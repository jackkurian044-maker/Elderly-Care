import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAPH9j8Cqdj3K_Cvl4LI4cOL56rZmRRyY8",
  authDomain: "elderly-care-cf91c.firebaseapp.com",
  projectId: "elderly-care-cf91c",
  storageBucket: "elderly-care-cf91c.firebasestorage.app",
  messagingSenderId: "93058455408",
  appId: "1:93058455408:web:905193af163a72dbc3a1b5",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
