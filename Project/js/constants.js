// --- STATE & CONSTANTS ---
export const DEFAULT_MODEL = "gemini-2.5-flash"; // ✅ Change to this
export const DEFAULT_MAX_TOKENS = 8192; // Gemini supports higher context
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const CLOUDINARY_CLOUD_NAME = 'dyff2bufp';
export const CLOUDINARY_UPLOAD_PRESET = 'stylo-preset';
export const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// 3. UNIFIED PLANS & LIMITS (Single Source of Truth)
// NOTE: Replace 'plan_xxxx' with the actual Plan ID from your Razorpay Dashboard -> Subscriptions
export const PLANS = {
    free: {
        name: 'Free',
        price: 0,
        razorpayPlanId: null,
        limits: {
            maxProjects: 3,
            maxCollections: 3,
            maxDeployments: 3,
            chatLimit: 20,
            maxSaves: 30,
            canExportCode: false,
            canAddCollaborators: false,
            maxStorage: 100,
            aiAccess: 'basic'
        }
    },
    startup: {
        name: 'Startup',
        price: 199,
        razorpayPlanId: 'plan_SGhbuPS2ykIa60', // Get this from Razorpay Dashboard
        limits: {
            maxProjects: 10,
            maxCollections: 11,
            maxDeployments: 9,
            chatLimit: 200,
            maxSaves: 120,
            canExportCode: true,
            canAddCollaborators: false,
            maxStorage: 500,
            aiAccess: 'standard'
        }
    },
    pro: {
        name: 'Pro',
        price: 399,
        razorpayPlanId: 'plan_SGhcVRxPpJiGcO',
        limits: {
            maxProjects: 50,
            maxCollections: 30,
            maxDeployments: 50,
            chatLimit: 500,
            maxSaves: 1000,
            canExportCode: true,
            canAddCollaborators: false,
            maxStorage: 2000,
            aiAccess: 'advanced'
        }
    },
    prebusiness: {
        name: 'Pre-Business',
        price: 799,
        razorpayPlanId: 'plan_SGhd0OWuCHYZ50',
        limits: {
            maxProjects: 100,
            maxCollections: 25,
            maxDeployments: 100,
            chatLimit: 2000,
            maxSaves: 5000,
            canExportCode: true,
            canAddCollaborators: true,
            maxStorage: 5000,
            aiAccess: 'advanced'
        }
    },
    business: {
        name: 'Business',
        price: 1299,
        razorpayPlanId: 'plan_SGhfgyJpKZ1aju',
        limits: {
            maxProjects: Infinity,
            maxCollections: Infinity,
            maxDeployments: Infinity,
            chatLimit: Infinity,
            maxSaves: Infinity,
            canExportCode: true,
            canAddCollaborators: true,
            maxStorage: 10000,
            aiAccess: 'advanced'
        }
    }
};