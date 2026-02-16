// js/templates.js
import { doc, getDoc, updateDoc, onSnapshot, collection, getDocs, query, where, orderBy, serverTimestamp, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { db } from '../../firebase-config.js';
import { s } from './state.js';
import { $, slugify, checkPlanAccess } from './utils.js';
import { notify, resetWorkspace, updateUIForLoadedProject, toggleCardLoader, showLoader } from './ui.js';
import { applyUIPermissions, renderCollaborators } from './auth.js';
import { renderChatHistory } from './ai-core.js';
import { CLOUDINARY_UPLOAD_PRESET, CLOUDINARY_URL } from './constants.js';
import { saveVersion } from './versions.js';
import { loadAskHistory } from './chat.js';

// --- PROJECT LOADING LOGIC ---

export const loadProject = async (initialData, id) => {
    if (!s.user) return notify("Please sign in to load a project.", "error");
    if (s.editId === id) return; 

    const isOwner = initialData.userId === s.user.uid;
    const isCollaborator = initialData.collaborators?.[s.user.uid];

    // CASE 1: Load directly
    if (isOwner || isCollaborator) {
        _subscribeToProject(id);
    } 
    // CASE 2: Create copy (Fork)
    else {
        if (!confirm("This will create a new, editable copy of the template in your account. Continue?")) {
            return;
        }
        showLoader(true);
        notify("Creating your editable copy of the template...", "success");
        try {
            const newProjectData = {
                name: `Copy of ${initialData.name}`,
                htmlContent: initialData.htmlContent,
                chatHistory: [{ role: 'ai', text: `This project was started from the '${initialData.name}' template.` }],
                userId: s.user.uid,
                createdAt: serverTimestamp(),
                isDirty: false,
                sharedWith: [],
                collaborators: {
                    [s.user.uid]: {
                        email: s.user.email,
                        displayName: s.user.displayName,
                        role: 'owner'
                    }
                }
            };

            const docRef = await addDoc(collection(db, "ai_templates"), newProjectData);
            await loadTemplates();
            _subscribeToProject(docRef.id);

        } catch (error) {
            console.error("Failed to import template:", error);
            notify(`Error importing template: ${error.message}`, "error");
        } finally {
            showLoader(false);
        }
    }
};

async function _subscribeToProject(projectId) {
    resetWorkspace();
    s.editId = projectId;

    const [projectImages, projectCollections] = await Promise.all([
        loadProjectImages(projectId),
        loadProjectCollections(projectId)
    ]);
    
    const docRef = doc(db, "ai_templates", projectId);

    s.projectUnsubscribe = onSnapshot(docRef, (docSnap) => {
        if (!docSnap.exists()) {
            notify("This project no longer exists.", "error");
            resetWorkspace();
            return;
        }
        const projectData = docSnap.data();
        history.pushState({ projectId: projectId }, `Project: ${projectData.name}`, `?project=${projectId}`);

        s.currentProjectData = { 
            id: docSnap.id, 
            ...projectData, 
            projectImages, 
            projectCollections 
        };

        // --- NEW: Update Header Text ---
        const headerNameEl = $('header-project-name');
        if(headerNameEl) headerNameEl.textContent = projectData.name;

        s.currentUserRole = projectData.collaborators?.[s.user.uid]?.role || 'viewer';
        if (projectData.userId === s.user.uid) s.currentUserRole = 'owner';
        applyUIPermissions(s.currentUserRole);

        if (projectData.isBeingEditedBy && projectData.isBeingEditedBy.uid !== s.user.uid) {
            const statusEl = $('realtime-status');
            statusEl.innerHTML = `<i class="fas fa-pencil-alt"></i> ${projectData.isBeingEditedBy.name} is editing...`;
            statusEl.classList.remove('hidden');
            if(s.realtimeStatusTimeout) clearTimeout(s.realtimeStatusTimeout);
            s.realtimeStatusTimeout = setTimeout(() => statusEl.classList.add('hidden'), 4000);
        }

        if (s.html !== projectData.htmlContent) {
            s.html = projectData.htmlContent;
            $('preview-frame').srcdoc = s.html;
        }

        if (JSON.stringify(s.chatHistory) !== JSON.stringify(projectData.chatHistory) && !s.isGenerating) {
             s.chatHistory = projectData.chatHistory || [{ role: 'ai', text: `Project "${projectData.name}" loaded.` }];
             renderChatHistory();
        }

        if (projectData.askChatHistory) {
            loadAskHistory(projectData.askChatHistory);
        } else {
            loadAskHistory([]); 
        }
        
        updateUIForLoadedProject({ id: projectId, ...projectData });
        renderCollaborators(projectData.collaborators || []);
    }, (error) => {
        console.error("Real-time listener error:", error);
        notify("Lost connection to the project. Please refresh.", "error");
    });
}

// --- LOAD TEMPLATES (UPDATED FOR DROPDOWN) ---
export const loadTemplates = async () => {
    if (!s.user) return;
    
    const listEl = $('templates-list'); // Main grid in 'My Projects' tab
    const headerDropdownList = $('header-project-items-container'); // New scrollable container in dropdown
    if (!listEl && !headerDropdownList) return; 

    if(listEl) listEl.innerHTML = "<p>Loading projects...</p>";
    if(headerDropdownList) headerDropdownList.innerHTML = "<div style='padding:10px; font-size:0.85rem; color:var(--text-light);'>Loading...</div>";

    try {
        // 1. Query My Projects (where I am the owner)
        const myProjectsQ = query(collection(db, "ai_templates"), where("userId", "==", s.user.uid));
        
        // 2. Query Shared Projects (where my ID is in sharedWith array)
        const sharedProjectsQ = query(collection(db, "ai_templates"), where("sharedWith", "array-contains", s.user.uid));

        // 3. Execute queries in parallel
        const [mySnap, sharedSnap] = await Promise.all([getDocs(myProjectsQ), getDocs(sharedProjectsQ)]);

        // 4. Merge & Map Data
        let allProjects = [
            ...mySnap.docs.map(d => ({ id: d.id, ...d.data(), _type: 'mine' })),
            ...sharedSnap.docs.map(d => ({ id: d.id, ...d.data(), _type: 'shared' }))
        ];

        // 5. Sort by CreatedAt Descending (Newest first)
        allProjects.sort((a, b) => {
            const tA = a.createdAt?.seconds || 0;
            const tB = b.createdAt?.seconds || 0;
            return tB - tA;
        });

        // --- Helper: Generate Stacked Profile Icons ---
        const getIconHTML = (p) => {
            const collabs = p.collaborators || {};
            const ownerId = p.userId;
            // Collaboration count includes owner + invited users
            const collabCount = Object.keys(collabs).length;
            
            // Get Owner Details
            const owner = collabs[ownerId] || { displayName: 'User', email: 'U' };
            const ownerInitial = (owner.displayName || owner.email || 'U').charAt(0).toUpperCase();
            
            // Create Owner Icon HTML
            const ownerContent = owner.photoURL 
                ? `<img src="${owner.photoURL}" class="p-icon ${collabCount > 1 ? 'back' : 'single'}" alt="Owner">` 
                : `<div class="p-icon ${collabCount > 1 ? 'back' : 'single'}">${ownerInitial}</div>`;

            let finalHTML = ownerContent;

            // If Collaborative, add second icon (front)
            if (collabCount > 1) {
                // Find a collaborator that isn't the owner (grab first one found)
                const otherId = Object.keys(collabs).find(id => id !== ownerId) || ownerId;
                const other = collabs[otherId];
                const otherInitial = (other.displayName || other.email || 'U').charAt(0).toUpperCase();
                
                const otherContent = other.photoURL
                    ? `<img src="${other.photoURL}" class="p-icon front" alt="Collab">`
                    : `<div class="p-icon front">${otherInitial}</div>`;
                
                finalHTML = `${ownerContent}${otherContent}`;
            }

            return `<div class="project-icon-stack" title="${collabCount > 1 ? 'Collaborative Project' : 'Personal Project'}">${finalHTML}</div>`;
        };

        // --- Render Main Grid (My Projects Tab) ---
        if(listEl) {
            const myOnly = allProjects.filter(p => p._type === 'mine');
            s.projectCount = myOnly.length;
            listEl.innerHTML = myOnly.length ? myOnly.map(t => {
                const needsUpdate = t.isDirty && t.deploymentUrl;
                const donateButton = !t.isPublic ? `<button class="btn-icon template-card__donate-btn" data-id="${t.id}" title="Donate as public template"><i class="fas fa-gift"></i></button>` : '';
                const placeholderImage = '../assets/Images/logo1.png';
                const cardImage = `<div class="template-card__image" style="background-image: url(${t.thumbnailUrl || placeholderImage})"></div>`;
                const loadButton = `<button class="btn btn--sm btn--secondary load-btn" data-id="${t.id}"><i class="fas fa-folder-open"></i> Load</button>`;
                let deployButtons = `<button class="btn btn--sm btn--primary deploy-btn" data-id="${t.id}"><i class="fas fa-rocket"></i> Deploy</button>`;
                if (t.deploymentUrl) {
                    deployButtons = `<a href="${t.deploymentUrl}" target="_blank" class="btn btn--sm btn--success"><i class="fas fa-external-link-alt"></i> Visit</a>
                        <button class="btn btn--sm btn--secondary deploy-btn ${needsUpdate ? 'needs-update' : ''}" data-id="${t.id}"><i class="fas fa-sync-alt"></i> Re-deploy</button>`;
                }
                return `<div class="template-card" data-name="${t.name.toLowerCase()}">
                    ${cardImage}
                    <div class="template-card__content">
                        <div class="template-card__header"><h4>${t.name}</h4><div class="template-card__icon-buttons">${donateButton}<button class="btn-icon template-card__delete-btn" data-id="${t.id}"><i class="fas fa-trash-alt"></i></button></div></div>
                        <div class="template-card__actions">
                            ${loadButton} ${deployButtons}
                        </div>
                    </div>
                </div>`;
            }).join('') : "<p>You haven't saved any projects yet.</p>";
        }

        // --- Render Shared Grid (Shared View) ---
        // Update global state for "Shared with Me" tab rendering
        s.sharedProjects = allProjects.filter(p => p._type === 'shared');
        // Trigger render if that view exists
        const sharedListEl = $('shared-templates-list');
        if(sharedListEl && typeof renderSharedProjects === 'function') {
            // Assumes renderSharedProjects is imported or defined in this scope
            // (In your provided code context, it is defined below this function)
            // We call it directly if defined in this module, otherwise we rely on the tab click handler.
            // Since it is exported in this file, we can call the logic directly or replicate:
             sharedListEl.innerHTML = s.sharedProjects.length ? s.sharedProjects.map(t => {
                const ownerData = t.collaborators?.[t.userId];
                const ownerInfo = ownerData ? `Shared by ${ownerData.displayName || ownerData.email}` : 'Shared by user';
                const placeholderImage = '../assets/Images/logo1.png';
                const cardImage = `<div class="template-card__image" style="background-image: url(${t.thumbnailUrl || placeholderImage})"></div>`;
                const cardActions = `<button class="btn btn--sm btn--secondary load-btn" data-id="${t.id}">Load</button>`;
                return `<div class="template-card" data-name="${t.name.toLowerCase()}">
                    ${cardImage}
                    <div class="template-card__content">
                        <div class="template-card__header"><h4>${t.name}</h4></div>
                        <div class="template-card__owner"><i class="fas fa-share-alt"></i> ${ownerInfo}</div>
                        <div class="template-card__actions">${cardActions}</div>
                    </div>
                </div>`;
            }).join('') : "<p>No projects shared with you.</p>";
        }

        // --- Render Header Dropdown (ALL Projects) ---
        if(headerDropdownList) {
            const itemsHTML = allProjects.length ? allProjects.map(t => `
                <div class="project-dropdown-item" onclick="window.handleProjectSelect('${t.id}')">
                    ${getIconHTML(t)}
                    <div class="project-dropdown-info">
                        <div style="font-weight:500;" class="p-name">${t.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-light);">${t._type === 'shared' ? 'Shared' : 'Mine'}</div>
                    </div>
                    <div class="project-dropdown-actions">
                        ${!t.isPublic && t._type === 'mine' ? `<button class="dropdown-action-btn" title="Donate" onclick="window.handleHeaderDonate(event, '${t.id}')"><i class="fas fa-gift"></i></button>` : ''}
                        ${t._type === 'mine' ? `<button class="dropdown-action-btn danger" title="Delete" onclick="window.handleHeaderDelete(event, '${t.id}', '${t.name}')"><i class="fas fa-trash-alt"></i></button>` : ''}
                    </div>
                </div>
            `).join('') : "<div style='padding:10px; color:var(--text-light);'>No projects found.</div>";
            
            // Append "Create New" at the bottom
            const createNewHTML = `
                <div class="project-dropdown-item" onclick="document.getElementById('new-project-btn').click(); document.getElementById('header-project-list').classList.add('hidden');" style="color:var(--primary-color); font-weight:600; border-top:1px solid var(--border-color); margin-top:auto;">
                    <div class="project-icon-stack"><div class="p-icon single" style="background:transparent; border:2px dashed var(--primary-color); color:var(--primary-color);"><i class="fas fa-plus"></i></div></div>
                    <div class="project-dropdown-info">Create New Project</div>
                </div>
            `;

            headerDropdownList.innerHTML = itemsHTML + createNewHTML;
        }

    } catch (e) { 
        console.error("Error loading projects:", e); 
        if(listEl) listEl.innerHTML = `<p style='color:red;'>Could not load projects.</p>`; 
        if(headerDropdownList) headerDropdownList.innerHTML = `<div style='padding:10px; color:red'>Error loading projects.</div>`;
    }
};

export const loadSharedProjects = async () => {
    if (!s.user) return;
    const listEl = $('shared-templates-list');
    if (!listEl) return; 

    listEl.innerHTML = "<p>Loading shared projects...</p>";
    try {
        const q = query(collection(db, "ai_templates"), where("sharedWith", "array-contains", s.user.uid), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        s.sharedProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSharedProjects();
    } catch (e) {
        listEl.innerHTML = `<p style='color:red;'>Could not load shared projects.</p>`;
        console.error("Error loading shared projects:", e);
    }
};

export const renderSharedProjects = () => {
    const listEl = $('shared-templates-list');
    listEl.innerHTML = s.sharedProjects.length ? s.sharedProjects.map(t => {
        const ownerData = t.collaborators?.[t.userId];
        const ownerInfo = ownerData ? `Shared by ${ownerData.displayName || ownerData.email}` : 'Shared by an unknown user';
        const placeholderImage = '../assets/Images/logo1.png';
        const cardImage = `<div class="template-card__image" style="background-image: url(${t.thumbnailUrl || placeholderImage})"></div>`;
        const cardActions = `
            <button class="btn btn--sm btn--secondary load-btn" data-id="${t.id}"><i class="fas fa-folder-open"></i> Load</button>
            ${t.deploymentUrl ? `<a href="${t.deploymentUrl}" target="_blank" class="btn btn--sm btn--success"><i class="fas fa-external-link-alt"></i> Visit</a>` : ''}
        `;
        return `<div class="template-card" data-name="${t.name.toLowerCase()}">
            ${cardImage}
            <div class="template-card__content">
                <div class="template-card__header"><h4>${t.name}</h4></div>
                <div class="template-card__owner"><i class="fas fa-share-alt"></i> ${ownerInfo}</div>
                <div class="template-card__actions">${cardActions}</div>
            </div>
        </div>`;
    }).join('') : "<p>No projects have been shared with you yet.</p>";
};

export const handleDonationUpload = async (event) => {
    const fileInput = event.target;
    const projectId = fileInput.dataset.projectId;
    const file = fileInput.files[0];
    if (!projectId || !file) return;
    toggleCardLoader(projectId, true);
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Screenshot upload to Cloudinary failed.');
        const data = await res.json();
        await updateDoc(doc(db, "ai_templates", projectId), { isPublic: true, donatedAt: serverTimestamp(), thumbnailUrl: data.secure_url });
        notify('Project successfully donated as a template!', 'success');
        await loadTemplates();
    } catch (err) {
        console.error('Donation failed:', err);
        notify('Donation failed. Please try again.', 'error');
        toggleCardLoader(projectId, false);
    }
};


export const saveProject = async () => {
    const name = $('save-template-name-input').value.trim();
    if (!name) {
        notify('Please enter a name.', 'error');
        return false;
    }
    try {
        if (s.editId) {
            await updateDoc(doc(db, "ai_templates", s.editId), { name, htmlContent: s.html, chatHistory: s.chatHistory });
            await saveVersion('Manual Save');
        } else {
            const docRef = await addDoc(collection(db, "ai_templates"), {
                name, siteName: slugify(name), htmlContent: s.html, chatHistory: s.chatHistory,
                userId: s.user.uid, isDirty: false, createdAt: serverTimestamp(),
                sharedWith: [],
                collaborators: {
                    [s.user.uid]: {
                        email: s.user.email,
                        displayName: s.user.displayName,
                        role: 'owner'
                    }
                }
            });
            _subscribeToProject(docRef.id);
        }
        await loadTemplates();
        notify('Project saved successfully!');
        return true;
    } catch (e) {
        notify(`Save failed: ${e.message}`, 'error');
        return false;
    }
};

export const loadProjectImages = async (projectId) => {
    if (!projectId) return [];
    try {
        const q = query(collection(db, `ai_templates/${projectId}/project_images`), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Could not load project images:", e);
        return [];
    }
};

export const loadProjectCollections = async (projectId) => {
    if (!projectId) return [];
    try {
        const q = query(collection(db, `ai_templates/${projectId}/project_collections`), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Could not load project collections:", e);
        return [];
    }
};
export const createNewProject = async (name, mode = 'website', workspaceId = null) => {
    if (!s.user) return false;

    if (!checkPlanAccess('createProject')) {
        return false; // Stop execution
    }
    try {
        const docRef = await addDoc(collection(db, "ai_templates"), {
            name,
            mode: mode,
            siteName: slugify(name),
            htmlContent: '',
            chatHistory: [{ role: 'ai', text: `Ready to build your ${mode}! Describe what you need.` }],
            userId: s.user.uid,
            workspaceId: workspaceId,
            isDirty: false,
            createdAt: serverTimestamp(),
            sharedWith: [],
            collaborators: {
                [s.user.uid]: {
                    email: s.user.email,
                    displayName: s.user.displayName,
                    photoURL: s.user.photoURL || null,
                    role: 'owner'
                }
            }
        });

        await _subscribeToProject(docRef.id);
        await loadTemplates();
        return true;
    } catch (e) {
        notify(`Failed to create project: ${e.message}`, 'error');
        console.error(e);
        return false;
    }
};

// Global Handlers for Dropdown (Attached to window for inline onclicks)
window.handleProjectSelect = (id) => {
    const headerDropdown = $('header-project-list');
    if(headerDropdown) headerDropdown.classList.add('hidden');
    
    // Instant Load
    getDoc(doc(db, "ai_templates", id)).then(snap => {
        if(snap.exists()) loadProject(snap.data(), snap.id);
    });
};

window.handleHeaderDelete = async (e, id, name) => {
    e.stopPropagation(); 
    if(!confirm(`Delete project "${name}"?`)) return;
    try {
        await deleteDoc(doc(db, "ai_templates", id));
        notify("Project deleted.", "success");
        if(s.editId === id) resetWorkspace();
        loadTemplates();
    } catch(err) {
        notify("Delete failed.", "error");
    }
};

window.handleHeaderDonate = (e, id) => {
    e.stopPropagation();
    const fileInput = document.createElement('input'); 
    fileInput.type = 'file'; 
    fileInput.accept = 'image/*'; 
    fileInput.style.display = 'none';
    fileInput.dataset.projectId = id;
    fileInput.addEventListener('change', handleDonationUpload);
    document.body.appendChild(fileInput); 
    fileInput.click(); 
    document.body.removeChild(fileInput);
};