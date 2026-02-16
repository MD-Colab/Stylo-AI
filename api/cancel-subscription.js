// api/cancel-subscription.js
const Razorpay = require('razorpay');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { subscriptionId } = req.body;
    const razorpay = new Razorpay({
        key_id: process.env.rzp_live_ROV9fWadVyjuJh,
        key_secret: process.env.u8AEm1l5M1RAiAMmvVwvz9hR 
    });

    try {
        // Cancels at the end of the current billing cycle
        await razorpay.subscriptions.cancel(subscriptionId, false); 
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}