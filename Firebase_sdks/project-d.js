// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAuqfwWDTUPFqfp-y_nwoEDKHSjzH0q9UQ",
  authDomain: "project-d-1272d.firebaseapp.com",
  databaseURL: "https://project-d-1272d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-d-1272d",
  storageBucket: "project-d-1272d.firebasestorage.app",
  messagingSenderId: "480524753005",
  appId: "1:480524753005:web:d06a6d313925cdf8304764",
  measurementId: "G-MNPDE420LL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);