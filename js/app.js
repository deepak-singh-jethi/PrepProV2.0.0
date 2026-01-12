import {
  generateUUID,
  formatDate
} from "./utils.js";

import {
  saveToStorage,
  loadFromStorage,
  validateData,
  saveToCloud
} from "./storage.js";

import {
  uiAlert,
  uiConfirm,
  uiPrompt,
  isDialogActive
} from "./dialogs.js";

import {
  subjectOps
} from "./subjects.js";

import {
  analyticsOps
} from "./analytics.js";

import {
  timerOps
} from "./timer.js";

import {
  taskOps
} from "./tasks.js";

import {
  systemOps
} from "./system.js";

import {
  authOps
} from "./auth.js";

// --- SECURITY HELPER: Prevents hacking via inputs ---
const escapeHTML = (str) => {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
};
// ----------------------------------------------------

window.app = {
  _isInit: false,
  data: {
    tasks: [],
    subjects: [],
    targetDate: "2026-02-01",
    activeTimer: null,
    timerInterval: null,
    currentView: "dashboard",
    currentDate: new Date(),
    calendarMonth: new Date(),
    completingTaskId: null,
    lastBackup: null,
    focusSubjectId: null,
    activeDrillSubject: null,
    analyticsRange: 7,
    isZenMode: false,
    user: null,
    isDataLoaded: false
  },
  toggleMobileTaskView(view) {
    taskOps.toggleMobileTaskView(view);
},
  safeId(id) {
    return document.getElementById(id);
  },
  uiAlert(msg) {
    return uiAlert(msg);
  },
  uiConfirm(msg) {
    return uiConfirm(msg);
  },
  uiPrompt(msg, val) {
    return uiPrompt(msg, val);
  },
  closeModal(id) {
    const el = this.safeId(id);
    if (el) el.classList.add("hidden");
  },
  openSettings() {
    const el = this.safeId("settingsModal");
    if (el) el.classList.remove("hidden");
  },
  toggleTheme() {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
  },
  setAnalyticsRange(days) {
    analyticsOps.setAnalyticsRange(days);
  },
  openAnalyticsDrill(sub) {
    analyticsOps.openAnalyticsDrill(sub);
  },
  closeAnalyticsDrill() {
    analyticsOps.closeAnalyticsDrill();
  },
  startTimer(id) {
    timerOps.startTimer(id);
  },
  stopTimer(silent) {
    timerOps.stopTimer(silent);
  },
  toggleTimer() {
    timerOps.toggleTimer();
  },
  toggleZenMode() {
    timerOps.toggleZenMode();
  },
  openZenMode() {
    timerOps.toggleZenMode(true);
  },
  createCardHTML(t, isDone) {
    return taskOps.createCardHTML(t, isDone);
  },
  openTaskModal(date, editId) {
    taskOps.openTaskModal(date, editId);
  },
  closeTaskModal() {
    taskOps.closeTaskModal();
  },
  openBacklogModal() {
    taskOps.openBacklogModal();
  },
  saveTask(e) {
    taskOps.saveTask(e);
  },
  deleteTask(id) {
    taskOps.deleteTask(id);
  },
  editTask(id) {
    taskOps.editTask(id);
  },
  manualComplete(id) {
    taskOps.manualComplete(id);
  },
  confirmCompletion(type) {
    taskOps.confirmCompletion(type);
  },
  quickSchedule(type, payload) {
    taskOps.quickSchedule(type, payload);
  },
  prepSafeAction(type, subject, topic) {
    taskOps.prepSafeAction(type, subject, topic);
  },
  assignToToday(id) {
    taskOps.assignToToday(id);
  },
  populateEditForm(id) {
    taskOps.populateEditForm(id);
  },
  resetForm() {
    taskOps.resetForm();
  },
  updateSubSubjects() {
    taskOps.updateSubSubjects();
  },
  renderDayManagerList(date) {
    taskOps.renderDayManagerList(date);
  },
  loadRevisionTopics() {
    taskOps.loadRevisionTopics();
  },
  exportData() {
    systemOps.exportData();
  },
  importData(input) {
    systemOps.importData(input);
  },
  restoreSafetyBackup() {
    systemOps.restoreSafetyBackup();
  },
  checkBackupStatus() {
    systemOps.checkBackupStatus();
  },
  loginGoogle() {
    authOps.loginGoogle();
  },
  logout() {
    authOps.logout();
  },
  handleEmailAuth(e) {
    const form = e.target;
    const email = form.email.value;
    const password = form.password.value;
    const action = form.dataset.action || "login";
    if (action === "register") {
      authOps.registerEmail(email, password);
    } else {
      authOps.loginEmail(email, password);
    }
  },
  async init() {
    if (this._isInit) return;
    this._isInit = true;
    window.subjActions = subjectOps;
    const user = await authOps.init();
    this.loadData();
    taskOps.checkBacklog();
    timerOps.restoreTimerState();
    systemOps.checkBackupStatus();
    this.setupKeyboardShortcuts();
    if (user) {
      this.navigate("dashboard");
    } else {
      this.navigate("landing");
    }
  },
 resetState() {

    if (this._renderTimer) {
      clearTimeout(this._renderTimer);
      this._renderTimer = null;
    }


    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval);
    }
    this.data.activeTimer = null;
    timerOps.updateGlobalTimerUI();
    this.data.tasks = [];
    this.data.subjects = [];
    this.data.user = null;
    this.data.activeDrillSubject = null;
    this.data.isDataLoaded = false;
    const zenOverlay = document.getElementById("zenModeOverlay");
    if (zenOverlay) zenOverlay.classList.add("hidden");
  },
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", async e => {
      if (isDialogActive()) return;
      if (e.key === "Escape") {
        const modals = Array.from(document.querySelectorAll(".modal")).filter(m => !m.classList.contains("hidden") && m.id !== "uiDialogContainer");
        if (modals.length > 0) {
          modals[modals.length - 1].classList.add("hidden");
        }
      }
    });
  },

  // --- DATA SAFETY FIX: Async Save Logic ---
  async saveData(options = { render: true }) {
    // 1. Update timestamp first
    this.data.lastBackup = new Date().toISOString();
    
    // 2. Save locally (always fast/sync)
    saveToStorage(this.data);
    
    // 3. Save to Cloud (WAIT for it to finish)
    if (this.data.user) {
      try {
        await saveToCloud(this.data);
      } catch (e) {
        console.error("Cloud save warning:", e);
      }
    }
    
    // 4. Update UI
    if (options.render) {
      this.scheduleRender();
    }
  },
  // -----------------------------------------

  scheduleRender() {
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(() => {
      this.render();
      this._renderTimer = null;
    }, 120);
  },
  loadData() {
    if (this.data.isDataLoaded) return;
    const parsed = loadFromStorage();
    if (parsed) {
      this.data.tasks = parsed.tasks || [];
      this.data.subjects = parsed.subjects || [];
      this.data.targetDate = parsed.targetDate || "2026-02-01";
      this.data.lastBackup = parsed.lastBackup || null;
      this.data.isDataLoaded = true;
    } else {
      this.data.subjects = [ {
        id: generateUUID(),
        name: "History",
        sub: [ "Ancient", "Medieval", "Modern" ]
      }, {
        id: generateUUID(),
        name: "Polity",
        sub: [ "Constitution", "Governance" ]
      }, {
        id: generateUUID(),
        name: "Geography",
        sub: [ "Physical", "Indian" ]
      } ];
      this.data.tasks = [];
    }
  },
  navigate(view) {
    this.data.currentView = view;
    if (this.data.activeDrillSubject && view !== "analytics") {
      analyticsOps.closeAnalyticsDrill();
    }
    const sidebar = this.safeId("mainSidebar");
    const header = this.safeId("mainHeader");
    if (view === "landing") {
      if (sidebar) sidebar.classList.add("hidden");
      if (header) header.classList.add("hidden");
    } else {
      if (sidebar) sidebar.classList.remove("hidden");
      if (header) header.classList.remove("hidden");
    }
    document.querySelectorAll(".view-section").forEach(el => el.classList.add("hidden"));
    
    // --- STABILITY FIX: Null Check ---
    const activeView = this.safeId(`view-${view}`);
    if (activeView) activeView.classList.remove("hidden");
    // ---------------------------------
    
    document.querySelectorAll(".nav-item").forEach(el => {
      el.classList.remove("bg-indigo-50", "text-primary", "dark:bg-gray-700", "dark:text-indigo-400", "font-bold");
      el.classList.add("text-gray-500", "dark:text-gray-400");
    });
    const activeBtn = this.safeId(`nav-${view}`);
    if (activeBtn) {
      activeBtn.classList.add("bg-indigo-50", "text-primary", "dark:bg-gray-700", "dark:text-indigo-400", "font-bold");
      activeBtn.classList.remove("text-gray-500", "dark:text-gray-400");
    }
    this.render();
  },
  render() {
    if (!this.safeId("view-dashboard")) return;
    this.renderHeader();
    this.renderDashboard();
    this.renderCalendar();
    this.renderSubjects();
    try {
      analyticsOps.renderAnalytics();
    } catch (e) {
      console.warn("Analytics error", e);
    }
    taskOps.renderBacklog();
    timerOps.updateGlobalTimerUI();
    const zenOverlay = this.safeId("zenModeOverlay");
    if (this.data.isZenMode && this.data.activeTimer) {
      if (zenOverlay) zenOverlay.classList.remove("hidden");
      const task = this.data.tasks.find(t => t.id === this.data.activeTimer.id);
      if (task) {
        const zenSub = this.safeId("zenSubject");
        const zenTask = this.safeId("zenTaskName");
        // Safe innerText used here, no HTML needed
        if (zenSub) zenSub.innerText = task.subject;
        if (zenTask) zenTask.innerText = task.subSubject;
      }
      const isRunning = this.data.activeTimer.startTime !== null;
      const zenBtn = this.safeId("zenPauseBtn");
      if (zenBtn) {
        if (isRunning) {
          zenBtn.querySelector("i").className = "fas fa-pause text-2xl md:text-3xl text-amber-400";
          zenBtn.querySelector("span").innerText = "Pause";
        } else {
          zenBtn.querySelector("i").className = "fas fa-play text-2xl md:text-3xl text-emerald-400";
          zenBtn.querySelector("span").innerText = "Resume";
        }
      }
    } else {
      if (zenOverlay) zenOverlay.classList.add("hidden");
    }
  },
 renderHeader() {
    const dateEl = this.safeId("currentDateDisplay");
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
    const target = new Date(this.data.targetDate);
    const diff = target - new Date();
    const daysLeft = Math.ceil(diff / (1e3 * 60 * 60 * 24));
    
    // Update Desktop Header
    const countEl = this.safeId("countdownTimer");
    if (countEl) countEl.textContent = daysLeft > 0 ? `${daysLeft}d` : "NOW";
    const targetEl = this.safeId("targetDateDisplay");
    if (targetEl) targetEl.textContent = target.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric"
    });

    // Update Mobile Target (New)
    const mCount = this.safeId("mobileCountdownTimer");
    const mDate = this.safeId("mobileTargetDisplay");
    if (mCount && mDate) {
        mCount.textContent = daysLeft > 0 ? `${daysLeft}d` : "NOW";
        mDate.textContent = target.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }

    const todayStr = formatDate(new Date());
    const activeToday = this.data.tasks.some(t => t.date === todayStr && t.status === "done");
    const streakEl = this.safeId("streakDisplay");
    if (streakEl) {
      if (activeToday) {
        streakEl.innerHTML = `<i class="fas fa-fire text-orange-500 animate-pulse"></i> <span class="text-orange-600 dark:text-orange-400">Streak Active</span>`;
      } else {
        streakEl.innerHTML = `<i class="fas fa-snowflake text-blue-300"></i> <span class="text-gray-400">Get Started</span>`;
      }
    }
  },
  computePhase3Signal(allTasks, targetDateStr, subjects) {
    const now = new Date();
    const day14 = new Date();
    day14.setDate(now.getDate() - 14);
    const day30 = new Date();
    day30.setDate(now.getDate() - 30);
    const recentTasks = allTasks.filter(t => new Date(t.date) >= day14 && t.status === "done");
    const totalMins = recentTasks.reduce((acc, t) => acc + (t.actualTime || 0), 0);
    if (totalMins / 60 < 6 || recentTasks.length < 3) return null;
    const snoozeUntil = localStorage.getItem("strategySnoozeUntil");
    if (snoozeUntil && parseInt(snoozeUntil) > now.getTime()) return null;
    const lastShown = localStorage.getItem("lastStrategyShownAt");
    if (lastShown && now.getTime() - parseInt(lastShown) < 7 * 24 * 60 * 60 * 1e3) return null;
    const target = new Date(targetDateStr);
    const weeksLeft = (target - now) / (1e3 * 60 * 60 * 24 * 7);
    if (weeksLeft <= 12) {
      const recentMocks = allTasks.filter(t => new Date(t.date) >= day30 && t.status === "done" && (t.subSubject || "").toLowerCase().includes("mock"));
      if (recentMocks.length < 2) {
        return {
          type: "MOCK",
          text: "Mocks are underused — take one full-length mock this week.",
          reason: "Mocks surface blind spots",
          ctaLabel: "Schedule Mock",
          ctaAction: "app.navigate('calendar')"
        };
      }
    }
    const topicLastSeen = {};
    allTasks.forEach(t => {
      if (t.status === "done") {
        const key = `${t.subject}::${t.subSubject}`;
        if (!topicLastSeen[key] || t.date > topicLastSeen[key]) topicLastSeen[key] = t.date;
      }
    });
    const limitDate = new Date();
    limitDate.setDate(now.getDate() - 21);
    const limitStr = formatDate(limitDate);
    const decayed = Object.entries(topicLastSeen).filter(([ _, dateStr ]) => dateStr < limitStr);
    if (decayed.length > 0) {
      const [ fullKey ] = decayed.sort((a, b) => a[1].localeCompare(b[1]))[0];
      const [ sub, topic ] = fullKey.split("::");
      return {
        type: "REVISION",
        text: `Revision overdue — revise ${topic} this week.`,
        reason: "Retention decay detected",
        ctaLabel: "Start Revision",
        ctaAction: `app.prepSafeAction('revision', '${sub.replace(/'/g, "\\'")}', '${topic.replace(/'/g, "\\'")}')`
      };
    }
    return null;
  },
executeStrategyAction(actionString) {
  localStorage.setItem("lastStrategyShownAt", Date.now().toString());


  if (actionString === "app.navigate('calendar')") {
    this.navigate('calendar');
  } 
  else if (actionString.startsWith("app.prepSafeAction")) {
    const matches = actionString.match(/'([^']+)'/g);
    if (matches && matches.length >= 3) {
      const type = matches[0].replace(/'/g, "");
      const sub = matches[1].replace(/'/g, "");
      const topic = matches[2].replace(/'/g, "");
      this.prepSafeAction(type, sub, topic);
    }
  }
  
  this.renderDashboard();
},

  snoozeStrategy() {
    localStorage.setItem("strategySnoozeUntil", (Date.now() + 3 * 864e5).toString());
    this.renderDashboard();
  },
  renderDashboard() {
    if (this.data.currentView !== "dashboard") return;
    const dashboardContainer = this.safeId("view-dashboard");
    if (!dashboardContainer) return;
    const todayStr = formatDate(new Date());
    const allTasks = this.data.tasks;
    const todayTasks = allTasks.filter(t => t.date === todayStr && t.status !== "backlog");
    let focusTask = this.data.activeTimer ? allTasks.find(t => t.id === this.data.activeTimer.id) : null;
    const targetDate = new Date(this.data.targetDate);
    const daysLeft = Math.ceil((targetDate - new Date()) / (1e3 * 60 * 60 * 24));
    const doneAll = allTasks.filter(t => t.status === "done").length;
    const coverage = Math.round(doneAll / (allTasks.length || 1) * 100);
    const completedToday = todayTasks.filter(t => t.status === "done").length;
    const totalToday = todayTasks.length;
    const progressPct = totalToday > 0 ? Math.round(completedToday / totalToday * 100) : 0;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentTasks = allTasks.filter(t => new Date(t.date) >= sevenDaysAgo);
    const totalHours = Math.round(recentTasks.reduce((acc, t) => acc + (t.actualTime || 0), 0) / 60);
    const isLowData = totalHours < 6;
    dashboardContainer.innerHTML = `
            <div id="dashQuickActions" class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4 shrink-0">
                <div>
                    <h2 class="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Dashboard</h2>
                    <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Your command center for today.</p>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="app.openBacklogModal()" class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all shadow-sm">
                        <i class="fas fa-archive text-gray-400"></i>
                        <span>Backlog</span>
                        <span id="dashMiniBacklogCount" class="hidden ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold shadow-sm">0</span>
                    </button>
                    <button onclick="app.openTaskModal()" class="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-700 text-white font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-95 transition-all text-sm flex items-center gap-2">
                        <i class="fas fa-plus"></i> New Task
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start lg:h-[calc(100vh-13rem)]">
                <div class="lg:col-span-5 space-y-6 lg:h-full lg:overflow-hidden lg:flex lg:flex-col">
                    <div id="dashFocusCard" class="shrink-0"></div>

                    <div class="bg-white dark:bg-dark-surface rounded-2xl p-6 border border-gray-100 dark:border-dark-border shadow-soft space-y-6 shrink-0">
                        <div class="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-dark-border">
                            <div class="flex flex-col">
                                <span class="text-[10px] uppercase tracking-wider font-bold text-gray-400">Days Left</span>
                                <strong class="text-2xl text-gray-900 dark:text-white tracking-tight">${daysLeft}</strong>
                            </div>
                            <div class="flex flex-col text-right">
                                <span class="text-[10px] uppercase tracking-wider font-bold text-gray-400">Coverage</span>
                                <strong class="text-2xl text-primary tracking-tight">${coverage}%</strong>
                            </div>
                        </div>
                        <div>
                            <h4 class="text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-2">Performance (7 Days)</h4>
                            <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl">
                                <span class="text-sm font-bold text-gray-700 dark:text-gray-300">${totalHours}h studied</span>
                                <span class="text-[10px] font-bold uppercase tracking-wider ${isLowData ? "text-gray-400" : "text-emerald-500"}">
                                    ${isLowData ? "LIMITED DATA" : "ON TRACK"}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Daily: ${completedToday}/${totalToday} Completed</span>
                                <span class="text-sm font-mono font-bold text-gray-800 dark:text-white">${progressPct}%</span>
                            </div>
                            <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                                <div id="dashProgressBar" class="bg-primary h-2.5 rounded-full transition-all duration-1000 shadow-glow" style="width: ${progressPct}%"></div>
                            </div>
                        </div>
                    </div>
                    <div id="dashStrategyCard" class="hidden shrink-0"></div>
                </div>

                <div class="lg:col-span-7 space-y-8 lg:h-full lg:overflow-y-auto lg:pr-2 custom-scrollbar pb-10">
                    <div>
                        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2 sticky top-0 bg-gray-50 dark:bg-dark-bg z-10 py-2">
                            <span class="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"></span> Remaining
                        </h3>
                        <div id="dashRemainingList" class="space-y-3"></div>
                    </div>
                    
                    <div id="dashCompletedListContainer"></div>

                    <div id="dashBacklogWhisper" class="hidden pt-6 border-t border-gray-100 dark:border-dark-border text-center">
                        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2" id="backlogText">Checking backlog...</p>
                        <button onclick="app.openBacklogModal()" class="text-xs font-bold text-primary hover:text-primary-700 transition-colors">Review Bucket <i class="fas fa-arrow-right ml-1"></i></button>
                    </div>
                </div>
            </div>
        `;
    const focusEl = this.safeId("dashFocusCard");
    if (focusEl) {
      if (focusTask) {
// SECURITY APPLIED HERE: escapeHTML used on focusTask.subSubject and focusTask.subject
focusEl.innerHTML = `
    <div id="active-hero-card" class="rounded-2xl p-4 md:p-8 border border-emerald-500/50 bg-white dark:bg-gray-800 relative group shadow-lg shadow-emerald-500/10 transition-all duration-500 overflow-hidden">
        <div id="active-hero-progress" class="absolute top-0 bottom-0 left-0 bg-emerald-500/10 transition-all duration-1000 ease-linear pointer-events-none" style="width: 0%"></div>
        <div class="relative z-10">
            <div class="flex justify-between items-start mb-3 md:mb-4">
                <div class="flex items-center gap-2">
                    <span class="relative flex h-2.5 w-2.5">
                      <span id="active-hero-ping" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span id="active-hero-dot" class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span id="active-hero-status" class="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Session Active</span>
                </div>
                <span class="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-black/20 px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10">
                    ${focusTask.duration}m Target
                </span>
            </div>
         
            <h2 class="text-xl md:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight mb-1 tracking-tight break-words line-clamp-2">${escapeHTML(focusTask.subSubject)}</h2> 
            
            <p class="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <i class="fas fa-book text-xs opacity-50"></i> ${escapeHTML(focusTask.subject)}
            </p>

            <button onclick="app.openZenMode()" class="w-full py-3 md:py-4 rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-transform active:scale-[0.98] bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2 group/btn">
                <span>Open Focus Mode</span>
                <i class="fas fa-expand text-xs group-hover/btn:scale-110 transition-transform"></i>
            </button>
        </div>
    </div>`;
      } else {
        focusEl.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-12 bg-white dark:bg-dark-surface rounded-2xl border-2 border-dashed border-gray-200 dark:border-dark-border group hover:border-primary/30 transition-colors">
                        <div class="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-2xl text-gray-300 group-hover:text-primary group-hover:scale-110 transition-all duration-300">
                            <i class="fas fa-coffee"></i>
                        </div>
                        <p class="text-gray-500 dark:text-gray-400 font-medium text-sm mb-4">Ready to start?</p>
                        <button onclick="app.openTaskModal()" class="bg-primary text-white hover:bg-primary-700 font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-primary/20 transition-transform active:scale-95 flex items-center gap-2">
                            <i class="fas fa-plus"></i> Add Anchor Task
                        </button>
                    </div>`;
      }
    }
    const remainingEl = this.safeId("dashRemainingList");
    if (remainingEl) {
      const remainingTasks = todayTasks.filter(t => t.id !== focusTask?.id && t.status !== "done");
      remainingEl.innerHTML = remainingTasks.length === 0 ? `<div class="text-xs text-gray-400 italic py-4 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">No other tasks remaining.</div>` : remainingTasks.map(t => this.createCardHTML(t, false)).join("");
    }
    const completedContainer = this.safeId("dashCompletedListContainer");
    if (completedContainer) {
      const doneTasks = todayTasks.filter(t => t.status === "done");
      if (doneTasks.length === 0) {
        completedContainer.innerHTML = `<h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2 opacity-75"><span class="w-2 h-2 rounded-full bg-emerald-400"></span> Completed Today</h3><div class="text-xs text-gray-400 italic py-4 text-center opacity-50">Nothing completed yet.</div>`;
      } else {
        const completedHtml = doneTasks.map(t => this.createCardHTML(t, true)).join("");
        completedContainer.innerHTML = `
                    <details ${doneTasks.length < 3 ? "open" : ""} class="group">
                        <summary class="list-none flex items-center gap-2 cursor-pointer mb-4 select-none opacity-75 hover:opacity-100 transition-opacity">
                            <i class="fas fa-chevron-right text-[10px] text-gray-400 transition-transform group-open:rotate-90"></i>
                            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-emerald-400"></span> 
                                Completed Today <span class="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1.5 rounded text-[10px]">${doneTasks.length}</span>
                            </h3>
                        </summary>
                        <div id="dashCompletedList" class="space-y-3 opacity-80 pl-2 border-l border-gray-200 dark:border-gray-700 ml-1">${completedHtml}</div>
                    </details>`;
      }
    }
    const signal = this.computePhase3Signal(allTasks, this.data.targetDate, this.data.subjects);
    const stratEl = this.safeId("dashStrategyCard");
    if (stratEl) {
      if (signal) {
        // SECURITY APPLIED HERE: escapeHTML used on signal text
        stratEl.innerHTML = `
                    <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800/50 flex flex-col gap-3">
                        <div>
                            <h4 class="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-1 flex items-center gap-2"><i class="fas fa-lightbulb"></i> Strategy</h4>
                            <p class="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">${escapeHTML(signal.text)}</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="app.executeStrategyAction('${signal.ctaAction.replace(/'/g, "\\'")}')" class="bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">${escapeHTML(signal.ctaLabel)}</button>
                            <button onclick="app.snoozeStrategy()" class="text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Snooze</button>
                        </div>
                    </div>`;
        stratEl.classList.remove("hidden");
      } else {
        stratEl.classList.add("hidden");
      }
    }
    const backlogCount = allTasks.filter(t => t.status === "backlog").length;
    const blEl = this.safeId("dashBacklogWhisper");
    if (blEl) {
      if (backlogCount > 0) {
        blEl.classList.remove("hidden");
        document.getElementById("backlogText").innerText = `You have ${backlogCount} postponed items pending.`;
      } else {
        blEl.classList.add("hidden");
      }
    }
  },
  renderCalendar() {
    if (this.data.currentView !== "calendar") return;
    const grid = this.safeId("calendarGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const year = this.data.calendarMonth.getFullYear();
    const month = this.data.calendarMonth.getMonth();
    const todayStr = formatDate(new Date());
    const monthLabel = this.safeId("calendarMonthLabel");
    if (monthLabel) monthLabel.innerText = this.data.calendarMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDay; i++) grid.insertAdjacentHTML("beforeend", `<div class="opacity-0"></div>`);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const tasksForDay = this.data.tasks.filter(t => t.date === dateStr);
      const isPast = dateStr < todayStr;
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;
      let heatClass = "";
      let pct = 0;
      let totalTasks = tasksForDay.length;
      if (totalTasks > 0) {
        const score = tasksForDay.reduce((acc, t) => acc + (t.status === "done" ? 1 : t.status === "partial" ? .5 : 0), 0);
        pct = Math.round(score / totalTasks * 100);
        if (!isFuture) {
          if (pct === 0) heatClass = "heat-missed"; else if (pct <= 40) heatClass = "heat-low"; else if (pct <= 75) heatClass = "heat-med"; else if (pct < 100) heatClass = "heat-high"; else heatClass = "heat-perfect";
        }
      } else if (isPast) {
        heatClass = "heat-past-empty";
      }
      let intentLabel = "";
      let intentClass = "";
      if ([ 7, 14, 21, 28 ].includes(day)) {
        intentClass = "accent-rev";
        intentLabel = `<span class="text-[8px] font-black text-amber-500">REV</span>`;
      } else if (day >= 29) {
        intentClass = "accent-mock";
        intentLabel = `<span class="text-[8px] font-black text-purple-400">MOCK</span>`;
      }
      const taskDisplay = totalTasks > 0 ? `${totalTasks}T` : "0T";
      const pctDisplay = totalTasks > 0 ? `${pct}%` : "--%";
      const pctColor = totalTasks > 0 ? pct === 0 ? "text-red-400" : "text-emerald-400" : "text-slate-600";
      const html = `
                <div onclick="app.openTaskModal('${dateStr}')"
                     class="day-cell-base ${heatClass} ${intentClass}
                            ${isToday ? "ring-2 ring-primary z-10 scale-[1.02] shadow-glow" : ""}
                            rounded-xl h-24 md:h-28 p-3 flex flex-col justify-between
                            cursor-pointer group hover:border-white/20 transition-all">

                    <div class="flex justify-between items-start">
                        <span class="text-[10px] font-bold text-slate-500">${day}</span>
                        ${intentLabel}
                    </div>

                    <div class="flex flex-col gap-1">
                        <div class="flex gap-1 mb-1 items-center">
                            ${totalTasks > 0 ? tasksForDay.slice(0, 4).map(t => `<div class="w-1.5 h-1.5 rounded-full ${t.status === "done" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-gray-400"}"></div>`).join("") : '<div class="w-1 h-1 rounded-full bg-slate-800"></div>'}
                        </div>

                        <div class="flex justify-between items-end border-t border-white/5 pt-1">
                            <span class="text-[9px] font-bold text-slate-500 tracking-tight">${taskDisplay}</span>
                            <span class="text-[9px] font-mono font-bold ${pctColor}">${pctDisplay}</span>
                        </div>
                    </div>
                </div>`;
      grid.insertAdjacentHTML("beforeend", html);
    }
  },
  renderSubjects() {
    if (this.data.currentView !== "subjects") return;
    if (this.data.focusSubjectId) {
      document.getElementById("subjectsGridView").classList.add("hidden");
      document.getElementById("subjectFocusPanel").classList.remove("hidden");
      subjectOps.renderFocusList();
      return;
    }
    document.getElementById("subjectsGridView").classList.remove("hidden");
    document.getElementById("subjectFocusPanel").classList.add("hidden");
    const list = document.getElementById("subjectsList");
    list.innerHTML = "";
    const showArchived = document.getElementById("showArchivedSubjects")?.checked || false;
    const visibleSubjects = this.data.subjects.filter(s => showArchived ? true : !s.isArchived);
    if (visibleSubjects.length === 0) {
      list.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl text-gray-400">
                    <div class="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <i class="fas fa-layer-group text-2xl text-gray-300"></i>
                    </div>
                    <p class="font-medium">No active subjects.</p>
                    <p class="text-xs opacity-70 mt-1">Create one or check "Show Archived".</p>
                </div>`;
      return;
    }
    visibleSubjects.forEach(sub => {
      const topicCount = (sub.sub || []).length;
      const taskCount = this.data.tasks.filter(t => t.subject === sub.name).length;
      const opacity = sub.isArchived ? "opacity-60 grayscale" : "opacity-100";
      const badge = sub.isArchived ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-600">ARCHIVED</span>' : "";
      const html = `
                    <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group flex flex-col h-full ${opacity}">
                        <div class="p-5 flex justify-between items-start">
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100 truncate max-w-[180px]" title="${sub.name}">${escapeHTML(sub.name)}</h3>
                                    ${badge}
                                </div>
                                <div class="text-xs text-gray-500 font-medium">${topicCount} Topics • ${taskCount} Logs</div>
                            </div>
                        </div>
                        
                        <div class="px-5 pb-5 mt-auto flex gap-3">
                            <button onclick="window.subjActions.openFocus('${sub.id}')" class="flex-1 bg-gray-50 dark:bg-gray-700/50 hover:bg-primary hover:text-white dark:hover:bg-primary text-gray-600 dark:text-gray-300 text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 group/btn">
                                View Topics <i class="fas fa-arrow-right transform group-hover/btn:translate-x-1 transition-transform"></i>
                            </button>
                            ${!sub.isArchived ? `
                            <button onclick="window.subjActions.startSession('${sub.id}')" class="w-10 flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 rounded-xl transition-colors" title="Quick Start">
                                <i class="fas fa-play text-xs"></i>
                            </button>` : ""}
                            <button onclick="window.subjActions.toggleSubjectArchive('${sub.id}')" class="w-10 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:bg-gray-700/30 dark:hover:bg-gray-700 rounded-xl transition-colors" title="${sub.isArchived ? "Restore" : "Archive"}">
                                <i class="fas fa-${sub.isArchived ? "undo" : "archive"} text-xs"></i>
                            </button>
                        </div>
                    </div>
                `;
      list.insertAdjacentHTML("beforeend", html);
    });
  },

  jumpToSubjectManager() {
    const subSelect = document.getElementById("taskSubject");
    const selectedSubId = subSelect ? subSelect.value : null;

    this.closeTaskModal();
    this.navigate('subjects');

    if (selectedSubId) {
        setTimeout(() => {
            if (window.subjActions && window.subjActions.openFocus) {
                window.subjActions.openFocus(selectedSubId);
            }
        }, 300);
    }
},
  openSubjectModal() {
    document.getElementById("subjectModal").classList.remove("hidden");
  },
  saveSubject(e) {
    e.preventDefault();
    const name = document.getElementById("newSubjectName").value;
    this.data.subjects.push({
      id: generateUUID(),
      name: name,
      sub: []
    });
    this.saveData();
    this.closeModal("subjectModal");
    e.target.reset();
  },
  async removeSubSubject(subId, topicName) {
    const subject = this.data.subjects.find(s => s.id === subId);
    if (!subject) return;
    if (await subjectOps.checkActiveTimerConflict(subject.name, topicName)) return;
    if (await this.uiConfirm(`Archive "${topicName}"?\n\nIt will be hidden from new tasks, but history is preserved.`)) {
      subject.sub = subject.sub.filter(s => s !== topicName);
      if (!subject.archivedSub) subject.archivedSub = [];
      if (!subject.archivedSub.includes(topicName)) subject.archivedSub.push(topicName);
      this.saveData();
      this.render();
    }
  },
  async editTargetDate() {
    const newDate = await this.uiPrompt("Set Exam Target Date (YYYY-MM-DD):", this.data.targetDate);
    if (newDate) {
      this.data.targetDate = newDate;
      this.saveData();
    }
  },
  changeMonth(delta) {
    this.data.calendarMonth.setMonth(this.data.calendarMonth.getMonth() + delta);
    this.render();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  window.app.init();
});