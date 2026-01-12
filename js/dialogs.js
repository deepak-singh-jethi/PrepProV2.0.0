const dialogQueue = [];

let isDialogOpen = false;

const getEls = () => ({
  container: document.getElementById("uiDialogContainer"),
  title: document.getElementById("uiDialogTitle"),
  msg: document.getElementById("uiDialogMessage"),
  input: document.getElementById("uiDialogInput"),
  btns: document.getElementById("uiDialogButtons")
});

function processDialogQueue() {
  if (isDialogOpen || dialogQueue.length === 0) return;
  const {
    type,
    msg,
    defaultVal,
    resolve
  } = dialogQueue.shift();
  isDialogOpen = true;
  const {
    container,
    title,
    msg: msgEl,
    input,
    btns
  } = getEls();
  msgEl.innerText = msg;
  input.classList.add("hidden");
  input.value = "";
  btns.innerHTML = "";
  const closeDialog = result => {
    container.classList.add("hidden");
    isDialogOpen = false;
    resolve(result);
    setTimeout(() => processDialogQueue(), 50);
  };
  if (type === "alert") {
    title.innerText = "Alert";
    btns.innerHTML = `<button id="uiBtnOK" class="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-700 font-bold text-sm shadow-lg shadow-primary/20 transition-all">OK</button>`;
    document.getElementById("uiBtnOK").onclick = () => closeDialog(undefined);
    container.classList.remove("hidden");
    document.getElementById("uiBtnOK").focus();
  } else if (type === "confirm") {
    title.innerText = "Confirm";
    btns.innerHTML = `
                <button id="uiBtnCancel" class="px-5 py-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium text-sm transition-colors">Cancel</button>
                <button id="uiBtnConfirm" class="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-700 font-bold text-sm shadow-lg shadow-primary/20 transition-all">Confirm</button>
            `;
    document.getElementById("uiBtnCancel").onclick = () => closeDialog(false);
    document.getElementById("uiBtnConfirm").onclick = () => closeDialog(true);
    container.classList.remove("hidden");
    document.getElementById("uiBtnConfirm").focus();
  } else if (type === "prompt") {
    title.innerText = "Input";
    input.value = defaultVal || "";
    input.classList.remove("hidden");
    btns.innerHTML = `
                <button id="uiBtnCancel" class="px-5 py-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium text-sm transition-colors">Cancel</button>
                <button id="uiBtnConfirm" class="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-700 font-bold text-sm shadow-lg shadow-primary/20 transition-all">Confirm</button>
            `;
    document.getElementById("uiBtnCancel").onclick = () => closeDialog(null);
    const confirmAction = () => closeDialog(input.value);
    document.getElementById("uiBtnConfirm").onclick = confirmAction;
    input.onkeydown = e => {
      if (e.key === "Enter") confirmAction();
    };
    container.classList.remove("hidden");
    input.focus();
    input.select();
  }
  const escapeHandler = e => {
    if (e.key === "Escape" && !container.classList.contains("hidden")) {
      if (type === "alert") closeDialog(undefined); else if (type === "confirm") closeDialog(false); else if (type === "prompt") closeDialog(null);
      document.removeEventListener("keydown", escapeHandler);
    }
  };
  document.addEventListener("keydown", escapeHandler);
}

export function uiAlert(msg) {
  return new Promise(resolve => {
    dialogQueue.push({
      type: "alert",
      msg: msg,
      resolve: resolve
    });
    processDialogQueue();
  });
}

export function uiConfirm(msg) {
  return new Promise(resolve => {
    dialogQueue.push({
      type: "confirm",
      msg: msg,
      resolve: resolve
    });
    processDialogQueue();
  });
}

export function uiPrompt(msg, defaultVal = "") {
  return new Promise(resolve => {
    dialogQueue.push({
      type: "prompt",
      msg: msg,
      defaultVal: defaultVal,
      resolve: resolve
    });
    processDialogQueue();
  });
}

export function isDialogActive() {
  return isDialogOpen;
}