import {
  validateData
} from "./storage.js";

import {
  uiAlert,
  uiConfirm
} from "./dialogs.js";

const getApp = () => window.app;

export const systemOps = {
  checkBackupStatus: () => {
    const app = getApp();
    const dot = document.getElementById("backupWarningDot");
    const last = app.data.lastBackup ? new Date(app.data.lastBackup) : null;
    const now = new Date();
    const diffDays = last ? (now - last) / (1e3 * 60 * 60 * 24) : 999;
    if (dot) {
      if (diffDays > 7) dot.classList.remove("hidden"); else dot.classList.add("hidden");
    }
    const panel = document.getElementById("backupHealthPanel");
    const title = document.getElementById("backupStatusTitle");
    const text = document.getElementById("backupStatusText");
    const icon = document.getElementById("backupStatusIcon");
    if (!panel || !title) return;
    panel.className = "p-4 rounded-xl border transition-all duration-300 mb-4 shadow-sm";
    icon.className = "fas text-xl";
    if (!last) {
      panel.classList.add("bg-gray-50", "border-gray-200", "dark:bg-gray-700/30", "dark:border-gray-600");
      title.innerText = "No Backup Found";
      title.className = "font-bold text-sm text-gray-600 dark:text-gray-300";
      text.innerText = "Export data to start protection.";
      icon.classList.add("fa-exclamation-circle", "text-gray-400");
    } else if (diffDays > 7) {
      panel.classList.add("bg-amber-50", "border-amber-200", "dark:bg-amber-900/20", "dark:border-amber-800");
      title.innerText = "Backup Overdue";
      title.className = "font-bold text-sm text-amber-700 dark:text-amber-500";
      text.innerText = `Last saved ${Math.floor(diffDays)} days ago.`;
      icon.classList.add("fa-exclamation-triangle", "text-amber-500");
    } else {
      panel.classList.add("bg-emerald-50", "border-emerald-200", "dark:bg-emerald-900/20", "dark:border-emerald-800");
      title.innerText = "System Healthy";
      title.className = "font-bold text-sm text-emerald-700 dark:text-emerald-500";
      const dateStr = last.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      text.innerText = `Last saved: ${dateStr}`;
      icon.classList.add("fa-check-circle", "text-emerald-500");
    }
  },
  exportData: () => {
    const app = getApp();
    app.data.lastBackup = new Date().toISOString();
    app.saveData();
    systemOps.checkBackupStatus();
    const exportObj = {
      schema: 3.2,
      ...app.data,
      activeTimer: null,
      timerInterval: null
    };
    const dataStr = JSON.stringify(exportObj);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", "prepmaster_backup.json");
    linkElement.click();
  },
  importData: input => {
    const app = getApp();
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const parsed = JSON.parse(e.target.result);
        const validation = validateData(parsed);
        if (!validation.ok) {
          await uiAlert(`⛔ Import Blocked\n\n${validation.error}\n\nNo changes were made.`);
          input.value = "";
          return;
        }
        const userConfirmed = await systemOps.showImportPreview(parsed);
        if (!userConfirmed) {
          input.value = "";
          return;
        }
        try {
          const safetyBackup = JSON.stringify(app.data);
          localStorage.setItem("prepMaster_safety_restore", safetyBackup);
        } catch (err) {
          await uiAlert("Warning: Could not create safety backup. Import aborted.");
          return;
        }
        if (app.data.timerInterval) clearInterval(app.data.timerInterval);
        app.data.activeTimer = null;
        app.data.timerInterval = null;
        localStorage.removeItem("prepMasterTimer");
        app.data.tasks = parsed.tasks;
        app.data.subjects = parsed.subjects;
        app.data.targetDate = parsed.targetDate || app.data.targetDate;
        app.data.lastBackup = new Date().toISOString();
        app.saveData({
          render: false
        });
        app.scheduleRender();
        if (typeof app.closeModal === "function") app.closeModal("settingsModal"); else document.getElementById("settingsModal").classList.add("hidden");
        await uiAlert("Import successful!");
      } catch (err) {
        console.error(err);
        await uiAlert("CRITICAL ERROR: File is not valid JSON.");
      }
    };
    reader.readAsText(file);
    input.value = "";
  },
  restoreSafetyBackup: async () => {
    const app = getApp();
    const raw = localStorage.getItem("prepMaster_safety_restore");
    if (!raw) {
      await uiAlert("No safety backup found on this device.");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const validation = validateData(parsed);
      if (!validation.ok) {
        await uiAlert(`Cannot restore: Backup is corrupt.\n${validation.error}`);
        return;
      }
      if (await uiConfirm("⚠️ RESTORE BACKUP\n\nThis will overwrite your current data with the last safety backup created during import.\n\nContinue?")) {
        if (app.data.timerInterval) clearInterval(app.data.timerInterval);
        app.data.activeTimer = null;
        app.data.timerInterval = null;
        localStorage.removeItem("prepMasterTimer");
        app.data.tasks = parsed.tasks;
        app.data.subjects = parsed.subjects;
        app.data.targetDate = parsed.targetDate;
        app.data.lastBackup = parsed.lastBackup;
        app.saveData({
          render: false
        });
        app.scheduleRender();
        if (typeof app.closeModal === "function") app.closeModal("settingsModal"); else document.getElementById("settingsModal").classList.add("hidden");
        await uiAlert("Safety backup restored successfully.");
      }
    } catch (e) {
      await uiAlert("Error reading backup file.");
    }
  },
  showImportPreview: data => {
    return new Promise(resolve => {
      const taskCount = data.tasks ? data.tasks.length : 0;
      const subCount = data.subjects ? data.subjects.length : 0;
      let dateRange = "No tasks";
      if (taskCount > 0) {
        const timestamps = data.tasks.map(t => new Date(t.date).getTime()).filter(ts => !isNaN(ts));
        if (timestamps.length > 0) {
          const minDate = new Date(Math.min(...timestamps));
          const maxDate = new Date(Math.max(...timestamps));
          const opts = {
            month: "short",
            day: "numeric",
            year: "2-digit"
          };
          const start = minDate.toLocaleDateString("en-US", opts);
          const end = maxDate.toLocaleDateString("en-US", opts);
          dateRange = start === end ? start : `${start} - ${end}`;
        }
      }
      document.getElementById("previewTaskCount").innerText = taskCount;
      document.getElementById("previewSubCount").innerText = subCount;
      document.getElementById("previewDateRange").innerText = dateRange;
      const modal = document.getElementById("importPreviewModal");
      modal.classList.remove("hidden");
      const cleanup = () => {
        modal.classList.add("hidden");
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
      };
      const cancelBtn = document.getElementById("btnPreviewCancel");
      const confirmBtn = document.getElementById("btnPreviewConfirm");
      cancelBtn.onclick = () => {
        cleanup();
        resolve(false);
      };
      confirmBtn.onclick = () => {
        cleanup();
        resolve(true);
      };
    });
  }
};