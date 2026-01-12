import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAnalytics
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAVq-qzrEHHVcDNvb5XBnM1EOYJ-G_mwJg",
  authDomain: "prep-master2.firebaseapp.com",
  projectId: "prep-master2",
  storageBucket: "prep-master2.firebasestorage.app",
  messagingSenderId: "676909332346",
  appId: "1:676909332346:web:a89d07f5a3fbe5fe0f48c3",
  measurementId: "G-9PVVGPEPDW"
};

const app = initializeApp(firebaseConfig);

const analytics = getAnalytics(app);

export const auth = getAuth(app);

export const db = getFirestore(app);