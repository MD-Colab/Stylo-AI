// js/drag&drop.js
import { s } from './state.js';
import { notify, showLoader } from './ui.js';
import { compileForPreview } from './ide.js';

// --- STATE ---
let iframeDoc = null;
let selectedEl = null;
let ghostEl = null; 
let draggedEl = null; // Can be an existing element or a new block type
let historyStack = [];
let historyIndex = -1;
let isLoaded = false;
let resizerBox = null;
let activeTab = 'style'; // 'style' or 'script'
let leftSidebarTab = 'elements'; // 'elements' or 'structure'
let clipboard = { styles: null, element: null }; // For copy/paste

// --- 1. STYLES (MATCHING MAIN THEME) ---
const styles = `
    :root { 
        --ve-bg: #13151b; /* Darker matching theme */
        --ve-panel: #1a1d26; 
        --ve-border: #2d313e; 
        --ve-accent: #6366f1; 
        --ve-text: #e0e0e0; 
        --ve-input: #0f1116;
        --ve-danger: #ef4444;
    }
    
    .ve-overlay { position: fixed; inset:0; background: var(--ve-bg); z-index: 100000; display: flex; flex-direction: column; opacity: 0; pointer-events: none; transition: 0.2s; font-family: 'Inter', sans-serif; color: var(--ve-text); }
    .ve-overlay.active { opacity: 1; pointer-events: all; }
    
    /* Header */
    .ve-header { height: 50px; border-bottom: 1px solid var(--ve-border); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: var(--ve-panel); flex-shrink: 0; }
    .ve-logo { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 10px; color: white; letter-spacing: 0.5px; }
    .ve-actions button { background: var(--ve-input); border: 1px solid var(--ve-border); color: #ccc; padding: 6px 14px; border-radius: 6px; cursor: pointer; margin-left: 8px; transition: 0.2s; font-size: 13px; }
    .ve-actions button:hover { background: #333; color: white; border-color: #555; }
    .ve-actions button:disabled { opacity: 0.4; cursor: not-allowed; }
    .ve-actions button.primary { background: var(--ve-accent); border-color: var(--ve-accent); color: white; font-weight: 600; }

    /* Body */
    .ve-body { display: flex; height: calc(100vh - 50px); }
    .ve-sidebar { width: 280px; background: var(--ve-panel); display: flex; flex-direction: column; border-right: 1px solid var(--ve-border); flex-shrink: 0; }
    .ve-sidebar.right { border-left: 1px solid var(--ve-border); border-right: none; width: 320px; }
    
    .ve-section-title { padding: 15px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--ve-border); }
    .ve-scroll { flex-grow: 1; overflow-y: auto; }
    .ve-scroll-padded { padding: 15px; }
    .ve-scroll::-webkit-scrollbar { width: 6px; }
    .ve-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

    /* Tabs */
    .ve-tabs { display: flex; border-bottom: 1px solid var(--ve-border); background: #111; flex-shrink: 0; }
    .ve-tab-btn { flex: 1; padding: 12px; background: transparent; border: none; color: #888; font-weight: 600; font-size: 12px; cursor: pointer; border-bottom: 2px solid transparent; transition: 0.2s; }
    .ve-tab-btn:hover { color: #ccc; }
    .ve-tab-btn.active { color: var(--ve-accent); border-bottom-color: var(--ve-accent); background: var(--ve-panel); }

    /* Blocks */
    .ve-block-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .ve-block { background: var(--ve-input); border: 1px solid var(--ve-border); border-radius: 8px; padding: 15px 10px; display: flex; flex-direction: column; align-items: center; cursor: grab; transition: 0.2s; user-select: none; }
    .ve-block:hover { border-color: var(--ve-accent); background: #252836; transform: translateY(-2px); }
    .ve-block i { font-size: 22px; margin-bottom: 8px; color: #9ca3af; }
    .ve-block span { font-size: 11px; color: #d1d5db; font-weight: 500; }

    /* Properties */
    .ve-group { margin-bottom: 18px; }
    .ve-label { font-size: 10px; color: #9ca3af; margin-bottom: 6px; display: block; font-weight: 600; text-transform: uppercase; }
    .ve-input, .ve-select { width: 100%; background: var(--ve-input); border: 1px solid var(--ve-border); color: white; padding: 8px; border-radius: 6px; font-size: 12px; outline: none; transition: 0.2s; }
    .ve-input:focus, .ve-select:focus { border-color: var(--ve-accent); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); }
    .ve-row { display: flex; gap: 8px; } .ve-row > * { flex: 1; }
    .ve-input-group { display: flex; }
    .ve-input-group .ve-input { border-radius: 6px 0 0 6px; }
    .ve-input-group .ve-select { border-left: 0; width: 60px; border-radius: 0 6px 6px 0; -webkit-appearance: none; text-align: center; padding-right: 5px; }

    /* Structure Panel */
    .ve-structure-item { display: flex; align-items: center; padding: 6px 10px; font-size: 12px; border-radius: 4px; cursor: pointer; transition: 0.2s; }
    .ve-structure-item:hover { background: #252836; }
    .ve-structure-item.selected { background: var(--ve-accent); color: white; }
    .ve-structure-item .tag { font-weight: 600; color: #a3a7f7; }
    .ve-structure-item.selected .tag { color: white; }
    .ve-structure-item .id-class { color: #888; font-size: 11px; margin-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ve-structure-item.selected .id-class { color: #ddd; }

    /* Canvas */
    .ve-canvas-area { flex-grow: 1; background: #0c0e12; padding: 20px; display: flex; flex-direction: column; justify-content: center; position: relative; overflow: hidden; }
    #ve-iframe { background: white; border: none; box-shadow: 0 0 60px rgba(0,0,0,0.5); transition: width 0.3s ease; width: 100%; height: 100%; max-width: 100%; border-radius: 2px; }
    .ve-devices { background: var(--ve-input); border-radius: 6px; display: flex; overflow: hidden; border: 1px solid var(--ve-border); margin-right: 15px; }
    .ve-device-btn { background: transparent; border: none; color: #888; padding: 6px 14px; cursor: pointer; height: 32px; display: flex; align-items: center; }
    .ve-device-btn.active { background: #333; color: white; }
    
    /* Breadcrumbs */
    #ve-breadcrumbs { height: 30px; background: var(--ve-panel); border-top: 1px solid var(--ve-border); flex-shrink: 0; display: flex; align-items: center; padding: 0 10px; font-size: 11px; color: #888; overflow-x: auto; }
    #ve-breadcrumbs button { background: none; border: none; color: #999; cursor: pointer; padding: 4px 6px; border-radius: 4px; }
    #ve-breadcrumbs button:hover { background: #333; color: white; }
    #ve-breadcrumbs span { margin: 0 4px; }

    /* Context Menu */
    #ve-context-menu { position: fixed; z-index: 100001; background: #252836; border: 1px solid var(--ve-border); border-radius: 6px; padding: 5px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); display: none; }
    #ve-context-menu button { display: block; width: 100%; background: none; border: none; color: var(--ve-text); padding: 8px 12px; text-align: left; cursor: pointer; border-radius: 4px; font-size: 13px; white-space: nowrap; }
    #ve-context-menu button:hover { background: var(--ve-accent); color: white; }
    #ve-context-menu hr { border: none; border-top: 1px solid var(--ve-border); margin: 4px 0; }
`;

// --- 2. HTML STRUCTURE ---
const htmlStructure = `
    <div id="ve-modal" class="ve-overlay">
        <div class="ve-header">
            <div class="ve-logo"><i class="fas fa-cubes"></i> Stylo Visual Editor</div>
            <div style="display:flex; align-items:center;">
                <div class="ve-devices">
                    <button class="ve-device-btn active" data-width="100%"><i class="fas fa-desktop"></i></button>
                    <button class="ve-device-btn" data-width="768px"><i class="fas fa-tablet-alt"></i></button>
                    <button class="ve-device-btn" data-width="375px"><i class="fas fa-mobile-alt"></i></button>
                </div>
                <div class="ve-actions">
                    <button id="ve-undo" title="Undo (Ctrl+Z)"><i class="fas fa-undo"></i></button>
                    <button id="ve-redo" title="Redo (Ctrl+Y)"><i class="fas fa-redo"></i></button>
                    <button id="ve-save" class="primary"><i class="fas fa-save"></i> Save Changes</button>
                    <button id="ve-close"><i class="fas fa-times"></i></button>
                </div>
            </div>
        </div>
        <div class="ve-body">
            <!-- Left Sidebar -->
            <div class="ve-sidebar">
                <div class="ve-tabs">
                    <button id="ve-tab-elements" class="ve-tab-btn active" onclick="window.veSwitchLeftSidebar('elements')">Elements</button>
                    <button id="ve-tab-structure" class="ve-tab-btn" onclick="window.veSwitchLeftSidebar('structure')">Structure</button>
                </div>
                <div id="ve-left-sidebar-content" class="ve-scroll"></div>
            </div>

            <!-- Center: Canvas -->
            <div class="ve-canvas-area">
                <iframe id="ve-iframe"></iframe>
                <div id="ve-breadcrumbs">Select an element...</div>
            </div>

            <!-- Right Sidebar: Properties -->
            <div class="ve-sidebar right">
                <div class="ve-tabs">
                    <button class="ve-tab-btn active" onclick="window.veSwitchTab('style')">Style</button>
                    <button class="ve-tab-btn" onclick="window.veSwitchTab('script')">Settings & Script</button>
                </div>
                <div id="ve-props-content" class="ve-scroll ve-scroll-padded">
                    <p style="color:#666; font-size:13px; text-align:center; margin-top:40px;">Select an element to edit</p>
                </div>
            </div>
        </div>
    </div>
    <div id="ve-context-menu">
        <button id="ve-ctx-duplicate"><i class="far fa-clone"></i> Duplicate</button>
        <hr>
        <button id="ve-ctx-copy-styles"><i class="fas fa-palette"></i> Copy Styles</button>
        <button id="ve-ctx-paste-styles"><i class="fas fa-paste"></i> Paste Styles</button>
        <hr>
        <button id="ve-ctx-delete" style="color: var(--ve-danger);"><i class="fas fa-trash"></i> Delete</button>
    </div>
`;

// --- 3. TEMPLATES & RENDERERS ---
const templates = {
    'section': `<section class="py-16 px-6 bg-white"><div class="container mx-auto border-2 border-dashed border-gray-300 p-10 text-center text-gray-400">Section Content</div></section>`,
    'container': `<div class="p-6 border border-gray-200 rounded-lg min-h-[100px] bg-gray-50">Container</div>`,
    'grid-2': `<div class="grid grid-cols-1 md:grid-cols-2 gap-8"><div class="p-6 bg-gray-100 border border-gray-200 rounded">Col 1</div><div class="p-6 bg-gray-100 border border-gray-200 rounded">Col 2</div></div>`,
    'grid-3': `<div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div class="p-6 bg-gray-100 rounded">1</div><div class="p-6 bg-gray-100 rounded">2</div><div class="p-6 bg-gray-100 rounded">3</div></div>`,
    'heading': `<h2 class="text-4xl font-extrabold text-gray-900 mb-4">Headline Text</h2>`,
    'text': `<p class="text-gray-600 mb-4 leading-relaxed text-lg">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>`,
    'image': `<img src="https://via.placeholder.com/600x400" alt="Placeholder" class="w-full h-auto rounded-lg shadow-md object-cover">`,
    'button': `<a href="#" class="inline-block px-8 py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition duration-300 shadow-sm">Click Me</a>`,
    'card': `<div class="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100"><img class="w-full h-48 object-cover" src="https://via.placeholder.com/400x200" alt="Card"><div class="p-6"><h3 class="font-bold text-xl mb-2 text-gray-900">Card Title</h3><p class="text-gray-600">Card description text goes here.</p></div></div>`,
    'navbar': `<nav class="bg-gray-900 text-white p-4 flex justify-between items-center shadow-md"><div class="font-bold text-xl tracking-tight">Logo</div><div class="flex gap-6"><a href="#" class="hover:text-indigo-400 transition">Home</a><a href="#" class="hover:text-indigo-400 transition">About</a><a href="#" class="hover:text-indigo-400 transition">Contact</a></div></nav>`,
    'video': `<div class="aspect-w-16 aspect-h-9"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full rounded-lg shadow-lg"></iframe></div>`,
    'input': `<input type="text" placeholder="Enter text..." class="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none">`
};

const renderers = {
    elements: () => `
        <div class="ve-scroll-padded">
            <div class="ve-block-grid">
                ${Object.entries(templates).map(([type, _]) => {
                    const name = type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
                    const icon = { section: 'far fa-square', container: 'far fa-window-maximize', 'grid-2': 'fas fa-columns', 'grid-3': 'fas fa-th-large', heading: 'fas fa-heading', text: 'fas fa-paragraph', image: 'far fa-image', button: 'fas fa-mouse', card: 'far fa-id-card', navbar: 'fas fa-bars', video: 'fas fa-play-circle', input: 'fas fa-keyboard' }[type];
                    return `<div class="ve-block" draggable="true" data-type="${type}"><i class="${icon}"></i><span>${name}</span></div>`
                }).join('')}
            </div>
        </div>
    `,
    structure: () => {
        if (!iframeDoc || !iframeDoc.body) return '<p class="p-4 text-xs text-gray-500">Loading structure...</p>';
        const generateTree = (el, level = 0) => {
            if (el.nodeType !== 1 || ['SCRIPT', 'STYLE'].includes(el.tagName)) return '';
            let id = el.getAttribute('data-ve-id');
            if (!id) {
                id = `ve-id-${Math.random().toString(36).substr(2, 9)}`;
                el.setAttribute('data-ve-id', id);
            }
            const isSelected = selectedEl === el;
            const childrenHtml = [...el.children].map(child => generateTree(child, level + 1)).join('');
            
            const idClass = `${el.id ? '#'+el.id : ''}${el.className.split(' ').filter(c=>c&&!c.startsWith('ve-')).map(c=>'.'+c).join('')}`;

            return `
                <div style="padding-left: ${level * 15}px;">
                    <div class="ve-structure-item ${isSelected ? 'selected' : ''}" data-ve-id="${id}" onclick="window.veSelectById('${id}')">
                        <span class="tag">${el.tagName}</span>
                        <span class="id-class">${idClass}</span>
                    </div>
                    ${childrenHtml}
                </div>
            `;
        };
        return generateTree(iframeDoc.body);
    }
};

// --- 4. INIT & SETUP ---
export const openVisualEditor = async () => {
    if (!isLoaded) {
        showLoader(true);
        const style = document.createElement('style'); style.innerHTML = styles; document.head.appendChild(style);
        document.body.insertAdjacentHTML('beforeend', htmlStructure);
        
        // FontAwesome
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const fa = document.createElement('link'); fa.rel = 'stylesheet'; fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'; document.head.appendChild(fa);
        }

        // Global Handlers
        window.veUpdateStyle = veUpdateStyle; window.veUpdateText = veUpdateText; window.veUpdateAttr = veUpdateAttr;
        window.veSwitchTab = veSwitchTab; window.veSwitchLeftSidebar = veSwitchLeftSidebar;
        window.veDeleteSelected = veDeleteSelected; window.veDuplicateSelected = veDuplicateSelected;
        window.veSelectById = (id) => selectElement(iframeDoc.querySelector(`[data-ve-id="${id}"]`));
        
        setupEvents();
        isLoaded = true;
        showLoader(false);
    }
    document.getElementById('ve-modal').classList.add('active');
    setTimeout(initCanvas, 100);
};

const initCanvas = () => {
    const iframe = document.getElementById('ve-iframe');
    iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    let html = s.files['index.html'] || s.html || '';
    if (!html.trim()) html = `<body><div class="p-20 text-center text-gray-400">Drag & Drop components here</div></body>`;
    if (!html.includes('cdn.tailwindcss.com')) html = html.replace('<head>', '<head><script src="https://cdn.tailwindcss.com"></script>');

    const editorStyles = `
        <style id="ve-internal">
            body { padding-bottom: 200px; min-height: 100vh; cursor: default; }
            *[data-ve-hover="true"] { outline: 2px solid #6366f1 !important; outline-offset: -2px; cursor: pointer; }
            *[data-ve-selected="true"] { outline: 3px solid #6366f1 !important; outline-offset: -3px; z-index: 10; position: relative; }
            .ve-resizer { position: absolute; border: 2px solid #6366f1; pointer-events: none; z-index: 9999; display: none; }
            .ve-resizer-label { position: absolute; top: -20px; left: -2px; background: #6366f1; color: white; font-size: 10px; padding: 2px 5px; border-radius: 4px 4px 0 0; }
            .ve-handle { width: 12px; height: 12px; background: white; border: 2px solid #6366f1; position: absolute; pointer-events: auto; cursor: nwse-resize; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
            .ve-handle.br { bottom: -6px; right: -6px; }
            .ve-drop-indicator { position: absolute; height: 3px; background: #3b82f6; width: 100%; z-index: 99999; pointer-events: none; }
            [contenteditable]:focus { outline: 2px solid #22c55e !important; background: rgba(34, 197, 94, 0.05); cursor: text; }
            /* Hide default drag ghost image */
            .ve-dragging-ghost { opacity: 0.5; border: 2px dashed #6366f1; }
        </style>
    `;

    iframeDoc.open();
    iframeDoc.write(html + editorStyles);
    iframeDoc.close();

    iframe.onload = () => {
        setupIframeInteractions();
        createResizer();
        recordHistory();
        updateHistoryButtons();
        renderLeftSidebar();
    };
};

const setupEvents = () => {
    document.getElementById('ve-close').onclick = () => document.getElementById('ve-modal').classList.remove('active');
    document.getElementById('ve-save').onclick = saveToProject;
    document.getElementById('ve-undo').onclick = undo;
    document.getElementById('ve-redo').onclick = redo;

    // Device switcher
    document.querySelectorAll('.ve-device-btn').forEach(btn => btn.onclick = () => {
        document.querySelectorAll('.ve-device-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('ve-iframe').style.width = btn.dataset.width;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (!document.getElementById('ve-modal').classList.contains('active')) return;
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') { e.preventDefault(); undo(); }
            if (e.key === 'y') { e.preventDefault(); redo(); }
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedEl && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                veDeleteSelected();
            }
        }
    });

    // Context Menu
    const ctxMenu = document.getElementById('ve-context-menu');
    document.getElementById('ve-ctx-duplicate').onclick = () => { veDuplicateSelected(); ctxMenu.style.display = 'none'; };
    document.getElementById('ve-ctx-delete').onclick = () => { veDeleteSelected(); ctxMenu.style.display = 'none'; };
    document.getElementById('ve-ctx-copy-styles').onclick = () => { copyStyles(); ctxMenu.style.display = 'none'; };
    document.getElementById('ve-ctx-paste-styles').onclick = () => { pasteStyles(); ctxMenu.style.display = 'none'; };
    document.addEventListener('click', () => ctxMenu.style.display = 'none');
};

const setupIframeInteractions = () => {
    const body = iframeDoc.body;
    iframeDoc.addEventListener('scroll', updateResizer);

    // Hover effect
    body.addEventListener('mouseover', e => {
        iframeDoc.querySelectorAll('[data-ve-hover]').forEach(el => el.removeAttribute('data-ve-hover'));
        if (e.target !== body && e.target !== selectedEl && !resizerBox.contains(e.target)) {
            e.target.setAttribute('data-ve-hover', 'true');
        }
    });

    // Element selection
    body.addEventListener('click', e => {
        if (e.target === body || resizerBox.contains(e.target)) return;
        e.stopPropagation(); e.preventDefault(); // Prevent links from firing
        selectElement(e.target);
    });

    // Double-click to edit text
    body.addEventListener('dblclick', e => {
        e.stopPropagation(); e.preventDefault();
        const el = e.target;
        if (el.children.length === 0) { // Only allow editing on leaf nodes
            el.contentEditable = true; el.focus();
            el.onblur = () => { el.contentEditable = false; recordHistory(); };
            el.oninput = () => recordHistory(); // Record history as user types
        }
    });
    
    // Right-click context menu
    body.addEventListener('contextmenu', e => {
        e.preventDefault();
        selectElement(e.target);
        const menu = document.getElementById('ve-context-menu');
        menu.style.display = 'block';
        const modalRect = document.getElementById('ve-modal').getBoundingClientRect();
        menu.style.left = `${e.clientX + modalRect.left}px`;
        menu.style.top = `${e.clientY + modalRect.top}px`;
    });


    // --- UNIFIED DRAG & DROP LOGIC ---
    body.addEventListener('dragstart', e => {
        e.stopPropagation();
        draggedEl = e.target;
        e.dataTransfer.effectAllowed = 'move';
        // Use a slight delay to allow the browser to create its ghost image
        setTimeout(() => {
           if(draggedEl) draggedEl.classList.add('ve-dragging-ghost');
        }, 0);
    }, false);

    body.addEventListener('dragover', e => {
        e.preventDefault();
        if(!draggedEl) return;
        const target = e.target;
        if(target === body || target === draggedEl || draggedEl.contains(target)) return;

        if(!ghostEl) {
             ghostEl = iframeDoc.createElement('div');
             ghostEl.className = 've-drop-indicator';
             iframeDoc.body.appendChild(ghostEl);
        }

        const rect = target.getBoundingClientRect();
        const isNested = (target.offsetHeight > 50 && e.clientY > rect.top + rect.height * 0.25 && e.clientY < rect.bottom - rect.height * 0.25);
        
        if(isNested) { // Drop inside
            ghostEl.style.width = "100%";
            ghostEl.style.top = `${target.getBoundingClientRect().top + iframeDoc.documentElement.scrollTop}px`;
            ghostEl.style.left = `${target.getBoundingClientRect().left}px`;
        } else { // Drop before/after
            const isAfter = e.clientY > rect.top + rect.height / 2;
            ghostEl.style.width = `${rect.width}px`;
            ghostEl.style.left = `${rect.left}px`;
            if(isAfter){
                ghostEl.style.top = `${rect.bottom + iframeDoc.documentElement.scrollTop}px`;
            } else {
                ghostEl.style.top = `${rect.top + iframeDoc.documentElement.scrollTop}px`;
            }
        }
    });

    body.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        if(!draggedEl || !ghostEl) return;

        let newEl;
        const target = e.target;
        const rect = target.getBoundingClientRect();
        const isNested = (target.offsetHeight > 50 && e.clientY > rect.top + rect.height * 0.25 && e.clientY < rect.bottom - rect.height * 0.25);
        
        if (typeof draggedEl === 'string') { // New element from sidebar
            const div = document.createElement('div'); div.innerHTML = templates[draggedEl];
            newEl = div.firstChild;
        } else { // Existing element from canvas
            newEl = draggedEl;
            draggedEl.classList.remove('ve-dragging-ghost');
        }

        if(isNested) {
            target.appendChild(newEl);
        } else {
            const isAfter = e.clientY > rect.top + rect.height / 2;
            target.parentNode.insertBefore(newEl, isAfter ? target.nextSibling : target);
        }

        if (ghostEl && ghostEl.parentNode) ghostEl.parentNode.removeChild(ghostEl);
        ghostEl = null; draggedEl = null;

        selectElement(newEl);
        recordHistory();
    });

    body.addEventListener('dragend', e => {
        if(draggedEl && typeof draggedEl !== 'string') {
            draggedEl.classList.remove('ve-dragging-ghost');
        }
        if(ghostEl && ghostEl.parentNode) ghostEl.parentNode.removeChild(ghostEl);
        draggedEl = null; ghostEl = null;
    });
};

// --- 5. RESIZER & UI UPDATES ---
const createResizer = () => {
    if (!iframeDoc) return;
    resizerBox = iframeDoc.createElement('div');
    resizerBox.className = 've-resizer';
    resizerBox.innerHTML = `<div class="ve-resizer-label"></div><div class="ve-handle br"></div>`;
    iframeDoc.body.appendChild(resizerBox);

    const handle = resizerBox.querySelector('.ve-handle');
    let startX, startY, startW, startH;

    handle.addEventListener('mousedown', e => {
        if (!selectedEl) return;
        e.stopPropagation(); e.preventDefault();
        startX = e.clientX; startY = e.clientY;
        const rect = selectedEl.getBoundingClientRect();
        startW = rect.width; startH = rect.height;

        const doResize = ev => {
            selectedEl.style.width = `${startW + (ev.clientX - startX)}px`;
            selectedEl.style.height = `${startH + (ev.clientY - startY)}px`;
            updateResizer();
            if (activeTab === 'style') renderStyleProps();
        };

        const stopResize = () => {
            iframeDoc.removeEventListener('mousemove', doResize);
            iframeDoc.removeEventListener('mouseup', stopResize);
            recordHistory();
        };
        iframeDoc.addEventListener('mousemove', doResize);
        iframeDoc.addEventListener('mouseup', stopResize);
    });
};

const updateResizer = () => {
    if (!selectedEl || !resizerBox) { if (resizerBox) resizerBox.style.display = 'none'; return; }
    const rect = selectedEl.getBoundingClientRect();
    const scrollTop = iframeDoc.documentElement.scrollTop || iframeDoc.body.scrollTop;
    resizerBox.style.display = 'block';
    resizerBox.style.top = `${rect.top + scrollTop}px`;
    resizerBox.style.left = `${rect.left}px`;
    resizerBox.style.width = `${rect.width}px`;
    resizerBox.style.height = `${rect.height}px`;
    resizerBox.querySelector('.ve-resizer-label').textContent = selectedEl.tagName;
};

const updateBreadcrumbs = () => {
    const container = document.getElementById('ve-breadcrumbs');
    if(!selectedEl) {
        container.innerHTML = 'Select an element...'; return;
    }
    let path = []; let el = selectedEl;
    while(el && el.tagName !== 'BODY') {
        path.unshift(el);
        el = el.parentElement;
    }
    container.innerHTML = path.map(p => `<button onclick="window.veSelectById('${p.getAttribute('data-ve-id')}')">${p.tagName}</button>`).join('<span>&gt;</span>');
};

// --- 6. ELEMENT SELECTION & MANIPULATION ---
const selectElement = (el) => {
    if (selectedEl) selectedEl.removeAttribute('data-ve-selected');
    selectedEl = el;
    if (!selectedEl) {
        renderSidebar();
        updateResizer();
        updateBreadcrumbs();
        return;
    };
    
    // Add draggable to all elements in canvas for reordering
    if(!selectedEl.hasAttribute('draggable')) {
        selectedEl.setAttribute('draggable', 'true');
    }

    selectedEl.setAttribute('data-ve-selected', 'true');
    updateResizer();
    renderSidebar();
    updateBreadcrumbs();
    
    // Update structure panel selection without full re-render
    document.querySelectorAll('.ve-structure-item.selected').forEach(i => i.classList.remove('selected'));
    const structureItem = document.querySelector(`.ve-structure-item[data-ve-id="${selectedEl.getAttribute('data-ve-id')}"]`);
    if(structureItem) structureItem.classList.add('selected');
};

function veDuplicateSelected() {
    if (!selectedEl) return;
    const clone = selectedEl.cloneNode(true);
    clone.removeAttribute('data-ve-selected');
    selectedEl.parentNode.insertBefore(clone, selectedEl.nextSibling);
    selectElement(clone);
    recordHistory();
}

function veDeleteSelected() {
    if (selectedEl && confirm("Are you sure you want to delete this element?")) {
        selectedEl.remove();
        selectedEl = null;
        renderSidebar();
        updateResizer();
        recordHistory();
        updateBreadcrumbs();
        renderLeftSidebar();
    }
}

function copyStyles() {
    if (!selectedEl) return;
    clipboard.styles = {
        inline: selectedEl.getAttribute('style') || '',
        classes: selectedEl.getAttribute('class') || ''
    };
    notify('Styles copied!');
}

function pasteStyles() {
    if (!selectedEl || !clipboard.styles) return;
    selectedEl.setAttribute('style', clipboard.styles.inline);
    selectedEl.setAttribute('class', clipboard.styles.classes);
    recordHistory();
    renderSidebar();
    notify('Styles pasted!');
}

// --- 7. PROPERTIES PANEL (DUAL TABS) ---
function veSwitchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.ve-sidebar.right .ve-tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderSidebar();
}
function veSwitchLeftSidebar(tab) {
    leftSidebarTab = tab;
    document.querySelectorAll('.ve-sidebar:not(.right) .ve-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`ve-tab-${tab}`).classList.add('active');
    renderLeftSidebar();
}

const renderLeftSidebar = () => {
    const container = document.getElementById('ve-left-sidebar-content');
    container.innerHTML = renderers[leftSidebarTab]();

    // After rendering elements, attach drag listeners
    if (leftSidebarTab === 'elements') {
        document.querySelectorAll('.ve-block').forEach(b => {
            b.addEventListener('dragstart', e => { draggedEl = b.dataset.type; e.dataTransfer.effectAllowed = 'copy'; });
            b.addEventListener('dragend', () => draggedEl = null);
        });
    }
}

const renderSidebar = () => {
    const container = document.getElementById('ve-props-content');
    if (!selectedEl) {
        container.innerHTML = '<p style="color:#666; font-size:13px; text-align:center; margin-top:40px;">Select an element to edit</p>';
        return;
    }

    if (activeTab === 'style') renderStyleProps();
    else renderScriptProps();
};

const renderStyleProps = () => {
    const container = document.getElementById('ve-props-content');
    const comp = selectedEl.ownerDocument.defaultView.getComputedStyle(selectedEl);
    
    // Helper to parse value and unit
    const parseUnitValue = (v) => {
        if (!v) return { value: '', unit: 'px' };
        const value = parseFloat(v) || 0;
        const unit = v.replace(String(value), '') || 'px';
        return { value, unit };
    };
    
    // Helper for Inputs with Units
    const unitInp = (label, prop) => {
        const { value, unit } = parseUnitValue(selectedEl.style[prop] || comp[prop]);
        return `<div class="ve-group">
            <label class="ve-label">${label}</label>
            <div class="ve-input-group">
                <input type="number" class="ve-input" value="${value}" onchange="window.veUpdateStyle('${prop}', this.value + this.nextElementSibling.value)">
                <select class="ve-select" onchange="window.veUpdateStyle('${prop}', this.previousElementSibling.value + this.value)">
                    ${['px', '%', 'rem', 'em', 'vw', 'vh'].map(u => `<option value="${u}" ${unit === u ? 'selected' : ''}>${u}</option>`).join('')}
                </select>
            </div>
        </div>`;
    };

    const inp = (label, prop, type='text', opts=[]) => {
        let val = selectedEl.style[prop] || comp[prop] || '';
        if(type === 'color' && val.startsWith('rgb')) {
            const [r,g,b] = val.match(/\d+/g);
            val = "#" + ((1<<24) + (+r<<16) + (+g<<8) + +b).toString(16).slice(1);
        }
        
        let control = `<input type="${type}" class="ve-input" value="${val}" onchange="window.veUpdateStyle('${prop}', this.value)">`;
        if(opts.length) {
            control = `<select class="ve-input" onchange="window.veUpdateStyle('${prop}', this.value)">
                ${opts.map(o => `<option value="${o}" ${val.includes(o) ? 'selected' : ''}>${o}</option>`).join('')}
            </select>`;
        }
        return `<div class="ve-group"><label class="ve-label">${label}</label>${control}</div>`;
    };

    const flexControls = comp.display === 'flex' ? `
        <div class="ve-label" style="margin-top:20px; color:#6366f1;">Flexbox</div>
        <div class="ve-group"><label class="ve-label">Direction</label><select class="ve-input" onchange="window.veUpdateStyle('flexDirection', this.value)">${['row','column','row-reverse','column-reverse'].map(o=>`<option ${comp.flexDirection===o?'selected':''}>${o}</option>`).join('')}</select></div>
        <div class="ve-group"><label class="ve-label">Justify Content</label><select class="ve-input" onchange="window.veUpdateStyle('justifyContent', this.value)">${['flex-start','flex-end','center','space-between','space-around'].map(o=>`<option ${comp.justifyContent===o?'selected':''}>${o}</option>`).join('')}</select></div>
        <div class="ve-group"><label class="ve-label">Align Items</label><select class="ve-input" onchange="window.veUpdateStyle('alignItems', this.value)">${['flex-start','flex-end','center','stretch','baseline'].map(o=>`<option ${comp.alignItems===o?'selected':''}>${o}</option>`).join('')}</select></div>
        ${unitInp('Gap', 'gap')}
    ` : '';
    
    container.innerHTML = `
        <div style="padding-bottom:15px; border-bottom:1px solid #333; margin-bottom:15px; font-weight:bold; color:#fff; text-transform:uppercase; font-size:11px;">
            ${selectedEl.tagName}
            <button onclick="window.veDuplicateSelected()" title="Duplicate Element" style="float:right; background:none; border:none; color:#ccc; cursor:pointer;"><i class="far fa-clone"></i></button>
        </div>

        ${selectedEl.children.length === 0 ? `<div class="ve-group"><label class="ve-label">Content Text</label><textarea class="ve-input" rows="3" oninput="window.veUpdateText(this.value)">${selectedEl.innerText}</textarea></div>` : ''}

        <div class="ve-label" style="margin-top:20px; color:#6366f1;">Layout</div>
        <div class="ve-row">${inp('Display', 'display', 'text', ['block', 'flex', 'grid', 'inline-block', 'none'])}${inp('Pos', 'position', 'text', ['static','relative','absolute','fixed'])}</div>
        <div class="ve-row">${unitInp('Width', 'width')}${unitInp('Height', 'height')}</div>
        ${flexControls}
        
        <div class="ve-label" style="margin-top:20px; color:#6366f1;">Spacing</div>
        <div class="ve-row">${unitInp('Padding', 'padding')}${unitInp('Margin', 'margin')}</div>
        
        <div class="ve-label" style="margin-top:20px; color:#6366f1;">Typography</div>
        <div class="ve-row">${unitInp('Size', 'fontSize')}${inp('Color', 'color', 'color')}</div>
        <div class="ve-row">${inp('Weight', 'fontWeight', 'text', ['400','500','600','700','800'])}${inp('Align', 'textAlign', 'text', ['left','center','right'])}</div>

        <div class="ve-label" style="margin-top:20px; color:#6366f1;">Appearance</div>
        <div class="ve-row">${inp('Bg Color', 'backgroundColor', 'color')}${inp('Opacity', 'opacity')}</div>
        <div class="ve-row">${unitInp('Radius', 'borderRadius')}${inp('Border', 'border')}</div>
        ${inp('Shadow', 'boxShadow')}

        <div class="ve-group" style="margin-top:20px;"><label class="ve-label">Tailwind Classes</label><textarea class="ve-input" rows="3" oninput="window.veUpdateAttr('class', this.value)">${selectedEl.className}</textarea></div>

        <button onclick="window.veDeleteSelected()" style="width:100%; margin-top:20px; background:var(--ve-danger); color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:600;"><i class="fas fa-trash"></i> Delete Element</button>
    `;
};

const renderScriptProps = () => { /* ... Unchanged from original ... */
    const container = document.getElementById('ve-props-content');
    const isImg = selectedEl.tagName === 'IMG';
    const isLink = selectedEl.tagName === 'A';

    let imgPickerHtml = '';
    if(isImg && s.currentProjectData?.projectImages?.length) {
        imgPickerHtml = `<div class="ve-group"><label class="ve-label">Select Project Image</label><div class="ve-img-grid">${s.currentProjectData.projectImages.map(img => `<img src="${img.url}" class="ve-img-option" onclick="window.veUpdateAttr('src', '${img.url}')" title="${img.name}">`).join('')}</div></div>`;
    }

    container.innerHTML = `
        <div style="padding-bottom:15px; border-bottom:1px solid #333; margin-bottom:15px; font-weight:bold; color:#fff; font-size:11px;">ELEMENT SETTINGS</div>
        <div class="ve-group"><label class="ve-label">Element ID</label><input type="text" class="ve-input" value="${selectedEl.id}" onchange="window.veUpdateAttr('id', this.value)" placeholder="unique-id"></div>
        ${isImg ? `<div class="ve-group"><label class="ve-label">Image Source URL</label><input type="text" class="ve-input" value="${selectedEl.src}" onchange="window.veUpdateAttr('src', this.value)"></div><div class="ve-group"><label class="ve-label">Alt Text</label><input type="text" class="ve-input" value="${selectedEl.alt}" onchange="window.veUpdateAttr('alt', this.value)"></div>${imgPickerHtml}` : ''}
        ${isLink ? `<div class="ve-group"><label class="ve-label">Link URL (Href)</label><input type="text" class="ve-input" value="${selectedEl.getAttribute('href')||'#'}" onchange="window.veUpdateAttr('href', this.value)"></div><div class="ve-group"><label class="ve-label">Target</label><select class="ve-input" onchange="window.veUpdateAttr('target', this.value)"><option value="_self">Same Tab</option><option value="_blank">New Tab</option></select></div>` : ''}
        <div class="ve-group" style="margin-top:20px; border-top:1px solid #333; padding-top:15px;"><label class="ve-label">On Click Interaction</label><select class="ve-input" onchange="if(this.value) window.veUpdateAttr('onclick', this.value)"><option value="">No Action</option><option value="alert('Hello!')" ${selectedEl.getAttribute('onclick')?.includes('alert')?'selected':''}>Show Alert</option><option value="window.scrollTo(0,0)" ${selectedEl.getAttribute('onclick')?.includes('scrollTo')?'selected':''}>Scroll to Top</option></select><textarea class="ve-input" rows="3" style="margin-top:5px;" placeholder="Custom JS: alert('hi')" onchange="window.veUpdateAttr('onclick', this.value)">${selectedEl.getAttribute('onclick')||''}</textarea></div>`;
};

// --- GLOBALS for inline event handlers ---
function veUpdateStyle(p, v) { if(selectedEl) { selectedEl.style[p] = v; updateResizer(); recordHistory(); } }
function veUpdateText(v) { if(selectedEl) { selectedEl.innerText = v; /* History recorded by oninput/onblur */ } }
function veUpdateAttr(a, v) { if(selectedEl) { selectedEl.setAttribute(a, v); updateResizer(); recordHistory(); renderLeftSidebar(); /* for id/class changes */ } }

// --- 8. HISTORY (UNDO/REDO) ---
const recordHistory = () => {
    if (!iframeDoc) return;
    const currentHtml = iframeDoc.body.innerHTML;
    if (currentHtml !== (historyStack[historyIndex] || null)) {
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push(currentHtml);
        historyIndex++;
        updateHistoryButtons();
    }
};

const updateHistoryButtons = () => {
    document.getElementById('ve-undo').disabled = historyIndex <= 0;
    document.getElementById('ve-redo').disabled = historyIndex >= historyStack.length - 1;
};

const undo = () => { if (historyIndex > 0) { historyIndex--; restoreState(); } };
const redo = () => { if (historyIndex < historyStack.length - 1) { historyIndex++; restoreState(); } };

const restoreState = () => {
    if (!iframeDoc || !historyStack[historyIndex]) return;
    iframeDoc.body.innerHTML = historyStack[historyIndex];
    selectElement(null);
    updateHistoryButtons();
    renderLeftSidebar(); // Structure panel needs full refresh
};

// --- 9. SAVE & EXPORT ---
const saveToProject = () => {
    showLoader(true);
    const clone = iframeDoc.documentElement.cloneNode(true);
    // Cleanup editor-specific elements before saving
    clone.querySelector('#ve-internal')?.remove();
    clone.querySelector('.ve-resizer')?.remove();
    clone.querySelectorAll('[data-ve-hover],[data-ve-selected],[data-ve-id],.ve-dragging-ghost').forEach(e => {
        e.removeAttribute('data-ve-hover'); e.removeAttribute('data-ve-selected');
        e.removeAttribute('data-ve-id'); e.removeAttribute('contenteditable');
        e.removeAttribute('draggable'); e.classList.remove('ve-dragging-ghost');
    });
    const finalHtml = `<!DOCTYPE html>\n${clone.outerHTML}`;
    
    s.files['index.html'] = finalHtml;
    s.html = compileForPreview();
    document.getElementById('preview-frame').srcdoc = s.html;
    document.getElementById('save-btn').click(); // Trigger main app save
    document.getElementById('ve-modal').classList.remove('active');
    showLoader(false);
    notify('Project saved successfully!');
};