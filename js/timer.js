import {
  uiConfirm
} from "./dialogs.js";

const getApp = () => window.app;

const getTimerKey = () => {
  const app = getApp();
  const uid = app?.data?.user?.uid || "local";
  return `prepMasterTimer_${uid}`;
};

export const timerOps = {
  getElapsedMS: () => {
    const app = getApp();
    if (!app.data.activeTimer) return 0;
    let currentSegment = 0;
    if (app.data.activeTimer.startTime !== null) {
      currentSegment = Math.max(0, Date.now() - app.data.activeTimer.startTime);
    }
    return (app.data.activeTimer.accumulated || 0) + currentSegment;
  },
  persistTimerState: () => {
    const app = getApp();
    const key = getTimerKey();
    if (app.data.activeTimer) {
      localStorage.setItem(key, JSON.stringify(app.data.activeTimer));
    } else {
      localStorage.removeItem(key);
    }
  },
  restoreTimerState: () => {
    const app = getApp();
    const key = getTimerKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (app.data.tasks.find(t => t.id === parsed.id)) {
          app.data.activeTimer = parsed;
        } else {
          localStorage.removeItem(key);
          app.data.activeTimer = null;
        }
      } catch (e) {
        console.error("Timer state corrupted", e);
        localStorage.removeItem(key);
      }
    } else {
      if (app.data.activeTimer) {
        const task = app.data.tasks.find(t => t.id === app.data.activeTimer.id);
        if (task) {
          console.log("⏱️ Restored active timer from Cloud state");
          timerOps.persistTimerState();
        } else {
          app.data.activeTimer = null;
        }
      }
    }
    if (app.data.activeTimer) {
      timerOps.updateGlobalTimerUI();
      if (app.data.activeTimer.startTime !== null) {
        timerOps.startTicker();
      }
    }
  },
  startTimer: async id => {
    const app = getApp();
    if (app.data.activeTimer) {
      if (app.data.activeTimer.id === id) {
        timerOps.toggleZenMode(true);
        return;
      }
      const currentTask = app.data.tasks.find(t => t.id === app.data.activeTimer.id);
      const currentName = currentTask ? currentTask.subSubject : "Current Task";
      const confirmed = await uiConfirm(`⏱️ Switch Task?\n\n"${currentName}" is currently running.\n\nStop it and switch to this new task?`);
      if (!confirmed) return;
      timerOps.stopTimer(true);
    }
    const task = app.data.tasks.find(t => t.id === id);
    const initialAccumulated = task && task.actualTime ? task.actualTime * 6e4 : 0;
    app.data.activeTimer = {
      id: id,
      startTime: Date.now(),
      accumulated: initialAccumulated
    };
    timerOps.persistTimerState();
    timerOps.toggleZenMode(true);
    app.render();
    timerOps.startTicker();
  },
  stopTimer: (silent = false) => {
    const app = getApp();
    if (!app.data.activeTimer) return;
    app.data.isZenMode = false;
    const zenOverlay = document.getElementById("zenModeOverlay");
    if (zenOverlay) zenOverlay.classList.add("hidden");
    if (app.data.activeTimer.startTime !== null) {
      const now = Date.now();
      const delta = Math.max(0, now - app.data.activeTimer.startTime);
      app.data.activeTimer.accumulated = (app.data.activeTimer.accumulated || 0) + delta;
      app.data.activeTimer.startTime = null;
    }
    const finalElapsedMS = app.data.activeTimer.accumulated;
    const finalMinutes = Math.ceil(finalElapsedMS / 1e3 / 60);
    const taskId = app.data.activeTimer.id;
    const task = app.data.tasks.find(t => t.id === taskId);
    if (task) {
      task.actualTime = finalMinutes;
      if (silent && task.status !== "done") task.status = "partial";
      app.saveData();
    }
    if (app.data.timerInterval) {
      clearInterval(app.data.timerInterval);
      app.data.timerInterval = null;
    }
    app.data.activeTimer = null;
    timerOps.persistTimerState();
    timerOps.updateGlobalTimerUI();
    app.render();
    if (!silent) {
      app.manualComplete(taskId, finalMinutes);
    }
  },
  toggleTimer: () => {
    const app = getApp();
    if (!app.data.activeTimer) return;
    if (app.data.activeTimer.startTime !== null) {
      const now = Date.now();
      const delta = Math.max(0, now - app.data.activeTimer.startTime);
      app.data.activeTimer.accumulated += delta;
      app.data.activeTimer.startTime = null;
      if (app.data.timerInterval) {
        clearInterval(app.data.timerInterval);
        app.data.timerInterval = null;
      }
      timerOps.updateTickerDisplay();
      const globalBtn = document.getElementById("globalTimerPauseBtn");
      if (globalBtn) globalBtn.innerText = "Resume";
      const zenBtn = document.getElementById("zenPauseBtn");
      if (zenBtn) {
        zenBtn.querySelector("i").className = "fas fa-play text-2xl md:text-3xl text-emerald-400";
        zenBtn.querySelector("span").innerText = "Resume";
      }
    } else {
      app.data.activeTimer.startTime = Date.now();
      timerOps.startTicker();
      const globalBtn = document.getElementById("globalTimerPauseBtn");
      if (globalBtn) globalBtn.innerText = "Pause";
      const zenBtn = document.getElementById("zenPauseBtn");
      if (zenBtn) {
        zenBtn.querySelector("i").className = "fas fa-pause text-2xl md:text-3xl text-amber-400";
        zenBtn.querySelector("span").innerText = "Pause";
      }
    }
    timerOps.persistTimerState();
  },
  startTicker: () => {
    const app = getApp();
    if (app.data.timerInterval) clearInterval(app.data.timerInterval);
    timerOps.updateTickerDisplay();
    app.data.timerInterval = setInterval(() => {
      timerOps.updateTickerDisplay();
    }, 1e3);
  },
  updateTickerDisplay: () => {
    const app = getApp();
    if (!app.data.activeTimer) return;
    const totalMS = timerOps.getElapsedMS();
    const totalSecs = Math.floor(totalMS / 1e3);
    const h = Math.floor(totalSecs / 3600).toString().padStart(2, "0");
    const m = Math.floor(totalSecs % 3600 / 60).toString().padStart(2, "0");
    const s = (totalSecs % 60).toString().padStart(2, "0");
    const timeString = `${h}:${m}:${s}`;
    const display = document.getElementById("globalTimerDisplay");
    if (display) display.innerText = timeString;
    const zenDisplay = document.getElementById("zenTimerDisplay");
    if (zenDisplay) zenDisplay.innerText = timeString;
    const task = app.data.tasks.find(t => t.id === app.data.activeTimer.id);
    if (task && task.duration) {
      const durationMS = task.duration * 6e4;
      const pct = totalMS / durationMS * 100;
      const isOvertime = pct > 100;
      const displayWidth = Math.min(pct, 100);
      const bar = document.getElementById(`progress-bar-${task.id}`);
      const timeText = document.getElementById(`time-display-${task.id}`);
      const card = document.getElementById(`task-card-${task.id}`);
      if (bar) {
        bar.style.width = `${displayWidth}%`;
        if (timeText) timeText.innerText = Math.floor(totalMS / 6e4);
        if (isOvertime && card && !card.classList.contains("overtime-warning")) {
          card.classList.add("overtime-warning");
          card.classList.remove("border-gray-100", "dark:border-gray-700", "bg-white", "dark:bg-gray-800");
          if (timeText) {
            timeText.parentElement.classList.remove("text-gray-400");
            timeText.parentElement.classList.add("text-amber-600", "dark:text-amber-500", "font-bold");
          }
          bar.classList.remove("bg-emerald-500/10");
          bar.classList.add("bg-amber-500/10");
        }
      }
      const heroCard = document.getElementById("active-hero-card");
      const heroBar = document.getElementById("active-hero-progress");
      const heroStatus = document.getElementById("active-hero-status");
      const heroPing = document.getElementById("active-hero-ping");
      const heroDot = document.getElementById("active-hero-dot");
      if (heroBar) {
        heroBar.style.width = `${displayWidth}%`;
        if (isOvertime && heroCard && !heroCard.classList.contains("overtime-warning")) {
          heroCard.classList.add("overtime-warning");
          heroCard.classList.remove("border-emerald-500/50", "shadow-emerald-500/10");
          heroBar.classList.remove("bg-emerald-500/10");
          heroBar.classList.add("bg-amber-500/10");
          if (heroStatus) {
            heroStatus.innerText = "Time Exceeded";
            heroStatus.classList.remove("text-emerald-500");
            heroStatus.classList.add("text-amber-500", "animate-pulse");
          }
          if (heroPing) heroPing.classList.replace("bg-emerald-400", "bg-amber-400");
          if (heroDot) heroDot.classList.replace("bg-emerald-500", "bg-amber-500");
        }
      }
    }
  },
  toggleZenMode: (forceState = null) => {
    const app = getApp();
    if (forceState !== null) {
      app.data.isZenMode = forceState;
    } else {
      app.data.isZenMode = !app.data.isZenMode;
    }
    app.render();
  },
  updateGlobalTimerUI: () => {
    const app = getApp();
    const bar = document.getElementById("globalTimerBar");
    if (!bar) return;
    if (app.data.activeTimer) {
      bar.classList.remove("translate-y-full");
      bar.onclick = e => {
        if (e.target.closest("button")) return;
        timerOps.toggleZenMode(true);
      };
      bar.style.cursor = "pointer";
      bar.title = "Click to expand Focus Mode";
      const task = app.data.tasks.find(t => t.id === app.data.activeTimer.id);
      if (task) {
        document.getElementById("globalTimerTaskName").innerText = `${task.subject}: ${task.subSubject}`;
      } else {
        app.data.activeTimer = null;
        timerOps.persistTimerState();
        bar.classList.add("translate-y-full");
        return;
      }
      const isRunning = app.data.activeTimer.startTime !== null;
      document.getElementById("globalTimerPauseBtn").innerText = isRunning ? "Pause" : "Resume";
      timerOps.updateTickerDisplay();
    } else {
      bar.classList.add("translate-y-full");
      bar.onclick = null;
      bar.style.cursor = "default";
    }
  }
};