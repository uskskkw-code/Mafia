// src/firebase.js

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// ***** يجب استبدال هذه القيم بقيم مشروعك الحقيقية *****
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
// **********************************************

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
