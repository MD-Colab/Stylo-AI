/**
 * STYLO AI - PROFILE MAIN CONTROLLER
 * Handles Auth, Module Initialization, Routing, and Subscription Management.
 */

// --- IMPORTS ---
// Firebase & Core Project State
import { auth } from '../Project/js/firebase-config.js';
import { s } from '../Project/js/state.js';
import { 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";

// Profile Local State & Utils
import { state } from './profile-state.js';
import { $, $$ } from './profile-utils.js';
import { fetchOrCreateUserData, fetchUserProjectsAndImages } from './profile-data.js';

// Module-specific Logic
import { initProfileInfo, renderProfileSection } from './modules/section-info.js';
import { initImages, renderImagesSection } from './modules/section-images.js';
import { initDatabases, renderDatabasesSection } from './modules/section-databases.js';
import { initApiKeys, renderApiKeysSection } from './modules/section-api.js';
import { initAccountSettings } from './modules/section-account.js';
import { initPricing, updatePricingUI } from './modules/section-pricing.js';
import { initTeams, fetchAndRenderTeams } from './modules/section-teams.js';

// Payment/Subscription Logic
import { processCancellation } from '../Project/js/pricing.js';

// --- MAIN RENDERING ---

/**
 * Renders the dashboard UI components based on loaded user data.
 */
const renderDashboard = () => {
    if (!state.currentUser) return;

    // Trigger UI updates across sections
    renderProfileSection();
    renderApiKeysSection();
    renderImagesSection();
    renderDatabasesSection();
    updatePricingUI();
    setTimeout(() => {
        updatePricingUI();
    }, 100);

    
    // Manage Subscription Button Visibility
    const cancelBtn = $('#open-cancel-modal-btn');
    if (state.currentUser.plan && state.currentUser.plan !== 'free') {
        cancelBtn?.classList.remove('hidden');
    } else {
        cancelBtn?.classList.add('hidden');
    }
      import('./modules/section-account.js').then(m => {
        m.checkOfferStatus();
    });

};

/**
 * Initializes the user session, fetches data, and starts the UI.
 */
const initializeUserProfile = async (authUser) => {
    try {
        // Load detailed user data from Firestore
        state.currentUser = await fetchOrCreateUserData(authUser);
        
        // Sync with global project state
        s.user = state.currentUser;
        
        // Start Render
        renderDashboard();
        handleHashChange();

        // Background fetches for heavy data
        await fetchUserProjectsAndImages(); 
        await fetchAndRenderTeams();
        
    } catch (e) {
        console.error("Profile Initialization Error:", e);
    }
};

// --- GLOBAL LISTENERS & EVENT HANDLING ---

const setupGlobalListeners = () => {
    // 1. Navigation & Auth
    window.addEventListener('hashchange', handleHashChange);
    
    $('#login-btn')?.addEventListener('click', () => {
        signInWithPopup(auth, new GoogleAuthProvider());
    });
    
    $('#logout-btn')?.addEventListener('click', async () => { 
        await signOut(auth); 
        window.location.href = '../index.html'; 
    });

    // 2. Cancellation Modal Logic
    const cancelModal = $('#cancel-sub-modal');
    const confirmCancelBtn = $('#confirm-cancel-sub-btn');
    const cancelReasonInput = $('#cancel-reason-input');

    $('#open-cancel-modal-btn')?.addEventListener('click', () => {
        cancelModal.classList.remove('hidden');
    });

    confirmCancelBtn?.addEventListener('click', async () => {
        const reason = cancelReasonInput.value.trim();
        if (!reason) return alert("Please provide a reason for cancellation.");

        confirmCancelBtn.disabled = true;
        confirmCancelBtn.textContent = "Processing...";

        const success = await processCancellation(reason);
        
        if (success) {
            alert("Subscription cancelled. You will retain access until the end of the billing period.");
            cancelModal.classList.add('hidden');
            window.location.reload();
        } else {
            confirmCancelBtn.disabled = false;
            confirmCancelBtn.textContent = "Confirm Cancellation";
        }
    });

    // 3. Global Modal Close Logic (Backdrop and Close buttons)
    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.modal__close, #cancel-delete-btn, #close-notification-btn, .modal__overlay')) {
            e.target.closest('.modal')?.classList.add('hidden');
        }
    });

    // 4. Initialize Sub-Modules
    initProfileInfo();
    initImages();
    initDatabases();
    initApiKeys();
    initAccountSettings();
    initPricing();
    initTeams();
};

/**
 * Handles Tab Navigation based on URL Hash (e.g., #pricing)
 */
const handleHashChange = () => {
    const hash = window.location.hash || '#profile';
    const cleanHash = hash.split('?')[0]; 
    const targetId = `${cleanHash.substring(1)}-section`;
    
    // Update Sidebar Navigation active state
    $$('.profile-nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === cleanHash);
    });

    // Toggle Visibility of Content Sections
    $$('.content-section').forEach(section => {
        section.classList.toggle('active', section.id === targetId);
    });

    // Scroll back to top of the content area
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- AUTH WATCHER (ENTRY POINT) ---

onAuthStateChanged(auth, (user) => {
    const loginBtn = $('#login-btn');
    const userInfo = $('#user-info');

    // UI Auth State Toggle
    if (loginBtn) loginBtn.classList.toggle('hidden', !!user);
    if (userInfo) userInfo.classList.toggle('hidden', !user);

    if (user) {
        // User is logged in: Init app
        setupGlobalListeners();
        initializeUserProfile(user);
    } else {
        // User is logged out: Trigger sign-in popup flow
        import('../Project/js/signin.js')
            .then(() => {
                console.log("Sign-in module loaded for guest user.");
            })
            .catch(err => console.error("Failed to load sign-in module:", err));
    }
});