/**
 * STYLO AI - ACCOUNT SETTINGS & PROMOTION MODULE
 * Securely handles account deletion and the Early Bird Free Elite Access offer.
 */

// --- IMPORTS ---
import { auth, db } from '../../Project/js/firebase-config.js';
import { deleteUser } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    increment, 
    runTransaction, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

// Local Utilities & State
import { $, toggleModal, notify, setLoading } from '../profile-utils.js';
import { state } from '../profile-state.js';
import { PLANS } from '../../Project/js/constants.js';

/**
 * Entry point for Account Tab listeners.
 */
export const initAccountSettings = () => {
    // 1. Initialize Account Deletion Logic
    const confirmDeleteBtn = $('#confirm-delete-btn');
    const deleteInput = $('#delete-confirm-input');

    $('#delete-account-btn')?.addEventListener('click', () => {
        toggleModal('delete-account-modal', true);
        if (deleteInput) deleteInput.value = '';
        if (confirmDeleteBtn) confirmDeleteBtn.disabled = true;
    });

    deleteInput?.addEventListener('input', (e) => {
        if (confirmDeleteBtn) confirmDeleteBtn.disabled = (e.target.value !== 'delete my account');
    });

    confirmDeleteBtn?.addEventListener('click', handleAccountDeletion);

    // 2. Initialize Early Bird Offer Logic
    checkOfferStatus();
    $('#claim-offer-btn')?.addEventListener('click', handleClaimOffer);
};

// --- SECTION 1: ACCOUNT DELETION ---

async function handleAccountDeletion() {
    const btn = $('#confirm-delete-btn');
    setLoading(btn, true, 'Deleting...');
    try {
        if (!auth.currentUser) return;
        await deleteUser(auth.currentUser);
        window.location.href = '../index.html';
    } catch (error) {
        console.error(error);
        notify(error.message, 'error');
        setLoading(btn, false);
    }
}

// --- SECTION 2: EARLY BIRD OFFER (PROMOTION) ---

/**
 * Checks if the user is already an Elite member or if slots are full.
 * Dynamically replaces the Form with a Reward Card.
 */
export async function checkOfferStatus() {
    const user = state.currentUser; 
    const slotsLabel = $('#offer-slots-left');
    const formContainer = $('#offer-form-container');
    const claimedContainer = $('#offer-claimed-container');
    const offerCard = $('#offer-card');

    if (!offerCard) return;

    // 1. LOGIC: If user already has Business plan or is an Early Bird
    // Based on your screenshot path: users/{uid}/isEarlyBird
    if (user && (user.plan === 'business' || user.isEarlyBird === true)) {
        if (formContainer) formContainer.classList.add('hidden');
        if (claimedContainer) claimedContainer.classList.remove('hidden');
        if (slotsLabel) {
            slotsLabel.textContent = "Status: Elite Active";
            slotsLabel.style.background = "linear-gradient(135deg, #22c55e, #16a34a)";
        }
        return; // User is already upgraded, stop further checks
    }

    // 2. LOGIC: Fetch global slots from settings/offers
    try {
        const offerRef = doc(db, "settings", "offers");
        const offerSnap = await getDoc(offerRef);

        if (offerSnap.exists()) {
            const { claimedCount, maxSlots } = offerSnap.data();
            const available = maxSlots - claimedCount;

            // Update Label: e.g., "Available: 19 / 20"
            if (slotsLabel) {
                slotsLabel.textContent = available <= 0 ? "Sold Out" : `Available: ${available} / ${maxSlots}`;
                if (available <= 0) slotsLabel.style.background = "#ef4444";
            }

            // If sold out, hide the form and show a message
            if (available <= 0 && formContainer) {
                formContainer.innerHTML = `
                    <div style="text-align:center; padding: 20px;">
                        <p style="color:var(--danger-color); font-weight:600;">
                           The Early Bird promotion has ended. All spots are claimed!
                        </p>
                    </div>`;
            }
        }
    } catch (e) {
        console.error("Database Path Error (check settings/offers):", e);
    }
}

/**
 * Claims the offer using a Transaction to ensure the 20-user limit is absolute.
 */
async function handleClaimOffer() {
    const title = $('#offer-title-input')?.value.trim();
    if (!title) return notify("Please enter your professional title.", "error");

    const btn = $('#claim-offer-btn');
    setLoading(btn, true, 'Verifying...');

    try {
        // Pathing Verified: settings/offers
        const offerRef = doc(db, "settings", "offers");
        const userRef = doc(db, "users", state.currentUser.uid);

        await runTransaction(db, async (transaction) => {
            const offerDoc = await transaction.get(offerRef);
            if (!offerDoc.exists()) throw "Offer configuration missing in database.";

            const { claimedCount, maxSlots } = offerDoc.data();
            if (claimedCount >= maxSlots) throw "Offer just expired! No spots left.";

            // 1. Increment Global Counter
            transaction.update(offerRef, { claimedCount: increment(1) });

            // 2. Upgrade User to Business Plan with Unlimited Limits
            transaction.update(userRef, {
                plan: 'business',
                subscriptionStatus: 'active',
                isEarlyBird: true,
                position: title,
                // Nested pathing: PLANS.business.limits (from constants.js)
                limits: PLANS.business.limits, 
                planUpdatedAt: serverTimestamp()
            });
            // 🔥 Immediately update local state
            state.currentUser.plan = 'business';
            state.currentUser.isEarlyBird = true;
            
            // Re-render Pricing + Offer UI
            import('../modules/section-pricing.js').then(m => {
                m.updatePricingUI();
            });
            
            checkOfferStatus();
        });

        notify("Congratulations! Access Unlocked.", "success");

    } catch (error) {
        console.error("Claim Error:", error);
        const errorMsg = typeof error === 'string' ? error : "Failed to claim. Try again later.";
        notify(errorMsg, "error");
    } finally {
        setLoading(btn, false);
    }
}