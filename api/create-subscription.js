// api/create-subscription.js
const Razorpay = require('razorpay');

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { planId, customerEmail } = req.body;

    // Use environment variables for security (Set these in Vercel Dashboard)
    const razorpay = new Razorpay({
        key_id: process.env.rzp_live_ROV9fWadVyjuJh,
        key_secret: process.env.u8AEm1l5M1RAiAMmvVwvz9hR 
    });

    try {
        const subscription = await razorpay.subscriptions.create({
            plan_id: planId, // e.g., plan_N6z... from Razorpay Dashboard
            customer_notify: 1,
            total_count: 120, // 10 years
            quantity: 1,
            notes: { email: customerEmail }
        });

        res.status(200).json({ subscriptionId: subscription.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}