// js/profile.js
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import { toggleModal, showLoader, notify } from './ui.js';
import { $ } from './utils.js';
import { s } from './state.js'; 

export const openUserProfile = async (uid) => {
    if (!uid) return;
    showLoader(true);
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            await renderProfileModal(data); 
            toggleModal('user-profile-modal', true);
        } else {
            notify("User profile not found.", "error");
        }
    } catch (error) {
        console.error("Error fetching profile:", error);
        notify("Failed to load profile.", "error");
    } finally {
        showLoader(false);
    }
};

const renderProfileModal = async (data) => {
    // 1. Header / Basic Info
    const avatarEl = $('profile-modal-avatar');
    const nameEl = $('profile-modal-name');
    const positionEl = $('profile-modal-position');
    const locationEl = $('profile-modal-location');

    if (avatarEl) {
        avatarEl.src = data.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.displayName || 'User')}&background=random`;
    }
    if (nameEl) nameEl.textContent = data.displayName || "Unknown User";
    if (positionEl) positionEl.textContent = data.position || "Member";
    if (locationEl) {
        if (data.location) {
            locationEl.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${data.location}`;
            locationEl.classList.remove('hidden');
        } else {
            locationEl.classList.add('hidden');
        }
    }

    // 2. Workspace / Team Logic (UPDATED TO BE CLICKABLE)
    const workspaceNameEl = $('profile-workspace-name');
    const linkBtn = $('link-workspace-btn');
    
    if (s.currentProjectData && s.currentProjectData.workspaceId) {
        linkBtn.classList.add('hidden');
        workspaceNameEl.innerHTML = `<span style="color:var(--text-light);">Loading...</span>`;
        
        try {
            const wsDoc = await getDoc(doc(db, "workspaces", s.currentProjectData.workspaceId));
            
            if (wsDoc.exists()) {
                // CHANGED: Wrapped in <a> tag pointing to Profile > Teams
                workspaceNameEl.innerHTML = `<a href="../Profile/index.html#teams" target="_blank" title="Manage Team" style="color:var(--primary-color); text-decoration:none; border-bottom:1px dashed var(--primary-color); cursor:pointer;">
                    <i class="fas fa-building"></i> ${wsDoc.data().name} <i class="fas fa-external-link-alt" style="font-size:0.7em;"></i>
                </a>`;
            } else {
                workspaceNameEl.textContent = "Workspace Deleted";
                linkBtn.classList.remove('hidden');
            }
        } catch (e) {
            if (e.code === 'permission-denied') {
                workspaceNameEl.innerHTML = `<span style="color:var(--text-light); font-style:italic;"><i class="fas fa-lock"></i> Private Team</span>`;
            } else {
                workspaceNameEl.textContent = "Unavailable";
            }
        }
    } else {
        workspaceNameEl.textContent = "Personal Project (No Team)";
        linkBtn.classList.remove('hidden');
        linkBtn.onclick = () => openTeamSelectionModal();
    }

    // 3. Stats & Details
    const teamCount = data.team ? data.team.length : 0;
    const invitesCount = data.pendingInvites ? data.pendingInvites.length : 0;
    
    const teamStatEl = $('profile-stat-team');
    const inviteStatEl = $('profile-stat-invites');
    
    if (teamStatEl) teamStatEl.textContent = teamCount;
    if (inviteStatEl) inviteStatEl.textContent = invitesCount;

    setField('profile-bio', data.bio);
    setField('profile-email', data.email);
    setField('profile-website', data.website);
    setField('profile-age', data.age, 'Age: ');
    setField('profile-gender', data.gender);
};

const setField = (id, value, prefix = '') => {
    const el = $(id);
    if(!el) return;
    if (value) {
        el.parentElement.classList.remove('hidden');
        if (id.includes('website') || id.includes('email')) {
            el.href = id.includes('email') ? `mailto:${value}` : value;
            el.textContent = value;
        } else {
            el.textContent = prefix + value;
        }
    } else {
        el.parentElement.classList.add('hidden');
    }
};

// ... Team Management Logic (openTeamSelectionModal, createAndLinkTeam) remains same ...
// You can keep the rest of the file exactly as it was in previous steps.
async function openTeamSelectionModal() {
    toggleModal('user-profile-modal', false);
    toggleModal('select-team-modal', true);
    const listContainer = $('workspace-list-container');
    listContainer.innerHTML = '<div style="padding:10px;">Loading workspaces...</div>';
    try {
        const q = query(collection(db, "workspaces"), where("memberIds", "array-contains", s.user.uid));
        const snap = await getDocs(q);
        if (snap.empty) {
            listContainer.innerHTML = '<div style="padding:10px; color:#888;">No existing workspaces found. Create one below.</div>';
        } else {
            listContainer.innerHTML = snap.docs.map(doc => {
                const ws = doc.data();
                return `
                <div class="workspace-item" style="padding:10px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:500;">${ws.name}</span>
                    <button class="btn btn--sm btn--secondary" onclick="window.linkProjectToTeam('${doc.id}', '${ws.name}')">Select</button>
                </div>`;
            }).join('');
        }
    } catch (e) {
        listContainer.innerHTML = '<div style="padding:10px; color:red;">Error loading workspaces.</div>';
    }
    const createBtn = $('create-workspace-btn');
    createBtn.onclick = createAndLinkTeam;
}

window.linkProjectToTeam = async (workspaceId, workspaceName) => {
    if (!s.editId) return;
    try {
        await updateDoc(doc(db, "ai_templates", s.editId), { workspaceId: workspaceId });
        s.currentProjectData.workspaceId = workspaceId;
        notify(`Project linked to ${workspaceName}!`, "success");
        toggleModal('select-team-modal', false);
        openUserProfile(s.user.uid);
    } catch (e) { notify("Failed to link project: " + e.message, "error"); }
};

async function createAndLinkTeam() {
    const nameInput = $('new-workspace-input');
    const name = nameInput.value.trim();
    if (!name) return notify("Please enter a workspace name", "error");
    const btn = $('create-workspace-btn');
    const originalText = btn.innerText;
    btn.innerText = "Creating...";
    btn.disabled = true;
    try {
        const wsRef = await addDoc(collection(db, "workspaces"), {
            name: name, ownerId: s.user.uid, memberIds: [s.user.uid], createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, "ai_templates", s.editId), { workspaceId: wsRef.id });
        s.currentProjectData.workspaceId = wsRef.id;
        notify("Workspace created and linked!", "success");
        toggleModal('select-team-modal', false);
        openUserProfile(s.user.uid);
    } catch (e) { notify("Error: " + e.message, "error"); } 
    finally { btn.innerText = originalText; btn.disabled = false; nameInput.value = ''; }
}