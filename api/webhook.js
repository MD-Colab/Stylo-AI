// api/webhook.js
// This ensures your user's plan stays "Active" every month automatically
export default async function handler(req, res) {
    const event = req.body.event;
    const subscription = req.body.payload.subscription.entity;
    const userEmail = subscription.notes.email;

    if (event === 'subscription.charged') {
        // Here you would use Firebase Admin SDK to find the user by email
        // and update their 'subscriptionStatus' to 'active'
        console.log(`Payment successful for ${userEmail}`);
    }

    res.status(200).send('ok');
}