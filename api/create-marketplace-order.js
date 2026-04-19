/**
 * /api/create-marketplace-order.js
 *
 * Called when a customer completes checkout on a dropshipper store.
 * This is the central order creation + routing endpoint.
 *
 * Flow:
 *  1. Validate order payload
 *  2. Verify product stock
 *  3. Create store-side order in /orders
 *  4. Route to supplier (creates /supplier_orders doc)
 *  5. Record payment distribution in /payments
 *  6. Return order confirmation
 *
 * This uses the Admin SDK (getDb from _utils) so it can bypass
 * Firestore security rules — supplier_orders allow create: if false for clients.
 */

const { getDb } = require('./_utils');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const {
        storeId,
        ownerId,           // dropshipper's UID
        supplierProductId,
        supplierId,
        quantity = 1,
        customer,          // { name, phone, email, address, city, state, country, zip }
        paymentId,         // Razorpay payment ID after payment succeeds
        currency = 'INR',
    } = req.body;

    if (!storeId || !supplierProductId || !supplierId || !customer || !paymentId) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    const db = getDb();

    try {
        // ── 1. Load supplier product ──────────────────────────────────────
        const supplierProductDoc = await db.collection('supplier_products').doc(supplierProductId).get();
        if (!supplierProductDoc.exists) {
            return res.status(404).json({ error: 'Supplier product not found.' });
        }
        const supplierProduct = supplierProductDoc.data();

        if (supplierProduct.status !== 'active') {
            return res.status(400).json({ error: 'This product is no longer available.' });
        }
        if ((supplierProduct.stock || 0) < quantity) {
            return res.status(400).json({ error: `Only ${supplierProduct.stock} units available.` });
        }

        // ── 2. Load store_product for dropshipper's selling price ─────────
        const storeProductSnap = await db.collection('store_products')
            .where('storeId', '==', storeId)
            .where('supplierProductId', '==', supplierProductId)
            .limit(1).get();

        if (storeProductSnap.empty) {
            return res.status(404).json({ error: 'Product not found in this store.' });
        }
        const storeProduct = storeProductSnap.docs[0].data();

        const supplierCost    = storeProduct.supplierCost    || 0;
        const platformFee     = storeProduct.platformFee     || 0;
        const sellingPrice    = storeProduct.sellingPrice    || 0;
        const dropshipperEarnings = sellingPrice - supplierCost - platformFee;
        const totalAmount     = sellingPrice * quantity;

        // ── 3. Create store-side order ─────────────────────────────────────
        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

        const storeOrderRef = db.collection('orders').doc();
        await storeOrderRef.set({
            orderId,
            storeId,
            ownerId,
            source:            'md_supplier',
            supplierId,
            supplierProductId,
            supplierOrderId:   null,          // filled after supplier order creation

            // Product snapshot
            productName:    storeProduct.title      || supplierProduct.title,
            productImage:   storeProduct.images?.[0] || supplierProduct.images?.[0] || '',
            sku:            storeProduct.sku         || supplierProduct.sku          || '',
            quantity,

            // Customer
            customer,

            // Financials
            totalAmount,
            currency,
            supplierCost:    supplierCost * quantity,
            platformFee:     platformFee  * quantity,
            dropshipperEarnings: dropshipperEarnings * quantity,

            // Payment
            paymentId,
            paymentStatus:   'paid',

            // Status
            status:    'Paid',
            createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
            updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
        });

        // ── 4. Create supplier order ───────────────────────────────────────
        const supplierOrderRef = db.collection('supplier_orders').doc();
        await supplierOrderRef.set({
            supplierId,
            dropshipperId:     ownerId,
            storeId,
            storeOrderId:      storeOrderRef.id,

            supplierProductId,
            productName:    storeProduct.title      || supplierProduct.title,
            productImage:   storeProduct.images?.[0] || supplierProduct.images?.[0] || '',
            variant:        storeProduct.variants?.[0]?.name || '',
            quantity,
            sku:            storeProduct.sku || supplierProduct.sku || '',

            customer,

            baseCost:             supplierCost * quantity,
            platformFee:          platformFee  * quantity,
            dropshipperEarnings:  dropshipperEarnings * quantity,
            totalPaid:            totalAmount,

            status:    'Paid',
            createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
            updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
        });

        // ── 5. Update store order with supplier order reference ────────────
        await storeOrderRef.update({ supplierOrderId: supplierOrderRef.id });

        // ── 6. Create payment distribution record ──────────────────────────
        await db.collection('payments').add({
            storeOrderId:      storeOrderRef.id,
            supplierOrderId:   supplierOrderRef.id,
            supplierId,
            dropshipperId:     ownerId,

            totalAmount,
            supplierPayout:      supplierCost  * quantity,
            dropshipperEarnings: dropshipperEarnings * quantity,
            platformCommission:  platformFee   * quantity,

            currency,
            paymentId,
            status:    'pending',    // → 'released' when supplier marks as Shipped
            createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
        });

        // ── 7. Decrement stock ─────────────────────────────────────────────
        await db.collection('supplier_products').doc(supplierProductId).update({
            stock: require('firebase-admin').firestore.FieldValue.increment(-quantity),
            updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
        });

        // Sync new stock to all stores that imported this product
        const newStockDoc = await db.collection('supplier_products').doc(supplierProductId).get();
        const newStock = newStockDoc.data().stock || 0;

        const storeProductsSnap = await db.collection('store_products')
            .where('supplierProductId', '==', supplierProductId).get();

        if (!storeProductsSnap.empty) {
            const stockBatch = db.batch();
            storeProductsSnap.forEach(doc => {
                stockBatch.update(doc.ref, {
                    stock:  newStock,
                    status: newStock === 0 ? 'out_of_stock' : 'active',
                    updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
                });
            });
            await stockBatch.commit();
        }

        // ── 8. Notify supplier ─────────────────────────────────────────────
        await db.collection('notifications').add({
            userId:    supplierId,
            type:      'new_order',
            title:     'New Order Received',
            message:   `New order for "${storeProduct.title||supplierProduct.title}" × ${quantity}. Order #${orderId}`,
            orderId:   supplierOrderRef.id,
            read:      false,
            createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
            success:         true,
            orderId,
            storeOrderId:    storeOrderRef.id,
            supplierOrderId: supplierOrderRef.id,
            totalAmount,
        });

    } catch (err) {
        console.error('create-marketplace-order error:', err);
        return res.status(500).json({ error: err.message });
    }
}