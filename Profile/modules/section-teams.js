import { db } from '../../Project/js/firebase-config.js';
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { state } from '../profile-state.js';
import { $, notify, toggleModal, setLoading } from '../profile-utils.js';

let currentManageTeamId = null;

export const initTeams = () => {
    // Create Team
    $('#create-team-btn')?.addEventListener('click', () => toggleModal('create-team-modal', true));
    $('#confirm-create-team-btn')?.addEventListener('click', handleCreateTeam);
    
    // Manage Team (Event Delegation)
    $('#teams-list-container')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.manage-team-btn');
        if (btn) openManageTeamModal(btn.dataset.id);
    });

    // FIX: Send Invite Button Handler (Ensure ID matches HTML)
    const sendBtn = document.getElementById('send-invite-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendInvite);
    }

    // Accept/Decline Invite Handlers
    $('#invites-list-container')?.addEventListener('click', handleInviteAction);

    // Tab Switching inside Modal
    document.querySelectorAll('#manage-team-modal .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#manage-team-modal .tab-btn').forEach(b => {
                b.classList.remove('active');
                b.style.borderBottom = 'none';
            });
            e.target.classList.add('active');
            e.target.style.borderBottom = '2px solid var(--primary-color)';
            const target = e.target.dataset.target;
            document.querySelectorAll('#manage-team-modal .tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(target).classList.remove('hidden');
        });
    });
};

// --- 1. RENDER TEAMS (WITH PLAN CHECK) ---
export const fetchAndRenderTeams = async () => {
    if (!state.currentUser) return;
    const uid = state.currentUser.uid;
    const container = $('#teams-list-container');
    
    try {
        const q = query(collection(db, "workspaces"), where("memberIds", "array-contains", uid));
        const snap = await getDocs(q);
        
        state.userWorkspaces = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (state.userWorkspaces.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-light);">You aren't part of any teams yet.</div>`;
        } else {
            // CHECK USER PLAN
            const userPlan = state.currentUser.plan || 'free';
            const canAccessTeams = (userPlan === 'prebusiness' || userPlan === 'business');

            container.innerHTML = state.userWorkspaces.map(ws => {
                // If user is Free, show Upgrade button instead of Manage
                let actionButton = '';
                
                if (canAccessTeams) {
                    actionButton = `<button class="btn btn--sm btn--secondary manage-team-btn" data-id="${ws.id}">Manage</button>`;
                } else {
                    actionButton = `<a href="#pricing"
   style="
   display:inline-block;
   padding:12px 28px;
   font-size:14px;
   font-weight:700;
   letter-spacing:1px;
   text-transform:uppercase;
   background:linear-gradient(135deg,#0f172a,#1e293b 40%,#6366f1);
   color:#ffffff;
   border-radius:40px;
   border:1px solid rgba(255,255,255,0.15);
   text-decoration:none;
   box-shadow:
     0 8px 25px rgba(99,102,241,0.35),
     inset 0 1px 0 rgba(255,255,255,0.15);
   backdrop-filter:blur(8px);
   transition:all 0.3s ease;
   ">
   🔥 Elite Access
</a>
`;
                }

                return `
                <div class="pricing-card" style="align-items:flex-start;">
                    <div class="pricing-header" style="border:none; padding:0; margin-bottom:10px; text-align:left;">
                        <h3 style="color:var(--primary-color);">${ws.name}</h3>
                        <p style="font-size:0.85rem; color:var(--text-light);">${ws.description || 'No description'}</p>
                    </div>
                    <div style="margin-top:auto; width:100%; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.8rem; background:rgba(0,0,0,0.05); padding:2px 8px; border-radius:10px;">${ws.memberIds.length} Members</span>
                        ${actionButton}
                    </div>
                </div>
            `}).join('');
        }
        
        fetchAndRenderInvites();

    } catch (e) {
        console.error("Error fetching teams:", e);
    }
};

// --- 2. RENDER PENDING INVITES (WITH PLAN CHECK) ---
export const fetchAndRenderInvites = async () => {
    const container = $('#invites-list-container');
    const email = state.currentUser.email;
    if(!email) return;

    try {
        const q = query(collection(db, "invites"), where("email", "==", email));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            container.innerHTML = '<p class="text-light">No pending invitations.</p>';
            return;
        }

        // Check Plan
        const userPlan = state.currentUser.plan || 'free';
        const canJoinTeam = (userPlan === 'prebusiness' || userPlan === 'business');

        container.innerHTML = snap.docs.map(d => {
            const inv = { id: d.id, ...d.data() };
            // Distinguish between Project and Workspace invites
    let contextText = '';
    let targetId = '';

    if (inv.type === 'project') {
        contextText = `Project Collab: ${inv.projectName || 'Untitled Project'}`;
        targetId = inv.projectId; // Crucial: use projectId
    } else {
        contextText = `Join Workspace`;
        targetId = inv.workspaceId; // Crucial: use workspaceId
    }
            let actionButtons = '';

            if (canJoinTeam) {
        actionButtons = `
            <button 
   class="btn btn--sm btn--secondary decline-invite-btn" 
   data-id="${inv.id}"
   style="
   display:inline-block;
   padding:10px 22px;
   font-size:13px;
   font-weight:600;
   letter-spacing:0.6px;
   text-transform:uppercase;
   background:linear-gradient(135deg,#2a2a2a,#3a3a3a);
   color:#f87171;
   border-radius:30px;
   border:1px solid rgba(248,113,113,0.4);
   box-shadow:
     0 4px 12px rgba(0,0,0,0.3),
     inset 0 1px 0 rgba(255,255,255,0.05);
   cursor:pointer;
   transition:all 0.3s ease;
   ">
   ✖ Decline
</button>

            <button class="btn btn--sm btn--primary accept-invite-btn" 
                data-id="${inv.id}" 
                data-type="${inv.type || 'workspace'}" 
                data-target="${targetId}">Accept</button>
        `;
            } else {
                // NO PLAN: Show Upgrade
                actionButtons = `
                    <button 
   class="btn btn--sm btn--secondary decline-invite-btn" 
   data-id="${inv.id}"
   style="
   display:inline-block;
   padding:10px 22px;
   font-size:13px;
   font-weight:600;
   letter-spacing:0.6px;
   text-transform:uppercase;
   background:linear-gradient(135deg,#2a2a2a,#3a3a3a);
   color:#f87171;
   border-radius:30px;
   border:1px solid rgba(248,113,113,0.4);
   box-shadow:
     0 4px 12px rgba(0,0,0,0.3),
     inset 0 1px 0 rgba(255,255,255,0.05);
   cursor:pointer;
   transition:all 0.3s ease;
   ">
   ✖ Decline
</button>

                    <a href="#pricing"
   style="
   display:inline-block;
   padding:11px 26px;
   font-size:13px;
   font-weight:600;
   letter-spacing:0.8px;
   text-transform:uppercase;
   background:linear-gradient(135deg,#1e293b,#334155 50%,#6366f1);
   color:#ffffff;
   border-radius:35px;
   border:1px solid rgba(255, 255, 255, 0.53);
   text-decoration:none;
   box-shadow:
     0 6px 18px rgba(165, 99, 241, 0.25),
     inset 0 1px 0 rgba(255,255,255,0.12);
   backdrop-filter:blur(6px);
   transition:all 0.3s ease;
   ">
   🚀 Upgrade to Access
</a>


                `;
            }

            return `
                <div class="api-key-item" style="padding: 15px; background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 10px;">
                    <div class="api-key-info">
                        <strong>${contextText}</strong>
                        <small style="color:var(--text-light)">From: ${inv.invitedByEmail || 'A user'}</small>
                    </div>
                    <div class="api-key-actions">
                        ${actionButtons}
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Invite fetch error:", e);
    }
};

// --- 3. ACTIONS ---

async function handleCreateTeam() {
    const name = $('#new-team-name').value.trim();
    const desc = $('#new-team-desc').value.trim();
    
    const userPlan = state.currentUser.plan || 'free';
    if (userPlan !== 'prebusiness' && userPlan !== 'business') {
        notify("Upgrade to Pre-Business to create teams!", "error");
        return;
    }

    if (!name) return notify("Name is required", "error");
    
    setLoading($('#confirm-create-team-btn'), true);
    try {
        await addDoc(collection(db, "workspaces"), {
            name, description: desc,
            ownerId: state.currentUser.uid,
            memberIds: [state.currentUser.uid],
            createdAt: serverTimestamp()
        });
        notify("Workspace created!", "success");
        toggleModal('create-team-modal', false);
        fetchAndRenderTeams();
    } catch (e) { notify(e.message, "error"); } 
    finally { setLoading($('#confirm-create-team-btn'), false); }
}

async function openManageTeamModal(teamId) {
    currentManageTeamId = teamId;
    const team = state.userWorkspaces.find(t => t.id === teamId);
    if (!team) return;

    $('#manage-team-title').textContent = `Manage: ${team.name}`;
    toggleModal('manage-team-modal', true);
    $('#invite-member-email').value = '';
    
    // Tab 1: Members
    const list = $('#team-members-list');
    list.innerHTML = '<div class="spinner-small"></div>';
    try {
        const promises = team.memberIds.map(uid => getDoc(doc(db, "users", uid)));
        const snaps = await Promise.all(promises);
        
        list.innerHTML = snaps.map(snap => {
            const u = snap.data() || { email: 'Unknown', displayName: 'User' };
            return `<div class="api-key-item">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${u.photoURL || 'https://ui-avatars.com/api/?name='+u.email}" style="width:32px; height:32px; border-radius:50%;">
                    <div><strong>${u.displayName || 'User'}</strong><br><small>${u.email}</small></div>
                </div>
                ${team.ownerId === snap.id ? '<span class="role--owner">Owner</span>' : '<span class="role--editor">Member</span>'}
            </div>`;
        }).join('');
    } catch(e) { list.innerHTML = 'Error loading members'; }

    // Tab 2: Projects (Linked by workspaceId)
    const pList = $('#team-projects-list');
    pList.innerHTML = '<div class="spinner-small"></div>';
    try {
        const pq = query(collection(db, "ai_templates"), where("workspaceId", "==", teamId));
        const psnap = await getDocs(pq);
        if(psnap.empty) {
            pList.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#888;">No projects linked to this workspace yet.</p>';
        } else {
            pList.innerHTML = psnap.docs.map(d => {
                const p = d.data();
                return `<div class="db-card" style="padding:10px;">
                    <strong>${p.name}</strong>
                    <small>Updated: ${new Date(p.createdAt?.seconds*1000).toLocaleDateString()}</small>
                    <a href="../Project/?project=${d.id}" class="btn-icon" style="float:right;"><i class="fas fa-external-link-alt"></i></a>
                </div>`;
            }).join('');
        }
    } catch(e) { pList.innerHTML = 'Error loading projects'; }
}
// FIX: Handle Send Invite
async function handleSendInvite() {
    const email = $('#invite-member-email').value.trim();
    if (!email) return notify("Enter an email", "error");
    if (!currentManageTeamId) return notify("Error: No team selected", "error");

    const btn = $('#send-invite-btn');
    const originalText = btn.innerText;
    btn.innerText = "Sending...";
    btn.disabled = true;

    try {
        await addDoc(collection(db, "invites"), {
            // Core Data
            email: email,
            type: 'workspace',
            status: 'pending',
            
            // Team Context
            workspaceId: currentManageTeamId,
            
            // Sender Info (Sending BOTH versions)
            invitedBy: state.currentUser.uid, 
            inviterId: state.currentUser.uid, 
            invitedByEmail: state.currentUser.email,
            
            createdAt: serverTimestamp()
        });
        
        notify(`Invite sent to ${email}`, "success");
        $('#invite-member-email').value = '';
        
    } catch (e) {
        console.error("Invite Error:", e);
        notify("Failed to send invite.", "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// FIX: Handle Accept/Decline
async function handleInviteAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const { id, type, target } = btn.dataset; // target is the ID (workspaceId or projectId)

    // DECLINE LOGIC
    if (btn.classList.contains('decline-invite-btn')) {
        if(confirm('Decline this invitation?')) {
            await deleteDoc(doc(db, "invites", id));
            fetchAndRenderInvites();
        }
    } 
    
    // ACCEPT LOGIC
    else if (btn.classList.contains('accept-invite-btn')) {
        setLoading(btn, true, 'Joining...');
        
        try {
            if (type === 'workspace') {
                // Add to workspace members
                const wsRef = doc(db, "workspaces", target);
                await updateDoc(wsRef, { memberIds: arrayUnion(state.currentUser.uid) });
            } 
            else if (type === 'project') {
                // Add to project collaborators
                // Note: 'target' here comes from data-target="${inv.projectId}"
                const projRef = doc(db, "ai_templates", target);
                
                // We need to fetch the invite to get the specific role (editor/viewer) assigned
                const inviteDoc = await getDoc(doc(db, "invites", id));
                const role = inviteDoc.exists() ? inviteDoc.data().role : 'viewer';

                await updateDoc(projRef, { 
                    sharedWith: arrayUnion(state.currentUser.uid),
                    [`collaborators.${state.currentUser.uid}`]: {
                        email: state.currentUser.email,
                        displayName: state.currentUser.displayName || state.currentUser.email,
                        photoURL: state.currentUser.photoURL || null,
                        role: role
                    }
                });
            }
            
            // Delete invite after acceptance
            await deleteDoc(doc(db, "invites", id));
            notify("Invitation accepted!", "success");
            
            // Refresh logic
            setTimeout(() => {
                // Reload page to reflect changes or refresh specific sections
                window.location.reload(); 
            }, 1000); 

        } catch (e) {
            console.error(e);
            notify("Error accepting: " + e.message, "error");
            setLoading(btn, false);
        }
    }
}