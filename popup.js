const DEFAULTS = {
  focus: false, textAdjust: false, font: "default", fontSize: 120,
  lineHeight: 1.8, letterSpacing: 0.05, wordSpacing: 0.1,
  theme: "default", ruler: false, speechRate: 1
};

const form = document.getElementById("settings");
const statusEl = document.getElementById("status");
const readBtn = document.getElementById("readBtn");
const nf = (n, max = 2) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: max });

const FORMAT = {
  fontSize: (v) => v + "%",
  lineHeight: (v) => nf(v, 1),
  letterSpacing: (v) => nf(v) + " em",
  wordSpacing: (v) => nf(v) + " em",
  speechRate: (v) => nf(v, 1) + "×"
};

function showOutput(key, value) {
  const out = document.getElementById(key + "Out");
  if (!out || !FORMAT[key]) return;
  const text = FORMAT[key](value);
  out.textContent = text;
  out.setAttribute("aria-hidden", "true");                      // evita ler o valor duas vezes
  form.elements[key].setAttribute("aria-valuetext", text);      // leitor de tela fala "120%" em vez de "120"
}

const NAMES = { focus: "Modo foco", textAdjust: "Ajuste de texto", ruler: "Régua de leitura", font: "Fonte", theme: "Tema" };

function render(settings) {
  for (const [key, value] of Object.entries(settings)) {
    const el = form.elements[key];
    if (!el) continue;
    if (el.type === "checkbox") el.checked = value; else el.value = value;
    showOutput(key, value);
  }
}

form.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.name) return;
  const value = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
  showOutput(el.name, value);
  chrome.storage.sync.set({ [el.name]: value });

  // Feedback falado para quem usa leitor de tela (região aria-live)
  if (NAMES[el.name]) {
    statusEl.textContent = el.type === "checkbox"
      ? NAMES[el.name] + (value ? " ativado." : " desativado.")
      : NAMES[el.name] + ": " + el.options[el.selectedIndex].text + ".";
  }
});

document.getElementById("resetBtn").addEventListener("click", () => {
  chrome.storage.sync.set(DEFAULTS, () => { render(DEFAULTS); statusEl.textContent = "Padrões restaurados."; });
});

/* ---- Leitura em voz alta: conversa com o content script ---- */
async function sendToTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    statusEl.textContent = "Esta página não permite a extensão. Abra um site comum e recarregue.";
    return null;
  }
}

async function refreshButton() {
  const res = await sendToTab({ type: "status" });
  readBtn.textContent = res && res.speaking ? "Parar leitura" : "Ler em voz alta";
}

readBtn.addEventListener("click", async () => {
  const status = await sendToTab({ type: "status" });
  if (!status) return;
  if (status.speaking) {
    await sendToTab({ type: "stop" });
    statusEl.textContent = "Leitura parada.";
  } else {
    const res = await sendToTab({ type: "speak" });
    statusEl.textContent = res && res.ok ? "Lendo a página…" : "Não encontrei texto para ler.";
  }
  refreshButton();
});

chrome.storage.sync.get(DEFAULTS, (saved) => { render({ ...DEFAULTS, ...saved }); refreshButton(); });
