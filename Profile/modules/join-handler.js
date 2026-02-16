import { db } from '../../Project/js/firebase-config.js';
import { doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { notify } from '../profile-utils.js';
import { state } from '../profile-state.js';

export const checkUrlForInvites = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const workspaceId = urlParams.get('workspace');

    if (action === 'join' && workspaceId) {
        // Clean URL so refresh doesn't trigger again
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + "#team";
        window.history.pushState({path:newUrl},'',newUrl);

        // Switch to team tab visually
        const navLinks = document.querySelectorAll('.profile-nav-link');
        navLinks.forEach(l => l.classList.remove('active'));
        const teamLink = document.querySelector('a[href="#team"]');
        if(teamLink) teamLink.classList.add('active');

        // Show loading state
        notify("Verifying invitation...", "info");

        await handleJoinRequest(workspaceId);
    }
};

async function handleJoinRequest(workspaceId) {
    if (!state.currentUser) {
        // Store for post-login
        sessionStorage.setItem('pending_join_workspace', workspaceId);
        notify("Please sign in to join the team.", "info");
        return;
    }

    try {
        const wsRef = doc(db, "workspaces", workspaceId);
        const wsSnap = await getDoc(wsRef);

        if (!wsSnap.exists()) {
            notify("Invite link expired or workspace deleted.", "error");
            return;
        }

        const wsData = wsSnap.data();
        if (wsData.memberIds && wsData.memberIds.includes(state.currentUser.uid)) {
            notify(`You are already a member of ${wsData.name}.`, "info");
            return;
        }

        // Auto-accept if clicked link (Professional flow often assumes click = consent)
        // Or show confirm dialog
        if(confirm(`Join the workspace "${wsData.name}"?`)) {
            await updateDoc(wsRef, {
                memberIds: arrayUnion(state.currentUser.uid)
            });
            notify(`Successfully joined ${wsData.name}!`, "success");
            
            // Reload to sync all data
            setTimeout(() => window.location.reload(), 1500);
        }
    } catch (e) {
        console.error(e);
        notify("Error joining team: " + e.message, "error");
    }
}