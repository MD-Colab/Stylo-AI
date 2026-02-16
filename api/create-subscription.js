const Razorpay = require('razorpay');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { planId, customerEmail } = req.body;

    // FIX: Accessing the KEY names you set in Vercel
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET 
    });

    try {
        const subscription = await razorpay.subscriptions.create({
            plan_id: planId,
            customer_notify: 1,
            total_count: 120,
            quantity: 1,
            notes: { email: customerEmail }
        });

        res.status(200).json({ subscriptionId: subscription.id });
    } catch (error) {
        console.error("Razorpay API Error:", error);
        res.status(500).json({ error: error.message });
    }
}