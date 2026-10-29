// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBBdzKwyBm4aY3DVAqW8r7-WHmCQ5PCBp4",
  authDomain: "kabirhat-private-hospital.firebaseapp.com",
  databaseURL: "https://kabirhat-private-hospital-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kabirhat-private-hospital",
  storageBucket: "kabirhat-private-hospital.firebasestorage.app",
  messagingSenderId: "108290650833",
  appId: "1:108290650833:web:1dc500dc1704736b4b0bf0",
  measurementId: "G-3ZCB5MRQ5Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);