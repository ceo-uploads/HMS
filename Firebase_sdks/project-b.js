// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBHz8r0rM8uuAblMPlfalLmDb-LRhpTALU",
  authDomain: "projet-b-f30f5.firebaseapp.com",
  databaseURL: "https://projet-b-f30f5-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "projet-b-f30f5",
  storageBucket: "projet-b-f30f5.firebasestorage.app",
  messagingSenderId: "551056666976",
  appId: "1:551056666976:web:c3080adb52acd53417ee05",
  measurementId: "G-GX7NKB5T4N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);