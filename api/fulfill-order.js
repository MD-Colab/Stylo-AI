/**
 * /api/fulfill-order.js
 *
 * All orders in Fuma DropShip are fulfilled via the Fuma Supplier network.
 * CJ Dropshipping and AliExpress manual fulfillment have been removed.
 *
 * This endpoint is now used ONLY for supplier_orders that need a
 * manual status push (e.g. admin correcting a stuck order).
 *
 * For normal order flow:
 *   Customer pays â†’ /api/create-marketplace-order creates the supplier_order
 *   Supplier logs in â†’ ships via the Supplier Portal (DropShip_Supplier)
 *   Supplier status update â†’ syncs back to /orders automatically
 *
 * This endpoint handles edge cases:
 *   - Manually marking an order as Processing when it got stuck
 *   - Admin overrides
 */

const { getDb } = require('./_utils');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { orderId, action = 'process' } = req.body;

    if (!orderId) {
        return res.status(400).json({ error: 'orderId is required.' });
    }

    const db = getDb();

    try {
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        const order = orderDoc.data();

        // Verify this is an Fuma Supplier order
        if (order.source !== 'md_supplier') {
            return res.status(400).json({
                error: 'This order is not an Fuma Supplier order. Only Fuma Supplier orders are supported.'
            });
        }

        if (!order.supplierOrderId) {
            return res.status(400).json({
                error: 'No supplier order linked. The customer payment may not have been processed yet.'
            });
        }

        // Allowed manual actions
        const allowedTransitions = {
            process:  { from: 'Paid',        to: 'Processing' },
            complete: { from: 'Delivered',   to: 'Completed'  },
        };

        const transition = allowedTransitions[action];
        if (!transition) {
            return res.status(400).json({
                error: `Unknown action "${action}". Allowed: ${Object.keys(allowedTransitions).join(', ')}`
            });
        }

        if (order.status !== transition.from) {
            return res.status(400).json({
                error: `Order must be "${transition.from}" to perform this action. Current status: ${order.status}`
            });
        }

        const now = require('firebase-admin').firestore.FieldValue.serverTimestamp();

        // Update both the store order and supplier order atomically
        const batch = db.batch();
        batch.update(orderRef, { status: transition.to, updatedAt: now });
        batch.update(db.collection('supplier_orders').doc(order.supplierOrderId), {
            status: transition.to, updatedAt: now
        });
        await batch.commit();

        return res.status(200).json({
            success: true,
            orderId,
            previousStatus: transition.from,
            newStatus:      transition.to,
            message:        `Order moved from ${transition.from} â†’ ${transition.to}.`
        });

    } catch(err) {
        console.error('fulfill-order error:', err);
        return res.status(500).json({ error: err.message });
    }
}
