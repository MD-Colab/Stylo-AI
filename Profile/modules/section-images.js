// Adjusted imports: up two levels to Project/js
import { db } from '../../Project/js/firebase-config.js';
import { updateDoc, doc, addDoc, collection, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
// Adjusted imports: up one level to Profile root
import { state } from '../profile-state.js';
import { $, notify } from '../profile-utils.js';

export const initImages = () => {
    $('#image-gallery-container')?.addEventListener('click', handleImageActions);
    document.body.addEventListener('click', (e) => {
         if (!e.target.closest('.custom-context-menu') && !e.target.closest('.export-image-btn')) {
             $('#custom-context-menu').classList.add('hidden');
        }
    });
};

export const renderImagesSection = () => {
    const container = $('#image-gallery-container');
    if (!container) return;
    if (state.userImages.length === 0) {
        container.innerHTML = `<div class="empty-state">You haven't uploaded any images yet.</div>`;
        return;
    }
    container.innerHTML = `<div class="image-gallery-grid">
        ${state.userImages.map(img => `
            <div class="image-gallery-item" data-project-id="${img.projectId}" data-image-id="${img.imageId}">
                <img src="${img.url}" alt="${img.name}" loading="lazy">
                <div class="image-gallery-overlay" style="flex-direction:column; align-items:flex-start; padding:10px;">
                    <span class="image-name">${img.name}</span>
                    <div class="image-actions" style="width:100%; display:flex; justify-content:flex-end; margin-top:10px;">
                        <button class="btn-icon edit-name-btn"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn-icon export-image-btn"><i class="fas fa-share-square"></i></button>
                        <button class="btn-icon delete-image-btn"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            </div>`).join('')}
    </div>`;
};

function handleImageActions(e) {
    const item = e.target.closest('.image-gallery-item');
    if (!item) return;
    const { projectId, imageId } = item.dataset;

    if (e.target.closest('.edit-name-btn')) handleImageRename(projectId, imageId);
    if (e.target.closest('.export-image-btn')) showExportContextMenu(e, projectId, imageId);
    if (e.target.closest('.delete-image-btn')) handleImageDelete(projectId, imageId);
}

async function handleImageRename(projectId, imageId) {
    const img = state.userImages.find(i => i.imageId === imageId);
    const newName = prompt("New name:", img.name);
    if (newName && newName.trim()) {
        try {
            await updateDoc(doc(db, "ai_templates", projectId, "project_images", imageId), { name: newName.trim() });
            img.name = newName.trim();
            renderImagesSection();
            notify('Renamed.', 'success');
        } catch(e) { notify('Error renaming.', 'error'); }
    }
}

function showExportContextMenu(event, sourceProjectId, imageId) {
    const menu = $('#custom-context-menu');
    const others = state.userProjects.filter(p => p.id !== sourceProjectId);
    
    let content = '<div class="context-menu-header">Export to Project</div>';
    if (others.length > 0) {
        content += others.map(p => `<button class="context-menu-item" data-target="${p.id}">${p.name}</button>`).join('');
    } else {
        content += `<div class="context-menu-item" style="color:var(--text-light);">No other projects.</div>`;
    }
    menu.innerHTML = content;
    menu.style.top = `${event.pageY}px`;
    menu.style.left = `${event.pageX}px`;
    menu.classList.remove('hidden');

    menu.onclick = (e) => {
        const btn = e.target.closest('.context-menu-item[data-target]');
        if(btn) {
            handleImageExport(imageId, btn.dataset.target);
            menu.classList.add('hidden');
        }
    };
}

async function handleImageExport(imageId, targetPid) {
    const img = state.userImages.find(i => i.imageId === imageId);
    try {
        await addDoc(collection(db, "ai_templates", targetPid, "project_images"), {
            name: img.name, url: img.url, publicId: img.publicId, createdAt: serverTimestamp()
        });
        notify('Image exported!', 'success');
    } catch(e) { notify('Export failed.', 'error'); }
}

async function handleImageDelete(projectId, imageId) {
    if(confirm("Delete image?")) {
        try {
            await deleteDoc(doc(db, "ai_templates", projectId, "project_images", imageId));
            state.userImages = state.userImages.filter(i => i.imageId !== imageId);
            renderImagesSection();
            notify('Deleted.', 'success');
        } catch(e) { notify('Delete failed.', 'error'); }
    }
}