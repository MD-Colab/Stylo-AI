// home.js
import { db, auth } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

// --- AUTH STATE LISTENER ---
const initAuthUI = () => {
    const loginBtn = document.getElementById('login-btn');
    const userBox = document.getElementById('user-profile-box');
    const avatar = document.getElementById('header-avatar');
    const nameEl = document.getElementById('header-username');
    const emailEl = document.getElementById('header-email');
    const logoutBtn = document.getElementById('header-logout');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is Logged In - Hide Login, Show Profile
            if(loginBtn) loginBtn.style.display = 'none';
            if(userBox) userBox.style.display = 'block';

            // 1. Get Basic Data from Auth
            let finalPhoto = user.photoURL;
            let finalName = user.displayName || "User";

            // 2. Fetch Latest Data from Firestore (The Fix)
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userDocRef);
                
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    // Prioritize Firestore data if it exists
                    if (userData.photoURL) finalPhoto = userData.photoURL;
                    if (userData.displayName) finalName = userData.displayName;
                }
            } catch (err) {
                console.error("Error fetching user profile:", err);
            }

            // 3. Update UI
            if(avatar) {
                // Use the fetched photo, or fallback to initials
                avatar.src = finalPhoto || `https://ui-avatars.com/api/?name=${user.email}&background=random`;
            }
            
            if(emailEl) emailEl.textContent = user.email;
            if(nameEl) nameEl.textContent = finalName;

        } else {
            // User is Logged Out
            if(loginBtn) loginBtn.style.display = 'inline-flex';
            if(userBox) userBox.style.display = 'none';
        }
    });

    // Handle Logout
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                window.location.reload();
            } catch (error) {
                console.error("Logout failed", error);
            }
        });
    }
};

// Toggle Menu Function
window.toggleProfileMenu = () => {
    const menu = document.getElementById('profile-dropdown');
    if(menu) menu.classList.toggle('active');
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const userBox = document.getElementById('user-profile-box');
    const menu = document.getElementById('profile-dropdown');
    if (userBox && !userBox.contains(e.target) && menu && menu.classList.contains('active')) {
        menu.classList.remove('active');
    }
});

// --- ANIMATION OBSERVER LOGIC ---
const initScrollAnimations = () => {
    const observerOptions = {
        threshold: 0.15, // Trigger when 15% of element is visible
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Optional: Stop observing once animated
                // observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    // Observe all elements with .animate-on-scroll class
    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach(el => observer.observe(el));
};

// --- TEMPLATE LOGIC (Restored from your original file) ---
let allTemplates = [];
let templatesInitialized = false;const CATEGORIES = [
    'All', 'Portfolio', 'AI Tools', 'E-commerce', 'Business', 
    'Marketing & Sales', 'Forms & Surveys', 'Blog & Content', 'Education', 
    'Technology', 'Real Estate', 'Health & Fitness', 'Food & Drink', 'Events', 'Other'
];
let currentCategory = 'All';
let currentSearchTerm = '';

const gridEl = document.getElementById('public-templates-grid');
const searchInput = document.getElementById('template-search');
const categoriesContainer = document.getElementById('category-filters');
const showTemplatesBtn = document.getElementById('show-templates-btn');
const navTemplatesLink = document.getElementById('nav-templates-link');
const mobileNavTemplatesLink = document.getElementById('mobile-nav-templates-link');
const templatesSection = document.getElementById('templates');

// --- CATEGORIZATION LOGIC ---
const determineCategory = (name) => {
    const n = name.toLowerCase();
    if (n.includes('form') || n.includes('survey') || n.includes('inquiry')) return 'Forms & Surveys';
    if (n.includes('portfolio') || n.includes('resume') || n.includes('cv') || n.includes('bio')) return 'Portfolio';
    if (n.includes(' ai') || n.includes('advisor') || n.includes('gpt')) return 'AI Tools';
    if (n.includes('shop') || n.includes('store') || n.includes('commerce') || n.includes('cart')) return 'E-commerce';
    if (n.includes('agency') || n.includes('business') || n.includes('saas') || n.includes('consult')) return 'Business';
    if (n.includes('marketing') || n.includes('sales') || n.includes('landing')) return 'Marketing & Sales';
    if (n.includes('blog') || n.includes('news') || n.includes('post')) return 'Blog & Content';
    if (n.includes('education') || n.includes('school') || n.includes('course')) return 'Education';
    if (n.includes('tech') || n.includes('app') || n.includes('software')) return 'Technology';
    if (n.includes('estate') || n.includes('property') || n.includes('house')) return 'Real Estate';
    if (n.includes('fitness') || n.includes('gym') || n.includes('yoga') || n.includes('health')) return 'Health & Fitness';
    if (n.includes('food') || n.includes('cafe') || n.includes('restaurant')) return 'Food & Drink';
    if (n.includes('event') || n.includes('wedding') || n.includes('music')) return 'Events';
    return 'Other';
};

const renderTemplates = (templatesToRender) => {
    if (!gridEl) return;
    if (templatesToRender.length === 0) {
        gridEl.innerHTML = `<div class="templates-empty" style="color:var(--text-muted); text-align:center;"><p>No templates found.</p></div>`;
        return;
    }
    const templatesHTML = templatesToRender.map((t, index) => {
        const placeholderImage = 'assets/Images/logo1.png';
        let imageUrl = t.data.thumbnailUrl || placeholderImage;
        if (imageUrl.includes('cloudinary')) {
            imageUrl = imageUrl.replace('/upload/', '/upload/w_400,c_fill,q_auto/');
        }
        // Add animation classes to cards
        return `
            <div class="template-card animate-on-scroll anim-zoom-in" style="transition-delay: ${index * 50}ms">
                <img src="${imageUrl}" alt="${t.data.name}" loading="lazy">
                <h3>${t.data.name}</h3>
                <a href="Project/?project=${t.id}" class="btn btn-secondary">Open in Editor</a>
            </div>
        `;
    }).join('');
    gridEl.innerHTML = templatesHTML;
    
    // Re-initialize observer for new elements
    initScrollAnimations();
};

const renderCategoryFilters = () => {
    if (!categoriesContainer) return;
    const buttonsHTML = CATEGORIES.map(category => `
        <button class="filter-btn ${category === 'All' ? 'active' : ''}" data-category="${category}">
            ${category}
        </button>
    `).join('');
    categoriesContainer.innerHTML = buttonsHTML;
};

const filterAndRender = () => {
    const term = currentSearchTerm.toLowerCase();
    const filtered = allTemplates.filter(t => {
        const categoryMatch = currentCategory === 'All' || t.derivedCategory === currentCategory;
        const searchMatch = !term || t.data.name.toLowerCase().includes(term);
        return categoryMatch && searchMatch;
    });
    renderTemplates(filtered);
};

const initializeTemplates = async () => {
    if (!gridEl || templatesInitialized) return;
    templatesInitialized = true;

    gridEl.innerHTML = `<div class="templates-loading" style="text-align:center; color:white;"><div class="spinner"></div><p>Loading templates...</p></div>`;

    try {
        const q = query(collection(db, 'ai_templates'), where("isPublic", "==", true));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            gridEl.innerHTML = `<div class="templates-empty"><p>No public templates yet.</p></div>`;
            return;
        }

        let templatesFromDB = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, data: data, derivedCategory: determineCategory(data.name || '') };
        });

        allTemplates = templatesFromDB;
        renderCategoryFilters();
        renderTemplates(allTemplates);
    } catch (error) {
        console.error("Error loading templates:", error);
        gridEl.innerHTML = `<div class="templates-empty"><p style="color: #ec4899;">Error loading templates.</p></div>`;
    }
};

const handleShowTemplatesClick = (e) => {
    e.preventDefault();
    if (templatesSection) {
        templatesSection.style.display = 'block';
        setTimeout(() => templatesSection.classList.add('is-visible'), 10);
        templatesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        initializeTemplates();
    }
};
// ... existing code ...

// --- ELITE SLOT CHECKER ---
const checkEliteSlots = async () => {
    const counterEl = document.getElementById('live-slots-count');
    if (!counterEl) return;

    try {
        // Fetching from settings/offers (Global counter)
        const offerRef = doc(db, "settings", "offers");
        const snap = await getDoc(offerRef);

        if (snap.exists()) {
            const data = snap.data();
            const claimed = data.claimedCount || 0;
            const max = data.maxSlots || 20;
            const remaining = Math.max(0, max - claimed);

            if (remaining > 0) {
                counterEl.innerHTML = `🔥 Only <span>${remaining}</span> / ${max} Spots Left`;
            } else {
                counterEl.innerHTML = `❌ Offer Sold Out`;
                counterEl.style.color = "#94a3b8"; // Grey out
                const btn = counterEl.nextElementSibling; // The Claim Button
                if(btn) {
                    btn.classList.add('btn-secondary');
                    btn.classList.remove('btn-primary');
                    btn.textContent = "Join Waitlist";
                    btn.href = "#";
                }
            }
        } else {
            // Fallback if DB doc doesn't exist yet
            counterEl.innerHTML = `🔥 Only <span>20</span> / 20 Spots Left`;
        }
    } catch (e) {
        console.error("Error fetching slots:", e);
        counterEl.innerHTML = `🔥 Limited Spots Available`;
    }
};


// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Start Animations
    initScrollAnimations();
    checkEliteSlots();
    initAuthUI();

    // 2. Mobile Menu Logic
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileNav = document.querySelector('.mobile-nav');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileNav.classList.toggle('open');
            const icon = mobileMenuBtn.querySelector('i');
            if(mobileNav.classList.contains('open')) {
                icon.classList.remove('fa-bars'); icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times'); icon.classList.add('fa-bars');
            }
        });
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileNav.classList.remove('open');
                mobileMenuBtn.querySelector('i').className = 'fas fa-bars';
            });
        });
    }

    // 3. Template Listeners
    if (showTemplatesBtn) showTemplatesBtn.addEventListener('click', handleShowTemplatesClick);
    if (navTemplatesLink) navTemplatesLink.addEventListener('click', handleShowTemplatesClick);
    if (mobileNavTemplatesLink) mobileNavTemplatesLink.addEventListener('click', handleShowTemplatesClick);

    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentSearchTerm = searchInput.value.trim();
                filterAndRender();
            }, 300);
        });
    }

    if (categoriesContainer) {
        categoriesContainer.addEventListener('click', (e) => {
            if (!e.target.matches('.filter-btn')) return;
            document.querySelector('.filter-btn.active')?.classList.remove('active');
            e.target.classList.add('active');
            currentCategory = e.target.dataset.category;
            filterAndRender();
        });
    }
    
});