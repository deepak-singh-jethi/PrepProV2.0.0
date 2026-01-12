import {
  db,
  auth
} from "./firebase-config.js";

import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentContextUid = null;

const getStorageKey = () => {
  return currentContextUid ? `prepProData_${currentContextUid}` : "prepProData_local";
};

export function setStorageContext(uid) {
  currentContextUid = uid;
}

export function clearCurrentSession() {
  currentContextUid = null;
}

export function saveToStorage(data) {
  try {
    const payload = JSON.stringify({
      schema: 3.2,
      tasks: data.tasks || [],
      subjects: data.subjects || [],
      targetDate: data.targetDate || "2026-02-01",
      lastBackup: data.lastBackup
    });
    localStorage.setItem(getStorageKey(), payload);
    return true;
  } catch (e) {
    console.error("Save failed:", e);
    return false;
  }
}

export function loadFromStorage() {
  const key = getStorageKey();
  let stored = localStorage.getItem(key);
  if (!stored && !currentContextUid) {
    const legacy = localStorage.getItem("prepMasterData_v3");
    if (legacy) stored = legacy;
  }
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error("Data corrupted, backing up and resetting.", e);
    localStorage.setItem(key + "_corrupted", stored);
    return null;
  }
}

export async function saveToCloud(data) {
  const user = auth.currentUser;
  if (!user || user.uid !== currentContextUid) return;
  try {
    const payload = {
      schema: 3.2,
      tasks: data.tasks || [],
      subjects: data.subjects || [],
      targetDate: data.targetDate || "2026-02-01",
      lastBackup: new Date().toISOString(),
      activeTimer: data.activeTimer || null
    };
    await setDoc(doc(db, "users", user.uid), payload);
    console.log("☁️ Saved to Cloud");
  } catch (e) {
    console.error("Cloud Save Error:", e);
    throw e;
  }
}

export async function loadFromCloud(uid) {
  if (!uid) return null;
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (e) {
    console.error("Cloud Load Error:", e);
    throw e;
  }
}

export function validateData(data) {
  if (!data || typeof data !== "object") return {
    ok: false,
    error: "Invalid JSON structure."
  };
  if (data.schema !== 3.2) return {
    ok: false,
    error: `Version mismatch. Expected 3.2, got ${data.schema}.`
  };
  if (!Array.isArray(data.tasks)) return {
    ok: false,
    error: "Missing tasks array."
  };
  if (!Array.isArray(data.subjects)) return {
    ok: false,
    error: "Missing subjects array."
  };
  return {
    ok: true
  };
}