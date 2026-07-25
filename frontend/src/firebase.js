import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAPfxpull1xoi2HucD-vcO6kKknIZ2P9K8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "omoka-73f48.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "omoka-73f48",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "omoka-73f48.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1025422986681",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1025422986681:web:deb539f7cb6a30fad77a68",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DC4DY0DZFC",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// Analytics is intentionally not initialized here: getAnalytics() requires
// a real browser environment with measurement APIs available, and this is
// a login/gameplay integration, not an analytics one. Add it back with
// `import { getAnalytics } from "firebase/analytics"` if you want
// pageview/event tracking later.
