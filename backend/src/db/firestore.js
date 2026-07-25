import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Initialize Firebase Admin SDK for Firestore access
 * Supports both service account key file and environment variable credentials
 */
let firebaseInitialized = false;
let firestoreInstance = null;

export async function initializeFirestore() {
  if (firebaseInitialized && firestoreInstance) {
    return firestoreInstance;
  }

  try {
    // Try to load from service account key file first
    const keyPath = path.join(__dirname, "../../serviceAccountKey.json");
    if (fs.existsSync(keyPath)) {
      console.log("[Firestore] Initializing with service account key file");
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Fallback to environment variable
      console.log("[Firestore] Initializing with service account from environment variable");
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    } else {
      console.warn(
        "[Firestore] Warning: No service account credentials found. " +
        "Provide serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT environment variable"
      );
      return null;
    }

    firestoreInstance = admin.firestore();
    firebaseInitialized = true;
    console.log("[Firestore] Initialized successfully");
    return firestoreInstance;
  } catch (error) {
    console.error("[Firestore] Initialization error:", error.message);
    return null;
  }
}

export async function getFirestore() {
  if (!firestoreInstance) {
    return await initializeFirestore();
  }
  return firestoreInstance;
}
