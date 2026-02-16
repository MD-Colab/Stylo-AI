// Adjusted import: sibling folder 'Project'
import { db } from '../Project/js/firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
// Local imports (same directory)
import { state } from './profile-state.js';
import { $, notify } from './profile-utils.js';
// Module imports (subdirectory)
import { renderImagesSection } from './modules/section-images.js';
import { renderDatabasesSection } from './modules/section-databases.js';

export const fetchUserProjectsAndImages = async () => {
    const uid = state.currentUser?.uid;
    if (!uid) return;
    
    const imgContainer = $('#image-gallery-container');
    const dbContainer = $('#database-gallery-container');
    if(imgContainer) imgContainer.innerHTML = `<div class="spinner-small"></div> Loading images...`;
    if(dbContainer) dbContainer.innerHTML = `<div class="spinner-small"></div> Loading databases...`;

    try {
        // 1. Fetch Projects Owned by User
        const ownedQ = query(collection(db, "ai_templates"), where("userId", "==", uid));
        
        // 2. Fetch Projects Shared with User (Direct Collab)
        const sharedQ = query(collection(db, "ai_templates"), where("sharedWith", "array-contains", uid));

        // 3. Execute in Parallel
        const [ownedSnap, sharedSnap] = await Promise.all([getDocs(ownedQ), getDocs(sharedQ)]);

        // 4. Merge Results (Avoid duplicates)
        const projectMap = new Map();
        [...ownedSnap.docs, ...sharedSnap.docs].forEach(doc => {
            projectMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        // 5. Convert to Array for State
        state.userProjects = Array.from(projectMap.values());

        // 6. Fetch Assets (Images & Collections) Safely
        const allImages = [];
        const allCollections = []; 

        // We use map to create an array of promises, but we wrap each in a try/catch
        // This ensures one failed permission check doesn't crash the whole page
        await Promise.all(state.userProjects.map(async (project) => {
            const projectId = project.id;
            const projectName = project.name || 'Untitled Project'; 

            try {
                // Fetch Images
                const imagesRef = collection(db, "ai_templates", projectId, "project_images");
                const imgSnap = await getDocs(imagesRef);
                imgSnap.forEach(doc => allImages.push({ projectId, projectName, imageId: doc.id, ...doc.data() }));
            } catch (e) {
                console.warn(`Skipping images for project ${projectId}: ${e.code}`);
            }

            try {
                // Fetch Collections
                const colsRef = collection(db, "ai_templates", projectId, "project_collections");
                const colSnap = await getDocs(colsRef);
                colSnap.forEach(doc => allCollections.push({ projectId, projectName, collectionId: doc.id, ...doc.data() }));
            } catch (e) {
                console.warn(`Skipping collections for project ${projectId}: ${e.code}`);
            }
        }));

        state.userImages = allImages;
        state.userCollections = allCollections; 

        renderImagesSection();
        renderDatabasesSection(); 

    } catch (error) {
        console.error("Error fetching assets:", error);
        notify('Failed to load project assets.', 'error');
        // Clear loaders if failed
        if(imgContainer) imgContainer.innerHTML = '<p class="text-light">Could not load images.</p>';
        if(dbContainer) dbContainer.innerHTML = '<p class="text-light">Could not load databases.</p>';
    }
};

export const fetchOrCreateUserData = async (authUser) => {
    const userRef = doc(db, "users", authUser.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return { ...authUser, ...userSnap.data() };
    } else {
        const newUserProfile = {
            email: authUser.email,
            displayName: authUser.displayName || 'New User',
            photoURL: authUser.photoURL || null,
            bio: "", age: null, gender: "Prefer not to say",
            position: "", website: "", location: "",
            team: [{ email: authUser.email, role: 'owner' }], // Legacy field kept for safety
            pendingInvites: [], apiKeys: [],
            createdAt: serverTimestamp(), lastUpdated: serverTimestamp()
        };
        await setDoc(userRef, newUserProfile);
        return { ...authUser, ...newUserProfile };
    }
};