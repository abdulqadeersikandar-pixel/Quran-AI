// firebase.js
// Yeh file Firebase ko initialize karti hai — Auth (login/signup) aur Firestore (progress data) dono ke liye.
//
// SETUP STEPS (Firebase Console mein):
// 1. https://console.firebase.google.com par jayein, apna project kholein.
// 2. Build > Authentication > Get Started.
//    - "Sign-in method" tab mein "Email/Password" provider ko Enable karein.
//    - Usi tab mein "Google" provider ko bhi Enable karein (support email select karna hoga).
// 3. Build > Firestore Database > Create Database.
//    - Location choose karein (jaise asia-south1 agar Pakistan/India ke qareeb chahiye).
//    - Start karein "production mode" mein (rules neeche di gayi hain).
// 4. Project Settings (gear icon, top-left) > General tab > "Your apps" section > "</>" (Web) icon par click karein.
//    - App ka naam den (e.g. "TajweedApp Web"), register karein.
//    - Jo `firebaseConfig` object milega, wahi neeche paste karein.
//
// Security ke liye: production mein yeh values .env file mein rakhein aur
// import.meta.env.VITE_FIREBASE_API_KEY (Vite) ya process.env.REACT_APP_FIREBASE_API_KEY (CRA) use karein,
// direct hardcode na karein agar repo public/GitHub par hai.

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBOmiOjACC8n7xmqfPKS437lCMC41uGo9w",
  authDomain: "quran-tajweed-app-1551b.firebaseapp.com",
  projectId: "quran-tajweed-app-1551b",
  storageBucket: "quran-tajweed-app-1551b.firebasestorage.app",
  messagingSenderId: "934614673732",
  appId: "1:934614673732:web:31daf8f8690f80db230f11"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;

/*
FIRESTORE SECURITY RULES (Firestore Database > Rules tab mein yeh paste karein):

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /practice_history/{sessionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}

Yeh rule ensure karta hai ke har user sirf apna hi data (users/{apna-uid}/...) parh aur likh sake, kisi aur ka nahi.
*/
