import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { auth, db } from './firebase-config.js';
import { s } from './state.js';
import { $ } from './utils.js';
import { notify, resetWorkspace } from './ui.js';
import { loadTemplates, loadSharedProjects } from './templates.js';
import { handleRouteChange } from './main.js';
import { PRE_ASSIGNED_AVATARS } from './avatars.js';

export function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        // Safe UI toggling
        const loginBtn = $('login-btn');
        const userInfo = $('user-info');
        if (loginBtn) loginBtn.classList.toggle('hidden', !!user);
        if (userInfo) userInfo.classList.toggle('hidden', !user);

        const chatInput = $('chat-input');
        if (chatInput) chatInput.disabled = true;
        
        const genBtn = $('generate-btn');
        if (genBtn) genBtn.disabled = true;
        
        const sendBtn = $('send-chat-btn');
        if (sendBtn) sendBtn.disabled = true;

        if (user) {
            try {
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);
                let userData;

                if (userSnap.exists()) {
                    userData = userSnap.data();
                } else {
                    userData = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || 'New User',
                        photoURL: PRE_ASSIGNED_AVATARS[user.email] || user.photoURL || null, 
                        bio: "Welcome to Stylo AI!",
                        createdAt: serverTimestamp()
                    };
                    await setDoc(userRef, userData);
                }
                
                s.user = { ...user, ...userData };

                // --- SAFE UI UPDATES ---
                const emailDisplay = $('user-email');
                if (emailDisplay) emailDisplay.textContent = s.user.displayName || s.user.email;
                
                const dropdownEmail = $('user-email-dropdown');
                if (dropdownEmail) dropdownEmail.textContent = s.user.email;
                
                const avatarImg = $('user-avatar');
                if (avatarImg) {
                    if (s.user.photoURL) {
                        avatarImg.src = s.user.photoURL;
                    } else {
                        avatarImg.src = '../assets/Images/logo1.png'; 
                    }
                }
                // -----------------------------------------------------------

                // --- API KEY FETCHING UPDATE (ONLY GEMINI) ---
                try {
                    const keyDoc = await getDoc(doc(db, "settings", "api_keys"));
                    if (keyDoc.exists()) {
                        const data = keyDoc.data();
                        
                        // FIX: Prioritize 'geminiApiKey' and ignore OpenRouter
                        if (data.geminiApiKey) {
                            s.apiKey = data.geminiApiKey.trim();
                            console.log("Gemini API Key loaded successfully.");
                        } else {
                            console.warn("geminiApiKey not found in settings/api_keys");
                            // Optional: Alert the user if critical key is missing
                            // notify("System API Key is missing. AI features may not work.", "warning");
                        }
                    } else {
                        console.warn("API Key document (settings/api_keys) not found.");
                    }
                } catch (keyErr) {
                    console.error("Error fetching API key:", keyErr);
                }
                // -----------------------------------------------------------

                if (chatInput) {
                    chatInput.disabled = false;
                    chatInput.placeholder = "e.g., Create a contact form linked to collection #leads...";
                }
                if (genBtn) genBtn.disabled = false;
                if (sendBtn) sendBtn.disabled = false;

                // Load Data
                await Promise.all([loadTemplates(), loadSharedProjects()]);

            } catch (e) {
                console.error("Failed to initialize user session:", e);
                notify(e.message, 'error');
                if (chatInput) chatInput.placeholder = "AI is offline. System error.";
            }
        } else {
            s.user = null;
            resetWorkspace();
            s.sharedProjects = [];
            const tList = $('templates-list');
            if (tList) tList.innerHTML = '<p>Sign in to view your saved projects.</p>';
            const sList = $('shared-templates-list');
            if (sList) sList.innerHTML = '';
        }

        handleRouteChange();
    });
}

export const handleSignIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const handleSignOut = () => signOut(auth);

export const applyUIPermissions = (role) => {
    const isViewer = role === 'viewer';
    const controlsToDisable = [
        'ai-persona-input', 'chat-input', 'send-chat-btn', 'generate-btn',
        'save-btn', 'confirm-save-btn', 'history-btn',
        'code-edit-toggle', 'ai-suggestion-prompt', 'ai-suggestion-btn', 'ai-apply-changes-btn'
    ];
    
    controlsToDisable.forEach(id => {
        const el = $(id);
        if (el) el.disabled = isViewer;
    });

    const shareBtn = $('share-btn');
    if (shareBtn) shareBtn.disabled = isViewer;
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