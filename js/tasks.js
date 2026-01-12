import {
  generateUUID,
  formatDate
} from "./utils.js";

import {
  uiConfirm,
  uiAlert,
  uiPrompt
} from "./dialogs.js";

import {
  timerOps
} from "./timer.js";

const getApp = () => window.app;

const escapeHTML = (str) => {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
};
// --------------------------------------------------------

export const taskOps = {
  createCardHTML: (t, isDone) => {
    const app = getApp();
    let duration = t.duration || 1;
    let actual = t.actualTime || 0;
    if (app.data.activeTimer && app.data.activeTimer.id === t.id) {
      actual = Math.floor(timerOps.getElapsedMS() / 6e4);
    }
    let pct = actual / duration * 100;
    let isOvertime = pct > 100;
    let displayWidth = Math.min(pct, 100);
    
    let progressOverlayClass = "bg-indigo-500/15";
    let borderClass = "border-white/10";

    if (actual > t.duration) {
      progressOverlayClass = "bg-orange-400/25";   
      borderClass = "border-orange-600/60";        
    } else if (pct >= 70) {
      progressOverlayClass = "bg-emerald-500/20";
    } else if (pct >= 30) {
      progressOverlayClass = "bg-indigo-500/20";
    }

    // SECURITY APPLIED BELOW: Used escapeHTML() on all user inputs
    return `
    <div id="task-card-${t.id}"
         class="group relative overflow-hidden rounded-xl
                border ${borderClass}
                bg-slate-800/70
                p-3 mb-3">

      <div class="absolute inset-y-0 left-0
                  ${progressOverlayClass}
                  transition-all duration-700 ease-linear
                  pointer-events-none"
           style="width:${displayWidth}%">
      </div>

      <div class="relative z-10 space-y-2">

        <div class="flex items-start gap-2">
          <span class="mt-1 w-2 h-2 rounded-full shrink-0
            ${isDone ? "bg-emerald-500" : "bg-gray-400"}"></span>

          <h3 class="text-[15px] font-semibold leading-snug text-white
                 ${isDone ? "line-through opacity-50" : ""}">
            ${escapeHTML(t.subSubject)}
          </h3>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <span class="px-2 py-0.5 text-[12px] font-medium rounded
                   bg-indigo-500/20 text-indigo-300">
            ${escapeHTML(t.subject)}
          </span>

          <span class="text-[12px] font-mono text-gray-300">
            ${Math.round(actual)}/${t.duration}m
          </span>
        </div>

        ${t.desc ? `
          <p class="text-[12px] text-gray-400 leading-snug">
            ${escapeHTML(t.desc)}
          </p>` : ""}

        ${!isDone ? `
        <div class="mt-3 flex items-center gap-2">
          <button onclick="app.startTimer('${t.id}')"
                  class="flex-1 h-11 rounded-lg bg-primary
                         text-white font-semibold">
            Start
          </button>

          <button onclick="app.manualComplete('${t.id}')"
                  class="w-11 h-11 rounded-lg bg-white/10">
            ✓
          </button>

          <button onclick="app.editTask('${t.id}')"
                  class="w-11 h-11 rounded-lg bg-white/10">
            ✎
          </button>

          <button onclick="app.deleteTask('${t.id}')"
                  class="w-11 h-11 rounded-lg bg-white/10">
            🗑
          </button>
        </div>
        ` : `
        <div class="mt-3">
          <button onclick="app.deleteTask('${t.id}')"
                  class="w-full h-11 rounded-lg
                         bg-white/10 text-gray-300
                         hover:bg-red-500/20 hover:text-red-400 transition">
            Delete
          </button>
        </div>
        `}
      </div>
    </div>`;
  },
  manualComplete: (id, defaultTime = null) => {
    const app = getApp();
    app.data.completingTaskId = id;
    const task = app.data.tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById("actualTimeInput").value = defaultTime || task.actualTime || task.duration;
    document.getElementById("completeModal").classList.remove("hidden");
  },
  getRecallQuality: () => {
    return new Promise(resolve => {
      const container = document.getElementById("uiDialogContainer");
      const title = document.getElementById("uiDialogTitle");
      const msg = document.getElementById("uiDialogMessage");
      const buttons = document.getElementById("uiDialogButtons");
      const input = document.getElementById("uiDialogInput");
      title.innerText = "Recall Check";
      msg.innerText = "How well did you remember this topic?";
      input.classList.add("hidden");
      buttons.innerHTML = "";
      container.classList.remove("hidden");
      const options = [ {
        id: "again",
        label: "Again",
        cls: "bg-red-100 text-red-700 hover:bg-red-200"
      }, {
        id: "hard",
        label: "Hard",
        cls: "bg-orange-100 text-orange-700 hover:bg-orange-200"
      }, {
        id: "good",
        label: "Good",
        cls: "bg-blue-100 text-blue-700 hover:bg-blue-200"
      }, {
        id: "easy",
        label: "Easy",
        cls: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
      } ];
      const finish = result => {
        container.classList.add("hidden");
        document.removeEventListener("keydown", escHandler);
        resolve(result);
      };
      const escHandler = e => {
        if (e.key === "Escape") finish("good");
      };
      document.addEventListener("keydown", escHandler);
      options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = `flex-1 py-3 px-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors ${opt.cls}`;
        btn.innerText = opt.label;
        btn.onclick = () => finish(opt.id);
        buttons.appendChild(btn);
      });
    });
  },
  confirmCompletion: async type => {
    const app = getApp();
    const id = app.data.completingTaskId;
    const task = app.data.tasks.find(t => t.id === id);
    if (task) {
      task.actualTime = parseInt(document.getElementById("actualTimeInput").value) || 0;
      task.focusScore = document.getElementById("focusScore").value;
      task.status = type;
      task.completedAt = new Date().toISOString();
      if (type === "done") {
        if (task.isRevision) {
          const quality = await taskOps.getRecallQuality();
          const intervals = {
            again: 1,
            hard: 3,
            good: 7,
            easy: 25
          };
          const daysToAdd = intervals[quality] || 7;
          task.lastRecallQuality = quality;
          task.lastReviewedAt = formatDate(new Date());
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + daysToAdd);
          task.nextReviewDate = formatDate(nextDate);
          if (quality === "again") {
            task.reviewStage = 1;
          } else {
            const currentStage = task.reviewStage || 0;
            task.reviewStage = currentStage < 3 ? currentStage + 1 : 3;
          }
        } else {
          const currentStage = task.reviewStage || 0;
          const nextStage = currentStage < 3 ? currentStage + 1 : 3;
          const intervals = {
            1: 1,
            2: 7,
            3: 30
          };
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + intervals[nextStage]);
          task.nextReviewDate = formatDate(nextDate);
          task.reviewStage = nextStage;
        }
      }
      app.saveData();
    }
    document.getElementById("completeModal").classList.add("hidden");
    app.data.completingTaskId = null;
  },
  openTaskModal: (date = null, editId = null) => {
    const app = getApp();
    document.getElementById("taskModal").classList.remove("hidden");
    const selectedDate = date || formatDate(new Date());
    document.getElementById("taskDate").value = selectedDate;
    const dateObj = new Date(selectedDate);
    const prettyDate = dateObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
    document.getElementById("taskModalTitle").innerText = "Schedule: " + prettyDate;
    const subSelect = document.getElementById("taskSubject");
    subSelect.innerHTML = '<option value="">Select Subject</option>';
    app.data.subjects.forEach(s => {
      subSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });
    taskOps.renderDayManagerList(selectedDate);
    const dayNum = dateObj.getDate();
    const revisionSection = document.getElementById("smartRevisionSection");
    if ([ 7, 14, 21, 28 ].includes(dayNum)) {
      revisionSection.classList.remove("hidden");
    } else {
      revisionSection.classList.add("hidden");
    }
    if (editId) {
      taskOps.populateEditForm(editId);
    } else {
      taskOps.resetForm();
    }
    taskOps.toggleMobileTaskView('list');
  },
  closeTaskModal: () => {
    document.getElementById("taskModal").classList.add("hidden");
  },
  renderDayManagerList: dateStr => {
    const app = getApp();
    const list = document.getElementById("dayManagerList");
    list.innerHTML = "";
    const tasks = app.data.tasks.filter(t => t.date === dateStr);
    const editId = document.getElementById("taskEditId").value;
    const isEditMode = !!editId;
    const totalMinutes = tasks.reduce((acc, t) => acc + (t.duration || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const bar = document.getElementById("dailyLoadBar");
    const warningText = document.getElementById("dailyLoadWarning");
    const loadText = document.getElementById("dailyLoadText");
    loadText.innerText = `${totalHours}h`;
    let percentage = Math.min(totalMinutes / 600 * 100, 100);
    bar.style.width = `${percentage}%`;
    bar.className = "h-1.5 rounded-full transition-all duration-500 ";
    warningText.classList.add("hidden");
    if (totalMinutes > 480) {
      bar.classList.add("bg-red-500");
      warningText.classList.remove("hidden");
    } else if (totalMinutes > 360) {
      bar.classList.add("bg-amber-400");
    } else {
      bar.classList.add("bg-secondary");
    }
    if (tasks.length === 0) {
      list.innerHTML = `<div class="text-xs text-gray-400 italic text-center py-8 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">No tasks planned yet.</div>`;
      return;
    }
    tasks.forEach(task => {
      const isEditing = task.id === editId;
      let statusColor = "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
      if (task.status === "done") statusColor = "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400";
      if (task.status === "partial") statusColor = "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
      const opacityClass = isEditMode && !isEditing ? "opacity-40 grayscale-[0.5]" : "opacity-100";
      const activeClass = isEditing ? "ring-2 ring-primary ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-900 bg-white dark:bg-gray-800 z-10 scale-[1.01] shadow-lg" : "bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600";
      list.insertAdjacentHTML("beforeend", `
                    <div class="flex justify-between items-center p-3 rounded-xl transition-all duration-200 ${activeClass} ${opacityClass}">
                        <div class="flex-1 min-w-0 mr-3">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="text-[9px] font-bold uppercase ${statusColor} px-1.5 py-0.5 rounded tracking-wide">${task.status}</span>
                                <span class="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">${escapeHTML(task.subject)}</span>
                            </div>
                            <div class="text-xs text-gray-500 font-medium truncate">${escapeHTML(task.subSubject)}</div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-400 font-mono bg-white/50 dark:bg-gray-800/50 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">${task.duration}m</span>
                            <div class="flex gap-1">
                                <button onclick="app.populateEditForm('${task.id}'); app.renderDayManagerList('${dateStr}');" class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-primary hover:bg-white dark:hover:bg-gray-600 transition-all"><i class="fas fa-pencil-alt text-xs"></i></button>
                                <button onclick="app.deleteTask('${task.id}')" class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-gray-600 transition-all"><i class="fas fa-trash-alt text-xs"></i></button>
                            </div>
                        </div>
                    </div>
                `);
    });
  },
  editTask: id => {
    const app = getApp();
    const task = app.data.tasks.find(t => t.id === id);
    if (!task) return;
    const dateToUse = task.date || formatDate(new Date());
    taskOps.openTaskModal(dateToUse, id);
  },
populateEditForm: id => {
    const app = getApp();
    const task = app.data.tasks.find(t => t.id === id);
    if (!task) return;
    
    document.getElementById("taskEditId").value = task.id;
    document.getElementById("formModeTitle").innerHTML = '<span class="w-2 h-2 rounded-full bg-accent animate-pulse"></span> Edit Mode';
    document.getElementById("cancelEditBtn").classList.remove("hidden");
    
    const saveBtn = document.getElementById("saveTaskBtn");
    saveBtn.innerText = "Update Task";
    saveBtn.classList.add("bg-gray-800", "hover:bg-black");
    
    // Set Subject
    const subObj = app.data.subjects.find(s => s.name === task.subject);
    const subSelect = document.getElementById("taskSubject");
    if (subObj) subSelect.value = subObj.id;
    
    // Update list to populate the Topic Select
    taskOps.updateSubSubjects(); 

    // Set Topic Value (Must happen AFTER updateSubSubjects populates the options)
    const topicSelect = document.getElementById("taskSubSubject");
    if (topicSelect) {
        // Check if the task's topic still exists in the subject list
        const topicExists = Array.from(topicSelect.options).some(opt => opt.value === task.subSubject);
        
        if (!topicExists) {
            // Edge Case: Logic for legacy tasks where the topic was deleted from Subject list
            // We create a temporary option so the UI doesn't break
            const tempOpt = document.createElement("option");
            tempOpt.value = task.subSubject;
            tempOpt.text = task.subSubject + " (Archived)";
            topicSelect.appendChild(tempOpt);
        }
        topicSelect.value = task.subSubject;
    }

    document.getElementById("taskDuration").value = task.duration;
    document.getElementById("taskDesc").value = task.desc || "";
    
    taskOps.toggleMobileTaskView('form');
},

resetForm: () => {
    document.getElementById("taskEditId").value = "";
    document.getElementById("formModeTitle").innerHTML = '<span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Plan New Task';
    document.getElementById("cancelEditBtn").classList.add("hidden");
    document.getElementById("saveTaskBtn").innerText = "Add to Schedule";
    document.getElementById("saveTaskBtn").classList.remove("bg-gray-800", "hover:bg-black");
    document.getElementById("taskSubject").value = "";
    document.getElementById("taskSubSubject").value = "";
    document.getElementById("taskDuration").value = "";
    document.getElementById("taskDesc").value = "";
    
    taskOps.updateSubSubjects();
  },

updateSubSubjects: () => {
    const app = getApp();
    const subId = document.getElementById("taskSubject").value;
    const topicSelect = document.getElementById("taskSubSubject");
    
    // 1. Clear existing options
    topicSelect.innerHTML = "";

    // 2. Handle Empty State
    if (!subId) {
        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.text = "Select Subject First";
        topicSelect.appendChild(defaultOpt);
        topicSelect.disabled = true;
        return;
    }

    // 3. Find Subject Data
    const subject = app.data.subjects.find(s => s.id == subId);
    
    // 4. Populate Topics
    if (subject && subject.sub && subject.sub.length > 0) {
        topicSelect.disabled = false;
        
        // Add Placeholder
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.text = "Select a Topic...";
        topicSelect.appendChild(placeholder);

        // Sort and Add Topics
        const sortedTopics = [...subject.sub].sort((a, b) => a.localeCompare(b));
        
        sortedTopics.forEach(topic => {
            const option = document.createElement("option");
            option.value = topic;
            option.text = topic;
            topicSelect.appendChild(option);
        });
    } else {
        // Handle case where Subject has no topics defined
        const noData = document.createElement("option");
        noData.value = "";
        noData.text = "(No topics defined - Go to Subjects tab)";
        topicSelect.appendChild(noData);
        topicSelect.disabled = true; 
    }
},
  saveTask: e => {
    e.preventDefault();
    const app = getApp();
    const subId = document.getElementById("taskSubject").value;
    if (!subId) return;
    const subjectName = app.data.subjects.find(s => s.id == subId).name;
    const editId = document.getElementById("taskEditId").value;
    const dateStr = document.getElementById("taskDate").value;
    if (editId) {
      const task = app.data.tasks.find(t => t.id == editId);
      task.subject = subjectName;
      task.subSubject = document.getElementById("taskSubSubject").value;
      task.duration = parseInt(document.getElementById("taskDuration").value);
      task.desc = document.getElementById("taskDesc").value;
      task.date = dateStr;
    } else {
      const task = {
        id: generateUUID(),
        subject: subjectName,
        subSubject: document.getElementById("taskSubSubject").value,
        duration: parseInt(document.getElementById("taskDuration").value),
        desc: document.getElementById("taskDesc").value,
        date: dateStr,
        status: "pending",
        actualTime: 0
      };
      app.data.tasks.push(task);
    }
    app.saveData();
    taskOps.resetForm();
    taskOps.renderDayManagerList(dateStr);
    taskOps.toggleMobileTaskView('list');
  },
  deleteTask: async id => {
    const app = getApp();
    if (app.data.activeTimer && app.data.activeTimer.id === id) {
      const task = app.data.tasks.find(t => t.id === id);
      const msg = `⚠️ SESSION IN PROGRESS\n\nYou are currently studying "${task.subSubject}".\n\nStop the timer and delete this task?`;
      if (await uiConfirm(msg)) {
        timerOps.stopTimer(true);
      } else {
        return;
      }
    } else {
      if (!await uiConfirm("Delete this task?")) return;
    }
    app.data.tasks = app.data.tasks.filter(t => t.id !== id);
    app.saveData();
    const modalDate = document.getElementById("taskDate")?.value;
    const modal = document.getElementById("taskModal");
    if (modal && !modal.classList.contains("hidden")) {
      taskOps.renderDayManagerList(modalDate);
      taskOps.resetForm();
    }
  },
  quickSchedule: (type, payload) => {
    const app = getApp();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = formatDate(tomorrow);
    if (type === "revision") {
      app.data.tasks.push({
        id: generateUUID(),
        subject: payload || "General",
        subSubject: "Quick Revision (Analytics)",
        duration: 20,
        desc: "Scheduled from Analytics insight",
        date: dateStr,
        status: "pending",
        actualTime: 0
      });
    } else if (type === "break") {
      app.data.tasks.push({
        id: generateUUID(),
        subject: "Break",
        subSubject: "Mental Reset",
        duration: 30,
        desc: "Buffer time to recover focus",
        date: dateStr,
        status: "pending",
        actualTime: 0
      });
    }
    app.saveData();
    uiAlert(`✅ Added to tomorrow's schedule.`);
  },
  prepSafeAction: (type, subject, topic) => {
    const app = getApp();
    taskOps.openTaskModal();
    setTimeout(() => {
      const subSelect = document.getElementById("taskSubject");
      const topicInput = document.getElementById("taskSubSubject");
      const descInput = document.getElementById("taskDesc");
      const subObj = app.data.subjects.find(s => s.name === subject);
      if (subObj) {
        subSelect.value = subObj.id;
        subSelect.dispatchEvent(new Event("change"));
      }
      if (type === "revision") {
        topicInput.value = topic;
        descInput.value = "Scheduled Revision";
      } else if (type === "split") {
        topicInput.value = `${topic} (Part 2)`;
        descInput.value = "Continued session";
      }
    }, 50);
  },
  loadRevisionTopics: async () => {
    const app = getApp();
    const dateInput = document.getElementById("taskDate");
    const targetDateStr = dateInput ? dateInput.value : formatDate(new Date());
    const latestMap = new Map();
    app.data.tasks.forEach(t => {
      if (t.status === "done") {
        const cleanSub = t.subSubject.replace(/^Review:\s*/, "");
        const key = `${t.subject}|${cleanSub}`;
        if (!latestMap.has(key)) {
          latestMap.set(key, t);
        } else {
          const existing = latestMap.get(key);
          if (t.date > existing.date || t.date === existing.date && t.id > existing.id) {
            latestMap.set(key, t);
          }
        }
      }
    });
    const dueTasks = [];
    latestMap.forEach(task => {
      if (task.nextReviewDate && task.nextReviewDate <= targetDateStr) {
        dueTasks.push(task);
      }
    });
    if (dueTasks.length === 0) {
      await uiAlert("No reviews are currently due.");
      return;
    }
    let addedCount = 0;
    dueTasks.forEach(source => {
      const cleanName = source.subSubject.replace(/^Review:\s*/, "");
      const newSubSubject = `Review: ${cleanName}`;
      const alreadyExists = app.data.tasks.some(t => t.date === targetDateStr && t.subject === source.subject && t.subSubject === newSubSubject && t.isRevision === true);
      if (!alreadyExists) {
        app.data.tasks.push({
          id: generateUUID(),
          subject: source.subject,
          subSubject: newSubSubject,
          duration: 20,
          desc: `SRS Stage ${source.reviewStage || 1} (Due: ${source.nextReviewDate})`,
          date: targetDateStr,
          status: "pending",
          actualTime: 0,
          reviewStage: source.reviewStage,
          isRevision: true,
          reviewOf: source.id
        });
        addedCount++;
      }
    });
    app.saveData();
    if (dateInput) {
      taskOps.renderDayManagerList(targetDateStr);
    }
    if (addedCount > 0) {
      await uiAlert(`Added ${addedCount} smart reviews to your schedule.`);
    } else {
      await uiAlert("All due reviews are already in today's schedule.");
    }
  },
  checkBacklog: () => {
    const app = getApp();
    const today = formatDate(new Date());
    let changed = false;
    app.data.tasks.forEach(t => {
      if (t.date < today && t.status !== "done" && t.status !== "backlog") {
        t.status = "backlog";
        changed = true;
      }
    });
    if (changed) app.saveData();
  },
  openBacklogModal: () => {
    const app = getApp();
    const list = document.getElementById("backlogModalList");
    const backlogTasks = app.data.tasks.filter(t => t.status === "backlog");
    document.getElementById("backlogModal").classList.remove("hidden");
    list.innerHTML = "";
    if (backlogTasks.length === 0) {
      list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-gray-400">
                    <i class="fas fa-check-circle text-4xl mb-3 text-emerald-100 dark:text-emerald-900"></i>
                    <p class="font-medium text-sm">Backlog Zero!</p>
                    <p class="text-xs opacity-70">You're all caught up.</p>
                </div>`;
      return;
    }
    backlogTasks.forEach(task => {
      list.insertAdjacentHTML("beforeend", `
                <div class="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center group hover:border-primary/30 transition-colors shadow-sm">
                    <div class="min-w-0 pr-3">
                        <div class="text-[10px] font-bold uppercase text-gray-400 mb-0.5 tracking-wider">${escapeHTML(task.subject)}</div>
                        <div class="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">${escapeHTML(task.subSubject)}</div>
                        <div class="text-[10px] text-red-400 mt-0.5">Missed: ${task.date}</div>
                    </div>
                    <button onclick="app.assignToToday('${task.id}'); app.openBacklogModal();" class="shrink-0 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition-all">
                        Do Today
                    </button>
                </div>
            `);
    });
  },
  renderBacklog: () => {
    const app = getApp();
    const backlogTasks = app.data.tasks.filter(t => t.status === "backlog");
    const count = backlogTasks.length;
    const countEl = document.getElementById("backlogCount");
    if (countEl) {
      countEl.textContent = count;
      countEl.classList.toggle("hidden", count === 0);
    }
    const miniBadge = document.getElementById("dashMiniBacklogCount");
    if (miniBadge) {
      miniBadge.textContent = count > 0 ? count : "";
      miniBadge.classList.toggle("hidden", count === 0);
    }
    const sidebarList = document.getElementById("sidebarBacklogList");
    sidebarList.innerHTML = "";
    if (count === 0) sidebarList.innerHTML = `<p class="text-gray-400 italic text-[10px] text-center py-2">No backlog.</p>`;
    backlogTasks.forEach(task => {
      sidebarList.insertAdjacentHTML("beforeend", `
                <div class="group flex justify-between items-center py-2 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors cursor-default">
                    <div class="truncate w-24 text-gray-600 dark:text-gray-400 text-xs" title="${escapeHTML(task.subSubject)}">${escapeHTML(task.subSubject)}</div>
                     <button onclick="app.assignToToday('${task.id}')" class="text-primary hover:text-primary-700 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">MOVE</button>
                </div>
            `);
    });
  },
  assignToToday: id => {
    const app = getApp();
    const task = app.data.tasks.find(t => t.id === id);
    task.date = formatDate(new Date());
    task.status = task.actualTime > 0 ? "partial" : "pending";
    app.saveData();
  },
  toggleMobileTaskView: (view) => {
    const isMobile = window.innerWidth < 768; 
    if (!isMobile) return; 

    const listPane = document.getElementById("tmListPane");
    const formPane = document.getElementById("tmFormPane");
    const backBtn = document.getElementById("tmMobileBackBtn");
    const title = document.getElementById("taskModalTitle");
    const dateInput = document.getElementById("taskDate");

    if (view === 'form') {
        listPane.classList.add('hidden');
        listPane.classList.remove('flex');
        formPane.classList.remove('hidden');
        formPane.classList.add('flex');
        
        backBtn.classList.remove('hidden');
        backBtn.classList.add('flex');
        
        const isEdit = document.getElementById("taskEditId").value;
        title.innerText = isEdit ? "Edit Task" : "New Task";
    } else {
        formPane.classList.add('hidden');
        formPane.classList.remove('flex');
        listPane.classList.remove('hidden');
        listPane.classList.add('flex');
        
        backBtn.classList.add('hidden');
        backBtn.classList.remove('flex');
        
        const dateObj = new Date(dateInput.value);
        const prettyDate = dateObj.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
        title.innerText = "Schedule: " + prettyDate;
    }
  },

};