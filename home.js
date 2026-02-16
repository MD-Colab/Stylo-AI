// home.js
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

// --- STATE, CONSTANTS, & UI ELEMENTS ---
const CATEGORIES = [
    'All', 'Portfolio', 'AI Tools', 'E-commerce', 'Business', 
    'Marketing & Sales', 'Forms & Surveys', 'Blog & Content', 'Education', 
    'Technology', 'Real Estate', 'Health & Fitness', 'Food & Drink', 'Events', 'Other'
];

let allTemplates = [];
let templatesInitialized = false;
let currentCategory = 'All';
let currentSearchTerm = '';

const gridEl = document.getElementById('public-templates-grid');
const searchInput = document.getElementById('template-search');
const categoriesContainer = document.getElementById('category-filters');
const showTemplatesBtn = document.getElementById('show-templates-btn');
const navTemplatesLink = document.getElementById('nav-templates-link');
const mobileNavTemplatesLink = document.getElementById('mobile-nav-templates-link'); // Added for mobile
const templatesSection = document.getElementById('templates');

// Mobile Menu Elements
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const mobileNav = document.querySelector('.mobile-nav');
const mobileLinks = document.querySelectorAll('.mobile-link, .mobile-cta');

// --- "AI" CATEGORIZATION LOGIC ---
const determineCategory = (name) => {
    const n = name.toLowerCase();
    if (n.includes('form') || n.includes('survey') || n.includes('inquiry') || n.includes('registration')) return 'Forms & Surveys';
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

// --- RENDERING FUNCTIONS ---
const renderTemplates = (templatesToRender) => {
    if (!gridEl) return;
    if (templatesToRender.length === 0) {
        gridEl.innerHTML = `<div class="templates-empty"><i class="fas fa-search"></i><p>No templates found matching your criteria.</p></div>`;
        return;
    }
    const templatesHTML = templatesToRender.map(t => {
        const placeholderImage = 'assets/Images/logo1.png'; // Fallback
        let imageUrl = t.data.thumbnailUrl || placeholderImage;
        if (imageUrl.includes('cloudinary')) {
            imageUrl = imageUrl.replace('/upload/', '/upload/w_400,c_fill,q_auto/');
        }
        return `
            <div class="template-card">
                <img src="${imageUrl}" alt="${t.data.name}" loading="lazy">
                <h3>${t.data.name}</h3>
                <a href="Project/?project=${t.id}" class="btn btn--secondary">Open in Editor</a>
            </div>
        `;
    }).join('');
    gridEl.innerHTML = templatesHTML;
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

// --- CORE LOGIC ---
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

    gridEl.innerHTML = `<div class="templates-loading"><div class="spinner"></div><p>Loading community templates...</p></div>`;

    try {
        const q = query(
            collection(db, 'ai_templates'),
            where("isPublic", "==", true)
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            gridEl.innerHTML = `<div class="templates-empty"><i class="fas fa-folder-open"></i><p>No public templates available yet.</p></div>`;
            return;
        }

        let templatesFromDB = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, data: data, derivedCategory: determineCategory(data.name || '') };
        });

        // Shuffle
        for (let i = templatesFromDB.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [templatesFromDB[i], templatesFromDB[j]] = [templatesFromDB[j], templatesFromDB[i]];
        }
        allTemplates = templatesFromDB;

        renderCategoryFilters();
        renderTemplates(allTemplates);
    } catch (error) {
        console.error("Error loading templates:", error);
        gridEl.innerHTML = `<div class="templates-empty"><p style="color: #E53E3E;">Error loading templates.</p></div>`;
    }
};

// --- EVENT LISTENERS ---
const handleShowTemplatesClick = (e) => {
    e.preventDefault();
    if (templatesSection) {
        templatesSection.style.display = 'block';
        templatesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        initializeTemplates();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Template toggles
    if (showTemplatesBtn) showTemplatesBtn.addEventListener('click', handleShowTemplatesClick);
    if (navTemplatesLink) navTemplatesLink.addEventListener('click', handleShowTemplatesClick);
    if (mobileNavTemplatesLink) mobileNavTemplatesLink.addEventListener('click', handleShowTemplatesClick);

    // Search
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

    // Category Filters
    if (categoriesContainer) {
        categoriesContainer.addEventListener('click', (e) => {
            if (!e.target.matches('.filter-btn')) return;
            document.querySelector('.filter-btn.active')?.classList.remove('active');
            e.target.classList.add('active');
            currentCategory = e.target.dataset.category;
            filterAndRender();
        });
    }

    // --- MOBILE MENU TOGGLE LOGIC ---
    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', () => {
            const isOpen = mobileNav.classList.contains('open');
            if (isOpen) {
                mobileNav.classList.remove('open');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            } else {
                mobileNav.classList.add('open');
                mobileMenuBtn.innerHTML = '<i class="fas fa-times"></i>';
            }
        });

        // Close menu when a link is clicked
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileNav.classList.remove('open');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            });
        });
    }
});