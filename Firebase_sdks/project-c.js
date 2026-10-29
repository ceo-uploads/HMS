// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBeFKZ4995sB6q8XJ8ISzJe_ltnxDPjVxU",
  authDomain: "project-c-669ef.firebaseapp.com",
  databaseURL: "https://project-c-669ef-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-c-669ef",
  storageBucket: "project-c-669ef.firebasestorage.app",
  messagingSenderId: "268935265527",
  appId: "1:268935265527:web:7f0c7d1fca90e80dc7a7f2",
  measurementId: "G-0ZD8GST16W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);