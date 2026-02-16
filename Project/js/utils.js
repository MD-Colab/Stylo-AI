// js/utils.js
import { CLOUDINARY_URL, CLOUDINARY_UPLOAD_PRESET, PLANS } from './constants.js';
import { s } from './state.js'; // <--- THIS WAS MISSING OR INCORRECT
import { notify } from './ui.js';

export const $ = id => document.getElementById(id);

export const throttle = (func, limit) => {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// --- SMOOTH AI TYPING ENGINE ---
export function smoothType(editorEl, code, speed = 10) {
    editorEl.value = "";
    let index = 0;

    const interval = setInterval(() => {
        editorEl.value += code[index];
        editorEl.scrollTop = editorEl.scrollHeight;
        index++;

        if (index >= code.length) clearInterval(interval);
    }, speed);
}

export function smoothTypeWithLines(editorEl, lineEl, code, speed = 10) {
    editorEl.value = "";
    lineEl.value = "";
    let index = 0;

    const interval = setInterval(() => {
        editorEl.value += code[index];

        const lines = editorEl.value.split("\n").length;
        lineEl.value = Array.from({ length: lines }, (_, i) => i + 1).join("\n");

        editorEl.scrollTop = editorEl.scrollHeight;
        lineEl.scrollTop = editorEl.scrollTop;

        index++;

        if (index >= code.length) clearInterval(interval);
    }, speed);
}
/**
 * Uploads any file to Cloudinary and returns the result.
 */
export const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    // Optional: Add resource_type auto to handle pdfs/raw files
    formData.append('resource_type', 'auto'); 

    try {
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Upload failed');
        return await res.json(); // Returns object with .secure_url, .public_id, etc.
    } catch (e) {
        console.error(e);
        throw e;
    }
};
/**
 * Reads a file and returns either Base64 (for images) or Text content.
 */
export const processFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        // Check for standard image types
        const isImage = file.type.startsWith('image/');
        // Check for readable text types
        const isText = file.type === 'text/html' || file.type === 'text/css' || 
                       file.type === 'text/javascript' || file.type === 'application/json' || 
                       file.name.endsWith('.txt') || file.name.endsWith('.md') || 
                       file.name.endsWith('.csv');

        reader.onload = () => {
            resolve({
                content: reader.result, // Base64 for image, String for text, ArrayBuffer for others
                isText: isText,
                isImage: isImage
            });
        };
        reader.onerror = reject;

        if (isImage) {
            reader.readAsDataURL(file);
        } else if (isText) {
            reader.readAsText(file);
        } else {
            // For PDF/Docs/Xlsx we can't easily extract text in browser without heavy libs.
            // We just upload them.
            resolve({ content: null, isText: false, isImage: false }); 
        }
    });
};
/**
 * Scrapes a URL using a CORS Proxy to get HTML text.
 */
export const scrapeURL = async (url) => {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (!data.contents) throw new Error("No content found");

        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        
        // 1. Extract Images BEFORE cleaning
        // We collect the top 10-15 images to avoid overwhelming the context window
        let imageContext = "AVAILABLE IMAGES FROM SOURCE:\n";
        const images = Array.from(doc.querySelectorAll('img'));
        
        images.slice(0, 15).forEach((img, index) => {
            let src = img.getAttribute('src');
            if (!src) return;

            // Handle relative URLs by making them absolute
            if (src.startsWith('//')) src = 'https:' + src;
            else if (src.startsWith('/')) {
                try {
                    const urlObj = new URL(url);
                    src = urlObj.origin + src;
                } catch (e) { /* ignore invalid base */ }
            } else if (!src.startsWith('http')) {
                 try {
                    const urlObj = new URL(url);
                    // Handle relative paths like 'assets/img.png'
                    src = new URL(src, urlObj.href).href;
                } catch (e) { /* ignore */ }
            }

            // Add to context string
            imageContext += `[Image${index + 1}]: ${src}\n`;
            
            // Optional: Tag the image in the DOM with a reference for text extraction
            img.textContent = ` [Image${index + 1}] `; 
        });

        // 2. Clean up DOM
        doc.querySelectorAll('script, style, svg, nav, footer, iframe').forEach(el => el.remove());
        
        // 3. Get Text Structure
        const cleanText = doc.body.innerText.replace(/\s\s+/g, ' ').trim().substring(0, 15000); 
        
        // 4. Return Combined Context
        return `${imageContext}\n\nWEBSITE TEXT CONTENT:\n${cleanText}`;

    } catch (e) {
        console.error("Scraping error:", e);
        throw new Error("Could not extract data from this URL. Security blocked or invalid link.");
    }
};
// --- NEW: PERMISSION CHECKER ---
/**
 * Checks if the current user is allowed to perform an action based on their plan.
 * @param {string} feature - 'createProject', 'exportCode', 'addCollaborator'
 * @returns {boolean} - True if allowed, False if blocked (and shows notification)
 */
export const checkPlanAccess = (feature) => {
    const planName = s.user?.plan || 'free'; 
    const limits = PLANS[planName];

    if (!limits) return false;

    // 1. Boolean Features
    if (feature === 'exportCode' && !limits.canExportCode) {
        notify(`Code Export is locked on ${planName}. Upgrade to Startup!`, 'error'); return false;
    }
    if (feature === 'addCollaborator' && !limits.canAddCollaborators) {
        notify(`Collaboration is locked on ${planName}. Upgrade to Pre-Business!`, 'error'); return false;
    }

    // 2. Numeric Limits
    // NOTE: For accurate counts, 's' (state) must be updated in real-time (e.g. in templates.js or chat.js)
    
    if (feature === 'createProject') {
        const count = s.projectCount || 0;
        if (count >= limits.maxProjects) {
            notify(`Project limit (${limits.maxProjects}) reached. Upgrade for more!`, 'error'); return false;
        }
    }

    if (feature === 'createCollection') {
        // Assuming you track collection count in state
        const count = s.collectionCount || 0; 
        if (count >= limits.maxCollections) {
            notify(`Database Collection limit (${limits.maxCollections}) reached.`, 'error'); return false;
        }
    }

    if (feature === 'deploy') {
        const count = s.deploymentCount || 0;
        if (count >= limits.maxDeployments) {
            notify(`Deployment limit (${limits.maxDeployments}) reached.`, 'error'); return false;
        }
    }

    if (feature === 'chat') {
        // You might reset this daily/monthly in a real app, here it's total session/stored
        const count = s.chatMessageCount || 0;
        if (count >= limits.chatLimit) {
            notify(`AI Chat limit (${limits.chatLimit}) reached. Upgrade!`, 'error'); return false;
        }
    }

    if (feature === 'save') {
        const count = s.saveCount || 0; // Track manual saves or versions
        if (count >= limits.maxSaves) {
            notify(`Save/Version limit (${limits.maxSaves}) reached.`, 'error'); return false;
        }
    }

    return true;
};


export const slugify = text => text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .substring(0, 50);