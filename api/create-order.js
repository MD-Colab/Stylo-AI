/**
 * /api/create-order.js
 *
 * BRANCH A — Fuma DropShip customer checkout with FULL RAZORPAY ROUTE
 *
 * HOW ROUTE WORKS HERE:
 * When the Razorpay order is created, it contains a `transfers` array that
 * instructs Razorpay to automatically split the captured payment into 3 parts:
 *
 *   Customer pays ₹500
 *     → Supplier linked account    receives ₹300  (supplierCost)       on_hold: false
 *     → Dropshipper linked account receives ₹175  (dropshipperEarnings) on_hold: false
 *     → Platform (you)             keeps   ₹25    (platformFee – stays in your account)
 *
 * All 3 transfers happen automatically the moment Razorpay captures the payment.
 * No manual payouts, no cron jobs, no dashboard intervention needed.
 *
 * LINKED ACCOUNT RESOLUTION:
 *   Supplier:    businesses/{supplierId}.meta.razorpayAccountId
 *   Dropshipper: businesses/{ownerId}.meta.razorpayAccountId
 *   Platform:    stays in your main Razorpay account (no transfer needed)
 *
 * If a linked account is missing/pending, that party's transfer is skipped
 * and their amount stays in your account for manual payout — order still goes through.
 *
 * BRANCH B — FUMA Invoice (updated)
 *   • Handles missing linkedAccount gracefully (direct payment, no Route transfer)
 *   • Sets invoice status to 'Processing' when order is created
 *   • Returns razorpayKeyId stored in invoice_settings (fallback to env)
 *
 * ✅ Fuma Business — NOT affected
 */

const Razorpay  = require('razorpay');
const { getDb } = require('./_utils');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const db = getDb();

    try {

        // ══════════════════════════════════════════════════════════════════════
        // BRANCH A — MD DROPSHIP CUSTOMER CHECKOUT WITH FULL ROUTE
        // ══════════════════════════════════════════════════════════════════════
        if (req.body.cart && Array.isArray(req.body.cart)) {
            const { cart, storeId, customer } = req.body;

            if (!cart.length)      throw new Error('Cart cannot be empty.');
            if (!storeId)          throw new Error('storeId is required.');
            if (!customer?.name)   throw new Error('Customer name is required.');
            if (!customer?.email)  throw new Error('Customer email is required.');

            const keyId     = process.env.RAZORPAY_KEY_ID;
            const keySecret = process.env.RAZORPAY_KEY_SECRET;
            if (!keyId || !keySecret) {
                throw new Error(
                    'Razorpay credentials not configured. ' +
                    'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Vercel environment variables.'
                );
            }

            // Load store
            const storeDoc = await db.collection('stores').doc(storeId).get();
            if (!storeDoc.exists) throw new Error('Store not found.');
            const store    = storeDoc.data();
            const currency = store.currency || 'INR';

            // Load dropshipper's linked account
            const dropshipperBizDoc = await db.collection('businesses').doc(store.ownerId).get();
            const dropshipperAccountId = dropshipperBizDoc.exists
                && dropshipperBizDoc.data().meta?.razorpayAccountId !== 'Pending'
                    ? dropshipperBizDoc.data().meta?.razorpayAccountId
                    : null;

            // Validate + price each cart item
            let totalSellingPrice = 0;
            let totalSupplierCost = 0;
            let totalPlatformFee  = 0;
            const validatedItems  = [];

            for (const cartItem of cart) {
                const spDoc = await db.collection('store_products').doc(cartItem.id).get();
                if (!spDoc.exists) throw new Error(`Product "${cartItem.id}" not found.`);
                const sp = spDoc.data();

                if (sp.storeId !== storeId) throw new Error(`Product "${sp.title}" not in this store.`);
                if ((sp.stock || 0) < (cartItem.quantity || 1)) {
                    throw new Error(`"${sp.title}" only has ${sp.stock} units in stock.`);
                }

                const qty   = cartItem.quantity || 1;
                const price = sp.sellingPrice   || 0;
                const cost  = sp.supplierCost   || 0;
                const fee   = sp.platformFee    || parseFloat((cost * 0.05).toFixed(2));

                totalSellingPrice += price * qty;
                totalSupplierCost += cost  * qty;
                totalPlatformFee  += fee   * qty;

                // Load supplier's linked account per item
                const supplierBizDoc = await db.collection('businesses').doc(sp.supplierId || '').get();
                const supplierAccountId = supplierBizDoc.exists
                    && supplierBizDoc.data().meta?.razorpayAccountId !== 'Pending'
                        ? supplierBizDoc.data().meta?.razorpayAccountId
                        : null;

                validatedItems.push({
                    storeProductId:    cartItem.id,
                    supplierProductId: sp.supplierProductId || '',
                    supplierId:        sp.supplierId        || '',
                    supplierName:      sp.supplierName      || '',
                    supplierAccountId,
                    title:             sp.title,
                    image:             sp.images?.[0]       || '',
                    quantity:          qty,
                    sellingPrice:      price,
                    supplierCost:      cost,
                    platformFee:       fee,
                    profit:            parseFloat(((price - cost - fee) * qty).toFixed(2)),
                    category:          sp.category          || '',
                    sku:               sp.sku               || '',
                });
            }

            const amountInPaise         = Math.round(totalSellingPrice * 100);
            const supplierAmountPaise    = Math.round(totalSupplierCost * 100);
            const dropshipperAmountPaise = Math.round(
                (totalSellingPrice - totalSupplierCost - totalPlatformFee) * 100
            );

            if (amountInPaise < 100) throw new Error('Order amount must be at least ₹1.');

            const transfers = [];

            const supplierGroups = {};
            for (const item of validatedItems) {
                if (!item.supplierAccountId) continue;
                if (!supplierGroups[item.supplierId]) {
                    supplierGroups[item.supplierId] = {
                        accountId: item.supplierAccountId,
                        amount:    0,
                    };
                }
                supplierGroups[item.supplierId].amount += Math.round(item.supplierCost * item.quantity * 100);
            }

            for (const [supplierId, group] of Object.entries(supplierGroups)) {
                if (group.amount > 0) {
                    transfers.push({
                        account:  group.accountId,
                        amount:   group.amount,
                        currency,
                        notes: {
                            type:      'dropship_supplier',
                            supplierId,
                            storeId,
                            ownerId:   store.ownerId,
                        },
                        on_hold: false,
                    });
                }
            }

            if (dropshipperAccountId && dropshipperAmountPaise > 0) {
                transfers.push({
                    account:  dropshipperAccountId,
                    amount:   dropshipperAmountPaise,
                    currency,
                    notes: {
                        type:      'dropship_earnings',
                        storeId,
                        ownerId:   store.ownerId,
                    },
                    on_hold: false,
                });
            }

            const admin           = require('firebase-admin');
            const now             = admin.firestore.FieldValue.serverTimestamp();
            const internalOrderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
            const orderRef        = db.collection('orders').doc();

            await orderRef.set({
                orderId:   internalOrderId,
                storeId,
                ownerId:   store.ownerId,
                source:    'md_supplier',
                items:     validatedItems,
                productName:       validatedItems[0]?.title             || '',
                productImage:      validatedItems[0]?.image             || '',
                supplierId:        validatedItems[0]?.supplierId        || '',
                supplierProductId: validatedItems[0]?.supplierProductId || '',
                quantity:          validatedItems[0]?.quantity          || 1,
                sku:               validatedItems[0]?.sku               || '',
                customer,
                totalAmount:         totalSellingPrice,
                supplierCost:        totalSupplierCost,
                platformFee:         totalPlatformFee,
                dropshipperEarnings: parseFloat(
                    (totalSellingPrice - totalSupplierCost - totalPlatformFee).toFixed(2)
                ),
                currency,
                routeTransfers: {
                    supplierTransferCreated:    Object.keys(supplierGroups).length > 0,
                    dropshipperTransferCreated: !!dropshipperAccountId,
                    supplierAccountMissing:     Object.keys(supplierGroups).length === 0,
                    dropshipperAccountMissing:  !dropshipperAccountId,
                },
                status:        'Pending',
                paymentStatus: 'pending',
                createdAt:     now,
                updatedAt:     now,
            });

            const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });

            const rzpOrderPayload = {
                amount:          amountInPaise,
                currency,
                payment_capture: 1,
                receipt:         internalOrderId.slice(0, 40),
                notes: {
                    type:             'dropship',
                    firestoreOrderId: orderRef.id,
                    internalOrderId,
                    storeId,
                    ownerId:          store.ownerId,
                },
            };

            if (transfers.length > 0) {
                rzpOrderPayload.transfers = transfers;
            }

            const rzpOrder = await instance.orders.create(rzpOrderPayload);

            return res.status(200).json({
                rzpOrderId:       rzpOrder.id,
                amount:           rzpOrder.amount,
                keyId,
                currency,
                firestoreOrderId: orderRef.id,
                transfersQueued:  transfers.length,
                warnings: [
                    ...Object.keys(supplierGroups).length === 0
                        ? ['Supplier has no linked Razorpay account – their payout will be manual'] : [],
                    ...!dropshipperAccountId
                        ? ['Dropshipper has no linked Razorpay account – their payout will be manual'] : [],
                ],
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // BRANCH B — FUMA INVOICE CLIENT PAYMENT
        // Updated: handles missing linkedAccount, supports direct payment fallback
        // ══════════════════════════════════════════════════════════════════════
        if (req.body.invoiceId) {
            const { invoiceId } = req.body;

            const invoiceRef = db.collection('invoices').doc(invoiceId);
            const invoiceDoc = await invoiceRef.get();
            if (!invoiceDoc.exists) throw new Error('Invoice not found.');
            const invoice = invoiceDoc.data();

            // Block already-paid invoices
            if (['Paid', 'Settled', 'Processing'].includes(invoice.status)) {
                throw new Error('This invoice is already paid or processing.');
            }

            const amountDue   = parseFloat(invoice.amountDue || invoice.total || 0);
            const amountInPaise = Math.round(amountDue * 100);
            if (amountInPaise < 100) throw new Error('Invoice amount must be at least ₹1.');

            const currency  = invoice.currency || 'INR';
            const keyId     = process.env.RAZORPAY_KEY_ID;
            const keySecret = process.env.RAZORPAY_KEY_SECRET;

            if (!keyId || !keySecret) {
                throw new Error('Razorpay credentials not configured on server.');
            }

            const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });

            // ── Try to fetch linked account for Route transfer ──────────────
            let linkedAccountId = null;
            try {
                const settingsDoc = await db.collection('invoice_settings').doc(invoice.ownerId).get();
                if (settingsDoc.exists) {
                    const sData = settingsDoc.data();
                    // Accept active linked accounts only
                    if (sData.linkedAccount?.status === 'active' && sData.linkedAccount?.accountId) {
                        linkedAccountId = sData.linkedAccount.accountId;
                    }
                    // Also persist the public key if stored in settings
                    // (so pay/script.js fallback can read it)
                }
            } catch (e) {
                console.warn('invoice_settings fetch error (non-fatal):', e.message);
            }

            // ── Build Razorpay order ────────────────────────────────────────
            const orderPayload = {
                amount:          amountInPaise,
                currency,
                receipt:         `rcpt_${(invoice.number || invoiceId).slice(0, 38)}`,
                payment_capture: 1,
                notes: {
                    type:      'invoice',
                    invoiceId,
                    ownerId:   invoice.ownerId,
                },
            };

            // Only add Route transfer if linked account is configured
            if (linkedAccountId) {
                orderPayload.transfers = [{
                    account:  linkedAccountId,
                    amount:   amountInPaise,
                    currency,
                    notes: { type: 'invoice', invoiceId, ownerId: invoice.ownerId },
                    on_hold:  false,
                }];
            }
            // If no linked account: payment still goes through to your main account.
            // You can payout manually from Razorpay dashboard.

            const order = await instance.orders.create(orderPayload);

            // Mark invoice as 'Processing' while payment is in flight
            try {
                await invoiceRef.update({
                    status:         'Processing',
                    razorpayOrderId: order.id,
                    updatedAt:      require('firebase-admin').firestore.FieldValue.serverTimestamp(),
                });
            } catch (e) {
                console.warn('Could not set invoice to Processing:', e.message);
            }

            return res.status(200).json({
                id:     order.id,
                amount: order.amount,
                keyId,
                currency,
                hasLinkedAccount: !!linkedAccountId,
            });
        }

        return res.status(400).json({ error: 'Invalid request format.' });

    } catch(err) {
        console.error('create-order error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}