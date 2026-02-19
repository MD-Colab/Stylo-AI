// Adjusted imports: up two levels to Project/js
import { db } from '../../Project/js/firebase-config.js';
import { AVATAR_LIST } from '../../Project/js/avatars.js';
import { updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
// Adjusted imports: up one level to Profile root
import { state } from '../profile-state.js';
import { $, setLoading, notify, toggleModal } from '../profile-utils.js';

export const initProfileInfo = () => {
    $('#edit-profile-btn')?.addEventListener('click', toggleEditMode);
    $('#cancel-edit-btn')?.addEventListener('click', toggleEditMode);
    $('#profile-form')?.addEventListener('submit', handleProfileUpdate);
    $('#choose-avatar-form-btn')?.addEventListener('click', openAvatarModal);
    $('#avatar-grid')?.addEventListener('click', handleAvatarSelection);
};

export const renderProfileSection = () => {
    const user = state.currentUser;
    if(!user) return;

    // Header updates
    $('#user-email').textContent = user.displayName || 'User';
    $('#display-name-header').textContent = user.displayName || 'User';
    $('#email-display').textContent = user.email;
    if (user.photoURL) {
        const imgs = document.querySelectorAll('#profile-picture-display, #user-avatar, #profile-picture-view, #profile-picture-display-form');
        imgs.forEach(img => img.src = user.photoURL);
    }

     // --- WEBSITE LINK LOGIC (CLICKABLE) ---
    const websiteEl = $('#website-view');
    if (websiteEl) {
        if (user.website && user.website.startsWith('http')) {
            // Agar website URL hai, toh usay clickable Link bana do
            websiteEl.innerHTML = `
                <a href="${user.website}" 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   style="color: #6366f1; text-decoration: underline; font-weight: 500;">
                   ${user.website} <i class="fas fa-external-link-alt" style="font-size: 0.7rem; margin-left: 5px;"></i>
                </a>`;
        } else {
            // Agar link nahi hai toh "Not set" dikhao
            websiteEl.textContent = user.website || 'Not set';
            websiteEl.style.color = 'inherit'; // Reset color
        }
    }
    

    // View Mode
    const setContent = (id, val) => { const el = $(id); if(el) el.textContent = val || 'Not set'; };
    setContent('#display-name-view', user.displayName);
    setContent('#bio-view', user.bio);
    setContent('#email-view', user.email);
    setContent('#age-view', user.age);
    setContent('#gender-view', user.gender);
    setContent('#position-view', user.position);
    setContent('#location-view', user.location);
    
    // Edit Form
    const setValue = (id, val) => { const el = $(id); if(el) el.value = val || ''; };
    setValue('#display-name-input', user.displayName);
    setValue('#bio-input', user.bio);
    setValue('#email-input', user.email);
    setValue('#age-input', user.age);
    setValue('#gender-select', user.gender || 'Prefer not to say');
    setValue('#position-input', user.position);
    setValue('#website-input', user.website);
    setValue('#location-input', user.location);
};


const toggleEditMode = () => {
    const isEditing = $('#profile-form').classList.contains('hidden');
    $('#profile-display-view').classList.toggle('hidden', isEditing);
    $('#profile-form').classList.toggle('hidden', !isEditing);
    $('#edit-profile-btn').classList.toggle('hidden', isEditing);
    if (!isEditing) renderProfileSection(); 
};

async function handleProfileUpdate(e) {
    e.preventDefault();
    setLoading($('#save-profile-btn'), true, 'Saving...');
    try {
        const payload = {
            displayName: $('#display-name-input').value.trim(),
            bio: $('#bio-input').value.trim(),
            age: parseInt($('#age-input').value, 10) || null,
            gender: $('#gender-select').value,
            position: $('#position-input').value.trim(),
            website: $('#website-input').value.trim(),
            location: $('#location-input').value.trim(),
            lastUpdated: serverTimestamp()
        };
        await updateDoc(doc(db, "users", state.currentUser.uid), payload);
        Object.assign(state.currentUser, payload);
        renderProfileSection();
        toggleEditMode();
        notify('Profile updated successfully!', 'success');
    } catch (error) {
        notify(`Error updating profile: ${error.message}`, 'error');
    } finally {
        setLoading($('#save-profile-btn'), false);
    }
}

const openAvatarModal = () => {
    const grid = $('#avatar-grid');
    if(!grid) return;
    grid.innerHTML = AVATAR_LIST.map(url => 
        `<img src="${url}" alt="Avatar option" class="avatar-item ${url === state.currentUser.photoURL ? 'selected' : ''}">`
    ).join('');
    toggleModal('avatar-selection-modal', true);
};

const handleAvatarSelection = async (e) => {
    const target = e.target;
    if (!target.matches('.avatar-item')) return;
    state.currentUser.photoURL = target.src;
    renderProfileSection();
    toggleModal('avatar-selection-modal', false);
    await updateDoc(doc(db, "users", state.currentUser.uid), { photoURL: target.src });
};
