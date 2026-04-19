/**
 * /api/_utils.js
 *
 * Shared utilities for all Fuma DropShip serverless API functions.
 * Firebase Admin SDK initialisation + API key resolution.
 *
 * NOTE: signAliExpressRequest has been removed.
 *       Fuma DropShip no longer connects to AliExpress or CJ Dropshipping.
 *       All products are sourced from the Fuma DropShip Supplier network.
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore }                  = require('firebase-admin/firestore');

let db;

/**
 * Returns a singleton Firestore Admin instance.
 * Reads credentials from the FIREBASE_SERVICE_ACCOUNT_KEY environment variable.
 */
function getDb() {
    if (db) return db;

    if (getApps().length === 0) {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountKey) {
            throw new Error(
                'FIREBASE_SERVICE_ACCOUNT_KEY is missing from environment variables. ' +
                'Add it in your Vercel dashboard under Settings â†’ Environment Variables.'
            );
        }

        let serviceAccount;
        try {
            serviceAccount = JSON.parse(serviceAccountKey);
            // Vercel sometimes escapes newlines in multi-line env values
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }
        } catch(e) {
            throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ' + e.message);
        }

        initializeApp({ credential: cert(serviceAccount) });
    }

    db = getFirestore();
    return db;
}

/**
 * Resolves an API key by name.
 *
 * Priority:
 *  1. Environment variable  (e.g.  process.env.GEMINI_API_KEY)
 *  2. Firestore document    (settings/api_keys)
 *
 * @param {string} keyName  â€” the logical key name (case-insensitive)
 * @returns {string|null}
 */
async function getApiKey(keyName) {
    // 1. Check environment variable first (fastest, most secure)
    const envKey = process.env[keyName.toUpperCase()];
    if (envKey) return envKey;

    // 2. Fall back to Firestore settings document
    try {
        const firestore = getDb();
        const doc = await firestore.collection('settings').doc('api_keys').get();

        if (doc.exists) {
            const data = doc.data();

            // Canonical field name mapping
            const mapping = {
                'gemini':          'geminiApi',
                'razorpay_id':     'razorPay',
                'razorpay_secret': 'razorPaySecret',
                'netlify':         'netlifyToken',
                'cloudflare':      'cloudflareToken',
                'whatsapp':        'whatsappToken',
            };

            const fieldName = mapping[keyName.toLowerCase()] || keyName;
            if (data[fieldName]) return data[fieldName];
            if (data[keyName])   return data[keyName];
        }
    } catch(e) {
        console.error(`Error fetching API key "${keyName}" from Firestore:`, e);
    }

    return null;
}

module.exports = { getDb, getApiKey };
