import {
  uiAlert,
  uiConfirm,
  uiPrompt
} from "./dialogs.js";

const getApp = () => window.app;
const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));

export const subjectOps = {
  checkActiveTimerConflict: async (subjectName, topicName = null) => {
    const app = getApp();
    if (!app.data.activeTimer || app.data.activeTimer.startTime === null) return false;
    const currentTask = app.data.tasks.find(t => t.id === app.data.activeTimer.id);
    if (!currentTask) return false;
    const subMatch = currentTask.subject === subjectName;
    const topicMatch = topicName ? currentTask.subSubject === topicName : true;
    if (subMatch && topicMatch) {
      const context = topicName ? `topic "${topicName}"` : `subject "${subjectName}"`;
      await uiAlert(`⛔ ACTION BLOCKED\n\nA timer is currently running for ${context}.\n\nPlease stop the timer before making changes to ensure data consistency.`);
      return true;
    }
    return false;
  },
  openFocus: id => {
    const app = getApp();
    app.data.focusSubjectId = id;
    app.render();
  },
  closeFocus: () => {
    const app = getApp();
    app.data.focusSubjectId = null;
    app.render();
  },
  renderFocusList: () => {
    const app = getApp();
    const subId = app.data.focusSubjectId;
    if (!subId) return;
    const sub = app.data.subjects.find(s => s.id === subId);
    if (!sub) return subjectOps.closeFocus();
    const activeTopics = sub.sub || [];
    if (!sub.archivedSub) sub.archivedSub = [];
    const totalHistory = app.data.tasks.filter(t => t.subject === sub.name).length;
    document.getElementById("focusPanelTitle").innerText = sub.name;
    document.getElementById("focusPanelStats").innerText = `${activeTopics.length} Active • ${sub.archivedSub.length} Archived • ${totalHistory} Historical Tasks`;
    const searchInput = document.getElementById("topicSearch");
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const activeGrid = document.getElementById("activeTopicsGrid");
    if (!activeGrid) return;
    const showAll = activeGrid.dataset.showAll === "true" || searchTerm.length > 0;
    const LIMIT = 20;
    const filteredActive = activeTopics.filter(t => t.toLowerCase().includes(searchTerm));
    const filteredArchived = sub.archivedSub.filter(t => t.toLowerCase().includes(searchTerm));
    activeGrid.innerHTML = "";
    const displayList = showAll ? filteredActive : filteredActive.slice(0, LIMIT);
    displayList.forEach(topic => {
      const usageCount = app.data.tasks.filter(t => t.subject === sub.name && t.subSubject === topic).length;
      activeGrid.insertAdjacentHTML("beforeend", `
                <div class="flex justify-between items-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group hover:border-primary/50 transition-colors shadow-sm">
                    <div class="min-w-0 flex-1">
                        <div class="text-sm font-bold text-gray-800 dark:text-gray-200 truncate pr-2" title="${topic}">${escapeHTML(topic)}</div>
                        <div class="text-[10px] text-gray-400 font-mono">${usageCount} tasks</div>
                    </div>
                    <div class="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="window.subjActions.renameTopic('${topic}')" class="p-2 text-gray-400 hover:text-primary transition-colors bg-gray-50 dark:bg-gray-700 rounded-lg" title="Rename"><i class="fas fa-pencil-alt text-xs"></i></button>
                        <button onclick="window.subjActions.archiveTopic('${topic}')" class="p-2 text-gray-400 hover:text-amber-500 transition-colors bg-gray-50 dark:bg-gray-700 rounded-lg" title="Archive"><i class="fas fa-archive text-xs"></i></button>
                    </div>
                </div>
            `);
    });
    const btn = document.getElementById("showMoreTopicsBtn");
    if (filteredActive.length > LIMIT && !showAll) {
      btn.classList.remove("hidden");
      btn.innerText = `Show ${filteredActive.length - LIMIT} More`;
    } else {
      btn.classList.add("hidden");
    }
    document.getElementById("activeTopicCount").innerText = filteredActive.length;
    const archivedSection = document.getElementById("archivedTopicsSection");
    const archivedGrid = document.getElementById("archivedTopicsList");
    archivedGrid.innerHTML = "";
    if (filteredArchived.length > 0) {
      archivedSection.classList.remove("hidden");
      document.getElementById("archivedTopicCount").innerText = filteredArchived.length;
      filteredArchived.forEach(topic => {
        const usageCount = app.data.tasks.filter(t => t.subject === sub.name && t.subSubject === topic).length;
        archivedGrid.insertAdjacentHTML("beforeend", `
                    <div class="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg">
                        <div class="min-w-0">
                            <div class="text-xs font-medium text-gray-500 line-through truncate">${escapeHTML(topic)}</div>
                            <div class="text-[9px] text-gray-400">${usageCount} logs</div>
                        </div>
                        <button onclick="window.subjActions.restoreTopic('${topic}')" class="text-xs font-bold text-primary hover:underline px-2">Restore</button>
                    </div>
                `);
      });
    } else {
      archivedSection.classList.add("hidden");
    }
  },
  showAllTopics: () => {
    document.getElementById("activeTopicsGrid").dataset.showAll = "true";
    subjectOps.renderFocusList();
  },
  addTopic: async () => {
    const app = getApp();
    const input = document.getElementById("newTopicInput");
    const name = input.value.trim();
    if (!name) return;
    const sub = app.data.subjects.find(s => s.id === app.data.focusSubjectId);
    if (sub.sub.some(t => t.toLowerCase() === name.toLowerCase())) {
      await uiAlert("Topic already exists.");
      return;
    }
    if (sub.archivedSub && sub.archivedSub.some(t => t.toLowerCase() === name.toLowerCase())) {
      const archivedName = sub.archivedSub.find(t => t.toLowerCase() === name.toLowerCase());
      if (await uiConfirm(`"${archivedName}" is currently archived. Restore it?`)) {
        subjectOps.restoreTopic(archivedName);
        input.value = "";
        return;
      }
      return;
    }
    sub.sub.unshift(name);
    app.saveData();
    input.value = "";
    subjectOps.renderFocusList();
  },
  renameTopic: async oldName => {
    const app = getApp();
    const sub = app.data.subjects.find(s => s.id === app.data.focusSubjectId);
    if (await subjectOps.checkActiveTimerConflict(sub.name, oldName)) return;
    const affectedTasks = app.data.tasks.filter(t => t.subject === sub.name && t.subSubject === oldName);
    const newName = await uiPrompt("Rename Topic:", oldName);
    if (newName && newName.trim() !== "" && newName !== oldName) {
      const cleanName = newName.trim();
      if (sub.sub.includes(cleanName)) {
        await uiAlert("Topic name already exists.");
        return;
      }
      const idx = sub.sub.indexOf(oldName);
      if (idx !== -1) sub.sub[idx] = cleanName;
      if (affectedTasks.length > 0) {
        affectedTasks.forEach(t => t.subSubject = cleanName);
      }
      app.saveData();
      subjectOps.renderFocusList();
    }
  },
  archiveTopic: async name => {
    const app = getApp();
    const sub = app.data.subjects.find(s => s.id === app.data.focusSubjectId);
    if (await subjectOps.checkActiveTimerConflict(sub.name, name)) return;
    if (await uiConfirm(`Archive "${name}"? It will be hidden from new tasks.`)) {
      sub.sub = sub.sub.filter(t => t !== name);
      if (!sub.archivedSub) sub.archivedSub = [];
      sub.archivedSub.push(name);
      app.saveData();
      subjectOps.renderFocusList();
    }
  },
  restoreTopic: name => {
    const app = getApp();
    const sub = app.data.subjects.find(s => s.id === app.data.focusSubjectId);
    sub.archivedSub = sub.archivedSub.filter(t => t !== name);
    sub.sub.push(name);
    app.saveData();
    subjectOps.renderFocusList();
  },
  editCurrentSubjectName: async () => {
    const app = getApp();
    const sub = app.data.subjects.find(s => s.id === app.data.focusSubjectId);
    const oldName = sub.name;
    if (await subjectOps.checkActiveTimerConflict(oldName)) return;
    const newName = await uiPrompt("Rename Subject:", oldName);
    if (newName && newName.trim() !== "" && newName !== oldName) {
      const cleanName = newName.trim();
      const affectedTasks = app.data.tasks.filter(t => t.subject === oldName);
      if (affectedTasks.length > 0) {
        if (!await uiConfirm(`Rename "${oldName}" to "${cleanName}"?\n\nThis will update ${affectedTasks.length} tasks.`)) return;
      }
      sub.name = cleanName;
      affectedTasks.forEach(t => t.subject = cleanName);
      app.saveData();
      app.render();
      subjectOps.renderFocusList();
    }
  },
  toggleSubjectArchive: async id => {
    const app = getApp();
    const sub = app.data.subjects.find(s => s.id === id);
    if (!sub.isArchived) {
      if (await subjectOps.checkActiveTimerConflict(sub.name)) return;
    }
    const msg = sub.isArchived ? `Restore "${sub.name}"?` : `Archive "${sub.name}"?\n\nTasks are preserved, but subject is hidden from dashboard.`;
    if (await uiConfirm(msg)) {
      sub.isArchived = !sub.isArchived;
      app.saveData();
      app.renderSubjects();
    }
  },
  startSession: subId => {
    const app = getApp();
    app.openTaskModal();
    setTimeout(() => {
      const select = document.getElementById("taskSubject");
      if (select) {
        select.value = subId;
        select.dispatchEvent(new Event("change"));
      }
    }, 50);
  }
};