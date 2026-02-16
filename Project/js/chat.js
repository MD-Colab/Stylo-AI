// js/chat.js
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import { s } from './state.js';
import { GEMINI_API_BASE, DEFAULT_MODEL } from './constants.js';
import { notify, updateChatInputVisual } from './ui.js';
import { $, checkPlanAccess } from './utils.js';
import { addUserMessageToChat, fetchSystemApiKey } from './ai-core.js'; // Imported fetchSystemApiKey

export const askState = {
    history: [],
    isThinking: false
};

export const loadAskHistory = (historyData) => {
    if (historyData && Array.isArray(historyData) && historyData.length > 0) {
        askState.history = historyData;
    } else {
        askState.history = [{ role: 'model', text: 'Hi! I see your code. Ask me any questions about errors or features.' }];
    }
    renderAskHistory();
};

const saveAskHistory = async () => {
    if (!s.editId || !s.user) return;
    try {
        await updateDoc(doc(db, "ai_templates", s.editId), {
            askChatHistory: askState.history
        });
    } catch (error) {
        console.error("Failed to save Ask history:", error);
    }
};

const formatAskResponse = (text) => {
    let formatted = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const codeBlocks = [];
    formatted = formatted.replace(/```(\w*)([\s\S]*?)```/g, (match, lang, code) => {
        const html = `
            <div class="ask-code-block">
                <div class="ask-code-header">
                    <span class="lang-tag">${lang || 'CODE'}</span>
                    <div class="ask-code-actions">
                        <button class="apply-ask-code-btn" title="Apply this fix">
                            <i class="fas fa-magic"></i> Apply
                        </button>
                        <button class="copy-ask-code-btn" title="Copy code">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                </div>
                <pre><code>${code}</code></pre>
            </div>`;
        codeBlocks.push(html);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    formatted = formatted
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    formatted = formatted.replace(/\n/g, '<br>');

    formatted = formatted.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
        return codeBlocks[index];
    });

    return formatted;
};

const renderAskHistory = () => {
    const historyEl = $('ask-history');
    if (!historyEl) return;

    historyEl.innerHTML = askState.history.map((msg, index) => {
        const htmlContent = formatAskResponse(msg.text);
        
        if (msg.role === 'user') {
            return `<div class="user-message" data-message-index="${index}">
                        ${htmlContent}
                        <div class="chat-actions">
                            <button class="btn-icon" data-action="edit" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn-icon" data-action="copy" title="Copy"><i class="fas fa-copy"></i></button>
                            <button class="btn-icon" data-action="rerun" title="Rerun"><i class="fas fa-sync-alt"></i></button>
                            <button class="btn-icon" data-action="delete" title="Delete"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>`;
        } else {
            return `<div class="ai-message ai-message--ask">${htmlContent}</div>`;
        }
    }).join('');
    
    historyEl.scrollTop = historyEl.scrollHeight;
};

const handleCommitChanges = () => {
    const aiMessages = askState.history.filter(msg => msg.role === 'model');
    if (aiMessages.length === 0) return notify("No suggestions to commit yet.", "error");

    let allCodeSnippets = "";
    let foundCode = false;

    aiMessages.forEach(msg => {
        const regex = /```(\w*)([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(msg.text)) !== null) {
            foundCode = true;
            allCodeSnippets += `\n/* Fix from debugging session */\n${match[2].trim()}\n`;
        }
    });

    if (!foundCode) return notify("No code snippets found.", "error");
    if (!confirm("Gather all code snippets and apply to project?")) return;

    const editTabBtn = document.querySelector('.tab-btn[data-target="panel-edit"]');
    if(editTabBtn) editTabBtn.click();

    const masterPrompt = `CRITICAL UPDATE: Apply the following technical fixes collected from the debugging session:\n\n\`\`\`\n${allCodeSnippets}\n\`\`\``;
    addUserMessageToChat(masterPrompt);
};

const handleUserAction = (action, index) => {
    const message = askState.history[index];
    if (!message) return;

    if (action === 'copy') {
        navigator.clipboard.writeText(message.text);
        notify('Copied to clipboard', 'success');
        return;
    }

    if (action === 'delete') {
        if (askState.history[index + 1]?.role === 'model') {
            askState.history.splice(index, 2);
        } else {
            askState.history.splice(index, 1);
        }
        renderAskHistory();
        saveAskHistory();
        return;
    }

    if (action === 'edit') {
        askState.history.splice(index, 1);
        $('ask-input').value = message.text;
        $('ask-input').focus();
        renderAskHistory();
        saveAskHistory();
        return;
    }

    if (action === 'rerun') {
        askState.history.splice(index);
        renderAskHistory();
        const input = $('ask-input');
        input.value = message.text;
        handleAskSubmit();
        return;
    }
};

const convertHistoryToGeminiFormat = (historyData, systemPrompt) => {
    const conversation = historyData.map(msg => ({
        role: msg.role === 'ai' ? 'model' : msg.role, 
        parts: [{ text: msg.text }]
    }));
    
    return {
        contents: conversation,
        system_instruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
             temperature: 0.5,
             maxOutputTokens: 2048
        }
    };
};

const handleAskSubmit = async () => {
    const input = $('ask-input');
    const text = input.value.trim();
    if (!text || askState.isThinking) return;

    // Ensure API Key via fetchSystemApiKey
    if (!s.apiKey) {
        await fetchSystemApiKey();
    }
    if (!s.apiKey) return notify('System API Key not found. Please contact admin.', 'error');

    askState.history.push({ role: 'user', text: text });
    renderAskHistory();
    saveAskHistory(); 
    
    input.value = '';
    askState.isThinking = true;

    const historyEl = $('ask-history');
    const loaderId = 'ask-loader-' + Date.now();
    
    const loaderHTML = `
        <div id="${loaderId}" class="ai-message ai-message--ask" style="width: fit-content; padding: 5px 10px; display: flex; align-items: center;">
            <img src="https://media.tenor.com/sMenWFrH3YsAAAAC/typing-text.gif" alt="Typing..." style="height: 30px; display: block;">
        </div>`;
        
    historyEl.insertAdjacentHTML('beforeend', loaderHTML);
    historyEl.scrollTop = historyEl.scrollHeight;

    const currentCodeContext = s.html ? `
    \n\nCURRENT PROJECT CODE (Read-Only Context):
    \`\`\`html
    ${s.html.substring(0, 30000)} 
    \`\`\`
    ` : 'No code generated yet.';

    const systemPrompt = `
    You are Stylo Assistant, a dedicated debugging AI.
    1. The user is asking about the specific code provided above.
    2. Provide **short, specific code snippets** to fix errors.
    3. Do NOT regenerate the entire file unless asked.
    4. Be helpful and concise.
    
    ${currentCodeContext}
    `;

    try {
        const geminiPayload = convertHistoryToGeminiFormat(askState.history, systemPrompt);

        const url = `${GEMINI_API_BASE}/${DEFAULT_MODEL}:streamGenerateContent?alt=sse&key=${s.apiKey}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        if (!res.ok) throw new Error('Failed to get response');

        const loader = document.getElementById(loaderId);
        if(loader) loader.remove();

        let fullResponse = "";
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        askState.history.push({ role: 'model', text: '' });
        const msgIndex = askState.history.length - 1;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr.trim() === '[DONE]') break;
                    
                    try {
                        const parsed = JSON.parse(dataStr);
                        const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (content) {
                            fullResponse += content;
                            askState.history[msgIndex].text = fullResponse;
                            renderAskHistory(); 
                        }
                    } catch (e) { /* ignore parse error on partial chunks */ }
                }
            }
        }
        saveAskHistory(); 

    } catch (error) {
        console.error(error);
        notify('Error getting answer', 'error');
        document.getElementById(loaderId)?.remove();
    } finally {
        askState.isThinking = false;
    }
};

export const initAskChat = () => {
    const btn = $('send-ask-btn');
    const commitBtn = $('commit-ask-btn');
    const input = $('ask-input');
    const history = $('ask-history');

    if (btn && input) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => handleAskSubmit());
        
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAskSubmit();
            }
        });
    }

    if (commitBtn) {
        const newCommit = commitBtn.cloneNode(true);
        commitBtn.parentNode.replaceChild(newCommit, commitBtn);
        newCommit.addEventListener('click', handleCommitChanges);
    }

    if (history) {
        history.onclick = (e) => {
            const target = e.target;
            const actionBtn = target.closest('.chat-actions .btn-icon');
            if (actionBtn) {
                const messageEl = actionBtn.closest('.user-message');
                const index = parseInt(messageEl.dataset.messageIndex, 10);
                const action = actionBtn.dataset.action;
                handleUserAction(action, index);
                return;
            }

            const copyBtn = target.closest('.copy-ask-code-btn');
            if (copyBtn) {
                if (!checkPlanAccess('exportCode')) return;
                const codeBlock = copyBtn.closest('.ask-code-header').nextElementSibling;
                if (codeBlock) {
                    navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                        const icon = copyBtn.querySelector('i');
                        icon.className = 'fas fa-check';
                        setTimeout(() => icon.className = 'fas fa-copy', 1500);
                    });
                }
                return;
            }

            const applyBtn = target.closest('.apply-ask-code-btn');
            if (applyBtn) {
                const codeBlock = applyBtn.closest('.ask-code-header').nextElementSibling;
                if (codeBlock) {
                    const codeToApply = codeBlock.textContent;
                    const editTabBtn = document.querySelector('.tab-btn[data-target="panel-edit"]');
                    if(editTabBtn) editTabBtn.click();

                    const createInput = $('chat-input');
                    createInput.value = `Please apply this code fix:\n\n\`\`\`html\n${codeToApply}\n\`\`\``;
                    
                    updateChatInputVisual();
                    createInput.focus();
                    createInput.style.height = 'auto';
                    createInput.style.height = createInput.scrollHeight + 'px';
                }
            }
        };
    }
};