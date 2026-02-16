// js/state.js
export const s = {
    user: null,
    apiKey: null,
    files: {
        "index.html": "",
        "style.css": "",
        "script.js": ""
    },
    activeFile: "index.html",
    html: '', 
    editId: null,
    isGenerating: false,
    chatHistory: [{ role: 'ai', text: 'Hello! I can now create multiple pages (About, Contact, etc). What shall we build?' }],
    currentProjectData: null,
    currentCollectionId: null,
    currentCollectionName: null,
    documents: [],
    currentDocumentIndex: null,
    currentDocumentData: null,
    activeMentionInput: null,
    projectUnsubscribe: null,
    sharedProjects: [],
    currentUserRole: null,
    selectedVersionId: null,
    chatMentions: [], 
    pendingAttachment: null,
    projectCount: 0,
};