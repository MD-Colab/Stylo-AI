// js/ai-core.js
import { doc, updateDoc, collection, addDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai"; 
import { db, config } from './firebase-config.js';
import { s } from './state.js';
import { scrapeURL, $ } from './utils.js';
import { notify, showLoader } from './ui.js';
import { DEFAULT_MODEL, GEMINI_API_BASE, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from './constants.js';
import { saveVersion } from './versions.js';

// --- UTILITIES ---

const throttle = (func, limit) => {
    let inThrottle;
    return function () {
        if (!inThrottle) {
            func.apply(this, arguments);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
};

const throttledPreviewUpdate = throttle(() => {
    if ($('preview-frame')) {
        $('preview-frame').srcdoc = s.html;
    }
}, 200);

// --- API KEY MANAGEMENT ---

/**
 * Fetches the Gemini API Key specifically from the 'settings/api_keys' document.
 * Includes trimming to remove accidental whitespace.
 */
export const fetchSystemApiKey = async () => {
    // Force a fresh fetch if we suspect issues, or just return cached if valid.
    // However, to be safe, we will fetch if s.apiKey is missing or looks short.
    if (s.apiKey && s.apiKey.length > 20) return s.apiKey; 

    console.log("Fetching System API Key...");
    try {
        const docRef = doc(db, "settings", "api_keys");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.geminiApiKey) {
                // .trim() removes accidental spaces from copy-pasting
                s.apiKey = data.geminiApiKey.trim(); 
                console.log("API Key loaded successfully (Masked):", s.apiKey.substring(0, 8) + "..." + s.apiKey.slice(-4));
                return s.apiKey;
            } else {
                console.error("Document exists but 'geminiApiKey' field is missing.");
            }
        } else {
            console.warn("settings/api_keys document does not exist.");
        }
        return null;
    } catch (error) {
        console.error("Error fetching system API key:", error);
        notify("Failed to load System API Key from database.", "error");
        return null;
    }
};

const detectFeaturesAndIntent = (text = '') => {
    const q = text.toLowerCase();
    const has = (regex) => regex.test(q);
    if (has(/\b(ecommerce|e-commerce|shop|store|sell products)\b/)) return { intent: 'ecommerce', hasForms: true };
    if (has(/\b(landing page|promo|launch page)\b/)) return { intent: 'landing-page', hasForms: has(/\b(contact|form|signup)\b/) };
    if (has(/\b(portfolio|gallery|photographer|designer|artist)\b/)) return { intent: 'portfolio', hasForms: has(/\b(contact|form)\b/) };
    if (has(/\b(blog|articles|news|content)\b/)) return { intent: 'blog', hasForms: has(/\b(subscribe|form)\b/) };
    return { intent: 'generic', hasForms: has(/\b(form|upload|contact|submit|signup|login|register)\b/) };
};

const formatMainChatMessage = (text) => {
    // 1. Extract Image Tags
    const imagePlaceholderRegex = /<img[^>]*class="chat-message-img"[^>]*>/g;
    const images = [];
    let textProcessing = text.replace(imagePlaceholderRegex, (match) => {
        images.push(match);
        return `__IMAGE_BLOCK_${images.length - 1}__`;
    });

    // 2. Extract Mention Pills
    const mentionPillRegex = /<span class="mention-pill[^>]*>.*?<\/span>/g;
    const mentions = [];
    textProcessing = textProcessing.replace(mentionPillRegex, (match) => {
        mentions.push(match);
        return `__MENTION_BLOCK_${mentions.length - 1}__`;
    });

    // 3. Extract File Links/Icons
    const fileIconRegex = /<i class="fas fa-file-[^"]*"><\/i>\s*[^<\n]+/g; 
    const files = [];
    textProcessing = textProcessing.replace(fileIconRegex, (match) => {
        files.push(match);
        return `__FILE_BLOCK_${files.length - 1}__`;
    });

    // 4. Escape HTML in the remaining text
    let formatted = textProcessing
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 5. Format Code Blocks
    const codeBlocks = [];
    formatted = formatted.replace(/```(\w*)([\s\S]*?)```/g, (match, lang, code) => {
        const html = `
            <div class="chat-embedded-code">
                <div class="chat-code-lang">${lang || 'CODE'}</div>
                <pre><code>${code}</code></pre>
            </div>`;
        codeBlocks.push(html);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // 6. Convert newlines
    formatted = formatted.replace(/\n/g, '<br>');

    // 7. Restore Blocks
    formatted = formatted.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => codeBlocks[index]);
    formatted = formatted.replace(/__MENTION_BLOCK_(\d+)__/g, (match, index) => mentions[index]);
    formatted = formatted.replace(/__IMAGE_BLOCK_(\d+)__/g, (match, index) => images[index]);
    formatted = formatted.replace(/__FILE_BLOCK_(\d+)__/g, (match, index) => files[index]);

    return formatted;
};

export const renderChatHistory = () => {
    const historyEl = $('chat-history');
    if (!historyEl) return;
    
    historyEl.innerHTML = s.chatHistory.map((msg, index) => {
        const safeText = formatMainChatMessage(msg.text);
        if (msg.role === 'user') {
            return `<div class="user-message" data-message-index="${index}">
                        ${safeText}
                        <div class="chat-actions">
                            <button class="btn-icon" data-action="edit" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn-icon" data-action="copy" title="Copy"><i class="fas fa-copy"></i></button>
                            <button class="btn-icon" data-action="rerun" title="Rerun"><i class="fas fa-sync-alt"></i></button>
                            <button class="btn-icon" data-action="delete" title="Delete"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>`;
        } else {
            return `<div class="ai-message">${safeText}</div>`;
        }
    }).join('');
    historyEl.scrollTop = historyEl.scrollHeight;
};

const constructPromptWithMentions = (rawText) => {
    let promptForAI = rawText;
    s.chatMentions.slice().reverse().forEach((mention, revIndex) => {
        const index = s.chatMentions.length - 1 - revIndex;
        const marker = `[${index + 1}]`;
        const textToReplace = `${mention.data.name} ${marker}`;
        let contextInstruction = '';
        if (mention.type === 'image') {
            contextInstruction = `CRITICAL ASSET INSTRUCTION: For the user-mentioned asset "${mention.data.name}", you MUST use this exact URL: ${mention.data.url}. `;
        } else if (mention.type === 'collection') {
            contextInstruction = `CRITICAL DATABASE INSTRUCTION: For any form related to "${mention.data.name}", you MUST use this exact ID in the hidden input: ${mention.data.id}. `;
        }
        promptForAI = promptForAI.replace(textToReplace, '').trim();
        promptForAI = contextInstruction + promptForAI;
    });
    return promptForAI;
};

// --- GEMINI HELPER FUNCTIONS ---

const imageUrlToBase64 = async (url) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result.split(',')[1];
                resolve({
                    inline_data: {
                        mime_type: blob.type,
                        data: base64data
                    }
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to convert image to base64:", e);
        return null;
    }
};

const formatMessagesForGemini = (messages) => {
    const systemMessage = messages.find(m => m.role === 'system');
    const conversation = messages.filter(m => m.role !== 'system').map(m => {
        let parts = [];
        if (Array.isArray(m.content)) {
            m.content.forEach(item => {
                if (item.type === 'text') parts.push({ text: item.text });
                if (item.inline_data) parts.push({ inline_data: item.inline_data });
            });
        } else {
            parts.push({ text: m.content });
        }
        
        return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: parts
        };
    });

    const payload = {
        contents: conversation,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
        }
    };

    if (systemMessage) {
        payload.system_instruction = {
            parts: [{ text: systemMessage.content }]
        };
    }

    return payload;
};

// --- PROMPT ENHANCER ---
export const enhancePrompt = async () => {
    const input = $('chat-input');
    const originalText = input.value.trim();
    if (!originalText) return notify("Please enter a prompt to enhance.", "error");

    // Ensure API Key
    if (!s.apiKey) await fetchSystemApiKey();
    if (!s.apiKey) return notify("System API Key missing. Contact admin.", "error");

    const btn = $('enhance-prompt-btn');
    const icon = btn.querySelector('i');
    icon.className = "fas fa-spinner fa-spin";
    btn.disabled = true;

    try {
        // --- FIX: SWITCH TO SDK (More Stable) ---
        // Initialize SDK
        const genAI = new GoogleGenerativeAI(s.apiKey);
        const model = genAI.getGenerativeModel({ 
            model: DEFAULT_MODEL,
            systemInstruction: "You are an expert Prompt Engineer. Rewrite the user's request into a detailed, professional web design prompt specifying modern UI/UX, color palettes, and Tailwind features. Output ONLY the enhanced prompt. and in just 100- 150 characters"
        });

        // Generate
        const result = await model.generateContent(`User Request: "${originalText}"`);
        const response = await result.response;
        const enhancedText = response.text().trim();

        // --- TYPING EFFECT ---
        input.value = "";
        let i = 0;
        const typeInterval = setInterval(() => {
            input.value += enhancedText.charAt(i);
            import('./ui.js').then(m => m.updateChatInputVisual());
            input.scrollTop = input.scrollHeight;
            i++;
            if (i >= enhancedText.length) {
                clearInterval(typeInterval);
                btn.disabled = false;
                icon.className = "fas fa-wand-sparkles"; 
            }
        }, 10);

    } catch (error) {
        console.error("Enhance Prompt Error:", error);
        notify("Could not enhance prompt. Check console.", "error");
        btn.disabled = false;
        icon.className = "fas fa-wand-sparkles";
    }
};

export const addUserMessageToChat = async (text) => {
    const trimmedText = text.trim();
    if (!trimmedText && !s.pendingAttachment) return;
    
    const mode = s.currentProjectData?.mode || 'website';
    let promptPrefix = "";
    if (mode === 'form') {
        promptPrefix = "FOCUS: Create a robust data collection form or dashboard. ";
    } else if (mode === 'bot') {
        promptPrefix = "FOCUS: Create a conversational Chatbot UI. ";
    } else {
        promptPrefix = "FOCUS: Create a High-Converting, Award-Winning Website. ";
    }

    let hiddenContext = "";
    let userDisplayText = trimmedText; 
    let multimodalContent = []; 

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = trimmedText.match(urlRegex);

    if (urls && urls.length > 0) {
        const urlToScrape = urls[0];
        if (!urlToScrape.includes('cloudinary.com')) {
            notify("Analyzing URL content...", "info");
            try {
                const scrapedContent = await scrapeURL(urlToScrape);
                hiddenContext += `\n\n[CONTEXT FROM URL ${urlToScrape}]:\n${scrapedContent}\n\n`;
                userDisplayText += ` <small>(Analyzed ${urlToScrape})</small>`;
            } catch (e) {
                notify(e.message, "error");
            }
        }
    }

    if (s.pendingAttachment) {
        const { name, url, content, type } = s.pendingAttachment;
        if (type === 'text') {
            hiddenContext += `\n\n[FILE CONTENT: ${name}]:\n${content}\n`;
            userDisplayText += ` <i class="fas fa-file-code"></i> ${name}`;
        } else if (type === 'image') {
            userDisplayText += `\n<img src="${url}" class="chat-message-img" alt="Uploaded Image">`;
            
            try {
                const imagePart = await imageUrlToBase64(url);
                if (imagePart) {
                    multimodalContent.push(imagePart);
                }
            } catch (err) {
                console.error("Image conversion error", err);
            }
            
            hiddenContext += `\n\nCRITICAL: Analyze this image and replicate its design/layout style.`;
        } else {
            hiddenContext += `\n\n[ATTACHED FILE]: ${name}\n[URL]: ${url}\n`;
            userDisplayText += ` <i class="fas fa-file-download"></i> ${name}`;
        }
        s.pendingAttachment = null;
        document.getElementById('attachment-preview').classList.add('hidden');
        document.getElementById('chat-file-upload').value = '';
    }

    s.chatMentions.forEach((mention, index) => {
        const marker = `[${index + 1}]`;
        const textPattern = `${mention.data.name} ${marker}`;
        let iconClass = mention.type === 'image' ? "fas fa-image" : "fas fa-database";
        let pillClass = mention.type === 'image' ? "mention-pill--image" : "mention-pill--db";
        let dataAttr = mention.type === 'image' ? `data-url='${mention.data.url}'` : `data-id='${mention.data.id}'`;
        const pillHTML = `<span class="mention-pill ${pillClass}" ${dataAttr}><i class="${iconClass}" style="pointer-events:none;"></i> ${mention.data.name}</span>`;
        userDisplayText = userDisplayText.split(textPattern).join(pillHTML);
    });

    s.chatHistory.push({ role: 'user', text: userDisplayText });
    renderChatHistory();
    
    const rawPrompt = constructPromptWithMentions(trimmedText);
    const finalUserText = promptPrefix + rawPrompt + hiddenContext;
    
    let geminiContent = [];
    geminiContent.push({ type: "text", text: finalUserText });
    if (multimodalContent.length > 0) {
        geminiContent = [ ...geminiContent, ...multimodalContent ];
    }
    
    const chatInput = $('chat-input');
    if (chatInput) {
        chatInput.value = '';
        chatInput.style.height = 'auto';
    }
    s.chatMentions = [];
    import('./ui.js').then(m => {
        m.updateChatInputVisual();
        m.renderMentionedAssets();
    });

    generateWithStreaming(geminiContent);
};

// --- CORE AI INSTRUCTIONS ---
const advancedSystemInstructions = `
You are 'Stylo Pro', an elite AI web designer and full-stack developer. Your persona is that of a product-aware, user-centric designer from a top-tier agency. Your goal is not just to write code, but to create a 'wow' experience by generating complete, beautiful, and fully functional single-file HTML websites.

--- CORE DIRECTIVES (NON-NEGOTIABLE) ---
1.  **NO MARKDOWN**: Your entire response MUST be raw HTML code only. Start with \`<!DOCTYPE html>\` and end with \`</html>\`.
2.  **NO APOLOGIES / REFUSALS**: You are an expert. Never apologize or say you cannot do something. Fulfill the request using the provided instructions.
3.  **NO LAZINESS**: Never generate placeholder content, short sections, or incomplete code. Every website must be rich, detailed, and production-ready. A landing page must have at least 4-5 distinct, well-designed sections with varied layouts.
4.  **PROACTIVE INFERENCE**: If a user's request is vague (e.g., "make a site for a cat"), you must infer a professional solution. Create a brand name (e.g., "Purrfect Paws"), write compelling marketing copy, choose an appropriate aesthetic, and build a complete site. Never ask for clarification.

--- DESIGN & AESTHETICS PHILOSOPHY ---
1.  **MODERN & CLEAN**: All designs must be modern, responsive, and aesthetically pleasing. Use TailwindCSS via its Play CDN for all styling.
2.  **TYPOGRAPHY & COLOR**: Use professional, high-quality fonts from Google Fonts.
3.  **CRITICAL COLOR RULE**: You are FORBIDDEN from inventing color names (e.g., 'text-primary-blue'). You MUST either:
    a) Use Tailwind's default color palette ONLY (e.g., \`bg-slate-800\`, \`text-sky-400\`).
    b) If you need a custom color, define it within the \`tailwind.config\` script as shown in the TECHNICAL MANDATES.
4.  **PURPOSEFUL ANIMATION**: Websites must feel alive. Use JavaScript \`IntersectionObserver\` to trigger "fade-in" effects on scroll for elements with a \`.scroll-animate\` class.
5.  **IMAGE PLACEHOLDERS**: Never use broken links. Always use Pexels for high-quality, relevant placeholders. Example: \`https://images.pexels.com/photos/1036808/pexels-photo-1036808.jpeg\`.

--- 3D INTELLIGENCE & AUTODETECTION (CRITICAL UPGRADE) ---
The AI must ALWAYS detect any request related to 3D, EVEN IF the user does not use technical terms.
The AI must treat ANY of the following phrases as a request to activate FULL 3D MODE:
"3d", "three dee", "3d effect", "3d background", "rotate", "rotate product",
"model ghumao", "object dikhao", "3d website", "3d design", "3d animation",
"3d product viewer", "object viewer", "view in 3d", "render", "gltf", "glb",
"3d scene", "orbit", "zoom", "drag to rotate", "interactive model".

If ANY such phrase or its natural-language variation is found, the AI MUST:
1. Activate FULL 3D MODE.
2. Automatically include Three.js importmap + module script.
3. Create a responsive <canvas> for rendering the 3D scene.
4. Include OrbitControls for rotation/zoom/pan interaction.
5. Add proper lighting (ambient + directional) so models never appear dark.
6. If user provides a .glb/.gltf link → load that object.
7. If no 3D model is provided → generate a placeholder 3D cube or sphere.
8. If user describes an object (e.g., "3D car", "3D phone") → create a placeholder mesh
   that stylistically represents the object.
9. Make the 3D scene responsive, animated if appropriate, and visually modern.
10. Maintain all SINGLE-FILE architecture rules.

The AI MUST NOT ask the user for clarification. It must infer:
- What type of 3D experience is best (viewer, animated scene, background, hero section).
- How to arrange the 3D canvas within the layout.
- What camera angle is most attractive.
- Whether to rotate the model automatically.

3D MODE ALWAYS OVERRIDES regular blueprints:
If a 3D request is detected:
- Use the Landing Page or E-commerce Blueprint,
- BUT all hero sections or product views MUST include 3D visuals by default.


--- TECHNICAL MANDATES ---
1.  **SINGLE-FILE ARCHITECTURE**: All CSS MUST be in a single \`<style type="text/tailwindcss">\` tag. All JavaScript MUST be in a single \`<script type="module">\` tag at the end of the \`<body>\`.
2.  **JAVASCRIPT LIBRARIES**:
    *   **TailwindCSS**: \`<script src="https://cdn.tailwindcss.com"></script>\` MUST be in the \`<head>\`.
    *   **Tailwind Config**: To use custom colors, you MUST include this script block in the \`<head>\` and define your colors.
        \`\`\`html
        <script>
          tailwind.config = { theme: { extend: { colors: { 'custom-blue': '#243c5a' } } } }
        </script>
        \`\`\`
    *   **Three.js (for 3D)**: If 3D is requested, you MUST include the Three.js importmap and module script.

--- BLUEPRINT FOR **NEW** WEBSITES ---
When creating a website from scratch, you MUST select and adhere to one of these blueprints.

    **BLUEPRINT 1: THE LANDING PAGE / BROCHURE SITE**
    -   **Goal**: Marketing, lead generation, information.
    -   **Required Sections**: Header, Hero, Features/Services, Social Proof, an additional relevant section (e.g., About, FAQ, Gallery), Final CTA, Footer.
    -   **Functionality**: If a form is needed, use the UNIFIED DATA HANDLING PATTERN. No e-commerce features.

    **BLUEPRINT 2: THE E-COMMERCE SITE**
    -   **Goal**: Selling Products.
    -   **Required Sections**: Header (with Cart icon/count), Product Grid, Admin Panel (with form to add products), Shopping Cart modal.
    -   **Functionality**: This is a full application. It MUST use the UNIFIED DATA HANDLING PATTERN for all product, order, and form management.
    -   **Upload product Form**: Must contains products' name, description, Product Category (dropdown), Sub-Category, Original Price (MRP), Sellong Price, Discont (auto calculte), Tax(GST%)- Optional, COD Available? (Yes/No), Stock Quality, Product Weight, Prduct Dimensions, Shipping Charges (Free/Paid), Delivery Days Estimate(2-7 Days etc.), SKU/Product code, Barcode(Optional), Product Status(Active, Draft, Out Of Stock), 
    -   **Order Form**: Must capture Customer Name, Email, Phone Number, Shipping Address(Full Adress, Land Mark, City, State, Pin Code, Country), Billing Address, List of Items (with quantities and prices), Total Amount, Payment Method (Credit Card, PayPal, etc.), Order Status (Pending, Shipped, Delivered), Order Date (auto timestamp), Delivery Options (Standard, Expedited).
    -   **Cart Functionality**: Users must be able to add/remove items, view total, and checkout via a form using the UNIFIED DATA HANDLING PATTERN.
    -   **Major Instruction**: Create Admin page always in #Admin, Always create Admin Pannel seperate from Main Page, Admin Pannel must have these pages Products, Orders, Coupons, Users, Settings, Alanytics.
    -   **UI/UX**: Create mai page always in different style and different UI.
--- UNIFIED DATA HANDLING PATTERN (CRITICAL FOR FUNCTIONALITY) ---
This is the most important set of instructions. Failure to follow these rules will result in a non-functional website, which is a critical error.

1.  **THE HIDDEN INPUT IS MANDATORY**: Every single form that saves data MUST include a hidden input field: \`<input type="hidden" name="_collectionId" value="THE_SPECIFIC_ID_PROVIDED_IN_THE_PROMPT">\`.
2.  **YOU WILL BE GIVEN THE ID**: The user's prompt will contain one or more "CRITICAL DATABASE INSTRUCTION" lines. These lines provide the exact, unique ID you MUST use. You MUST read these instructions and use the correct ID for the corresponding form.
    *   *Example Instruction:* "CRITICAL DATABASE INSTRUCTION: For any contact form, you MUST use this exact ID: DAvMFvECxMOIQRskwOdW"
    *   *Your Action:* The contact form's HTML must contain \`<input type="hidden" name="_collectionId" value="DAvMFvECxMOIQRskwOdW">\`.
3.  **THE JAVASCRIPT BACKBONE**: If the website has any forms or e-commerce features, you MUST include the following COMPLETE and UNALTERED JavaScript code block within your single \`<script type="module">\` tag.

    \`\`\`javascript
    // --- UNIVERSAL JAVASCRIPT ENGINE v3.1 ---
    import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
    import { getFirestore, collection, doc, addDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
    const firebaseConfig = '--FIREBASE_CONFIG_REPLACE_ME--';
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/--CLOUDINARY_NAME--/image/upload';
    const CLOUDINARY_PRESET = '--CLOUDINARY_PRESET--';
    const PROJECT_ID = '--PROJECT_ID--';
    const PRODUCTS_COLLECTION_ID = '--PRODUCTS_ID--';
    const ORDERS_COLLECTION_ID = '--ORDERS_ID--';

    async function handleFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const collectionIdInput = form.querySelector('input[name="_collectionId"]');
        if (!collectionIdInput) return;
        const collectionId = collectionIdInput.value;
        if (!collectionId || collectionId.includes('--')) {
            alert('Error: This form is not connected to a database yet.'); return;
        }
        const btn = form.querySelector('[type="submit"]');
        const originalBtnText = btn.textContent;
        btn.disabled = true; btn.textContent = 'Submitting...';
        try {
            const fd = new FormData(form);
            const dataToSubmit = {};
            for (const [key, value] of fd.entries()) {
                if (key === '_collectionId') continue;
                if (value instanceof File && value.size > 0) {
                    const cloudFd = new FormData();
                    cloudFd.append('file', value);
                    cloudFd.append('upload_preset', CLOUDINARY_PRESET);
                    const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: cloudFd });
                    if (!res.ok) throw new Error(\`Cloudinary Error: \${(await res.json()).error.message}\`);
                    const cloudData = await res.json();
                    dataToSubmit[key] = { name: value.name, url: cloudData.secure_url, publicId: cloudData.public_id };
                } else { dataToSubmit[key] = value; }
            }
            const submissionPath = \`ai_templates/\${PROJECT_ID}/project_collections/\${collectionId}/submissions\`;
            await addDoc(collection(db, submissionPath), { formData: dataToSubmit, createdAt: serverTimestamp() });
            alert('Submission successful!');
            form.reset();
            if (form.closest('#admin-panel')) await refreshAllData();
            if (form.id === 'checkout-form') { cart = []; updateCart(); document.getElementById('cart-modal')?.classList.add('hidden'); }
        } catch (e) { console.error('Submission Error:', e); alert(\`Error: \${e.message}\`);
        } finally { btn.disabled = false; btn.textContent = originalBtnText; }
    }

    async function renderCollectionItems(containerId, collectionId, renderer) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!collectionId || collectionId.includes('--')) {
            container.innerHTML = '<div class="p-4 rounded-md bg-yellow-100 text-yellow-800"><strong>Database Not Connected</strong></div>'; return;
        }
        container.innerHTML = '<p class="text-center text-gray-400 p-4">Loading...</p>';
        try {
            const q = query(collection(db, \`ai_templates/\${PROJECT_ID}/project_collections/\${collectionId}/submissions\`), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            if (snapshot.empty) { container.innerHTML = '<p class="text-center text-gray-500 p-4">No items found.</p>'; return; }
            container.innerHTML = snapshot.docs.map(doc => renderer(doc.id, doc.data().formData)).join('');
        } catch (e) { console.error(\`Error rendering \${containerId}: \`, e); container.innerHTML = '<p class="text-center text-red-500 p-4">Could not load items.</p>'; }
    }

    const productRenderer = (id, data) => \`<div class="border rounded-lg overflow-hidden shadow-lg group"><img src="\${data.image?.url || 'https://source.unsplash.com/400x300/?product'}" alt="\${data.name}" class="w-full h-48 object-cover"><div class="p-4"><h3 class="font-bold text-lg truncate">\${data.name}</h3><div class="flex justify-between items-center mt-4"><span class="font-bold text-xl">$\${parseFloat(data.price||0).toFixed(2)}</span><button data-id="\${id}" data-name="\${data.name}" data-price="\${data.price}" class="add-to-cart-btn bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Add to Cart</button></div></div></div>\`;
    const adminProductRenderer = (id, data) => \`<div class="flex items-center justify-between p-2 border-b gap-2"><img src="\${data.image?.url || 'https://source.unsplash.com/100x100/?product'}" alt="\${data.name}" class="w-12 h-12 rounded-md object-cover"><span class="flex-1 truncate">\${data.name}</span><span class="font-semibold">$\${parseFloat(data.price||0).toFixed(2)}</span><button data-id="\${id}" class="delete-product-btn text-red-500 hover:text-red-700 p-1">Delete</button></div>\`;
    
    let cart = JSON.parse(localStorage.getItem('stylo-cart') || '[]');
    function updateCart() { localStorage.setItem('stylo-cart', JSON.stringify(cart)); renderCart(); }
    function addToCart(id, name, price) { const existing = cart.find(i => i.id === id); if(existing){ existing.quantity++; } else { cart.push({ id, name, price: parseFloat(price), quantity: 1 }); } updateCart(); }
    function renderCart() {
        const cont = document.getElementById('cart-items'), totalEl = document.getElementById('cart-total'), countEl = document.getElementById('cart-count');
        if (countEl) countEl.textContent = cart.reduce((s, i) => s + i.quantity, 0);
        if (!cont || !totalEl) return;
        if (cart.length === 0) { cont.innerHTML = '<p>Your cart is empty.</p>'; } else {
            cont.innerHTML = cart.map(i => \`<div class="flex justify-between p-2 border-b"><span>\${i.name} (x\${i.quantity})</span><span>$\${(i.price * i.quantity).toFixed(2)}</span></div>\`).join('');
        }
        totalEl.textContent = cart.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2);
        const checkoutForm = document.getElementById('checkout-form');
        if(checkoutForm && checkoutForm.elements.items) checkoutForm.elements.items.value = JSON.stringify(cart);
    }

    async function refreshAllData() {
       await Promise.all([
           renderCollectionItems('public-products-list', PRODUCTS_COLLECTION_ID, productRenderer),
           renderCollectionItems('admin-products-list', PRODUCTS_COLLECTION_ID, adminProductRenderer)
       ]);
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('form').forEach(form => form.addEventListener('submit', handleFormSubmit));
        document.querySelectorAll('a[href^="#"]').forEach(anchor => anchor.addEventListener('click', function (e) { e.preventDefault(); document.querySelector(this.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' }); }));
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('animate-fade-in'); observer.unobserve(entry.target); } });
        }, { threshold: 0.1 });
        document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
        if(document.getElementById('public-products-list')) {
            renderCart();
            document.body.addEventListener('click', async (e) => {
                if (e.target.classList.contains('add-to-cart-btn')) { const { id, name, price } = e.target.dataset; addToCart(id, name, price); }
                if (e.target.classList.contains('delete-product-btn')) {
                    if (confirm('Delete this product?')) {
                        try {
                            await deleteDoc(doc(db, \`ai_templates/\${PROJECT_ID}/project_collections/\${PRODUCTS_COLLECTION_ID}/submissions\`, e.target.dataset.id));
                            await refreshAllData();
                        } catch (err) { console.error('Delete error:', err); alert('Failed to delete product.'); }
                    }
                }
            });
            refreshAllData();
        }
    });
    \`\`\`

--- CRITICAL: EDITING & REFINEMENT PROTOCOL ---
When the prompt provides you with "CURRENT HTML", you MUST follow these rules.
1.  **PRESERVE, DON'T REPLACE**: Your primary goal is to act as a surgeon. You MUST take the provided "CURRENT HTML" and apply the user's changes to it.
2.  **NO NEW WEBSITES**: You are FORBIDDEN from generating a new website from scratch in this mode. You MUST NOT discard the existing code, layout, style, or script tags.
3.  **SURGICAL CHANGES**: Locate the most logical place in the existing HTML and make precise changes.
4.  **RETURN THE FULL CODE**: After making your change, you MUST return the COMPLETE, modified HTML file.
5.  **MAINTAIN SCRIPT & STYLE**: The existing \`<style>\` and \`<script>\` tags MUST be preserved perfectly.
`;

// --- GENERATION LOGIC ---
export const generateWithStreaming = async (userContent) => {
    if (s.isGenerating) return;
    if (!s.user) return notify('Please sign in first.', 'error');
    if (!s.editId) {
        notify('Please create or load a project first.', 'error');
        return;
    }

    // 1. Get API Key
    const apiKey = await fetchSystemApiKey();
    if (!apiKey) return notify('System API Key not found. Please contact admin.', 'error');

    if (s.currentUserRole === 'viewer') return notify("You have view-only access.", "error");

    showLoader(true);
    
    // 2. Lock the document
    try {
        await updateDoc(doc(db, "ai_templates", s.editId), { 
            isBeingEditedBy: { uid: s.user.uid, name: s.user.displayName || s.user.email } 
        });
    } catch (e) { console.error("Lock update failed", e); }

    // 3. Detect Intent & Prepare Database Instructions
    let textForIntent = "";
    if (Array.isArray(userContent)) {
        textForIntent = userContent.find(i => i.type === 'text')?.text || "";
    } else {
        textForIntent = userContent;
    }
    
    const { intent, hasForms } = detectFeaturesAndIntent(textForIntent);
    let productsCollectionId = '', ordersCollectionId = '', contactCollectionId = '';
    let databaseInstructions = '';

    if (s.editId && hasForms) {
        try {
            const projectCollections = s.currentProjectData.projectCollections || [];
            const projectCollectionsPath = `ai_templates/${s.editId}/project_collections`;
            const findOrCreateCollection = async (name) => {
                let existingCol = projectCollections.find(c => c.name.toLowerCase() === name.toLowerCase());
                if (existingCol) return existingCol.id;
                const newRef = await addDoc(collection(db, projectCollectionsPath), { name, createdAt: serverTimestamp() });
                s.currentProjectData.projectCollections.push({ id: newRef.id, name });
                notify(`A "${name}" database was created.`, 'success');
                return newRef.id;
            };

            if (intent === 'ecommerce') {
                productsCollectionId = await findOrCreateCollection('Products');
                ordersCollectionId = await findOrCreateCollection('Orders');
            } else if (hasForms) {
                contactCollectionId = await findOrCreateCollection('Leads');
            }

            if (contactCollectionId) databaseInstructions += `\nCRITICAL DATABASE INSTRUCTION: For any contact/leads/inquiry form, use this ID: ${contactCollectionId}`;
            if (productsCollectionId) databaseInstructions += `\nCRITICAL DATABASE INSTRUCTION: For any form that adds new products, use this ID: ${productsCollectionId}`;
            if (ordersCollectionId) databaseInstructions += `\nCRITICAL DATABASE INSTRUCTION: For any checkout/order form, use this ID: ${ordersCollectionId}`;
            
        } catch (error) { notify(`Error setting up databases: ${error.message}`, 'error'); }
    }

    // 4. Update User Content with DB Instructions
    if (databaseInstructions) {
        if (Array.isArray(userContent)) {
            const textObj = userContent.find(i => i.type === 'text');
            if (textObj) textObj.text += databaseInstructions;
        } else {
            // Convert string to array format for SDK compatibility later
            userContent = [{ type: 'text', text: userContent + databaseInstructions }];
        }
    } else {
        // Ensure standard array format
        if (!Array.isArray(userContent)) userContent = [{ type: 'text', text: userContent }];
    }

    // 5. Construct the Context/Prompt
    const personaInstruction = $('ai-persona-input')?.value?.trim() ? `Persona: "${$('ai-persona-input').value.trim()}"` : '';
    
    const contextInstruction = s.html && s.html.trim()
        ? `${personaInstruction}\n--- EDITING MODE ---\nFollow the "EDITING & REFINEMENT PROTOCOL".\n\nCURRENT HTML:\n${s.html}`
        : `${personaInstruction}\n--- NEW WEBSITE MODE ---\nCreate a complete, stunning single-file website based on the request.`;

    const textObj = userContent.find(i => i.type === 'text');
    if (textObj) {
        textObj.text = contextInstruction + "\n\nRequest: " + textObj.text;
    }

    // 6. UI Feedback
    if (s.html && s.html.trim()) {
        const frame = $('preview-frame');
        if(frame) frame.srcdoc = '<body><p style="font-family: sans-serif; text-align: center; padding: 2rem; color:#666;">Applying changes...</p></body>';
    }

    try {
        // --- NEW SDK IMPLEMENTATION (THE FIX) ---
        
        // Initialize Gemini SDK
        const genAI = new GoogleGenerativeAI(s.apiKey.trim());
        const model = genAI.getGenerativeModel({ 
            model: DEFAULT_MODEL, // Ensure constants.js has "gemini-1.5-flash"
            systemInstruction: advancedSystemInstructions 
        });

        // Convert your content format to SDK format
        // Your code uses {type:'text', text:'...'} and {inline_data: ...}
        // SDK expects { text: '...' } and { inlineData: { data: ..., mimeType: ... } }
        const sdkParts = userContent.map(part => {
            if (part.type === 'text' || part.text) {
                return { text: part.text };
            }
            if (part.inline_data) {
                // Convert snake_case from your helper to CamelCase for SDK
                return { 
                    inlineData: { 
                        data: part.inline_data.data, 
                        mimeType: part.inline_data.mime_type 
                    } 
                };
            }
            return null;
        }).filter(Boolean);

        // Generate Stream
        const result = await model.generateContentStream(sdkParts);

        let htmlStream = '';
        
        // Iterate through stream
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            htmlStream += chunkText;
            
            // Live Preview Update
            if (htmlStream.includes('<body')) {
                s.html = htmlStream;
                throttledPreviewUpdate();
            }
        }
        
        s.html = htmlStream;

        // 7. Post-Processing (Replacements)
        s.html = s.html
            .replace(/'--FIREBASE_CONFIG_REPLACE_ME--'/g, JSON.stringify(config))
            .replace(/--CLOUDINARY_NAME--/g, CLOUDINARY_CLOUD_NAME)
            .replace(/--CLOUDINARY_PRESET--/g, CLOUDINARY_UPLOAD_PRESET)
            .replace(/const PROJECT_ID = '.*';/g, `const PROJECT_ID = '${s.editId || ''}';`)
            .replace(/--PRODUCTS_ID--/g, productsCollectionId || '')
            .replace(/--ORDERS_ID--/g, ordersCollectionId || '');
            
        // Clean up markdown markers if any slipped through
        const doctypeIndex = s.html.indexOf('<!DOCTYPE html>');
        if (doctypeIndex > 0) s.html = s.html.substring(doctypeIndex);
        const endHtmlIndex = s.html.lastIndexOf('</html>');
        if (endHtmlIndex > 0) s.html = s.html.substring(0, endHtmlIndex + 7);

        if ($('preview-frame')) $('preview-frame').srcdoc = s.html;

        s.chatHistory.push({ role: 'ai', text: "I've updated the design based on your request. How does it look?" });
        renderChatHistory();

    } catch (e) {
        console.error("Gemini Generation Error:", e);
        notify(`AI Error: ${e.message}`, 'error');
        s.chatHistory.push({ role: 'ai', text: "Sorry, I encountered an error. Please try again." });
        renderChatHistory();
        if ($('preview-frame')) $('preview-frame').srcdoc = s.html;
    } finally {
        if (s.editId) {
            try {
                await updateDoc(doc(db, "ai_templates", s.editId), {
                    htmlContent: s.html,
                    chatHistory: s.chatHistory,
                    isBeingEditedBy: null,
                    isDirty: true
                });
                await saveVersion('AI Edit');
            } catch (updateError) { console.error("Save error:", updateError); }
        }
        showLoader(false);
    }
};

export const generateCodePatch = async (selectedCode, instruction) => {
    // 1. Ensure we have the key
    const apiKey = await fetchSystemApiKey();
    if (!apiKey) throw new Error("API Key missing");

    try {
        // 2. Initialize the SDK
        const genAI = new GoogleGenerativeAI(apiKey.trim());
        const model = genAI.getGenerativeModel({ 
            model: DEFAULT_MODEL, // Uses "gemini-1.5-flash-001" from constants
            systemInstruction: `You are a precise Code Editor AI. 
            Your task is to Modify, Fix, or Generate code based ONLY on the provided selection.
            RULES:
            1. Return ONLY the code. 
            2. ABSOLUTELY NO markdown blocks (no \`\`\`), no explanations.
            3. Maintain original indentation.
            4. If fixing an error, just return the fixed code.`
        });

        // 3. Prepare Request
        const prompt = `CONTEXT SELECTION:\n${selectedCode}\n\nUSER INSTRUCTION:\n${instruction}`;

        // 4. Generate Content (Non-streaming is fine for small patches)
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let finalCode = response.text().trim();

        // 5. Extra Safety: Strip any markdown backticks if AI ignores system instructions
        finalCode = finalCode.replace(/^```\w*\n?/, '').replace(/```$/, '').trim();
        
        return finalCode;

    } catch (error) {
        console.error("AI Patch Error:", error);
        throw new Error(error.message || "Failed to generate code patch");
    }
};