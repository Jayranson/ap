// Firebase Imports
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';

// Firebase configuration and initialization
let app: FirebaseApp | null, auth: Auth | null, db: Firestore | null, storage: FirebaseStorage | null, functions: Functions | null;
let isFirebaseConfigured = false;

// Function to initialize Firebase (called after window variables are guaranteed to be set)
export const initializeFirebase = () => {
    if (isFirebaseConfigured) return; // Already initialized
    
    try {
        const firebaseConfig = JSON.parse(typeof window.__firebase_config !== 'undefined' ? window.__firebase_config : '{}');
        
        // Check if Firebase config has required fields
        if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            storage = getStorage(app);
            functions = getFunctions(app);
            isFirebaseConfigured = true;
            console.log("Firebase initialized successfully");
        }
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
};

export const getAppId = () => {
    return typeof window.__app_id !== 'undefined' ? window.__app_id : 'gay-tradies-v2';
};

export { app, auth, db, storage, functions, isFirebaseConfigured };