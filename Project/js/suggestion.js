import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import { s } from './state.js';
import { $ } from './utils.js';
import { addUserMessageToChat } from './ai-core.js';
import { CLOUDINARY_URL, CLOUDINARY_UPLOAD_PRESET } from './constants.js';

// --- 1. CSS Injection ---
const injectWizardStyles = () => {
    if (document.getElementById('wizard-styles')) return;
    const style = document.createElement('style');
    style.id = 'wizard-styles';
    style.textContent = `
        .wizard-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #ffffff; z-index: 10000; display: flex; flex-direction: column;
            font-family: 'Inter', sans-serif; opacity: 0; pointer-events: none;
            transition: opacity 0.3s ease;
        }
        .wizard-overlay.active { opacity: 1; pointer-events: all; }
        .wizard-header {
            padding: 20px 40px; border-bottom: 1px solid #eee; display: flex;
            justify-content: space-between; align-items: center;
        }
        .wizard-progress {
            flex-grow: 1; margin: 0 40px; height: 6px; background: #f0f0f0;
            border-radius: 3px; overflow: hidden;
        }
        .wizard-progress-bar {
            height: 100%; background: linear-gradient(90deg, #6366f1, #a855f7);
            width: 0%; transition: width 0.3s ease;
        }
        .wizard-content {
            flex-grow: 1; display: flex; flex-direction: column; align-items: center;
            justify-content: center; padding: 40px; max-width: 800px; margin: 0 auto;
            width: 100%; overflow-y: auto;
        }
        .wizard-question {
            font-size: 2rem; font-weight: 700; color: #1e293b; margin-bottom: 2rem;
            text-align: center; animation: slideUp 0.4s ease;
        }
        .wizard-options {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px; width: 100%; margin-bottom: 2rem;
        }
        .wizard-option-btn {
            padding: 20px; border: 2px solid #e2e8f0; border-radius: 12px;
            background: white; cursor: pointer; font-size: 1.1rem; transition: all 0.2s;
            text-align: center;
        }
        .wizard-option-btn:hover, .wizard-option-btn.selected {
            border-color: #6366f1; background: #eff6ff; color: #4338ca;
            transform: translateY(-2px); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
        }
        .wizard-input-area {
            width: 100%; display: flex; gap: 10px; position: relative;
        }
        .wizard-text-input {
            width: 100%; padding: 15px; font-size: 1.2rem; border: 2px solid #e2e8f0;
            border-radius: 12px; outline: none; transition: border-color 0.2s;
        }
        .wizard-text-input:focus { border-color: #6366f1; }
        
        /* Navigation Buttons */
        .wizard-nav {
            width: 100%; display: flex; justify-content: space-between; /* Spaced out */
            margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;
        }
        .wizard-btn {
            padding: 12px 24px; border-radius: 8px; font-size: 1rem; cursor: pointer;
            border: none; transition: all 0.2s; font-weight: 500;
        }
        .wizard-btn--next {
            background: #1e293b; color: white; display: flex; align-items: center; gap: 8px;
        }
        .wizard-btn--next:hover { background: #0f172a; }
        .wizard-btn--next:disabled { background: #cbd5e1; cursor: not-allowed; }
        
        .wizard-btn--skip {
            background: transparent; color: #64748b; border: 1px solid #e2e8f0;
        }
        .wizard-btn--skip:hover { background: #f8fafc; color: #334155; border-color: #cbd5e1; }

        .uploaded-preview {
            width: 120px; height: 120px; object-fit: contain; border-radius: 8px;
            margin: 15px auto; display: none; border: 2px solid #e2e8f0; background: #f8fafc;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
};

// --- 2. Questions Data ---
const questions = [
    { id: 'role', type: 'mcq', text: "What are we building today?", options: ["Portfolio", "Business Site", "E-commerce", "Blog", "Landing Page"] },
    { id: 'name', type: 'text', text: "What is the name of your brand or project?", placeholder: "e.g., Acme Corp" },
    { id: 'vibe', type: 'mcq', text: "Choose a design aesthetic:", options: ["Minimalist", "Bold & Colorful", "Corporate / Professional", "Dark Mode", "Playful"] },
    { id: 'logo_check', type: 'mcq', text: "Do you have a logo ready?", options: ["Yes", "No, generate text logo"] },
    { id: 'logo_upload', type: 'upload', text: "Great! Upload your logo file.", condition: (answers) => answers.logo_check === "Yes" },
    { id: 'colors', type: 'text', text: "Any specific color preferences?", placeholder: "e.g., Blue and Gold, or #FF5733" },
    { id: 'target', type: 'text', text: "Who is your target audience?", placeholder: "e.g., Students, Tech Startups, Pet Owners" },
    { id: 'features', type: 'mcq', text: "Key feature needed?", options: ["Contact Form", "Booking System", "Gallery", "Newsletter", "Map"] },
    { id: 'content', type: 'text', text: "Describe your main service or value proposition briefly.", placeholder: "We sell handmade candles..." },
    { id: 'cta', type: 'text', text: "What is the main Call to Action (CTA)?", placeholder: "e.g., 'Get a Quote', 'Buy Now'" }
];

let currentStep = 0;
let answers = {};
let logoUrl = "";

// --- 3. Wizard Logic ---

const renderStep = () => {
    const q = questions[currentStep];
    
    if (q.condition && !q.condition(answers)) {
        currentStep++;
        if (currentStep >= questions.length) return finishWizard();
        return renderStep();
    }

    const container = document.getElementById('wizard-content');
    const progressBar = document.getElementById('wizard-progress-bar');
    
    const progress = ((currentStep) / questions.length) * 100;
    progressBar.style.width = `${progress}%`;

    let html = `<div class="wizard-question">${q.text}</div>`;

    if (q.type === 'mcq') {
        html += `<div class="wizard-options">
            ${q.options.map(opt => `<div class="wizard-option-btn" onclick="window.handleOptionClick('${opt}')">${opt}</div>`).join('')}
        </div>`;
    } else if (q.type === 'text') {
        html += `<div class="wizard-input-area">
            <input type="text" id="wizard-input" class="wizard-text-input" placeholder="${q.placeholder || ''}" autofocus>
        </div>`;
    } else if (q.type === 'upload') {
        html += `<div class="wizard-input-area" style="flex-direction:column; align-items:center;">
            <button onclick="document.getElementById('wizard-file').click()" class="btn btn--secondary"><i class="fas fa-cloud-upload-alt"></i> Choose File</button>
            <input type="file" id="wizard-file" class="hidden" accept="image/*" onchange="window.handleWizardUpload(this)">
            <img id="wizard-img-preview" class="uploaded-preview">
            <div id="upload-status" style="color:#64748b; margin-top:10px; font-size: 0.9rem;"></div>
        </div>`;
    }

    // NEW: Added Skip Button alongside Continue
    html += `<div class="wizard-nav">
        <button class="wizard-btn wizard-btn--skip" onclick="window.handleSkip()">Skip Question</button>
        <button id="wizard-next" class="wizard-btn wizard-btn--next" onclick="window.handleNext()">Continue <i class="fas fa-arrow-right"></i></button>
    </div>`;

    container.innerHTML = html;

    if(q.type === 'text') setTimeout(() => document.getElementById('wizard-input')?.focus(), 100);
};

// Handle Next Button
window.handleNext = () => {
    const q = questions[currentStep];
    
    if (q.type === 'text') {
        const val = document.getElementById('wizard-input').value.trim();
        if (!val) return alert("Please enter a value.");
        answers[q.id] = val;
    } else if (q.type === 'upload') {
        if (!logoUrl) {
            if(!confirm("No image uploaded. Do you want to skip this step?")) return;
            answers[q.id] = "No logo provided";
        } else {
            answers[q.id] = logoUrl;
        }
    }
    
    nextStep();
};

// Handle Skip Button
window.handleSkip = () => {
    const q = questions[currentStep];
    answers[q.id] = "Not specified"; // Save as undefined/skipped
    nextStep();
};

const nextStep = () => {
    currentStep++;
    if (currentStep >= questions.length) {
        finishWizard();
    } else {
        renderStep();
    }
};

window.handleOptionClick = (val) => {
    answers[questions[currentStep].id] = val;
    document.querySelectorAll('.wizard-option-btn').forEach(b => b.classList.remove('selected'));
    event.target.classList.add('selected');
    
    setTimeout(() => {
        nextStep();
    }, 300);
};

window.handleWizardUpload = async (input) => {
    const file = input.files[0];
    if (!file) return;
    
    const status = document.getElementById('upload-status');
    status.textContent = "Uploading to secure storage...";
    document.getElementById('wizard-next').disabled = true;

    try {
        // 1. Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        if (!res.ok) throw new Error("Cloudinary upload failed");
        const data = await res.json();
        
        logoUrl = data.secure_url;
        
        // 2. Preview Update
        const img = document.getElementById('wizard-img-preview');
        img.src = logoUrl;
        img.style.display = 'block';
        
        // 3. SAVE TO FIRESTORE (Project Images)
        if (s.editId) {
            status.textContent = "Saving to project assets...";
            await addDoc(collection(db, `ai_templates/${s.editId}/project_images`), {
                name: file.name.split('.')[0] || "Wizard Logo",
                url: logoUrl,
                publicId: data.public_id,
                createdAt: serverTimestamp()
            });
        }

        status.textContent = "Upload Successful & Saved!";
        status.style.color = "green";
        document.getElementById('wizard-next').disabled = false;
        
    } catch (e) {
        status.textContent = "Upload Failed.";
        status.style.color = "red";
        console.error(e);
        alert("Upload failed. Please skip or try again.");
        document.getElementById('wizard-next').disabled = false;
    }
};

const finishWizard = () => {
    const overlay = document.getElementById('wizard-overlay');
    
    document.getElementById('wizard-content').innerHTML = `
        <div style="text-align:center;">
            <img src="../assets/Images/Generate.gif" style="width:120px; margin-bottom:20px;">
            <h2>Compiling your blueprint...</h2>
            <p>Our AI is analyzing your answers.</p>
        </div>
    `;

    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);

        // Construct the MASTER PROMPT
        let prompt = `Create a ${answers.role} website for "${answers.name}". `;
        if (answers.vibe !== "Not specified") prompt += `Aesthetic: ${answers.vibe}. `;
        if (answers.target !== "Not specified") prompt += `Target Audience: ${answers.target}. `;
        if (answers.features !== "Not specified") prompt += `Core Feature: ${answers.features}. `;
        if (answers.colors && answers.colors !== "Not specified") prompt += `Color Palette: ${answers.colors}. `;
        if (answers.content && answers.content !== "Not specified") prompt += `Description: ${answers.content}. `;
        if (answers.cta && answers.cta !== "Not specified") prompt += `CTA: "${answers.cta}". `;
        
        if (logoUrl) prompt += `CRITICAL: Use this exact Logo URL in the navbar: ${logoUrl} `;

        // Send to AI
        addUserMessageToChat(prompt);
        
    }, 2500);
};

// --- 4. Initialization ---
export const startProjectWizard = () => {
    injectWizardStyles();
    
    currentStep = 0;
    answers = {};
    logoUrl = "";

    const overlay = document.createElement('div');
    overlay.id = 'wizard-overlay';
    overlay.className = 'wizard-overlay active';
    
    overlay.innerHTML = `
        <div class="wizard-header">
            <div class="logo"><img src="../assets/Images/logo1.png" width="40"></div>
            <div class="wizard-progress"><div id="wizard-progress-bar" class="wizard-progress-bar"></div></div>
            <button class="btn btn--sm btn--secondary" onclick="document.getElementById('wizard-overlay').remove()">Exit Wizard</button>
        </div>
        <div id="wizard-content" class="wizard-content"></div>
    `;
    
    document.body.appendChild(overlay);
    renderStep();
};