import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { auth, db } from './firebase-config.js';
import { s } from './state.js';
import { $ } from './utils.js';
import { notify, resetWorkspace, setLoading } from './ui.js';
import { loadTemplates, loadSharedProjects } from './templates.js';
import { handleRouteChange } from './main.js';
import { PRE_ASSIGNED_AVATARS } from './avatars.js';

// --- MD COLAB BRIDGE CONFIG ---
const mdColabConfig = {
    apiKey: "AIzaSyDQ097vz04Oj7QpHIZKNR9KVp5L0U03Fio",
    authDomain: "md-colab-63228.firebaseapp.com",
    projectId: "md-colab-63228",
    storageBucket: "md-colab-63228.firebasestorage.app",
    messagingSenderId: "568580723297",
    appId: "1:568580723297:web:1426515deda2d3d0a45020"
};
const mdApp = getApps().find(a => a.name === "mdColab") || initializeApp(mdColabConfig, "mdColab");
const mdDb = getFirestore(mdApp);

/**
 * STYLO AI - ECOSYSTEM SYNC
 * Autofills profile from MD Colab and fixes MD Colab DB status
 */
async function syncEcosystem(user, styloUserData) {
    try {
        console.log("Searching MD Colab DB for email:", user.email);
        const q = query(collection(mdDb, "users"), where("email", "==", user.email));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const mdDoc = snap.docs[0]; 
            const mdData = mdDoc.data();
            const mdInternalId = mdDoc.id;

            const isVerified = mdData.isVerified === true;
            const isConnected = mdData.connectedApps?.styloAI === true;

            if (isVerified || isConnected) {
                console.log("✅ MD Colab Identity Found. Syncing...");

                const mdPortfolioUrl = mdData.username ? `https://mdcolab.vercel.app/@${mdData.username}` : "";
                const fullName = (mdData.firstName + " " + (mdData.lastName || "")).trim();
                
                const autofillData = {
                    displayName: fullName || styloUserData.displayName,
                    bio: mdData.bio || styloUserData.bio || "",
                    position: mdData.role || "", 
                    location: mdData.address || "", 
                    photoURL: mdData.profilePhotoBase64 || styloUserData.photoURL || null,
                    website: mdPortfolioUrl,
                    plan: 'business', 
                    isElite: true,
                    linkedMDColab: true,
                    lastSync: new Date().toISOString()
                };

                // 1. Update Stylo AI DB
                await updateDoc(doc(db, "users", user.uid), autofillData);

                // 2. Update Local State
                Object.assign(s.user, autofillData);

                // 3. UI Update
                if($('user-email')) $('user-email').textContent = fullName;
                if($('user-avatar') && autofillData.photoURL) $('user-avatar').src = autofillData.photoURL;

                // 4. Reverse Fix: Update MD Colab DB if it says false
                if (!mdData.connectedApps?.styloAI) {
                    await updateDoc(doc(mdDb, "users", mdInternalId), {
                        "connectedApps.styloAI": true 
                    });
                }
                notify(`Elite Access Active! Sync complete.`, "success");
            }
        }
    } catch (e) { 
        console.error("Ecosystem Sync Error:", e); 
    }
}

/**
 * VERIFY & LINK VIA MD PIN (Overlay Logic)
 */
async function verifyAndLinkEcosystem() {
    const pinInput = document.getElementById('ecosystem-md-pin');
    const enteredPin = pinInput.value.trim();
    const btn = document.getElementById('verify-ecosystem-btn');

    if (enteredPin.length < 4) return notify("Please enter your MD Pin", "error");

    setLoading(btn, true, "Verifying...");

    try {
        const q = query(collection(mdDb, "users"), where("email", "==", s.user.email));
        const snap = await getDocs(q);

        if (snap.empty) throw new Error("No MD Colab account found for this email.");

        const mdDoc = snap.docs[0];
        const mdData = mdDoc.data();

        if (mdData.mdPin === enteredPin) {
            // Unlock UI first
            document.getElementById('ecosystem-lock-overlay').classList.add('hidden');
            document.getElementById('profile-view-wrapper').classList.remove('profile-blurred');
            
            // Run full sync
            await syncEcosystem(s.user, s.user);
            import('./ui.js').then(m => m.renderProfileSection());
            notify("Ecosystem Connected!", "success");
        } else {
            throw new Error("Invalid MD Pin. Try again.");
        }
    } catch (e) {
        notify(e.message, "error");
    } finally {
        setLoading(btn, false);
    }
}

/**
 * MAIN AUTH LISTENER
 */
export function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        const loginBtn = $('login-btn');
        const userInfo = $('user-info');
        
        if (loginBtn) loginBtn.classList.toggle('hidden', !!user);
        if (userInfo) userInfo.classList.toggle('hidden', !user);

        if (user) {
            try {
                // 1. Get/Create Stylo User
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);
                let userData;

                if (userSnap.exists()) {
                    userData = userSnap.data();
                } else {
                    userData = {
                        uid: user.uid, email: user.email,
                        displayName: user.displayName || 'New User',
                        photoURL: PRE_ASSIGNED_AVATARS[user.email] || user.photoURL || null,
                        bio: "Welcome to Stylo AI!",
                        plan: 'free', createdAt: serverTimestamp()
                    };
                    await setDoc(userRef, userData);
                }

                s.user = { ...user, ...userData };

                // 2. Handle Lock/Blur Overlay
                const lockOverlay = document.getElementById('ecosystem-lock-overlay');
                const viewWrapper = document.getElementById('profile-view-wrapper');

                if (userData.linkedMDColab) {
                    if(lockOverlay) lockOverlay.classList.add('hidden');
                    if(viewWrapper) viewWrapper.classList.remove('profile-blurred');
                    // Run sync to keep data updated
                    await syncEcosystem(user, userData);
                } else {
                    if(lockOverlay) {
                        lockOverlay.classList.remove('hidden');
                        document.getElementById('verify-ecosystem-btn').onclick = verifyAndLinkEcosystem;
                    }
                    if(viewWrapper) viewWrapper.classList.add('profile-blurred');
                }

                // 3. UI and Assets
                if ($('user-email')) $('user-email').textContent = s.user.displayName;
                if ($('user-avatar')) $('user-avatar').src = s.user.photoURL || '../assets/Images/logo1.png';

                const keyDoc = await getDoc(doc(db, "settings", "api_keys"));
                if (keyDoc.exists()) s.apiKey = keyDoc.data().geminiApiKey?.trim();

                await Promise.all([loadTemplates(), loadSharedProjects()]);
                
            } catch (e) { 
                console.error(e);
                notify("Auth initialization failed", "error"); 
            }
        } else {
            s.user = null;
            resetWorkspace();
        }
        handleRouteChange();
    });
}

export const handleSignIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const handleSignOut = () => signOut(auth).then(() => window.location.reload());

export const applyUIPermissions = (role) => {
    const isViewer = role === 'viewer';
    const ids = ['chat-input', 'send-chat-btn', 'generate-btn', 'save-btn', 'ai-persona-input'];
    ids.forEach(id => { if ($(id)) $(id).disabled = isViewer; });
};

export const renderCollaborators = (collaborators) => {
    const avatarContainer = $('collaborators-container');
    const listContainer = $('collaborators-list');
    
    if (!avatarContainer && !listContainer) return;

    const collaboratorsArray = Object.entries(collaborators || {});
    
    if (avatarContainer) {
        avatarContainer.innerHTML = collaboratorsArray.map(([uid, data]) => {
            const title = `${data.displayName || data.email} (${data.role})`;
            if (data.photoURL) {
                return `<img src="${data.photoURL}" alt="${data.displayName}" class="collaborator-avatar profile-trigger" data-uid="${uid}" title="${title}">`;
            } else {
                const initial = (data.displayName || data.email).charAt(0).toUpperCase();
                return `<div class="collaborator-avatar profile-trigger" data-uid="${uid}" title="${title}">${initial}</div>`;
            }
        }).join('');
    }

    if (listContainer) {
        const canManage = s.currentUserRole === 'owner';
        if (collaboratorsArray.length > 0) {
            listContainer.innerHTML = collaboratorsArray.map(([uid, data]) => `
                <div class="collaborator-item" data-uid="${uid}">
                    <div class="collaborator-item__info">
                        <strong>${data.displayName || 'User'}</strong>
                        <small>${data.email}</small>
                    </div>
                    <div class="collaborator-item__role">
                        ${s.currentProjectData?.userId === uid ? '<span>(Owner)</span>' : `<span class="role-tag role-${data.role}">${data.role}</span>`}
                    </div>
                    ${canManage && s.currentProjectData?.userId !== uid ? `<button class="collaborator-item__remove-btn" title="Remove">&times;</button>` : ''}
                </div>
            `).join('');
        } else {
            listContainer.innerHTML = '<p>No other collaborators.</p>';
        }
    }
};