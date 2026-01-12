# 🚀 PrepPro v2.0.0

**PrepPro** is a focused, offline‑first study planner with **secure cloud sync and cross‑device support**, built for aspirants preparing for long‑term competitive exams (UPSC, SSC, State PSCs, etc.).

It is designed around one core idea:

> **Your study data must be reliable, distraction‑free, and never lost.**

---

## ✨ What PrepPro Offers

### 🔐 Authentication & User Safety

* Firebase Authentication (Email / Password)
* Each user’s data is **strictly isolated** using their UID
* Logout fully clears in‑memory state (no data bleed, no ghost sessions)

### ☁️ True Cloud Sync (Cross‑Device)

* Tasks, subjects, progress, and timers sync automatically
* Log in from a new device → **data restores instantly**
* Clearing browser storage does **not** delete your data
* Firestore acts as the **authoritative source of truth**

### ⚡ Offline‑First by Design

* App works fully without internet
* Local storage is used as a **cache + offline fallback**
* When connection returns, sync resumes silently

### ⏱️ Robust Timer System

* Start / stop focus timers per task
* Timer state survives refresh, logout, and device switch
* No runaway intervals or ghost timers

### 🧠 Minimal & Focused UI

* No dark patterns
* No unnecessary animations
* Designed for long study sessions
* Stability > gimmicks

---

## 🏗️ Architecture Overview

```
Browser (UI)
   │
   ├── Firebase Auth (identity)
   │
   ├── Firestore (authoritative cloud data)
   │
   └── localStorage (offline cache & fallback)
```

### Data Flow (Simplified)

1. App waits for Firebase Auth to resolve
2. Cloud data loads first (Firestore)
3. Local data used only if cloud unavailable
4. All changes are written:

   * locally (offline safety)
   * to cloud (cross‑device sync)

---

## 📂 Important Files (Codebase Guide)

| File            | Purpose                                 |
| --------------- | --------------------------------------- |
| `index.html`    | SPA entry point                         |
| `js/app.js`     | App lifecycle & guarded initialization  |
| `js/auth.js`    | Auth lifecycle + cloud/local sync logic |
| `js/storage.js` | Local storage + Firestore wrappers      |
| `js/timer.js`   | Timer persistence & restoration         |

---

## 🧪 Stability & QA Status

This version has passed:

* ✅ Auth lifecycle testing
* ✅ Cross‑device sync testing
* ✅ Offline → online recovery
* ✅ Timer edge cases
* ✅ Logout / re‑login safety
* ✅ UI / UX regression checks

**Status:** 🟢 Production‑ready for small to medium user base

---

## ⚙️ Local Setup

```bash
git clone https://github.com/deepak-singh-jethi/PrepProV2.0.0.git
cd PrepProV2.0.0
```

### Firebase Setup

1. Create a Firebase project
2. Enable:

   * Authentication (Email/Password)
   * Firestore (Native mode)
3. Add your config to:

   ```
   js/firebase-config.js
   ```

Then serve the app using any static server:

```bash
npx serve .
```

---

## 🔒 Recommended Firestore Security Rules

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

These rules ensure **strict per‑user data isolation**.

---

## 📈 Cost & Scaling Notes

* Firestore usage is minimal and guarded
* No background write loops
* Safe for Spark (free) plan initially
* Enable billing alerts as a precaution

---

## 🗺️ Roadmap (High‑Level)

* 📊 Study analytics & trends
* 🔔 Smart reminders
* 📱 PWA support
* 📦 Optional backup‑only export mode

---

## 🤝 Contributing Guidelines

* Do not change UI/UX without discussion
* Preserve offline‑first behavior
* Avoid re‑introducing lifecycle race conditions
* Stability > features

PRs and issues are welcome.

---

## 📄 License

MIT License

---

## 🧠 Philosophy

> *A study app should never become another distraction.*

PrepPro is built to stay out of your way — and protect your effort.
