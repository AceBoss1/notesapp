import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { setting } from "@/lib/config";

const firebaseConfig = {
  apiKey: setting("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: setting("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: setting("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: setting("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: setting("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: setting("NEXT_PUBLIC_FIREBASE_APP_ID"),
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
