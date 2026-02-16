// js/ide.js
import { s } from './state.js';
import { $, slugify, checkPlanAccess } from './utils.js'; 
import { notify, toggleModal } from './ui.js';
import { generateCodePatch } from './ai-core.js';

let editorInstance = null;
let aiWidget = null;
let aiWindow = null;

// --- CRITICAL: Bridge Single-File HTML to Multi-File IDE ---
const syncStateToFiles = () => {
    // If we already have files loaded, don't overwrite
    if (s.files && Object.keys(s.files).length > 0 && s.files['index.html']) return;

    // If we have a single HTML string (from AI or Firestore), split it
    if (s.html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(s.html, 'text/html');
        
        // Extract CSS
        let css = "";
        const styleTag = doc.querySelector('style');
        if (styleTag) {
            css = styleTag.innerHTML;
            styleTag.remove();
        }

        // Extract JS
        let js = "";
        const scripts = doc.querySelectorAll('script');
        scripts.forEach(script => {
            if (!script.src && (!script.type || script.type === 'module' || script.type === 'text/javascript')) {
                js += script.innerHTML + "\n";
                script.remove();
            }
        });

        const cleanHtml = doc.documentElement.outerHTML;

        s.files = {
            "index.html": `<!DOCTYPE html>\n${cleanHtml}`,
            "style.css": css.trim(),
            "script.js": js.trim()
        };
        s.activeFile = "index.html";
    } else {
        // Default blank state
        s.files = { "index.html": "", "style.css": "", "script.js": "" };
        s.activeFile = "index.html";
    }
};

export const initIDE = () => {
    if (editorInstance) return;
    
    const textarea = document.getElementById('ide-codemirror');
    if(!textarea) return;

    editorInstance = CodeMirror.fromTextArea(textarea, {
        theme: 'material-darker',
        lineNumbers: true,
        autoCloseTags: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        tabSize: 2,
        indentUnit: 2,
        lineWrapping: false,
        viewportMargin: Infinity, 
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        foldGutter: true
    });

    // FIX: ADD CLOSE MODAL LISTENER
    document.querySelector('#code-modal .modal__close')?.addEventListener('click', () => {
        toggleModal('code-modal', false);
        removeAiWidgets(); // Clean up any floating AI buttons
    });

    editorInstance.on('change', () => {
        if (s.activeFile && s.files[s.activeFile] !== undefined) {
            s.files[s.activeFile] = editorInstance.getValue();
        }
    });

    // --- Contextual AI Listeners ---
    editorInstance.on('cursorActivity', () => {
        // Use setTimeout to allow selection to settle
        setTimeout(handleSelectionChange, 10);
    });

    // Hide widgets on scroll to prevent misalignment
    editorInstance.on('scroll', removeAiWidgets);

    // --- BUTTON EVENT LISTENERS ---
    $('ide-save-btn')?.addEventListener('click', saveFromIDE);
    $('ide-run-btn')?.addEventListener('click', runFromIDE);
    $('ide-download-btn')?.addEventListener('click', downloadFromIDE); 
    $('ide-new-file')?.addEventListener('click', createNewFile);
    $('ide-delete-file')?.addEventListener('click', deleteCurrentFile);
    
    // Navigation
    document.querySelector('.ide-sidebar')?.addEventListener('click', handleFileClick);
    document.getElementById('ide-tabs')?.addEventListener('click', handleTabClick);
};

export const openIDE = () => {
    syncStateToFiles(); 
    toggleModal('code-modal', true);
    initIDE();
    renderFileTree();
    renderTabs();
    
    const initialFile = s.activeFile || "index.html";
    openFile(initialFile);
    
    setTimeout(() => {
        editorInstance.refresh();
        editorInstance.focus();
    }, 200);
};

export const openFile = (filename) => {
    if (s.files[filename] === undefined) return;
    
    s.activeFile = filename;
    
    // Determine Mode
    let mode = 'htmlmixed';
    if (filename.endsWith('.css')) mode = 'css';
    if (filename.endsWith('.js')) mode = 'javascript';
    
    editorInstance.setOption('mode', mode);
    
    const content = s.files[filename] || "";
    if (editorInstance.getValue() !== content) {
        editorInstance.setValue(content);
    }
    
    renderFileTree();
    renderTabs();
    
    // Update Status Bar
    const statusRight = document.getElementById('ide-status-right');
    if(statusRight) statusRight.textContent = `UTF-8  ${mode.toUpperCase()}  Ln 1, Col 1`;
    
    // Fix render glitch
    setTimeout(() => editorInstance.refresh(), 10);
};

const renderFileTree = () => {
    const tree = document.getElementById('file-tree');
    if (!tree) return;
    tree.innerHTML = Object.keys(s.files).sort().map(filename => `
        <div class="file-item ${filename === s.activeFile ? 'active' : ''}" data-file="${filename}">
            <i class="fab ${getFileIcon(filename)}"></i> ${filename}
        </div>
    `).join('');
};

const renderTabs = () => {
    const tabsContainer = document.getElementById('ide-tabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = Object.keys(s.files).map(filename => `
        <div class="ide-tab ${filename === s.activeFile ? 'active' : ''}" data-file="${filename}">
            <i class="fab ${getFileIcon(filename)}"></i> ${filename}
        </div>
    `).join('');
};

const getFileIcon = (filename) => {
    if (filename.endsWith('.html')) return 'fa-html5';
    if (filename.endsWith('.css')) return 'fa-css3-alt';
    if (filename.endsWith('.js')) return 'fa-js';
    return 'fa-file-code';
};

const handleFileClick = (e) => {
    const item = e.target.closest('.file-item');
    if (item) openFile(item.dataset.file);
};

const handleTabClick = (e) => {
    const tab = e.target.closest('.ide-tab');
    if (tab) openFile(tab.dataset.file);
};

const createNewFile = () => {
    const name = prompt("Enter file name (e.g., about.html):");
    if (name && !s.files[name]) {
        s.files[name] = name.endsWith('.html') ? '<!DOCTYPE html>\n' : '';
        openFile(name);
    }
};

const deleteCurrentFile = () => {
    if (s.activeFile === 'index.html') return notify("Cannot delete index.html", "error");
    if (confirm(`Delete ${s.activeFile}?`)) {
        delete s.files[s.activeFile];
        openFile('index.html');
    }
};

export const compileForPreview = () => {
    let mainHtml = s.files['index.html'] || '';
    const css = s.files['style.css'] || '';
    const js = s.files['script.js'] || '';

    if (css && !mainHtml.includes(css)) {
        mainHtml = mainHtml.replace('</head>', `<style>${css}</style></head>`);
    }

    if (js && !mainHtml.includes(js)) {
        mainHtml = mainHtml.replace('</body>', `<script type="module">${js}</script></body>`);
    }
    
    return mainHtml;
};

const runFromIDE = () => {
    s.html = compileForPreview();
    $('preview-frame').srcdoc = s.html;
    notify("Preview Updated", "success");
};

const saveFromIDE = async () => {
    $('save-btn').click();
};

const downloadFromIDE = async () => {
  if (!checkPlanAccess('exportCode')) return;
    notify('Preparing download...', 'success');
    
    try {
        const zip = new JSZip();
        
        Object.keys(s.files).forEach(filename => {
            const content = s.files[filename];
            if (content) {
                zip.file(filename, content);
            }
        });

        const blob = await zip.generateAsync({ type: "blob" });
        
        const projectName = s.currentProjectData?.name || 'project';
        const safeName = slugify(projectName); 
        const fileName = `${safeName}.zip`;

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    } catch (e) {
        console.error("Download Error:", e);
        notify("Failed to create ZIP file.", "error");
    }
};

// --- AI CONTEXTUAL WIDGET LOGIC ---

const removeAiWidgets = () => {
    if (aiWidget) { aiWidget.remove(); aiWidget = null; }
    if (aiWindow) { aiWindow.remove(); aiWindow = null; }
};

const handleSelectionChange = () => {
    if (aiWindow) return;

    const selection = editorInstance.getSelection();
    
    if (!selection || selection.trim().length === 0) {
        removeAiWidgets();
        return;
    }

    const ranges = editorInstance.listSelections();
    if (!ranges.length) return;
    
    const coords = editorInstance.cursorCoords(ranges[0].head, 'window');

    if (!aiWidget) {
        createAiButton(coords.left, coords.top, selection);
    }
};

const createAiButton = (x, y, selectedText) => {
    aiWidget = document.createElement('div');
    aiWidget.className = 'ai-float-btn';
    aiWidget.innerHTML = '<i class="fas fa-wand-sparkles"></i>';
    aiWidget.title = "Edit with AI";
    
    aiWidget.style.left = `${x + 10}px`;
    aiWidget.style.top = `${y - 40}px`;

    aiWidget.onclick = (e) => {
        e.stopPropagation();
        createAiWindow(x, y, selectedText);
        aiWidget.remove();
        aiWidget = null;
    };

    document.body.appendChild(aiWidget);
};

const createAiWindow = (x, y, selectedText) => {
    const mode = editorInstance.getOption('mode');
    const langDisplay = typeof mode === 'string' ? mode : 'Code';

    aiWindow = document.createElement('div');
    aiWindow.className = 'ai-float-window';
    
    const leftPos = Math.min(x, window.innerWidth - 420);
    aiWindow.style.left = `${leftPos}px`;
    aiWindow.style.top = `${y - 10}px`;

    aiWindow.innerHTML = `
        <div class="ai-float-input-group">
            <input type="text" class="ai-float-input" placeholder="Ask or edit in context (e.g., 'Fix this error')..." autoFocus>
            <button class="ai-float-submit"><i class="fas fa-paper-plane"></i></button>
        </div>
        <div class="ai-float-info">
            <span>Editing ${langDisplay} selection</span>
            <span>Esc to close</span>
        </div>
    `;

    const input = aiWindow.querySelector('input');
    const submitBtn = aiWindow.querySelector('button');

    const handleSubmit = async () => {
        const instruction = input.value.trim();
        if (!instruction) return;

        input.disabled = true;
        input.value = "Generating code patch...";
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const newCode = await generateCodePatch(selectedText, instruction);
            
            editorInstance.replaceSelection(newCode);
            editorInstance.focus();
            
            notify("Code updated successfully", "success");
            removeAiWidgets();
        } catch (error) {
            notify(`AI Error: ${error.message}`, "error");
            input.disabled = false;
            input.value = instruction;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    };

    submitBtn.onclick = handleSubmit;
    
    input.onkeydown = (e) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') {
            removeAiWidgets();
            editorInstance.focus();
        }
    };

    setTimeout(() => {
        document.addEventListener('click', function closeOnClick(e) {
            if (aiWindow && !aiWindow.contains(e.target)) {
                removeAiWidgets();
                document.removeEventListener('click', closeOnClick);
            }
        });
    }, 100);

    document.body.appendChild(aiWindow);
    input.focus();
};