/**
 * /api/approve-linked-account.js
 *
 * Admin endpoint to approve and activate a Razorpay linked account for a user.
 *
 * UPDATED: Now writes to BOTH collections so both MD Invoice and Fuma DropShip work:
 *   - businesses/{uid}.meta.razorpayAccountId  â† Fuma DropShip reads this
 *   - invoice_settings/{uid}.linkedAccount      â† MD Invoice reads this
 *
 * Call this once per user after their Razorpay linked account is approved.
 *
 * POST /api/approve-linked-account
 * Headers: Authorization: Bearer YOUR_ADMIN_SECRET_KEY
 * Body: { targetUserId, razorpayAccountId }
 */

const { getDb } = require('./_utils');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET_KEY}`) {
        return res.status(403).json({ error: 'Unauthorized Admin Access' });
    }

    const { targetUserId, razorpayAccountId, role = 'both' } = req.body;
    // role: 'both' | 'dropshipper' | 'supplier' | 'invoice'

    if (!targetUserId || !razorpayAccountId) {
        return res.status(400).json({ error: 'targetUserId and razorpayAccountId are required.' });
    }

    const db  = getDb();
    const now = new Date().toISOString();

    try {
        const batch = db.batch();

        // â”€â”€ Write to businesses/{uid} (Fuma DropShip reads this) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (role === 'both' || role === 'dropshipper' || role === 'supplier') {
            const bizRef = db.collection('businesses').doc(targetUserId);
            batch.set(bizRef, {
                meta: {
                    razorpayAccountId,
                    razorpayAccountStatus: 'active',
                    razorpayLinkedAt: now,
                }
            }, { merge: true });
        }

        // â”€â”€ Write to invoice_settings/{uid} (MD Invoice reads this) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (role === 'both' || role === 'invoice') {
            const invRef = db.collection('invoice_settings').doc(targetUserId);
            batch.set(invRef, {
                linkedAccount: {
                    accountId:  razorpayAccountId,
                    status:     'active',
                    approvedAt: now,
                }
            }, { merge: true });
        }

        await batch.commit();

        return res.status(200).json({
            success: true,
            message: `Linked account activated for user ${targetUserId}.`,
            razorpayAccountId,
            updatedCollections: {
                businesses:      role === 'both' || role === 'dropshipper' || role === 'supplier',
                invoice_settings: role === 'both' || role === 'invoice',
            }
        });

    } catch(err) {
        console.error('approve-linked-account error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
