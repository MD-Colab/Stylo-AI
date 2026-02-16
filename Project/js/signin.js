// js/signin.js

import { 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail // IMPORTED
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";
import { auth } from './firebase-config.js';

let isSignUpMode = false;

// --- 1. CSS Injection (Updated for Reset Modal) ---
const injectSigninStyles = () => {
    if (document.getElementById('signin-popup-style')) return;

    const style = document.createElement('style');
    style.id = 'signin-popup-style';
    style.textContent = `
        /* Overlay & Transitions */
        .signin-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px);
            z-index: 99999; display: flex; justify-content: center; align-items: center;
            opacity: 0; pointer-events: none; transition: opacity 0.4s ease;
        }
        .signin-overlay.visible { opacity: 1; pointer-events: all; }

        /* Main Card */
        .signin-card {
            background: #ffffff; width: 90%; max-width: 400px; padding: 2.5rem;
            border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            text-align: center; transform: translateY(20px);
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: flex; flex-direction: column; gap: 16px; position: relative;
        }
        .signin-overlay.visible .signin-card { transform: translateY(0); }

        /* Typography */
        .signin-logo { width: 60px; margin: 0 auto; display: block; }
        .signin-title { font-family: 'Inter', sans-serif; font-size: 1.5rem; font-weight: 700; color: #1e293b; margin: 0; }
        .signin-desc { font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #64748b; margin-top: -8px; }

        /* Form Elements */
        .auth-form { display: flex; flex-direction: column; gap: 12px; width: 100%; margin-top: 10px; }
        .auth-input {
            width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px;
            font-size: 1rem; outline: none; transition: border-color 0.2s;
        }
        .auth-input:focus { border-color: #6366f1; }
        
        .auth-btn {
            width: 100%; padding: 12px; background-color: #4f46e5; color: white;
            border: none; border-radius: 8px; font-size: 1rem; font-weight: 600;
            cursor: pointer; transition: background 0.2s;
        }
        .auth-btn:hover { background-color: #4338ca; }
        .auth-btn:disabled { background-color: #a5b4fc; cursor: not-allowed; }

        /* Extras */
        .divider { display: flex; align-items: center; color: #94a3b8; font-size: 0.8rem; margin: 10px 0; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
        .divider span { padding: 0 10px; }

        .google-btn {
            display: flex; align-items: center; justify-content: center; gap: 10px;
            width: 100%; padding: 10px; background-color: #fff; color: #374151;
            border: 1px solid #d1d5db; border-radius: 8px; font-weight: 500;
            cursor: pointer; transition: all 0.2s;
        }
        .google-btn:hover { background-color: #f9fafb; border-color: #9ca3af; }
        
        .toggle-link { font-size: 0.9rem; color: #64748b; margin-top: 10px; cursor: pointer; }
        .toggle-link span { color: #4f46e5; font-weight: 600; text-decoration: underline; }
        
        .error-msg { color: #ef4444; font-size: 0.85rem; display: none; text-align: left; }
        .success-msg { color: #10b981; font-size: 0.85rem; display: none; text-align: left; background: #ecfdf5; padding: 10px; border-radius: 6px; }

        /* Forgot Password Link */
        .forgot-password-link {
            font-size: 0.85rem; color: #6366f1; text-align: right; margin-top: -8px; 
            cursor: pointer; text-decoration: none; display: inline-block; width: 100%;
        }
        .forgot-password-link:hover { text-decoration: underline; }

        /* Close Button for Reset Modal */
        .close-reset {
            position: absolute; top: 15px; right: 15px; background: none; border: none; 
            font-size: 1.5rem; color: #94a3b8; cursor: pointer;
        }
    `;
    document.head.appendChild(style);
};

// --- 2. HTML Creation (Signin & Reset) ---
const createSigninPopup = () => {
    if (document.getElementById('signin-overlay')) return;

    injectSigninStyles();

    const overlay = document.createElement('div');
    overlay.id = 'signin-overlay';
    overlay.className = 'signin-overlay';

    overlay.innerHTML = `
        <!-- LOGIN / SIGNUP CARD -->
        <div class="signin-card" id="main-auth-card">
            <img src="../assets/Images/logo1.png" alt="Stylo AI" class="signin-logo">
            <h2 class="signin-title" id="auth-title">Welcome Back</h2>
            <p class="signin-desc" id="auth-desc">Sign in to continue to Stylo AI</p>

            <form class="auth-form" id="email-auth-form">
                <div id="error-message" class="error-msg"></div>
                
                <input type="text" id="auth-name" class="auth-input" placeholder="Full Name" style="display:none;">
                <input type="email" id="auth-email" class="auth-input" placeholder="Email address" required>
                <input type="password" id="auth-password" class="auth-input" placeholder="Password" required>
                
                <!-- Forgot Password Link (Hidden in SignUp mode) -->
                <div id="forgot-password-link" class="forgot-password-link">Forgot Password?</div>

                <button type="submit" class="auth-btn" id="email-submit-btn">Sign In</button>
            </form>

            <div class="divider"><span>OR</span></div>

            <button id="popup-google-btn" class="google-btn">
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
            </button>

            <div class="toggle-link" id="auth-toggle">
                Don't have an account? <span>Sign Up</span>
            </div>
        </div>

        <!-- RESET PASSWORD CARD (Hidden initially) -->
        <div class="signin-card" id="reset-password-card" style="display: none;">
            <button class="close-reset" id="back-to-login">&times;</button>
            <h2 class="signin-title">Reset Password</h2>
            <p class="signin-desc">Enter your email to receive reset instructions.</p>
            
            <div id="reset-success-msg" class="success-msg"></div>
            <div id="reset-error-msg" class="error-msg"></div>

            <form class="auth-form" id="reset-form">
                <input type="email" id="reset-email" class="auth-input" placeholder="Enter your email" required>
                <button type="submit" class="auth-btn" id="send-reset-btn">Send Reset Link</button>
            </form>
            
            <div class="toggle-link" id="back-link-text">
                <span>Back to Sign In</span>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(() => { overlay.classList.add('visible'); }, 10);

    // --- Event Listeners ---
    
    // Main Auth
    document.getElementById('popup-google-btn').addEventListener('click', handleGoogleLogin);
    document.getElementById('email-auth-form').addEventListener('submit', handleEmailAuth);
    document.getElementById('auth-toggle').addEventListener('click', toggleAuthMode);

    // Reset Password Navigation
    document.getElementById('forgot-password-link').addEventListener('click', showResetCard);
    document.getElementById('back-to-login').addEventListener('click', showLoginCard);
    document.getElementById('back-link-text').addEventListener('click', showLoginCard);
    
    // Reset Logic
    document.getElementById('reset-form').addEventListener('submit', handlePasswordReset);
};

const removeSigninPopup = () => {
    const overlay = document.getElementById('signin-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => { overlay.remove(); }, 400);
    }
};

// --- 3. Logic: Switch Views ---

const showResetCard = () => {
    document.getElementById('main-auth-card').style.display = 'none';
    document.getElementById('reset-password-card').style.display = 'flex';
    // Pre-fill email if typed in main form
    const mainEmail = document.getElementById('auth-email').value;
    if(mainEmail) document.getElementById('reset-email').value = mainEmail;
    
    // Clear messages
    document.getElementById('reset-error-msg').style.display = 'none';
    document.getElementById('reset-success-msg').style.display = 'none';
};

const showLoginCard = () => {
    document.getElementById('reset-password-card').style.display = 'none';
    document.getElementById('main-auth-card').style.display = 'flex';
};

// --- 4. Logic: Password Reset ---

const handlePasswordReset = async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    const btn = document.getElementById('send-reset-btn');
    const successMsg = document.getElementById('reset-success-msg');
    const errorMsg = document.getElementById('reset-error-msg');

    if (!email) return;

    btn.textContent = 'Sending...';
    btn.disabled = true;
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    try {
        await sendPasswordResetEmail(auth, email);
        successMsg.textContent = `Reset link sent to ${email}. Check your inbox.`;
        successMsg.style.display = 'block';
        document.getElementById('reset-form').reset();
    } catch (error) {
        console.error("Reset Error:", error);
        let msg = "Failed to send reset link.";
        if (error.code === 'auth/user-not-found') msg = "No user found with this email.";
        if (error.code === 'auth/invalid-email') msg = "Invalid email format.";
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
    } finally {
        btn.textContent = 'Send Reset Link';
        btn.disabled = false;
    }
};

// --- 5. Logic: Auth Flow ---

const toggleAuthMode = () => {
    isSignUpMode = !isSignUpMode;
    const title = document.getElementById('auth-title');
    const desc = document.getElementById('auth-desc');
    const btn = document.getElementById('email-submit-btn');
    const toggleText = document.getElementById('auth-toggle');
    const nameInput = document.getElementById('auth-name');
    const forgotLink = document.getElementById('forgot-password-link');
    const errorMsg = document.getElementById('error-message');

    errorMsg.style.display = 'none';

    if (isSignUpMode) {
        title.textContent = "Create Account";
        desc.textContent = "Join Stylo AI to start building";
        btn.textContent = "Sign Up";
        toggleText.innerHTML = "Already have an account? <span>Sign In</span>";
        nameInput.style.display = 'block';
        nameInput.required = true;
        forgotLink.style.display = 'none'; // Hide in SignUp
    } else {
        title.textContent = "Welcome Back";
        desc.textContent = "Sign in to continue to Stylo AI";
        btn.textContent = "Sign In";
        toggleText.innerHTML = "Don't have an account? <span>Sign Up</span>";
        nameInput.style.display = 'none';
        nameInput.required = false;
        forgotLink.style.display = 'block'; // Show in SignIn
    }
};

const handleEmailAuth = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;
    const btn = document.getElementById('email-submit-btn');
    
    if(password.length < 6) {
        showError("Password must be at least 6 characters.");
        return;
    }

    btn.innerHTML = '<div class="spinner-small" style="width:16px; height:16px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; display:inline-block;"></div> Processing...';
    btn.disabled = true;
    document.getElementById('error-message').style.display = 'none';

    try {
        if (isSignUpMode) {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            if (name) {
                await updateProfile(userCredential.user, { displayName: name });
            }
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        console.error("Auth Error:", error);
        let msg = "Authentication failed.";
        if(error.code === 'auth/email-already-in-use') msg = "Email already in use.";
        if(error.code === 'auth/wrong-password') msg = "Incorrect password.";
        if(error.code === 'auth/user-not-found') msg = "No account found with this email.";
        if(error.code === 'auth/invalid-email') msg = "Invalid email address.";
        if(error.code === 'auth/too-many-requests') msg = "Too many failed attempts. Try again later.";
        
        showError(msg);
        btn.innerHTML = isSignUpMode ? "Sign Up" : "Sign In";
        btn.disabled = false;
    }
};

const showError = (msg) => {
    const el = document.getElementById('error-message');
    el.textContent = msg;
    el.style.display = 'block';
};

const handleGoogleLogin = async () => {
    const btn = document.getElementById('popup-google-btn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<div class="spinner-small" style="width:20px; height:20px; border:2px solid #ccc; border-top-color:#333; border-radius:50%; animation:spin 1s linear infinite;"></div> Signing in...';
        btn.style.pointerEvents = 'none'; 
        
        await signInWithPopup(auth, new GoogleAuthProvider());
        
    } catch (error) {
        console.error("Popup Login Error:", error);
        alert("Google Sign in failed. Please try again.");
        btn.innerHTML = originalText;
        btn.style.pointerEvents = 'auto';
    }
};

// --- Initialization ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        removeSigninPopup();
    } else {
        createSigninPopup();
    }
});

if (!document.getElementById('spin-anim-style')) {
    const s = document.createElement('style');
    s.id = 'spin-anim-style';
    s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(s);
}