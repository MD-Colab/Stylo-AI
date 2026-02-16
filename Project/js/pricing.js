// Project/js/pricing.js
import { db, auth } from './firebase-config.js'; 
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { notify, setLoading } from './ui.js';
import { PLANS } from './constants.js';

export async function initiatePayment(planType, btnElement) {
    const user = auth?.currentUser;
    if (!user) return notify("Please sign in to upgrade.", "error");

    const plan = PLANS[planType];
    if (!plan || planType === 'free') return;

    setLoading(btnElement, true, 'Connecting...');

    try {
        // 1. Fetch the Public Key from Firestore (settings/api_keys -> razorpayKeyId)
        const keyDoc = await getDoc(doc(db, "settings", "api_keys"));
        const razorpayPublicKey = keyDoc.exists() ? keyDoc.data().razorpayKeyId : null;

        if (!razorpayPublicKey) {
            throw new Error("Razorpay Public Key not found in database.");
        }

        // 2. Call your Vercel API to get the Subscription ID
        const response = await fetch('/api/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                planId: plan.razorpayPlanId, 
                customerEmail: user.email 
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        // 3. Open Razorpay Checkout
        const options = {
            "key": razorpayPublicKey.trim(), // FIXED: Now uses the real key from Firestore
            "subscription_id": data.subscriptionId,
            "name": "Stylo AI",
            "description": `Monthly ${plan.name} Plan`,
            "handler": async function (resp) {
                await updateUserPlan(user.uid, planType, resp.razorpay_subscription_id);
                notify("Success! Subscription active.", "success");
                window.location.reload();
            },
            "prefill": { 
                "name": user.displayName || "",
                "email": user.email 
            },
            "theme": { "color": "#4A47A3" }
        };

        const rzp = new Razorpay(options);
        rzp.open();
    } catch (err) {
        console.error(err);
        notify(err.message, "error");
    } finally {
        setLoading(btnElement, false);
    }
}

// Logic to cancel via Vercel API
export async function processCancellation(reason) {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const subId = userSnap.data()?.subscriptionId;

        if (!subId) throw new Error("No active subscription found.");

        const res = await fetch('/api/cancel-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: subId, reason: reason })
        });

        if (!res.ok) throw new Error("Server failed to cancel subscription.");

        await updateDoc(doc(db, "users", user.uid), {
            subscriptionStatus: 'cancelled',
            cancelReason: reason,
            cancelledAt: serverTimestamp()
        });

        return true;
    } catch (e) {
        console.error(e);
        notify(e.message, "error");
        return false;
    }
}

async function updateUserPlan(uid, planType, subId) {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
        plan: planType,
        subscriptionId: subId,
        subscriptionStatus: 'active',
        limits: PLAN_LIMITS[planType],
        planUpdatedAt: serverTimestamp()
    });
}