/**
 * /api/payment-webhook.js
 *
 * DUAL PURPOSE:
 *   POST /api/payment-webhook  â€” Razorpay webhook (all payment + transfer events)
 *   GET  /api/payment-webhook  â€” One-time auto-setup (registers webhook on Razorpay)
 *
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * FULL ROUTE PAYMENT FLOW:
 *
 *   Customer pays â‚¹500
 *     â†“ Razorpay captures (payment.captured)
 *     â†“ Route auto-transfers:
 *         â†’ Supplier linked account   â‚¹300 immediately (transfer.processed)
 *         â†’ Dropshipper linked account â‚¹175 immediately (transfer.processed)
 *         â†’ Platform (you)            â‚¹25  stays in your account
 *     â†“ Webhook fires for each event â†’ Firestore updated in real time
 *
 * EVENTS HANDLED:
 *   payment.captured      â†’ order marked Paid, supplier_orders created, stock decremented
 *   payment.failed        â†’ order marked failed
 *   order.paid            â†’ backup for above + FUMA Invoice
 *   transfer.processed    â†’ payment doc updated: supplier/dropshipper transfer confirmed
 *   transfer.settled      â†’ FUMA Invoice Route payout settled
 *   transfer.failed       â†’ log which party's transfer failed, flag for manual payout
 *
 * AUTO-SETUP (run once after deploy):
 *   Visit: https://fumatechnologies.vercel.app/api/payment-webhook?setup=1&key=YOUR_ADMIN_SECRET_KEY
 *
 * âœ… FUMA Invoice â€” ALL original events preserved exactly
 * âœ… Fuma Business â€” not touched
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

const crypto    = require('crypto');
const { getDb } = require('./_utils');

const WEBHOOK_EVENTS = [
    'payment.captured',
    'payment.failed',
    'order.paid',
    'transfer.processed',   // â† Route: transfer sent to linked account
    'transfer.settled',     // â† Route: transfer settled in recipient's bank
    'transfer.failed',      // â† Route: transfer failed, needs manual payout
];

export default async function handler(req, res) {

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // GET â€” ONE-TIME AUTO SETUP
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (req.method === 'GET') {
        if (req.query.setup !== '1') {
            return res.status(200).json({ status: 'Fuma DropShip payment webhook active.' });
        }
        if (!process.env.ADMIN_SECRET_KEY || req.query.key !== process.env.ADMIN_SECRET_KEY) {
            return res.status(403).json({ error: 'Invalid admin key.' });
        }

        const keyId     = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) {
            return res.status(400).json({
                error: 'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Vercel env vars first.',
            });
        }

        const webhookUrl = `https://${req.headers.host}/api/payment-webhook`;
        const db         = getDb();

        try {
            const listRes  = await rzpApi('GET', '/v1/webhooks?count=50', keyId, keySecret);
            const existing = (listRes.items || []).find(w => w.url === webhookUrl && w.active);

            if (existing) {
                return res.status(200).json({
                    success: true, alreadyExists: true,
                    webhookId: existing.id, webhookUrl,
                    mode: keyId.startsWith('rzp_test_') ? 'TEST' : 'LIVE',
                    message: 'Webhook already configured.',
                });
            }

            const webhookSecret = crypto.randomBytes(32).toString('hex');
            const created = await rzpApi('POST', '/v1/webhooks', keyId, keySecret, {
                url:    webhookUrl,
                secret: webhookSecret,
                active: true,
                events: WEBHOOK_EVENTS.reduce((o, e) => ({ ...o, [e]: true }), {}),
            });

            if (!created.id) {
                return res.status(500).json({
                    error: 'Webhook creation failed.',
                    detail: created.error?.description || JSON.stringify(created),
                });
            }

            await db.collection('settings').doc('razorpay').set({
                webhookId: created.id, webhookUrl, webhookSecret,
                keyId, mode: keyId.startsWith('rzp_test_') ? 'test' : 'live',
                configuredAt: new Date().toISOString(),
                events: WEBHOOK_EVENTS,
            }, { merge: true });

            return res.status(200).json({
                success: true, webhookId: created.id, webhookUrl,
                mode: keyId.startsWith('rzp_test_') ? 'TEST' : 'LIVE',
                eventsEnabled: WEBHOOK_EVENTS,
                message: 'âœ… Done. Full Route payment flow is now automatic.',
            });
        } catch(err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // POST â€” RAZORPAY WEBHOOK
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing signature.' });

    // Resolve webhook secret: env var â†’ Firestore â†’ skip with warning
    let secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
        try {
            const doc = await getDb().collection('settings').doc('razorpay').get();
            if (doc.exists) secret = doc.data().webhookSecret;
        } catch(e) { /* ignore */ }
    }

    if (secret) {
        const expected = crypto.createHmac('sha256', secret)
            .update(JSON.stringify(req.body)).digest('hex');
        if (expected !== signature) {
            console.error('[Webhook] Signature mismatch');
            return res.status(400).json({ error: 'Invalid signature.' });
        }
    } else {
        console.warn('[Webhook] Secret not configured â€” run setup endpoint');
    }

    const event = req.body.event;
    const db    = getDb();
    const admin = require('firebase-admin');
    const now   = admin.firestore.FieldValue.serverTimestamp();
    console.log(`[Webhook] ${event}`);

    try {

        // â”€â”€ payment.captured â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Real money debit confirmed. Mark order Paid + create supplier_orders.
        // Route transfers fire automatically from Razorpay â€” we just track them.
        if (event === 'payment.captured') {
            const payment = req.body.payload.payment.entity;
            const notes   = payment.notes || {};

            if (notes.type === 'dropship') {
                const firestoreOrderId = notes.firestoreOrderId || notes.internalOrderId;
                if (!firestoreOrderId) {
                    return res.status(200).json({ status: 'ok', warning: 'No firestoreOrderId' });
                }

                const orderRef = db.collection('orders').doc(firestoreOrderId);
                const orderDoc = await orderRef.get();
                if (!orderDoc.exists) {
                    return res.status(200).json({ status: 'ok', warning: 'Order not found' });
                }

                const order = orderDoc.data();
                if (order.status === 'Paid' || order.paymentStatus === 'captured') {
                    return res.status(200).json({ status: 'ok', info: 'Already paid' });
                }

                await orderRef.update({
                    status:          'Paid',
                    paymentStatus:   'captured',
                    paymentId:       payment.id,
                    razorpayOrderId: payment.order_id,
                    amountPaid:      payment.amount / 100,
                    paidAt:          now,
                    updatedAt:       now,
                });
                console.log(`[Webhook] Order ${firestoreOrderId} â†’ Paid`);

                for (const item of (order.items || [])) {
                    if (!item.supplierId || !item.supplierProductId) continue;
                    try {
                        await processItem(db, admin, now, {
                            order, firestoreOrderId, item,
                            paymentId: payment.id,
                        });
                    } catch(e) {
                        console.error(`[Webhook] Item ${item.supplierProductId} failed:`, e.message);
                    }
                }
            }
        }

        // â”€â”€ order.paid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Backup for dropship. Primary for FUMA Invoice (unchanged).
        else if (event === 'order.paid') {
            const rzpOrder = req.body.payload.order.entity;
            const payment  = req.body.payload.payment.entity;
            const notes    = rzpOrder.notes || {};
            const type     = notes.type || 'invoice';

            if (type === 'dropship') {
                const firestoreOrderId = notes.firestoreOrderId || notes.internalOrderId;
                if (firestoreOrderId) {
                    const orderRef = db.collection('orders').doc(firestoreOrderId);
                    const orderDoc = await orderRef.get();
                    if (orderDoc.exists && orderDoc.data().status === 'Pending') {
                        await orderRef.update({
                            status: 'Paid', paymentStatus: 'captured',
                            paymentId: payment.id, razorpayOrderId: rzpOrder.id,
                            amountPaid: rzpOrder.amount_paid / 100,
                            paidAt: now, updatedAt: now,
                        });
                    }
                }
            }

            // FUMA Invoice (IDENTICAL TO ORIGINAL)
            else {
                const invoiceId = notes.invoiceId;
                if (invoiceId) {
                    const expectedSettlement = new Date();
                    expectedSettlement.setDate(expectedSettlement.getDate() + 3);
                    await db.collection('invoices').doc(invoiceId).update({
                        amountPaid:             rzpOrder.amount_paid / 100,
                        amountDue:              0,
                        status:                 'Processing',
                        razorpay_payment_id:    payment.id,
                        lastPaymentDate:        now,
                        expectedSettlementDate: expectedSettlement.toISOString(),
                    });
                    console.log(`[Webhook] Invoice ${invoiceId} â†’ Processing`);
                }
            }
        }

        // â”€â”€ payment.failed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        else if (event === 'payment.failed') {
            const payment = req.body.payload.payment.entity;
            const notes   = payment.notes || {};
            if (notes.type === 'dropship') {
                const id = notes.firestoreOrderId || notes.internalOrderId;
                if (id) {
                    await db.collection('orders').doc(id).update({
                        paymentStatus: 'failed',
                        paymentFailReason: payment.error_description || 'Payment failed',
                        updatedAt: now,
                    });
                }
            }
        }

        // â”€â”€ transfer.processed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Fires when Razorpay Route successfully sends money to a linked account.
        // Update the payments doc to mark that party as paid.
        else if (event === 'transfer.processed') {
            const transfer = req.body.payload.transfer.entity;
            const notes    = transfer.notes || {};

            if (notes.type === 'dropship_supplier' || notes.type === 'dropship_earnings') {
                // Find the payments doc for this order
                const paySnap = await db.collection('payments')
                    .where('storeOrderId', '==', transfer.source)
                    .limit(1).get();

                if (!paySnap.empty) {
                    const updateData = { updatedAt: now };
                    if (notes.type === 'dropship_supplier') {
                        updateData.supplierTransferStatus  = 'processed';
                        updateData.supplierTransferId      = transfer.id;
                        updateData.supplierTransferredAt   = now;
                    } else {
                        updateData.dropshipperTransferStatus = 'processed';
                        updateData.dropshipperTransferId     = transfer.id;
                        updateData.dropshipperTransferredAt  = now;
                    }
                    await paySnap.docs[0].ref.update(updateData);
                }

                // Check if both transfers done â†’ mark payments as fully distributed
                if (!paySnap.empty) {
                    const payData = paySnap.docs[0].data();
                    const supplierDone    = notes.type === 'dropship_supplier'    || payData.supplierTransferStatus    === 'processed';
                    const dropshipperDone = notes.type === 'dropship_earnings'    || payData.dropshipperTransferStatus === 'processed';
                    if (supplierDone && dropshipperDone) {
                        await paySnap.docs[0].ref.update({ status: 'distributed', updatedAt: now });
                    }
                }

                console.log(`[Webhook] Transfer ${transfer.id} processed â†’ ${notes.type}`);
            }

            // FUMA Invoice transfer processed
            else if (notes.type === 'invoice' && notes.invoiceId) {
                await db.collection('invoices').doc(notes.invoiceId).update({
                    status: 'Settled', settledAt: now,
                });
            }
        }

        // â”€â”€ transfer.settled (FUMA Invoice â€” IDENTICAL TO ORIGINAL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        else if (event === 'transfer.settled') {
            const transfer = req.body.payload.transfer.entity;
            const notes    = transfer.notes || {};

            if (notes.type === 'dropship_supplier' || notes.type === 'dropship_earnings') {
                // Route transfer settled in recipient's bank â€” update payments doc
                const paySnap = await db.collection('payments')
                    .where('storeOrderId', '==', transfer.source)
                    .limit(1).get();
                if (!paySnap.empty) {
                    const field = notes.type === 'dropship_supplier'
                        ? 'supplierSettledAt' : 'dropshipperSettledAt';
                    await paySnap.docs[0].ref.update({ [field]: now, updatedAt: now });
                }
            } else if (notes.type === 'invoice' && notes.invoiceId) {
                // FUMA Invoice (ORIGINAL)
                await db.collection('invoices').doc(notes.invoiceId).update({
                    status: 'Settled', settledAt: now,
                });
                console.log(`[Webhook] Invoice ${notes.invoiceId} â†’ Settled`);
            }
        }

        // â”€â”€ transfer.failed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Route transfer failed â€” flag the party for manual payout.
        else if (event === 'transfer.failed') {
            const transfer = req.body.payload.transfer.entity;
            const notes    = transfer.notes || {};

            if (notes.type === 'dropship_supplier' || notes.type === 'dropship_earnings') {
                const paySnap = await db.collection('payments')
                    .where('storeOrderId', '==', transfer.source)
                    .limit(1).get();
                if (!paySnap.empty) {
                    const field = notes.type === 'dropship_supplier'
                        ? 'supplierTransferStatus' : 'dropshipperTransferStatus';
                    await paySnap.docs[0].ref.update({
                        [field]: 'failed',
                        [`${field}Reason`]: transfer.error_description || 'Transfer failed',
                        needsManualPayout: true,
                        updatedAt: now,
                    });
                }
                console.error(`[Webhook] Transfer failed for ${notes.type} â€” manual payout needed`);

                // Notify admin
                await db.collection('notifications').add({
                    userId:    'admin',
                    type:      'transfer_failed',
                    title:     'Route Transfer Failed',
                    message:   `${notes.type} transfer failed for order ${transfer.source}. Manual payout needed.`,
                    transferId: transfer.id,
                    amount:    transfer.amount / 100,
                    read:      false,
                    createdAt: now,
                });
            } else if (notes.type === 'invoice' && notes.invoiceId) {
                // FUMA Invoice (ORIGINAL)
                await db.collection('invoices').doc(notes.invoiceId).update({
                    status: 'Transfer Failed', updatedAt: now,
                });
            }
        }

        return res.status(200).json({ status: 'ok', event });

    } catch(err) {
        console.error('[Webhook] Error:', err.message);
        return res.status(200).json({ status: 'error', message: err.message });
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// processItem â€” creates supplier_orders + payments doc + decrements stock
// Called after payment.captured for each cart item
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function processItem(db, admin, now, { order, firestoreOrderId, item, paymentId }) {

    // Idempotency
    const existing = await db.collection('supplier_orders')
        .where('storeOrderId',      '==', firestoreOrderId)
        .where('supplierProductId', '==', item.supplierProductId)
        .limit(1).get();
    if (!existing.empty) return;

    const qty   = item.quantity     || 1;
    const cost  = item.supplierCost || 0;
    const fee   = item.platformFee  || 0;
    const price = item.sellingPrice || 0;
    const profit = item.profit      || parseFloat(((price - cost - fee) * qty).toFixed(2));

    // Create supplier_orders doc
    const soRef = db.collection('supplier_orders').doc();
    await soRef.set({
        supplierId:        item.supplierId,
        dropshipperId:     order.ownerId,
        storeId:           order.storeId,
        storeOrderId:      firestoreOrderId,
        supplierProductId: item.supplierProductId,
        productName:       item.title    || '',
        productImage:      item.image    || '',
        sku:               item.sku      || '',
        quantity:          qty,
        customer:          order.customer,
        baseCost:          cost  * qty,
        platformFee:       fee   * qty,
        dropshipperEarnings: profit,
        totalPaid:         price * qty,
        paymentId,
        status:    'Paid',
        createdAt: now,
        updatedAt: now,
    });

    // Back-link
    await db.collection('orders').doc(firestoreOrderId).update({
        supplierOrderId: soRef.id, updatedAt: now,
    });

    // payments distribution doc â€” tracks Route transfer status per party
    await db.collection('payments').add({
        storeOrderId:    firestoreOrderId,
        supplierOrderId: soRef.id,
        supplierId:      item.supplierId,
        dropshipperId:   order.ownerId,

        // â‚¹ amounts
        totalAmount:          price * qty,
        supplierPayout:       cost  * qty,
        dropshipperEarnings:  profit,
        platformCommission:   fee   * qty,

        // Route transfer status (updated by transfer.processed / transfer.failed)
        supplierTransferStatus:    item.supplierAccountId ? 'pending'  : 'no_account',
        dropshipperTransferStatus: order.routeTransfers?.dropshipperTransferCreated ? 'pending' : 'no_account',

        currency:   order.currency || 'INR',
        paymentId,
        status:     'pending',
        createdAt:  now,
    });

    // Decrement stock
    await db.collection('supplier_products').doc(item.supplierProductId).update({
        stock: admin.firestore.FieldValue.increment(-qty), updatedAt: now,
    });

    // Sync stock to all store_products
    const updated  = await db.collection('supplier_products').doc(item.supplierProductId).get();
    const newStock = updated.exists ? (updated.data().stock || 0) : 0;

    const storeProds = await db.collection('store_products')
        .where('supplierProductId', '==', item.supplierProductId).get();

    if (!storeProds.empty) {
        const batch = db.batch();
        storeProds.forEach(doc => batch.update(doc.ref, {
            stock: newStock, status: newStock === 0 ? 'out_of_stock' : 'active', updatedAt: now,
        }));
        await batch.commit();
    }

    // Notify supplier
    await db.collection('notifications').add({
        userId:    item.supplierId,
        type:      'new_order',
        title:     'New Order Received',
        message:   `New order: "${item.title}" Ã— ${qty}`,
        orderId:   soRef.id,
        read:      false,
        createdAt: now,
    });

    console.log(`[Webhook] Supplier order ${soRef.id} created. Stock: ${newStock}`);
}

// Razorpay REST API helper
async function rzpApi(method, path, keyId, keySecret, body) {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const opts = {
        method,
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`https://api.razorpay.com${path}`, opts);
    return r.json();
}

