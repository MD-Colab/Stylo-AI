// Adjusted imports: up two levels to Project/js
import { db } from '../../Project/js/firebase-config.js';
import { addDoc, collection, doc, deleteDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
// Adjusted imports: up one level to Profile root
import { state } from '../profile-state.js';
import { $, notify, toggleModal, setLoading } from '../profile-utils.js';
import { fetchUserProjectsAndImages } from '../profile-data.js';

export const initDatabases = () => {
    $('#global-create-collection-btn')?.addEventListener('click', openCreateCollectionModal);
    $('#confirm-create-collection-btn')?.addEventListener('click', handleCreateCollection);
    $('#database-gallery-container')?.addEventListener('click', handleDatabaseActions);
};

export const renderDatabasesSection = () => {
    const container = $('#database-gallery-container');
    if (!container) return;
    if (state.userCollections.length === 0) return container.innerHTML = `<div class="empty-state">No databases created yet.</div>`;
    
    container.innerHTML = `<div class="pricing-grid">
        ${state.userCollections.map(col => `
            <div class="db-card" data-project-id="${col.projectId}" data-collection-id="${col.collectionId}">
                <div style="display:flex; gap:1rem; align-items:center;">
                    <div class="db-icon-wrapper"><i class="fas fa-database"></i></div>
                    <div class="db-info"><h4 class="db-name">${col.name}</h4><p>${col.projectName}</p></div>
                </div>
                <div class="db-actions">
                    <button class="btn-icon btn-edit-db"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-icon btn-delete-db"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>`).join('')}
    </div>`;
};

function openCreateCollectionModal() {
    const select = $('#collection-project-select');
    select.innerHTML = state.userProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    if(state.userProjects.length === 0) {
        select.innerHTML = `<option disabled>No projects found</option>`;
        $('#confirm-create-collection-btn').disabled = true;
    } else {
        $('#confirm-create-collection-btn').disabled = false;
    }
    toggleModal('create-collection-modal', true);
}

async function handleCreateCollection() {
    const pid = $('#collection-project-select').value;
    const name = $('#new-collection-name').value.trim();
    if (!pid || !name) return notify("Fill all fields.", "error");

    setLoading($('#confirm-create-collection-btn'), true);
    try {
        await addDoc(collection(db, `ai_templates/${pid}/project_collections`), { name, createdAt: serverTimestamp() });
        notify('Created.', 'success');
        toggleModal('create-collection-modal', false);
        fetchUserProjectsAndImages();
    } catch(e) { notify("Error creating DB.", "error"); } finally { setLoading($('#confirm-create-collection-btn'), false); }
}

function handleDatabaseActions(e) {
    const edit = e.target.closest('.btn-edit-db');
    const del = e.target.closest('.btn-delete-db');
    const card = e.target.closest('.db-card');
    if(!card) return;
    const { projectId, collectionId } = card.dataset;
    
    if (edit) {
        const newName = prompt("New name:", card.querySelector('.db-name').textContent);
        if (newName && newName.trim()) {
             updateDoc(doc(db, `ai_templates/${projectId}/project_collections`, collectionId), { name: newName.trim() })
             .then(() => { notify("Renamed.", "success"); fetchUserProjectsAndImages(); });
        }
    }
    if (del && confirm("Delete database?")) {
        deleteDoc(doc(db, `ai_templates/${projectId}/project_collections`, collectionId))
        .then(() => { notify("Deleted.", "success"); fetchUserProjectsAndImages(); });
    }
}