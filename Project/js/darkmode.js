// js/darkmode.js

/**
 * Initializes the Dark Mode functionality.
 * 1. Checks for saved preference or system preference.
 * 2. Injects a toggle button into the header.
 * 3. Handles the toggle logic.
 */
document.addEventListener('DOMContentLoaded', () => {
    initDarkMode();
});

function initDarkMode() {
    // 1. Determine initial state
    const savedTheme = localStorage.getItem('stylo-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Default to saved, otherwise system, otherwise light
    const currentTheme = savedTheme || (systemDark ? 'dark' : 'light');
    
    // Apply initial theme
    applyTheme(currentTheme);

    // 2. Inject Toggle Button
    // We look for the .header__right container to add the button
    const headerRight = document.querySelector('.header__right');
    
    if (headerRight) {
        // Create the button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'theme-toggle-btn';
        toggleBtn.className = 'btn-icon small';
        toggleBtn.title = 'Toggle Dark Mode';
        toggleBtn.style.marginRight = '5px'; // Spacing
        
        // Set initial icon
        updateToggleIcon(toggleBtn, currentTheme);

        // Insert it before the User Profile or at the start of right section
        const authContainer = document.getElementById('auth-container');
        if (authContainer) {
            headerRight.insertBefore(toggleBtn, authContainer);
        } else {
            headerRight.appendChild(toggleBtn);
        }

        // 3. Add Event Listener
        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'dark' ? 'light' : 'dark';
            
            applyTheme(newTheme);
            updateToggleIcon(toggleBtn, newTheme);
            localStorage.setItem('stylo-theme', newTheme);
        });
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function updateToggleIcon(btn, theme) {
    if (theme === 'dark') {
        btn.innerHTML = '<i class="fas fa-sun"></i>'; // Show Sun icon to switch to light
        btn.style.color = '#fbbf24'; // Yellowish for sun
    } else {
        btn.innerHTML = '<i class="fas fa-moon"></i>'; // Show Moon icon to switch to dark
        btn.style.color = '#64748b'; // Slate for moon
    }
}