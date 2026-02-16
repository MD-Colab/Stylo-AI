// Adjusted imports: up two levels to Project/js
import { db } from '../../Project/js/firebase-config.js';
import { updateDoc, doc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
// Adjusted imports: up one level to Profile root
import { state } from '../profile-state.js';
import { $, notify, copyToClipboard } from '../profile-utils.js';

export const initApiKeys = () => {
    $('#generate-api-key-btn')?.addEventListener('click', handleApiKeyGenerate);
    $('#api-keys-list')?.addEventListener('click', handleApiKeyActions);
};

export const renderApiKeysSection = () => {
    const listEl = $('#api-keys-list');
    const apiKeys = state.currentUser.apiKeys || [];
    listEl.innerHTML = apiKeys.length === 0 ? `<p class="empty-state">No API keys generated yet.</p>` :
        apiKeys.map(key => `
            <div class="api-key-item" data-key="${key}">
                <div class="api-key-info"><strong>Token</strong><div class="api-key-input-wrapper"><input type="password" readonly class="form__input api-key-input" value="${key}"><button class="btn-icon toggle-visibility-btn"><i class="fas fa-eye"></i></button></div></div>
                <div class="api-key-actions"><button class="btn btn--secondary btn--sm copy-key-btn">Copy</button><button class="btn btn--danger btn--sm delete-key-btn">Delete</button></div>
            </div>`).join('');
};

async function handleApiKeyGenerate() {
    const newKey = `stylo_sk_live_${[...Array(32)].map(() => Math.random().toString(36)[2]).join('')}`;
    try {
        await updateDoc(doc(db, "users", state.currentUser.uid), { apiKeys: arrayUnion(newKey) });
        state.currentUser.apiKeys.push(newKey);
        renderApiKeysSection();
        notify('Key generated.', 'success');
    } catch(e) { notify('Error generating key.', 'error'); }
}

async function handleApiKeyActions(e) {
    const item = e.target.closest('.api-key-item');
    if(!item) return;
    const key = item.dataset.key;

    if (e.target.closest('.delete-key-btn') && confirm("Delete key?")) {
        await updateDoc(doc(db, "users", state.currentUser.uid), { apiKeys: arrayRemove(key) });
        state.currentUser.apiKeys = state.currentUser.apiKeys.filter(k => k !== key);
        renderApiKeysSection();
        notify('Key deleted.', 'success');
    }
    if (e.target.closest('.copy-key-btn')) copyToClipboard(key);
    if (e.target.closest('.toggle-visibility-btn')) {
        const inp = item.querySelector('.api-key-input');
        inp.type = inp.type === 'password' ? 'text' : 'password';
    }
}