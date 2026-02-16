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
    const plan = state.currentUser.plan || 'free';
    const allIds = ['free', 'startup', 'pro', 'prebusiness', 'business'];
    
    allIds.forEach(id => {
        const btnId = id === 'free' ? '#card-free button' : `#btn-${id === 'prebusiness' ? 'prebiz' : id}`; 
        const btn = document.querySelector(btnId);
        if (btn) {
            if (id === plan) {
                btn.textContent = "Current Plan";
                btn.disabled = true;
                btn.className = "btn btn--secondary full-width";
            } else {
                btn.textContent = "Upgrade"; 
                btn.disabled = false;
                if (id !== 'free') btn.className = id === 'pro' || id === 'startup' ? "btn btn--primary full-width" : "btn btn--secondary full-width";
            }
        }
    });
};