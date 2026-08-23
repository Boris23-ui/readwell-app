import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDJjAXJQk_47laVjuTij453xlLra-08ODQ",
  authDomain: "gen-lang-client-0448236486.firebaseapp.com",
  projectId: "gen-lang-client-0448236486",
  storageBucket: "gen-lang-client-0448236486.firebasestorage.app",
  messagingSenderId: "30345284115",
  appId: "1:30345284115:web:959e2b33cee9f464b98de6",
  measurementId: "G-ET23L29JMC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
