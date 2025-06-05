import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyD4iGCybnBM6kvJ8sgVn8xnzNLk0-ysiCw",
  authDomain: "memozise-3ecca.firebaseapp.com",
  projectId: "memozise-3ecca",
  storageBucket: "memozise-3ecca.firebasestorage.app",
  messagingSenderId: "281173784850",
  appId: "1:281173784850:web:ba3ec42ac5190cea33dbcb",
  measurementId: "G-7R0JL1FX2R",
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
const db = getFirestore(app);

// Initialize Auth only if not already initialized
let auth;
try {
  auth = getAuth(app); // Try to get existing auth instance
} catch (e) {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
}

export { app, db, auth };
