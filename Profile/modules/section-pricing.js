// Adjusted imports: up two levels to Project/js
import { initiatePayment } from '../../Project/js/pricing.js';
// Adjusted imports: up one level to Profile root
import { state } from '../profile-state.js';
import { $ } from '../profile-utils.js';

export const initPricing = () => {
    ['startup', 'pro', 'prebiz', 'biz'].forEach(id => {
        const btn = $(`#btn-${id}`);
        if(btn) btn.addEventListener('click', () => initiatePayment(id === 'prebiz' ? 'prebusiness' : (id === 'biz' ? 'business' : id), btn));
    });
};

export const updatePricingUI = () => {
    const user = state.currentUser;
    
    // 🔥 More reliable detection
    let plan = 'free';

    if (user?.plan === 'business' || user?.isEarlyBird === true) {
        plan = 'business';
    } else if (user?.plan) {
        plan = user.plan;
    }

    const allIds = ['free', 'startup', 'pro', 'prebusiness', 'business'];
    
    const idMap = {
    free: null,
    startup: 'btn-startup',
    pro: 'btn-pro',
    prebusiness: 'btn-prebiz',
    business: 'btn-biz'
};

allIds.forEach(id => {

    const btn = id === 'free'
        ? document.querySelector('#card-free button')
        : document.getElementById(idMap[id]);

    if (!btn) return;

    if (id === plan) {
        btn.textContent = "Current Plan";
        btn.disabled = true;
        btn.className = "btn btn--secondary full-width";
    } else {
        btn.textContent = "Upgrade";
        btn.disabled = false;
        btn.className =
            id === 'pro' || id === 'startup'
                ? "btn btn--primary full-width"
                : "btn btn--secondary full-width";
    }
});

};