import {
  auth
} from "./firebase-config.js";

import {
  loadFromCloud,
  saveToCloud,
  setStorageContext,
  clearCurrentSession,
  loadFromStorage,
  saveToStorage
} from "./storage.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  uiAlert
} from "./dialogs.js";

const googleProvider = new GoogleAuthProvider();

export const authOps = {
  init: () => {
    return new Promise(resolve => {
      let isInitialized = false;
      onAuthStateChanged(auth, async user => {
        const app = window.app;
        if (app.data.user && user && app.data.user.uid === user.uid) {
          return;
        }
        if (user) {
          setStorageContext(null);
          const guestData = loadFromStorage();
          setStorageContext(user.uid);
          let localData = loadFromStorage();
          let cloudData = null;
          try {
            cloudData = await loadFromCloud(user.uid);
          } catch (e) {
            console.warn("Offline or Cloud Error:", e);
          }
          let finalData = null;
          let shouldUpload = false;
          let shouldSaveLocal = false;
          const localTime = localData?.lastBackup || "1970-01-01";
          const cloudTime = cloudData?.lastBackup || "1970-01-01";
          if (cloudData && localData) {
            if (cloudTime >= localTime) {
              console.log("📥 Cloud is newer (or equal). Syncing down.");
              finalData = cloudData;
              shouldSaveLocal = true;
            } else {
              console.log("📤 Local is newer. Syncing up.");
              finalData = localData;
              shouldUpload = true;
            }
          } else if (cloudData && !localData) {
            console.log("📥 Restoring data from Cloud.");
            finalData = cloudData;
            shouldSaveLocal = true;
          } else if (!cloudData && localData) {
            console.log("📤 Initial Upload to Cloud.");
            finalData = localData;
            shouldUpload = true;
          } else if (!cloudData && !localData && guestData) {
            console.log("🚀 Migrating Guest Data to User Account.");
            finalData = guestData;
            shouldUpload = true;
            shouldSaveLocal = true;
          } else {
            console.log("✨ New User Profile.");
            finalData = null;
          }
          if (finalData) {
            if (shouldSaveLocal) {
              saveToStorage(finalData);
            }
            app.data.isDataLoaded = true;
            app.data.tasks = finalData.tasks || [];
            app.data.subjects = finalData.subjects || [];
            app.data.targetDate = finalData.targetDate || app.data.targetDate;
            app.data.lastBackup = finalData.lastBackup;
            app.render();
          } else {
            app.data.isDataLoaded = false;
          }
          app.data.user = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split("@")[0],
            photoURL: user.photoURL
          };
          authOps.updateUI(true);
          if (shouldUpload && finalData) {
            saveToCloud(finalData).catch(e => console.error("Background sync failed:", e));
          }
        } else {
          setStorageContext(null);
          app.data.user = null;
          console.log("🔒 Guest Mode");
          authOps.updateUI(false);
        }
        const loader = document.getElementById("app-loading-screen");
        if (loader) {
          loader.classList.add("opacity-0", "pointer-events-none");
          setTimeout(() => {
            if (loader.parentNode) loader.parentNode.removeChild(loader);
          }, 500);
        }
        if (!isInitialized) {
          isInitialized = true;
          resolve(user);
        }
      });
    });
  },
  loginGoogle: async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      document.getElementById("authModal").classList.add("hidden");
      await uiAlert("Welcome back, Scholar!");
      window.app.navigate("dashboard");
    } catch (error) {
      console.error(error);
      await uiAlert(`Login Failed: ${error.message}`);
    }
  },
  loginEmail: async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      document.getElementById("authModal").classList.add("hidden");
      window.app.navigate("dashboard");
    } catch (error) {
      await uiAlert(`Login Failed: ${error.message}`);
    }
  },
  registerEmail: async (email, password) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      document.getElementById("authModal").classList.add("hidden");
      await uiAlert("Account created successfully!");
      window.app.navigate("dashboard");
    } catch (error) {
      await uiAlert(`Signup Failed: ${error.message}`);
    }
  },
 logout: async () => {
    try {
  
      if (window.app) {
        if (window.app.data.activeTimer) {
          window.app.stopTimer(true);
        }
        if (window.app._renderTimer) {
          clearTimeout(window.app._renderTimer);
          window.app._renderTimer = null;
        }
      }

      await signOut(auth);
      window.app.resetState();
      clearCurrentSession();
      await uiAlert("Logged out successfully.");
      window.app.navigate("landing");
    } catch (error) {
      console.error(error);
    }
  },
  updateUI: isLoggedIn => {
    const loginBtn = document.getElementById("navLoginBtn");
    const userProfile = document.getElementById("navUserProfile");
    const userImg = document.getElementById("navUserImg");
    const userName = document.getElementById("navUserName");
    if (loginBtn && userProfile) {
      if (isLoggedIn && window.app.data.user) {
        loginBtn.classList.add("hidden");
        userProfile.classList.remove("hidden");
        if (userImg) userImg.src = window.app.data.user.photoURL || `https://ui-avatars.com/api/?name=${window.app.data.user.displayName}&background=random`;
        if (userName) userName.textContent = window.app.data.user.displayName;
      } else {
        loginBtn.classList.remove("hidden");
        userProfile.classList.add("hidden");
      }
    }
  }
};