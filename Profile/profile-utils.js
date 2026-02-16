import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
// Adjusted import: sibling folder 'Project'
import { db } from '../Project/js/firebase-config.js';

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

export const toggleModal = (modalId, show) => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.toggle('hidden', !show);
};

export const setLoading = (btn, isLoading, loadingText = '') => {
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = `<div class="spinner-small"></div> ${loadingText}`;
    } else if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
    }
};

export const notify = (message, type = 'success', duration = 3000) => {
    const modal = $('#notification-modal');
    if (!modal) return;
    const messageEl = $('#notification-message');
    const contentEl = $('#notification-content');
    messageEl.textContent = message;
    contentEl.style.backgroundColor = type === 'success' ? '#F0FFF4' : '#FFF5F5';
    contentEl.style.borderColor = type === 'success' ? '#9AE6B4' : '#FEB2B2';
    contentEl.style.borderLeft = `4px solid ${type === 'success' ? 'var(--success-color)' : 'var(--danger-color)'}`;
    toggleModal('notification-modal', true);
    setTimeout(() => {
        if (modal.querySelector('#notification-message')?.textContent === message) {
            toggleModal('notification-modal', false);
        }
    }, duration);
};

export const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        notify('Copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        notify('Failed to copy text.', 'error');
    }
};

// Global Preview Function (Attached to window for inline onclicks)
window.previewProject = async (projectId, projectName) => {
    const modal = $('#project-preview-modal');
    if(!modal) return;
    
    const frame = $('#project-preview-frame');
    frame.srcdoc = ''; 
    
    toggleModal('project-preview-modal', true);
    
    const loadingHtml = `
        <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;font-family:sans-serif;color:#666;">
            <div style="width:30px;height:30px;border:3px solid #ccc;border-top-color:#333;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:10px;"></div>
            Loading Preview...
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        </div>`;
    frame.srcdoc = loadingHtml;

    try {
        const docRef = doc(db, "ai_templates", projectId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            const htmlContent = data.htmlContent || data.html || "<h1>No content found.</h1>";
            
            const titleEl = $('#preview-modal-title');
            if(titleEl) titleEl.textContent = `Preview: ${projectName || data.name}`;
            frame.srcdoc = htmlContent;
        } else {
            throw new Error("Document does not exist");
        }
    } catch (e) {
        console.error("Preview Error:", e);
        frame.srcdoc = `<div style="text-align:center; padding:20px; color:red;">${e.code === 'permission-denied' ? "Access Denied" : "Could not load preview."}</div>`;
    }
};