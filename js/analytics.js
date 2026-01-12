const getApp = () => window.app;

const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));

export const analyticsOps = {
  setAnalyticsRange: days => {
    const app = getApp();
    app.data.analyticsRange = days;
    document.querySelectorAll(".analytics-toggle").forEach(btn => {
      btn.classList.remove("bg-indigo-50", "text-primary", "dark:bg-gray-700", "dark:text-white", "shadow-sm");
      btn.classList.add("text-gray-500", "hover:text-primary");
    });
    const activeBtn = document.getElementById(`btnRange${days}`);
    if (activeBtn) {
      activeBtn.classList.remove("text-gray-500", "hover:text-primary");
      activeBtn.classList.add("bg-indigo-50", "text-primary", "dark:bg-gray-700", "dark:text-white", "shadow-sm");
    }
    analyticsOps.renderAnalytics();
  },
  getBestTimeBlock: tasks => {
    const validTasks = tasks.filter(t => t.completedAt && t.focusScore);
    if (validTasks.length < 5) return null;
    const buckets = {};
    validTasks.forEach(t => {
      const hour = new Date(t.completedAt).getHours();
      if (!buckets[hour]) buckets[hour] = [];
      buckets[hour].push(parseInt(t.focusScore));
    });
    let bestHour = -1;
    let maxAvg = 0;
    Object.keys(buckets).forEach(h => {
      const avg = buckets[h].reduce((a, b) => a + b, 0) / buckets[h].length;
      if (avg > maxAvg) {
        maxAvg = avg;
        bestHour = parseInt(h);
      }
    });
    if (bestHour === -1) return null;
    const ampm = bestHour >= 12 ? "PM" : "AM";
    const hour12 = bestHour % 12 || 12;
    return `${hour12}-${hour12 + 1} ${ampm}`;
  },
  renderAnalytics: () => {
    const app = getApp();
    if (app.data.currentView !== "analytics") return;
    if (!app.data.tasks) return;
    const range = app.data.analyticsRange || 7;
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - (range - 1));
    cutoffDate.setHours(0, 0, 0, 0);
    const relevantTasks = app.data.tasks.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= cutoffDate && tDate <= now;
    });
    const completedOrPartial = relevantTasks.filter(t => t.actualTime > 0);
    const totalMins = completedOrPartial.reduce((acc, t) => acc + (t.actualTime || 0), 0);
    if (totalMins === 0) {
      document.getElementById("analyticsSubjectBars").innerHTML = `<div class="text-center py-12 text-gray-400">
                <i class="fas fa-chart-area text-4xl mb-3 opacity-20"></i>
                <p class="font-medium">Not enough data yet.</p>
                <p class="text-xs mt-1">Complete a few tasks to unlock insights.</p>
             </div>`;
      document.getElementById("analyticsTotalHours").innerText = "0h";
      document.getElementById("analyticsAvgFocus").innerText = "-";
      document.getElementById("analyticsCompletion").innerText = "-";
      document.getElementById("analyticsConsistency").classList.add("hidden");
      document.getElementById("analyticsReflection").classList.add("hidden");
      document.getElementById("cardStrongSubject").classList.add("hidden");
      document.getElementById("cardWeakSubject").classList.add("hidden");
      analyticsOps.generateInsights(0, 0, 0, range);
      return;
    }
    const totalEl = document.getElementById("analyticsTotalHours");
    if (totalEl) totalEl.innerText = `${(totalMins / 60).toFixed(1)}h`;
    const ratedTasks = relevantTasks.filter(t => t.focusScore);
    const avgFocus = ratedTasks.length ? (ratedTasks.reduce((acc, t) => acc + parseInt(t.focusScore), 0) / ratedTasks.length).toFixed(1) : "0.0";
    document.getElementById("analyticsAvgFocus").innerText = avgFocus;
    const completed = relevantTasks.filter(t => t.status === "done");
    const denominator = relevantTasks.length;
    const rate = denominator ? Math.round(completed.length / denominator * 100) : 0;
    document.getElementById("analyticsCompletion").innerText = `${rate}%`;
    const consistencyEl = document.getElementById("analyticsConsistency");
    consistencyEl.classList.remove("hidden");
    const activeDays = new Set(completedOrPartial.map(t => t.date)).size;
    document.getElementById("consistencyText").innerText = `${activeDays} active days this week`;
    const visuals = document.getElementById("consistencyVisuals");
    visuals.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const isFilled = i < activeDays;
      visuals.insertAdjacentHTML("beforeend", `<div class="w-2 h-2 rounded-full ${isFilled ? "bg-secondary" : "bg-gray-200 dark:bg-gray-700"}"></div>`);
    }
    const barContainer = document.getElementById("analyticsSubjectBars");
    if (!barContainer) return;
    barContainer.innerHTML = "";
    const subjectStats = {};
    relevantTasks.forEach(t => {
      if (!subjectStats[t.subject]) subjectStats[t.subject] = {
        mins: 0,
        focusSum: 0,
        count: 0
      };
      if (t.actualTime > 0) subjectStats[t.subject].mins += t.actualTime;
      if (t.focusScore) {
        subjectStats[t.subject].focusSum += parseInt(t.focusScore);
        subjectStats[t.subject].count++;
      }
    });
    const sortedSubs = Object.entries(subjectStats).map(([ name, stat ]) => ({
      name: name,
      ...stat,
      avgFocus: stat.count ? stat.focusSum / stat.count : 0
    })).sort((a, b) => b.mins - a.mins);
    if (sortedSubs.length > 0) {
      const maxMins = sortedSubs[0].mins || 1;
      const grandTotalMins = totalMins || 1;
      sortedSubs.forEach((sub, index) => {
        const width = sub.mins / maxMins * 100;
        const shareOfTotal = Math.round(sub.mins / grandTotalMins * 100);
        let focusColor = "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
        if (sub.avgFocus >= 4) focusColor = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"; else if (sub.avgFocus >= 2.5) focusColor = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"; else if (sub.avgFocus > 0) focusColor = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
        const hours = (sub.mins / 60).toFixed(1);
        const safeName = sub.name.replace(/'/g, "\\'");
        const barHtml = `
                <div class="group relative bg-gray-50 dark:bg-gray-700/20 hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 rounded-xl p-3 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md" onclick="app.openAnalyticsDrill('${safeName}')">
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-gray-400 w-4">#${index + 1}</span>
                            <span class="text-sm font-bold text-gray-800 dark:text-gray-100 group-hover:text-primary transition-colors">${escapeHTML(sub.name)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                             ${sub.avgFocus > 0 ? `
                             <div class="${focusColor} px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <i class="fas fa-brain"></i> ${sub.avgFocus.toFixed(1)}
                             </div>` : ""}
                        </div>
                    </div>
                    <div class="relative w-full h-2.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-1.5">
                        <div class="absolute top-0 left-0 h-full bg-primary group-hover:bg-primary-600 transition-all duration-500 rounded-full" style="width: ${width}%"></div>
                    </div>
                    <div class="flex justify-between items-center text-[10px] font-medium text-gray-400">
                        <span>${hours} hours logged</span>
                        <span class="font-mono text-gray-500 dark:text-gray-300">${shareOfTotal}% of total study</span>
                    </div>
                    <div class="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <i class="fas fa-chevron-right text-gray-300 dark:text-gray-500"></i>
                    </div>
                </div>`;
        barContainer.insertAdjacentHTML("beforeend", barHtml);
      });
      const weak = [ ...sortedSubs ].reverse().find(s => s.mins > 30 && s.avgFocus < 3);
      const weakCard = document.getElementById("cardWeakSubject");
      if (weak) {
        weakCard.classList.remove("hidden");
        document.getElementById("lblWeakSub").innerText = weak.name;
      } else {
        weakCard.classList.add("hidden");
      }
      const strong = sortedSubs.find(s => s.mins > 60 && s.avgFocus >= 3.5);
      if (strong) {
        document.getElementById("cardStrongSubject").classList.remove("hidden");
        document.getElementById("lblStrongSub").innerText = strong.name;
      } else {
        document.getElementById("cardStrongSubject").classList.add("hidden");
      }
    }
    const refPanel = document.getElementById("analyticsReflection");
    if (range === 7 && activeDays >= 2) {
      refPanel.classList.remove("hidden");
      document.getElementById("refConsistency").innerText = activeDays >= 5 ? "Consistent effort this week." : "Building momentum.";
      const hardest = sortedSubs.sort((a, b) => a.avgFocus - b.avgFocus)[0];
      document.getElementById("refBalance").innerText = hardest ? `Hardest topic: ${hardest.name}` : "Balanced workload.";
      const bestTime = analyticsOps.getBestTimeBlock(relevantTasks);
      document.getElementById("refTiming").innerText = bestTime ? `Peak focus around ${bestTime}.` : "Timing data gathering...";
    } else {
      refPanel.classList.add("hidden");
    }
    analyticsOps.generateInsights(totalMins, parseFloat(avgFocus), rate, range, sortedSubs);
  },
  generateInsights: (totalMins, avgFocus, completionRate, range, subjectStats = []) => {
    const suggestionsEl = document.getElementById("analyticsSuggestions");
    if (!suggestionsEl) return;
    suggestionsEl.innerHTML = "";
    const tips = [];
    if (totalMins > 0 && avgFocus < 2.5) {
      tips.push({
        icon: "fa-battery-quarter",
        color: "text-gray-400",
        text: "Low energy days happen. Tomorrow is a reset.",
        action: null
      });
    }
    if (totalMins > 0 && completionRate < 50) {
      tips.push({
        icon: "fa-align-left",
        color: "text-orange-500",
        text: "High backlog? Reduce daily load slightly.",
        action: {
          label: "Move 1 Task",
          type: "break"
        }
      });
    }
    if (avgFocus > 4.2) {
      tips.push({
        icon: "fa-fire",
        color: "text-amber-500",
        text: "Great flow! Lock this in with a quick review.",
        action: {
          label: "Schedule Review",
          type: "revision"
        }
      });
    }
    if (tips.length === 0 && totalMins > 0) {
      tips.push({
        icon: "fa-check",
        color: "text-emerald-500",
        text: "Your rhythm is steady. Keep going.",
        action: null
      });
    }
    tips.slice(0, 3).forEach(tip => {
      let btnHtml = "";
      if (tip.action) {
        btnHtml = `
            <button onclick="app.quickSchedule('${tip.action.type}')" class="ml-auto text-[10px] font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded shadow-sm hover:text-primary transition-colors whitespace-nowrap">
                ${tip.action.label}
            </button>`;
      }
      suggestionsEl.insertAdjacentHTML("beforeend", `
            <div class="flex gap-3 items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <i class="fas ${tip.icon} ${tip.color} text-xs w-4 text-center shrink-0"></i>
                <span class="text-xs font-medium text-gray-600 dark:text-gray-300 leading-snug flex-1">${tip.text}</span>
                ${btnHtml}
            </div>
        `);
    });
  },
  openAnalyticsDrill: subjectName => {
    const app = getApp();
    app.data.activeDrillSubject = subjectName;
    const bars = document.getElementById("analyticsSubjectBars");
    const header = bars.previousElementSibling;
    bars.classList.add("hidden");
    if (header) header.classList.add("hidden");
    const panel = document.getElementById("analyticsDrillPanel");
    panel.classList.remove("hidden");
    document.getElementById("view-analytics").scrollIntoView({
      behavior: "smooth"
    });
    analyticsOps.renderDrillDown();
  },
  closeAnalyticsDrill: () => {
    const app = getApp();
    app.data.activeDrillSubject = null;
    const bars = document.getElementById("analyticsSubjectBars");
    const header = bars.previousElementSibling;
    bars.classList.remove("hidden");
    if (header) header.classList.remove("hidden");
    document.getElementById("analyticsDrillPanel").classList.add("hidden");
  },
  renderDrillDown: () => {
    const app = getApp();
    const subName = app.data.activeDrillSubject;
    if (!subName) return;
    const subObj = app.data.subjects.find(s => s.name === subName);
    const definedTopics = subObj ? subObj.sub : [];
    const topicMap = new Map();
    definedTopics.forEach(t => topicMap.set(t, {
      name: t,
      time: 0,
      count: 0,
      lastDate: null
    }));
    let hasFocusData = false;
    const dayStats = [ 0, 0, 0, 0, 0, 0, 0 ];
    app.data.tasks.forEach(t => {
      if (t.subject === subName) {
        if (t.actualTime > 0) {
          const entry = topicMap.get(t.subSubject) || {
            name: t.subSubject,
            time: 0,
            count: 0,
            lastDate: null
          };
          entry.time += t.actualTime;
          entry.count++;
          if (!entry.lastDate || t.date > entry.lastDate) entry.lastDate = t.date;
          topicMap.set(t.subSubject, entry);
        }
        if (t.status === "done" && t.focusScore) {
          const parts = t.date.split("-");
          const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
          dayStats[localDate.getDay()] += parseInt(t.focusScore);
          hasFocusData = true;
        }
      }
    });
    const headerHtml = `
        <div class="sticky top-0 z-20 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 py-3 mb-6 transition-all">
            <div class="flex items-center justify-between px-2 sm:px-4">
                <div class="flex items-center gap-3">
                    <button onclick="app.closeAnalyticsDrill()" class="group w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary hover:text-primary transition-all shadow-sm">
                        <i class="fas fa-arrow-left text-sm text-gray-400 group-hover:text-primary transition-colors"></i>
                    </button>
                    <div>
                        <h3 class="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">${escapeHTML(subName)}</h3>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Topic Performance</p>
                    </div>
                </div>
                <button onclick="app.closeAnalyticsDrill()" class="hidden sm:block text-xs font-bold text-gray-400 hover:text-primary px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    CLOSE
                </button>
            </div>
        </div>
    `;
    let insightHtml = "";
    if (hasFocusData && Math.max(...dayStats) > 0) {
      const bestDayIdx = dayStats.indexOf(Math.max(...dayStats));
      const days = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];
      insightHtml = `
            <div class="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-lg shadow-indigo-500/20 group">
                <div class="absolute -right-6 -top-6 text-white/5 text-9xl group-hover:scale-110 transition-transform duration-700"><i class="fas fa-brain"></i></div>
                <div class="relative z-10 p-4 flex items-start gap-5">
                    <div class="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/10">
                        <i class="fas fa-lightbulb text-amber-300 text-xl"></i>
                    </div>
                    <div>
                        <div class="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-1">Focus Insight</div>
                        <p class="text-sm font-medium leading-relaxed">
                            You have the highest focus intensity on <span class="font-bold text-amber-300 border-b-2 border-amber-300/30">${days[bestDayIdx]}s</span> for this subject.
                        </p>
                    </div>
                </div>
            </div>`;
    }
    let listRows = "";
    const sortedTopics = Array.from(topicMap.values()).sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
    if (sortedTopics.length === 0) {
      listRows = `
            <div class="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-gray-400 bg-gray-50/50 dark:bg-gray-800/50">
                <i class="fas fa-layer-group text-3xl mb-3 opacity-50"></i>
                <p class="font-medium">No topics started yet.</p>
                <button onclick="app.closeAnalyticsDrill(); app.openTaskModal()" class="mt-4 text-xs font-bold text-primary hover:underline">Create a Task</button>
            </div>`;
    } else {
      sortedTopics.forEach(topic => {
        let status = {
          color: "bg-gray-100 text-gray-500 border-gray-200",
          label: "New",
          icon: "fa-circle"
        };
        if (topic.lastDate) {
          const parts = topic.lastDate.split("-");
          const diffTime = new Date().setHours(0, 0, 0, 0) - new Date(parts[0], parts[1] - 1, parts[2]);
          const daysAgo = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
          if (daysAgo <= 3) status = {
            color: "bg-emerald-100 text-emerald-700 border-emerald-200",
            label: "Fresh",
            icon: "fa-check-circle"
          }; else if (daysAgo <= 10) status = {
            color: "bg-amber-100 text-amber-700 border-amber-200",
            label: "Review",
            icon: "fa-exclamation-circle"
          }; else status = {
            color: "bg-red-50 text-red-600 border-red-100",
            label: "Overdue",
            icon: "fa-history"
          };
        }
        const safeName = topic.name.replace(/'/g, "\\'");
        const safeSub = subName.replace(/'/g, "\\'");
        listRows += `
                <div class="group relative bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all duration-200">
                    
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <h4 class="text-sm font-extrabold text-gray-800 dark:text-gray-100 truncate" title="${topic.name}">
                                    ${escapeHTML(topic.name)}
                                </h4>
                                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${status.color}">
                                    ${status.label}
                                </span>
                            </div>
                            <div class="text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 rounded-full ${topic.lastDate ? "bg-indigo-400" : "bg-gray-300"}"></span>
                                ${topic.lastDate ? "Last studied: " + topic.lastDate : "No activity yet"}
                            </div>
                        </div>

                        <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                            
                            <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/40 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700/50">
                                <div class="flex flex-col items-center leading-none">
                                    <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Time</span>
                                    <span class="text-xs font-mono font-bold text-gray-700 dark:text-gray-200">${(topic.time / 60).toFixed(1)}h</span>
                                </div>
                                <div class="w-px h-5 bg-gray-200 dark:bg-gray-600"></div> <div class="flex flex-col items-center leading-none">
                                    <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Sess.</span>
                                    <span class="text-xs font-mono font-bold text-gray-700 dark:text-gray-200">${topic.count}</span>
                                </div>
                            </div>

                            <div class="flex items-center gap-1 pl-1">
                                <button onclick="app.prepSafeAction('revision', '${safeSub}', '${safeName}')" class="px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                                    Revise
                                </button>
                                <button onclick="app.prepSafeAction('split', '${safeSub}', '${safeName}')" class="px-3 py-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs font-bold transition-colors">
                                    Split
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
      });
    }
    const panel = document.getElementById("analyticsDrillPanel");
    panel.innerHTML = `
        <div class="flex flex-col w-full min-h-[80vh] sm:min-h-0 pb-20">
            ${headerHtml}
            <div class="animate-fade-in px-1">
                ${insightHtml}
                <div class="space-y-3">
                    ${listRows}
                </div>
            </div>
        </div>
    `;
  }
};