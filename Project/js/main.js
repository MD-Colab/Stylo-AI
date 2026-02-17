// js/main.js
import { db } from './firebase-config.js';
import { doc, getDoc, deleteDoc, collection, addDoc, updateDoc, serverTimestamp, query, where, getDocs, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { s } from './state.js';
import { $, checkPlanAccess } from './utils.js';
import { openIDE, compileForPreview } from './ide.js';
import { notify, toggleModal, setLoading, showLoader, resetWorkspace, handleImageMention, handleCollectionMention, showCode, toggleCodeEditorReadOnly, updateLineNumbers, updateChatInputVisual, renderMentionedAssets } from './ui.js';
import { initAuth, handleSignIn, handleSignOut } from './auth.js';
import { addUserMessageToChat, renderChatHistory, enhancePrompt } from './ai-core.js';
import { handleImageRename, renderProjectImages } from './images.js';
import { renderFirestoreData, loadDocuments, renderFirestoreDocuments, renderProjectCollections } from './firestore.js';
import { createNewProject, loadProject, loadTemplates, saveProject, loadProjectImages, loadProjectCollections, handleDonationUpload, loadSharedProjects } from './templates.js';
import { loadVersionHistory, restoreVersion } from './versions.js';
import { CLOUDINARY_URL, CLOUDINARY_UPLOAD_PRESET } from './constants.js';
import { AVATAR_LIST } from './avatars.js';
import { initAskChat } from './chat.js';
import { startProjectWizard } from './suggestion.js';
import { openVisualEditor } from './drag&drop.js';
import { openUserProfile } from './profile.js';
import { processFile, uploadToCloudinary } from './utils.js';

// --- ROUTING ---
export const handleRouteChange = async () => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    const modalId = params.get('modal');

    if (projectId && projectId !== s.editId && s.user) {
        showLoader(true);
        try {
            const docSnap = await getDoc(doc(db, "ai_templates", projectId));
            if (docSnap.exists()) {
                loadProject(docSnap.data(), docSnap.id);
            } else {
                notify('Project not found.', 'error');
                history.replaceState(null, 'New Project', window.location.pathname);
                resetWorkspace();
            }
        } catch (err) {
            console.error("Error in handleRouteChange:", err);
            notify(`Error loading project: ${err.message}`, 'error');
            resetWorkspace();
        } finally {
            showLoader(false);
        }
    } else if (!projectId && s.editId) {
        resetWorkspace();
    }

    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    if (modalId && document.getElementById(modalId)) {
        if (modalId === 'code-modal') {
             showCode();
        } else if (modalId === 'version-history-modal' && s.editId) {
             loadVersionHistory();
             toggleModal('version-history-modal', true);
        } else {
            toggleModal(modalId, true);
        }
    }
};

// --- INITIALIZATION & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    handleRouteChange();
    renderChatHistory();
    initAskChat();

    // --- Header Project Dropdown Toggle & Search ---
    const dropdownTrigger = $('project-dropdown-trigger');
    const dropdownList = $('header-project-list');
    const searchInput = $('header-project-search');
    
    if (dropdownTrigger && dropdownList) {
        dropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownList.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!dropdownTrigger.contains(e.target) && !dropdownList.contains(e.target)) {
                dropdownList.classList.add('hidden');
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = document.querySelectorAll('#header-project-items-container .project-dropdown-item');
            items.forEach(item => {
                const nameEl = item.querySelector('.p-name');
                const infoText = item.innerText.toLowerCase();
                if (item.innerText.includes("Create New Project")) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = infoText.includes(term) ? 'flex' : 'none';
                }
            });
        });
        searchInput.addEventListener('click', (e) => e.stopPropagation());
    }

    // --- Tab Switching Logic ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.panel-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.dataset.target;
            panels.forEach(p => p.classList.add('hidden'));
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) targetPanel.classList.remove('hidden');
        });
    });

    // --- Main Controls ---
    const on = (id, event, cb) => { const el = $(id); if (el) el.addEventListener(event, cb); };

    on('login-btn', 'click', handleSignIn);
    on('logout-btn', 'click', handleSignOut);
    
    on('new-project-btn', 'click', async () => {
        const input = $('new-project-name-input');
        if(input) input.value = '';
        
        // Populate Workspace Dropdown
        const workspaceSelect = $('new-project-workspace-select');
        if (workspaceSelect && s.user) {
            // Reset to default
            workspaceSelect.innerHTML = '<option value="personal">Personal Project</option>';
            workspaceSelect.innerHTML += '<option disabled>Loading teams...</option>';
            
            try {
                // Query workspaces where current user is a member
                const q = query(collection(db, "workspaces"), where("memberIds", "array-contains", s.user.uid));
                const snap = await getDocs(q);
                
                // Clear "Loading..."
                workspaceSelect.innerHTML = '<option value="personal">Personal Project</option>';
                
                snap.forEach(doc => {
                    const team = doc.data();
                    const opt = document.createElement('option');
                    opt.value = doc.id;
                    opt.textContent = `Team: ${team.name}`;
                    workspaceSelect.appendChild(opt);
                });
            } catch (e) {
                console.error("Error fetching workspaces:", e);
                workspaceSelect.innerHTML = '<option value="personal">Personal Project</option><option disabled>Error loading teams</option>';
            }
        }

        toggleModal('new-project-modal', true);
    });

    on('confirm-create-project-btn', 'click', async () => {
        const nameEl = $('new-project-name-input');
        const modeEl = $('new-project-mode-select');
        const workspaceEl = $('new-project-workspace-select'); // Get the workspace dropdown
        
        const name = nameEl ? nameEl.value.trim() : '';
        const mode = modeEl ? modeEl.value : 'website';
        const workspaceId = workspaceEl ? workspaceEl.value : 'personal';

        if (!name) return notify('Please enter a project name.', 'error');
        
        const btn = $('confirm-create-project-btn');
        setLoading(btn, true, 'Creating...');
        
        // Pass null if personal, otherwise the ID
        const finalWorkspaceId = workspaceId === 'personal' ? null : workspaceId;

        // NOTE: Ensure your createNewProject in templates.js accepts the 3rd argument
        const success = await createNewProject(name, mode, finalWorkspaceId);
        
        if (success) {
            toggleModal('new-project-modal', false);
            setTimeout(() => { startProjectWizard(); }, 500);
        }
        setLoading(btn, false);
    });

    // --- Header & Workspace Actions ---
    on('visual-edit-btn', 'click', () => openVisualEditor());
    on('save-btn', 'click', () => toggleModal('save-modal', true));
    on('code-btn', 'click', () => {
        openIDE();
    });
    
    on('history-btn', 'click', () => {
        if (s.editId) {
            loadVersionHistory();
            const frame = $('version-preview-frame');
            if(frame) frame.srcdoc = '';
            const title = $('version-preview-title');
            if(title) title.textContent = 'Select a version to preview';
            const restoreBtn = $('restore-version-btn');
            if(restoreBtn) restoreBtn.disabled = true;
            s.selectedVersionId = null;
            toggleModal('version-history-modal', true);
        }
    });

    on('view-new-tab-btn', 'click', () => {
        if (s.html) { const blob = new Blob([s.html], { type: 'text/html' }); window.open(URL.createObjectURL(blob), '_blank'); }
    });

    // --- Deploy Button Logic ---
    const deployContainer = $('header-deploy-container');
    if (deployContainer) {
        deployContainer.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            if (btn.id === 'header-deploy-btn' || btn.id === 'header-redeploy-btn') {
                if (!s.editId) return;
                setLoading(btn, true, 'Deploying...');
                try {
                    const docSnap = await getDoc(doc(db, "ai_templates", s.editId));
                    if (!docSnap.exists()) throw new Error("Project not found.");
                    const pData = docSnap.data();

                    const settingsSnap = await getDoc(doc(db, "settings", "api_keys"));
                    if (!settingsSnap.exists()) throw new Error("API Settings missing.");
                    const netlifyToken = settingsSnap.data().netlifyToken;
                    if (!netlifyToken) throw new Error("Netlify Token not configured.");

                    const zip = new JSZip();
                    const cleanHtml = (pData.htmlContent || "").trim();
                    zip.file("index.html", cleanHtml);
                    zip.file("_headers", "/*\n  Content-Type: text/html; charset=utf-8\n");
                    const zipBlob = await zip.generateAsync({ type: "blob" });

                    let targetUrl = "https://api.netlify.com/api/v1/sites";
                    if (pData.netlifySiteId) targetUrl = `https://api.netlify.com/api/v1/sites/${pData.netlifySiteId}/deploys`;
                    const proxyUrl = "https://cors.eu.org/" + targetUrl;

                    const res = await fetch(proxyUrl, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${netlifyToken}`, 'Content-Type': 'application/zip' },
                        body: zipBlob
                    });

                    if (!res.ok) {
                        const errText = await res.text();
                        if (res.status === 404 && pData.netlifySiteId) throw new Error("Linked site not found. Clear netlifySiteId in DB.");
                        throw new Error(`Netlify Error: ${res.status} - ${errText}`);
                    }

                    const result = await res.json();
                    const siteId = result.site_id || result.id;
                    const siteName = result.subdomain || result.name;
                    const deploymentUrl = `https://${siteName}.netlify.app`;

                    await updateDoc(doc(db, "ai_templates", s.editId), { 
                        deploymentUrl: deploymentUrl, netlifySiteId: siteId, siteName: siteName, isDirty: false 
                    });

                    notify('🚀 Deployed successfully!', 'success');
                    loadTemplates(); 
                } catch (err) {
                    notify(`Deploy failed: ${err.message}`, 'error');
                } finally {
                    setLoading(btn, false);
                }
            }
        });
    }

    // --- Responsive Toggles ---
    const toggleContainer = $('responsive-toggles');
    if (toggleContainer) {
        toggleContainer.addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            document.querySelectorAll('#responsive-toggles button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const frame = $('preview-frame');
            if (frame) {
                frame.style.width = btn.dataset.size;
                frame.style.height = btn.dataset.size === '100%' ? '100%' : '80vh';
            }
        });
    }

    // ============================================================
    // --- ALL CHAT HISTORY ACTIONS (Edit, Media, Pills, etc.) ---
    // ============================================================
    const chatHistoryEl = $('chat-history');
    if (chatHistoryEl) {
        chatHistoryEl.addEventListener('click', async (e) => {
            const target = e.target;

            // 1. Media Preview (Images)
            if (target.matches('.chat-message-img')) {
                const src = target.src;
                const modal = $('media-preview-modal');
                const content = $('media-preview-content');
                if (modal && content) {
                    content.innerHTML = `<img src="${src}" style="max-height: 80vh; max-width: 90vw; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">`;
                    toggleModal('media-preview-modal', true);
                }
                return;
            }

            // 2. Pill Interactions (Mentions)
            const pill = target.closest('.mention-pill');
            if (pill) {
                if (pill.dataset.url) {
                    const modal = $('media-preview-modal');
                    const content = $('media-preview-content');
                    if (modal && content) {
                        content.innerHTML = `<img src="${pill.dataset.url}" style="max-height: 80vh; max-width: 90vw; border-radius: 8px;">`;
                        toggleModal('media-preview-modal', true);
                    }
                } 
                else if (pill.dataset.id) {
                    if (s.editId) {
                        toggleModal('collections-modal', true);
                        import('./firestore.js').then(async m => {
                            await m.renderProjectCollections();
                            s.currentCollectionId = pill.dataset.id;
                            const col = s.currentProjectData.projectCollections.find(c => c.id === pill.dataset.id);
                            s.currentCollectionName = col ? col.name : 'Collection';
                            
                            document.querySelectorAll('#collections-list .firestore-item').forEach(el => el.classList.remove('active'));
                            setTimeout(() => {
                                const item = document.querySelector(`.firestore-item[data-collection-id="${pill.dataset.id}"]`);
                                if(item) item.classList.add('active');
                            }, 50);
                            
                            await m.loadDocuments(pill.dataset.id);
                        });
                    }
                }
                return;
            }

            // 3. Inline Editing Logic
            const saveBtn = target.closest('.chat-edit-btn.save');
            const cancelBtn = target.closest('.chat-edit-btn.cancel');

            if (saveBtn) {
                const messageEl = saveBtn.closest('.user-message') || saveBtn.closest('.ai-message');
                const index = parseInt(messageEl.dataset.messageIndex, 10);
                const textarea = messageEl.querySelector('.chat-edit-textarea');
                const newText = textarea.value.trim();

                if (newText) {
                    s.chatHistory[index].text = newText;
                    import('./ai-core.js').then(m => m.renderChatHistory());
                }
                return;
            }

            if (cancelBtn) {
                import('./ai-core.js').then(m => m.renderChatHistory());
                return;
            }

            // 4. Header Actions (Edit, Copy, Rerun, Delete)
            const actionBtn = target.closest('.chat-actions .btn-icon');
            if (!actionBtn) return;

            const messageEl = actionBtn.closest('.user-message');
            const messageIndex = parseInt(messageEl.dataset.messageIndex, 10);
            const message = s.chatHistory[messageIndex];
            const action = actionBtn.dataset.action;

            switch (action) {
                case 'edit':
                    if (messageEl.querySelector('.chat-edit-wrapper')) return;
                    const actionsDiv = messageEl.querySelector('.chat-actions');
                    if(actionsDiv) actionsDiv.style.display = 'none';
                    const rawText = message.text; 
                    const editHTML = `
                        <div class="chat-edit-wrapper">
                            <textarea class="chat-edit-textarea">${rawText}</textarea>
                            <div class="chat-edit-actions">
                                <button class="chat-edit-btn cancel">Cancel</button>
                                <button class="chat-edit-btn save">Save</button>
                            </div>
                        </div>
                    `;
                    messageEl.innerHTML = editHTML;
                    const ta = messageEl.querySelector('textarea');
                    if(ta) {
                        ta.focus();
                        ta.style.height = ta.scrollHeight + 'px';
                    }
                    break;

                case 'copy':
                    navigator.clipboard.writeText(message.text).then(() => notify('Message copied!', 'success'));
                    break;

                case 'rerun':
                    s.chatHistory.splice(messageIndex); 
                    import('./ai-core.js').then(m => {
                        m.renderChatHistory();
                        m.addUserMessageToChat(message.text);
                    });
                    break;

                case 'delete':
                    if (s.chatHistory[messageIndex + 1]?.role === 'ai') {
                        s.chatHistory.splice(messageIndex, 2);
                    } else {
                        s.chatHistory.splice(messageIndex, 1);
                    }
                    import('./ai-core.js').then(m => m.renderChatHistory());
                    break;
            }
        });
    }

    // --- Chat Inputs ---
on('send-chat-btn', 'click', () => {
    const input = $('chat-input');
    if (input.value.trim() || s.pendingAttachment) {
        addUserMessageToChat(input.value);
    }
});
    const chatInp = $('chat-input');
    if (chatInp) {
        chatInp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addUserMessageToChat(e.target.value); }
        });
        chatInp.addEventListener('input', (e) => {
            updateChatInputVisual();
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
            handleImageMention(e);
            handleCollectionMention(e);
        });
        chatInp.addEventListener('scroll', () => {
            const visualEl = $('chat-input-visual');
            if (visualEl) visualEl.scrollTop = chatInp.scrollTop;
        });
    }
    on('generate-btn', 'click', () => addUserMessageToChat($('chat-input').value));
    on('enhance-prompt-btn', 'click', enhancePrompt);

    // --- File Attachment Logic (Cloudinary) ---
    const fileInput = document.getElementById('chat-file-upload');
    const attachBtn = document.getElementById('attach-file-btn');
    const removeAttachBtn = document.getElementById('remove-attachment-btn');
    const previewContainer = document.getElementById('attachment-preview');
    const nameEl = document.getElementById('attachment-name');
    
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const originalIcon = attachBtn.innerHTML;
            attachBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
            attachBtn.disabled = true;
            notify("Uploading file...", "info");

            try {
                const cloudData = await uploadToCloudinary(file);
                const localData = await processFile(file);

                s.pendingAttachment = {
                    name: file.name,
                    url: cloudData.secure_url,
                    content: localData.content,
                    type: localData.isImage ? 'image' : (localData.isText ? 'text' : 'file')
                };
                
                previewContainer.classList.remove('hidden');
                nameEl.innerHTML = ''; 
                
                if (s.pendingAttachment.type === 'image') {
                    const img = document.createElement('img');
                    img.src = s.pendingAttachment.url; 
                    nameEl.appendChild(img);
                    const span = document.createElement('span');
                    span.className = 'attachment-info';
                    span.textContent = file.name;
                    nameEl.appendChild(span);
                    nameEl.style.display = 'flex'; 
                    nameEl.style.alignItems = 'center'; 
                    nameEl.style.gap = '10px';
                } else {
                    nameEl.innerHTML = `<i class="fas fa-file-alt"></i> <span class="attachment-info">${file.name}</span>`;
                }
                notify("File uploaded!", "success");

            } catch (err) {
                console.error(err);
                notify("Upload failed.", "error");
            } finally {
                attachBtn.innerHTML = originalIcon;
                attachBtn.disabled = false;
            }
        });
    }

    if (removeAttachBtn) {
        removeAttachBtn.addEventListener('click', () => {
            s.pendingAttachment = null;
            document.getElementById('chat-file-upload').value = '';
            document.getElementById('attachment-preview').classList.add('hidden');
        });
    }

    // --- Mentions ---
    on('image-mention-popup', 'click', e => {
        const item = e.target.closest('.mention-item'); if (!item) return;
        const input = s.activeMentionInput; if (!input) return;
        s.chatMentions.push({ 
            type: 'image', 
            data: { id: item.dataset.id, name: item.dataset.name, url: item.dataset.url } 
        });
        const mentionIndex = s.chatMentions.length;
        const text = input.value; 
        const cursorPos = input.selectionStart;
        const match = text.substring(0, cursorPos).match(/\B@([a-zA-Z0-9_.-]*)$/);
        if (match) { 
            input.value = text.substring(0, match.index) + `${item.dataset.name} [${mentionIndex}] ` + text.substring(cursorPos); 
        }
        input.focus(); 
        updateChatInputVisual();
        renderMentionedAssets();
        $('image-mention-popup').classList.add('hidden'); 
    });

    on('collection-mention-popup', 'click', e => {
        const item = e.target.closest('.mention-item'); if (!item) return;
        const input = s.activeMentionInput; if (!input) return;
        s.chatMentions.push({
            type: 'collection',
            data: { id: item.dataset.id, name: item.dataset.name }
        });
        const mentionIndex = s.chatMentions.length;
        const text = input.value;
        const cursorPos = input.selectionStart;
        const match = text.substring(0, cursorPos).match(/\B#([a-zA-Z0-9_.-]*)$/);
        if (match) {
            input.value = text.substring(0, match.index) + `${item.dataset.name} [${mentionIndex}] ` + text.substring(cursorPos);
        }
        input.focus();
        updateChatInputVisual();
        renderMentionedAssets();
        $('collection-mention-popup').classList.add('hidden');
    });

    on('mentioned-assets-container', 'click', e => {
        const removeBtn = e.target.closest('.remove-mention-btn');
        if (!removeBtn) return;
        const thumbnail = removeBtn.closest('.mention-thumbnail');
        const indexToRemove = parseInt(thumbnail.dataset.mentionIndex, 10);
        const mentionToRemove = s.chatMentions[indexToRemove];
        const textToRemove = `${mentionToRemove.data.name} [${indexToRemove + 1}]`;
        let currentText = $('chat-input').value;
        currentText = currentText.replace(textToRemove, '');
        s.chatMentions.splice(indexToRemove, 1);
        for (let i = indexToRemove; i < s.chatMentions.length; i++) {
            const mentionToUpdate = s.chatMentions[i];
            const oldMarker = `[${i + 2}]`;
            const newMarker = `[${i + 1}]`;
            currentText = currentText.replace(`${mentionToUpdate.data.name} ${oldMarker}`, `${mentionToUpdate.data.name} ${newMarker}`);
        }
        $('chat-input').value = currentText.replace(/\s\s+/g, ' ').trim();
        updateChatInputVisual();
        renderMentionedAssets();
    });

    on('collaborators-list', 'click', async (e) => {
        // Profile Click Handler inside Collaborator List
        const trigger = e.target.closest('.profile-trigger');
        if (trigger) {
            const uid = trigger.dataset.uid;
            if (uid) openUserProfile(uid);
            return;
        }

        const removeBtn = e.target.closest('.collaborator-item__remove-btn');
        if (removeBtn && s.currentUserRole === 'owner') {
            const item = removeBtn.closest('.collaborator-item');
            const uidToRemove = item.dataset.uid;
            if (!s.editId || !uidToRemove) return;
            if (confirm('Remove collaborator?')) {
                try {
                    const projectRef = doc(db, "ai_templates", s.editId);
                    await updateDoc(projectRef, {
                        sharedWith: arrayRemove(uidToRemove),
                        [`collaborators.${uidToRemove}`]: deleteField()
                    });
                     notify('Removed.', 'success');
                } catch (err) {
                     notify(`Error: ${err.message}`, 'error');
                }
            }
        }
    });

    // --- Header Profile Click ---
    const collabContainer = $('collaborators-container');
    if (collabContainer) {
        collabContainer.addEventListener('click', (e) => {
            const trigger = e.target.closest('.profile-trigger');
            if (trigger) {
                const uid = trigger.dataset.uid;
                if (uid) openUserProfile(uid);
            }
        });
    }

    // --- Save Logic ---
    on('confirm-save-btn', 'click', async () => {
        setLoading($('confirm-save-btn'), true, 'Saving...');
        const success = await saveProject();
        if (success) toggleModal('save-modal', false);
        setLoading($('confirm-save-btn'), false);
    });

    // --- Version History ---
    on('versions-list', 'click', async (e) => {
        const item = e.target.closest('.version-item');
        if (!item) return;
        s.selectedVersionId = item.dataset.versionId;
        document.querySelectorAll('.version-item.active').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        try {
            const versionDoc = await getDoc(doc(db, "ai_templates", s.editId, "versions", s.selectedVersionId));
            if (versionDoc.exists()) {
                const data = versionDoc.data();
                const frame = $('version-preview-frame');
                if(frame) frame.srcdoc = data.htmlContent;
                const title = $('version-preview-title');
                if(title) {
                    const date = data.savedAt ? new Date(data.savedAt.seconds * 1000).toLocaleString() : '';
                    title.textContent = `Previewing: ${date}`;
                }
                const resBtn = $('restore-version-btn');
                if(resBtn) resBtn.disabled = false;
            }
        } catch (err) {
            notify("Error loading preview.", 'error');
        }
    });
    on('restore-version-btn', 'click', restoreVersion);

    // --- Image Manager ---
    on('upload-image-btn', 'click', () => {
        const inp = $('image-upload-input');
        if(inp) inp.click();
    });
    
    on('image-upload-input', 'change', async e => {
        const files = Array.from(e.target.files); 
        if (files.length === 0 || !s.editId) return;
        setLoading($('upload-image-btn'), true, `Uploading...`);
        
        const collectionPath = `ai_templates/${s.editId}/project_images`;
        const uploadPromises = files.map(async (file) => {
            try {
                const cloudData = await uploadToCloudinary(file);
                const docData = {
                    name: file.name.split('.').slice(0, -1).join('.') || file.name,
                    url: cloudData.secure_url,
                    publicId: cloudData.public_id,
                    createdAt: serverTimestamp()
                };
                return addDoc(collection(db, collectionPath), docData);
            } catch (err) {
                notify(`Failed: ${file.name}`, 'error');
                return Promise.reject(err);
            }
        });
        try { await Promise.all(uploadPromises); }
        catch (err) { console.error("Bulk upload error:", err); }
        e.target.value = '';
        setLoading($('upload-image-btn'), false);

        s.currentProjectData.projectImages = await loadProjectImages(s.editId);
        renderProjectImages();
    });
    
    on('images-list', 'change', handleImageRename);

    // --- Project Search ---
    on('search-input', 'input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        document.querySelectorAll('#templates-list .template-card, #shared-templates-list .template-card').forEach(card => {
            const projectName = card.dataset.name || '';
            card.style.display = projectName.includes(searchTerm) ? 'flex' : 'none';
        });
    });

    // --- Template List Actions (Event Delegation) ---
    const handleTemplateClick = async (e) => {
        const btn = e.target.closest('button, a'); 
        if (!btn) return;
        const id = btn.dataset.id;
        if (!id) return;
        if (btn.tagName === 'A') return; 
        
        e.preventDefault(); 
        if (btn.classList.contains('load-btn')) { 
            const docSnap = await getDoc(doc(db, "ai_templates", id)); 
            if (docSnap.exists()) loadProject(docSnap.data(), docSnap.id);
        } else if (btn.classList.contains('template-card__delete-btn')) { 
            const delModal = $('delete-modal');
            if(delModal) { delModal.dataset.id = id; toggleModal('delete-modal', true); }
        } else if (btn.classList.contains('template-card__donate-btn')) {
            const fileInput = document.createElement('input'); 
            fileInput.type = 'file'; 
            fileInput.accept = 'image/*'; 
            fileInput.style.display = 'none';
            fileInput.dataset.projectId = id; 
            fileInput.addEventListener('change', handleDonationUpload);
            document.body.appendChild(fileInput); 
            fileInput.click(); 
            document.body.removeChild(fileInput);
        }
    };
    
    on('templates-list', 'click', handleTemplateClick);
    on('shared-templates-list', 'click', handleTemplateClick);

    on('confirm-delete-btn', 'click', async () => {
        const id = $('delete-modal').dataset.id; if (!id) return;
        setLoading($('confirm-delete-btn'), true, 'Deleting...');
        await deleteDoc(doc(db, "ai_templates", id));
        toggleModal('delete-modal', false);
        await Promise.all([loadTemplates(), loadSharedProjects()]);
        setLoading($('confirm-delete-btn'), false);
    });

    // --- Collections ---
    on('add-collection-btn', 'click', async () => {
        const name = prompt("Name for new database collection:"); 
        if (!name || !name.trim() || !s.editId) return;
        const collectionRef = collection(db, `ai_templates/${s.editId}/project_collections`);
        const docData = { name: name.trim(), createdAt: serverTimestamp() };
        try {
            await addDoc(collectionRef, docData);
            notify('Collection created!', 'success');
            s.currentProjectData.projectCollections = await loadProjectCollections(s.editId);
            renderProjectCollections();
        } catch (e) { notify(`Error: ${e.message}`, 'error'); }
    });

    on('view-toggles', 'click', (e) => {
        const btn = e.target.closest('.view-toggle-btn');
        if (!btn) return;
        const view = btn.dataset.view;
        document.querySelectorAll('#view-toggles .view-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tList = $('templates-list');
        const sList = $('shared-templates-list');
        if(tList) tList.classList.toggle('hidden', view !== 'my-projects');
        if(sList) sList.classList.toggle('hidden', view === 'my-projects');
    });

    // --- Asset Modals ---
    on('project-db-btn', 'click', () => { if (s.editId) { toggleModal('collections-modal', true); renderProjectCollections(); } });
    on('project-images-btn', 'click', () => { if (s.editId) { toggleModal('images-modal', true); renderProjectImages(); } });

    // --- Modal Navigation ---
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) toggleModal(e.target.id, false);
        if (e.target.matches('.modal__close, #cancel-delete-btn, #close-notification-btn')) {
            const modal = e.target.closest('.modal');
            if (modal) toggleModal(modal.id, false);
        }
        // Media Preview Close
        if(e.target.id === 'media-preview-modal') {
            toggleModal('media-preview-modal', false);
        }
    });

    window.addEventListener('popstate', () => { setTimeout(handleRouteChange, 0); });

    // --- Context Menu Logic ---
    const contextMenu = $('custom-context-menu');
    let currentContext = null;
    const handleOutsideClick = (e) => { if (!contextMenu.contains(e.target)) { hideContextMenu(); } };
    const hideContextMenu = () => {
        if (contextMenu && !contextMenu.classList.contains('hidden')) {
            contextMenu.classList.add('hidden');
            document.removeEventListener('mousedown', handleOutsideClick);
        }
    };
    const showContextMenu = (e, menuConfig) => {
        e.preventDefault(); e.stopPropagation();
        const items = $('context-menu-items');
        if(items) {
            items.innerHTML = menuConfig.map(item => {
                if (item.type === 'divider') return '<li class="context-menu-divider"></li>';
                return `<li data-action="${item.action}" class="${item.class || ''}"><i class="fas ${item.icon}"></i><span>${item.label}</span></li>`;
            }).join('');
        }
        contextMenu.classList.remove('hidden');
        const { clientX: mouseX, clientY: mouseY } = e.touches ? e.touches[0] : e;
        const { innerWidth, innerHeight } = window;
        const menuWidth = contextMenu.offsetWidth; const menuHeight = contextMenu.offsetHeight;
        let top = mouseY; let left = mouseX;
        if (mouseX + menuWidth > innerWidth) left = innerWidth - menuWidth - 5;
        if (mouseY + menuHeight > innerHeight) top = innerHeight - menuHeight - 5;
        contextMenu.style.top = `${top}px`; contextMenu.style.left = `${left}px`;
        document.addEventListener('mousedown', handleOutsideClick);
    };

    if (contextMenu) {
        contextMenu.addEventListener('click', async (e) => {
            const actionItem = e.target.closest('[data-action]');
            if (!actionItem || !currentContext) return;
            hideContextMenu();
            const { action } = actionItem.dataset;
            const { assetType, id, name } = currentContext;
            if (!s.editId) return;
            const currentPath = assetType === 'image' ? `ai_templates/${s.editId}/project_images` : `ai_templates/${s.editId}/project_collections`;
            switch (action) {
                case 'edit':
                    const newName = prompt(`New name for "${name}":`, name);
                    if (newName && newName.trim()) {
                        try {
                            await updateDoc(doc(db, currentPath, id), { name: newName.trim() });
                            notify('Renamed.', 'success');
                            if (assetType === 'image') {
                                s.currentProjectData.projectImages = await loadProjectImages(s.editId);
                                renderProjectImages();
                            } else {
                                s.currentProjectData.projectCollections = await loadProjectCollections(s.editId);
                                renderProjectCollections();
                            }
                        } catch (err) { notify(`Error: ${err.message}`, 'error'); }
                    }
                    break;
                case 'delete':
                    if (confirm(`Remove "${name}"?`)) {
                        try {
                            await deleteDoc(doc(db, currentPath, id));
                            notify('Removed.', 'success');
                            if (assetType === 'image') {
                                s.currentProjectData.projectImages = s.currentProjectData.projectImages.filter(i => i.id !== id);
                                renderProjectImages();
                            } else {
                                s.currentProjectData.projectCollections = s.currentProjectData.projectCollections.filter(c => c.id !== id);
                                renderProjectCollections();
                            }
                        } catch (err) { notify(`Error: ${err.message}`, 'error'); }
                    }
                    break;
            }
        });
    }

    on('images-modal', 'click', async (e) => {
        const target = e.target;
        if (target.closest('.modal__close')) { toggleModal('images-modal', false); return; }
        const menuBtn = target.closest('.image-item__menu-btn');
        if (menuBtn) {
            const item = menuBtn.closest('.image-card'); if (!item) return;
            currentContext = { assetType: 'image', id: item.dataset.id, name: item.querySelector('textarea').value };
            showContextMenu(e, [
                { label: 'Edit Name', action: 'edit', icon: 'fa-pencil-alt' },
                { label: 'Remove', action: 'delete', icon: 'fa-times-circle', class: 'danger' }
            ]);
        }
    });

    on('collections-modal', 'click', async (e) => {
        const target = e.target;
        if (target.closest('.modal__close')) { toggleModal('collections-modal', false); return; }
        const menuBtn = target.closest('.collection-item__menu-btn');
        if (menuBtn) {
            const item = menuBtn.closest('.firestore-item'); if (!item) return;
            currentContext = { assetType: 'collection', id: item.dataset.collectionId, name: item.dataset.collectionName };
            showContextMenu(e, [
                { label: 'Edit Name', action: 'edit', icon: 'fa-pencil-alt' },
                { label: 'Remove', action: 'delete', icon: 'fa-times-circle', class: 'danger' }
            ]);
            return;
        }
        const collectionItem = target.closest('.firestore-item[data-collection-id]');
        if (collectionItem) {
            s.currentCollectionId = collectionItem.dataset.collectionId;
            s.currentCollectionName = collectionItem.dataset.collectionName;
            s.currentDocumentIndex = null; s.currentDocumentData = null;
            document.querySelectorAll('#collections-list .firestore-item').forEach(el => el.classList.remove('active'));
            collectionItem.classList.add('active');
            renderFirestoreData();
            await loadDocuments(s.currentCollectionId);
        }
        const documentItem = target.closest('.firestore-item[data-doc-index]');
        if (documentItem) {
            s.currentDocumentIndex = parseInt(documentItem.dataset.docIndex, 10);
            s.currentDocumentData = s.documents[s.currentDocumentIndex];
            document.querySelectorAll('#documents-list .firestore-item').forEach(el => el.classList.remove('active'));
            documentItem.classList.add('active');
            renderFirestoreDocuments();
            renderFirestoreData();
        }
    });

    // Avatar Selection
    on('avatar-selection-modal', 'click', async (e) => {
        const target = e.target;
        if (!target.matches('.avatar-item')) return;
        const newAvatarUrl = target.src;
        const uAv = $('user-avatar');
        if(uAv) uAv.src = newAvatarUrl;
        if (s.user) {
            try { await updateDoc(doc(db, "users", s.user.uid), { photoURL: newAvatarUrl }); } 
            catch (err) { console.error("Avatar save error:", err); }
        }
        toggleModal('avatar-selection-modal', false);
    });
    
    const profileTrigger = document.querySelector('.user-profile__trigger'); 
    if (profileTrigger) {
        profileTrigger.addEventListener('click', () => {
             const grid = $('avatar-grid');
             if(grid) grid.innerHTML = AVATAR_LIST.map(url => `<img src="${url}" alt="Avatar option" class="avatar-item ${url === $('user-avatar').src ? 'selected' : ''}">`).join('');
             toggleModal('avatar-selection-modal', true);
        });
    }
    document.getElementById('visual-edit-btn')?.addEventListener('click', () => {
    openVisualEditor();
});
});

// Run Button for IDE
document.getElementById('ide-run-btn')?.addEventListener('click', () => {
    s.html = compileForPreview();
    const frame = document.getElementById('preview-frame');
    if(frame) frame.srcdoc = s.html;
    notify("Preview updated!", "success");
});

document.getElementById('ide-save-btn')?.addEventListener('click', async () => {
    if(!s.editId) return notify("Save the project first using the main Save button.", "error");
    const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js");
    s.html = compileForPreview(); 
    await updateDoc(doc(db, "ai_templates", s.editId), { files: s.files, htmlContent: s.html });
    notify("Files saved.", "success");
});

window.editors = {};
const initProEditors = () => {
    try {
        if(!document.getElementById('code-html')) return;
        window.editors.html = CodeMirror.fromTextArea(document.getElementById('code-html'), { mode: 'text/html', theme: 'material-darker', lineNumbers: true, autoCloseTags: true, autoCloseBrackets: true, matchBrackets: true, tabSize: 2, indentUnit: 2, viewportMargin: Infinity, lineWrapping: false, gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"], foldGutter: true });
        window.editors.css = CodeMirror.fromTextArea(document.getElementById('code-css'), { mode: 'css', theme: 'material-darker', lineNumbers: true, autoCloseBrackets: true, matchBrackets: true, tabSize: 2, indentUnit: 2, viewportMargin: Infinity, gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"], foldGutter: true });
        window.editors.js = CodeMirror.fromTextArea(document.getElementById('code-js'), { mode: 'javascript', theme: 'material-darker', lineNumbers: true, autoCloseBrackets: true, matchBrackets: true, tabSize: 2, indentUnit: 2, viewportMargin: Infinity, gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"], foldGutter: true });
    } catch (err) { console.warn('CodeMirror init failed:', err); }
};
initProEditors();