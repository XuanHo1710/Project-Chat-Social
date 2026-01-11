// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCFdlHGDYEc4YXfSm7eYI5vdxScHxN_I3o",
    authDomain: "project-chat-ca9b5.firebaseapp.com",
    projectId: "project-chat-ca9b5",
    storageBucket: "project-chat-ca9b5.firebasestorage.app",
    messagingSenderId: "371677931472",
    appId: "1:371677931472:web:1f95ceeafdad66c2993bd5",
    measurementId: "G-YDKW5DQW0H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);