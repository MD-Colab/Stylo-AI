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

// --- MD COLAB ECOSYSTEM BRIDGE ---
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

const mdColabConfig = {
    apiKey: "AIzaSyDQ097vz04Oj7QpHIZKNR9KVp5L0U03Fio",
    authDomain: "md-colab-63228.firebaseapp.com",
    projectId: "md-colab-63228",
    storageBucket: "md-colab-63228.firebasestorage.app",
    messagingSenderId: "568580723297",
    appId: "1:568580723297:web:1426515deda2d3d0a45020"
};

// MD Colab App ko alag naam ("mdColab") se initialize karein
const mdApp = getApps().find(a => a.name === "mdColab") 
              ? getApps().find(a => a.name === "mdColab") 
              : initializeApp(mdColabConfig, "mdColab");
const mdDb = getFirestore(mdApp);

// --- MAIN LISTENER ---
onAuthStateChanged(auth, async (user) => {
    const loginBtn = $('#login-btn');
    const userInfo = $('#user-info');

    if (user) {
        // 1. UI Toggle
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userInfo) userInfo.classList.remove('hidden');

        // 2. Load Stylo AI Profile
        state.currentUser = await fetchOrCreateUserData(user);

        // 3. ECOSYSTEM CHECK (MD Colab Link)
        try {
            const mdDocRef = doc(mdDb, "users", user.uid);
            const mdDocSnap = await getDoc(mdDocRef);

            if (mdDocSnap.exists()) {
                const mdData = mdDocSnap.data();
                // Unlock Elite if Verified on MD Colab OR App is manually connected
                if (mdData.isVerified || mdData.connectedApps?.styloAI === true) {
                    state.currentUser.plan = 'business'; // Force Business Plan
                    state.currentUser.isElite = true;
                    console.log("🚀 Ecosystem Verified: Elite access granted.");
                }
            }
        } catch (err) {
            console.warn("Ecosystem check bypassed:", err.message);
        }

        // 4. Sync State & Init App
        s.user = state.currentUser;
        setupGlobalListeners();
        initializeUserProfile(user);

    } else {
        // 5. Logged Out State
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userInfo) userInfo.classList.add('hidden');

        // Load Sign-in Module
        import('../Project/js/signin.js').catch(err => console.error("Auth UI Error:", err));
    }
});
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
/**
 * Initializes the user session, fetches data, and starts the UI.
 */
const initializeUserProfile = async (authUser) => {
    try {
        // 1. Load Stylo AI user data
        state.currentUser = await fetchOrCreateUserData(authUser);
        
        // 2. CHECK MD COLAB ECOSYSTEM LINK
        try {
            const mdDocRef = doc(mdDb, "users", authUser.uid);
            const mdDocSnap = await getDoc(mdDocRef);
            
            if (mdDocSnap.exists()) {
                const mdData = mdDocSnap.data();
                
                // Agar user Verified hai ya usne Apps tab se Stylo AI connect kiya hai
                if (mdData.isVerified || mdData.connectedApps?.styloAI === true) {
                    console.log("🚀 MD Colab Ecosystem Link Verified!");
                    
                    // User ko Business Plan par force karein (Local State)
                    state.currentUser.plan = 'business';
                    state.currentUser.isElite = true; 
                    
                    // UI Notify
                    setTimeout(() => {
                        notify("MD Colab Ecosystem Active: Elite Features Unlocked!", "success");
                    }, 1000);
                }
            }
        } catch (linkError) {
            console.warn("Ecosystem link check failed:", linkError);
        }

        // 3. Sync with global project state
        s.user = state.currentUser;
        
        // 4. Start Render
        renderDashboard();
        handleHashChange();

        // 5. Background fetches
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
