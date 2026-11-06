// Modo Leitura Fácil: content script
(() => {
  "use strict";

  const DEFAULTS = {
    focus: false,
    textAdjust: false,
    font: "default",     // default | legivel | dislexia
    fontSize: 120,       // %
    lineHeight: 1.8,
    letterSpacing: 0.05, // em
    wordSpacing: 0.1,    // em
    theme: "default",    // default | escuro | contraste | suave
    ruler: false,
    speechRate: 1
  };

  const NOISE =
    "aside, nav, iframe, [role='complementary'], [role='navigation'], " +
    "[class*='advert' i], [id*='advert' i], [class*='sidebar' i]";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "NOSCRIPT", "TEMPLATE"]);

  const html = document.documentElement;
  let settings = { ...DEFAULTS };
  let focusRoot = null;
  let ruler = null;
  const hidden = new Set();

  /* ---------- Descobrir o conteúdo principal ---------- */
  function findMainRoot() {
    let best = null;
    let bestLen = 500;
    document.querySelectorAll("article, main, [role='main']").forEach((el) => {
      const len = (el.innerText || "").length;
      if (len > bestLen) { best = el; bestLen = len; }
    });
    if (best) return best;

    // Plano B: o bloco com mais texto em parágrafos
    const scores = new Map();
    document.querySelectorAll("p").forEach((p) => {
      const len = (p.innerText || "").trim().length;
      const parent = p.parentElement;
      if (len < 80 || !parent) return;
      scores.set(parent, (scores.get(parent) || 0) + len);
      const gp = parent.parentElement;
      if (gp) scores.set(gp, (scores.get(gp) || 0) + len / 2);
    });
    let top = 0;
    scores.forEach((score, el) => {
      if (score > top && el !== document.body && el !== html) { best = el; top = score; }
    });
    return best;
  }

  /* ---------- Modo foco ---------- */
  function hide(el) { el.classList.add("lf-hidden"); hidden.add(el); }

  function enableFocus() {
    disableFocus();
    focusRoot = findMainRoot();
    if (!focusRoot) return;
    focusRoot.classList.add("lf-focus-root");
    html.classList.add("lf-focus");

    // Esconde tudo que não está no caminho entre o conteúdo e o <body>
    let node = focusRoot;
    while (node && node !== document.body) {
      const parent = node.parentElement;
      if (!parent) break;
      for (const sib of parent.children) {
        if (sib !== node && !SKIP_TAGS.has(sib.tagName) && !sib.classList.contains("lf-ruler")) hide(sib);
      }
      node = parent;
    }
    focusRoot.querySelectorAll(NOISE).forEach(hide);
  }

  function disableFocus() {
    hidden.forEach((el) => el.classList.remove("lf-hidden"));
    hidden.clear();
    if (focusRoot) focusRoot.classList.remove("lf-focus-root");
    focusRoot = null;
    html.classList.remove("lf-focus");
  }

  /* ---------- Texto e tema ---------- */
  function applyText() {
    const on = settings.textAdjust;
    html.classList.toggle("lf-text", on);
    if (on) {
      html.style.setProperty("--lf-scale", settings.fontSize / 100);
      html.style.setProperty("--lf-lh", settings.lineHeight);
      html.style.setProperty("--lf-ls", settings.letterSpacing + "em");
      html.style.setProperty("--lf-ws", settings.wordSpacing + "em");
    }
    if (on && settings.font !== "default") html.dataset.lfFont = settings.font;
    else delete html.dataset.lfFont;
  }

  function applyTheme() {
    if (settings.theme !== "default") html.dataset.lfTheme = settings.theme;
    else delete html.dataset.lfTheme;
  }

  /* ---------- Régua de leitura ---------- */
  function moveRuler(centerY) {
    if (ruler) ruler.style.top = centerY - ruler.offsetHeight / 2 + "px";
  }
  const onMouse = (e) => moveRuler(e.clientY);
  const onFocus = (e) => {
    const r = e.target.getBoundingClientRect && e.target.getBoundingClientRect();
    if (r) moveRuler(r.top + r.height / 2);
  };

  function enableRuler() {
    if (ruler) return;
    ruler = document.createElement("div");
    ruler.className = "lf-ruler";
    ruler.setAttribute("aria-hidden", "true");
    document.body.appendChild(ruler);
    document.addEventListener("mousemove", onMouse);
    document.addEventListener("focusin", onFocus);
  }

  function disableRuler() {
    if (!ruler) return;
    ruler.remove();
    ruler = null;
    document.removeEventListener("mousemove", onMouse);
    document.removeEventListener("focusin", onFocus);
  }

  /* ---------- Leitura em voz alta (Web Speech API) ---------- */
  function chunk(text) {
    const sentences = text.replace(/\s+/g, " ").match(/[^.!?…]+[.!?…]*\s*/g) || [text];
    const out = [];
    let cur = "";
    for (const s of sentences) {
      if (cur && (cur + s).length > 200) { out.push(cur.trim()); cur = ""; }
      cur += s;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /* Destaque visual da imagem enquanto o alt é lido */
  let currentImg = null;
  let caption = null;

  function clearImageHighlight() {
    if (currentImg) currentImg.classList.remove("lf-reading-img");
    currentImg = null;
    if (caption) { caption.remove(); caption = null; }
  }

  function highlightImage(img, text) {
    clearImageHighlight();
    currentImg = img;
    img.classList.add("lf-reading-img");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    img.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    caption = document.createElement("div");
    caption.className = "lf-caption";
    caption.setAttribute("aria-hidden", "true");
    caption.textContent = text;
    document.body.appendChild(caption);
  }

  function stop() {
    window.speechSynthesis.cancel();
    clearImageHighlight();
  }

  // Extrai o texto visível em segmentos; imagens viram segmentos próprios (lidas pelo alt)
  function extractSegments(rootEl) {
    const lang = (html.lang || navigator.language || "pt").toLowerCase();
    const label = lang.startsWith("pt")
      ? { img: "Imagem", none: "Imagem sem descrição." }
      : { img: "Image", none: "Image without description." };
    const segments = [];
    const walker = document.createTreeWalker(
      rootEl,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(n) {
          if (n.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
          if (SKIP_TAGS.has(n.tagName) || n.getAttribute("aria-hidden") === "true") return NodeFilter.FILTER_REJECT;
          if (n.checkVisibility && !n.checkVisibility()) return NodeFilter.FILTER_REJECT;
          return n.tagName === "IMG" ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        let t = node.nodeValue.replace(/\s+/g, " ").trim();
        if (!t) continue;
        const p = node.parentElement;
        // Títulos e itens sem pontuação ganham um ponto para a voz fazer pausa
        if (p && p.matches("h1,h2,h3,h4,h5,h6,li,figcaption,th,td") && !/[.!?…:]$/.test(t)) t += ".";
        segments.push({ text: t });
      } else {
        if (node.clientWidth && node.clientWidth < 10) continue; // pixel de rastreamento
        const alt = node.getAttribute("alt");
        if (alt === null) segments.push({ text: label.none, img: node });
        else if (alt.trim()) {
          segments.push({ text: label.img + ": " + alt.trim().replace(/[.!?…]*$/, "") + ".", img: node });
        }
        // alt="" = imagem decorativa: ignorada (WCAG 1.1.1)
      }
    }
    return segments;
  }

  function speak() {
    stop();
    const lang = html.lang || navigator.language || "pt-BR";
    const selected = String(window.getSelection() || "").trim();
    const source = focusRoot || findMainRoot() || document.body;
    const segments = selected ? [{ text: selected }] : extractSegments(source);

    // Texto vira blocos de ~200 caracteres; cada imagem é uma fala separada
    const queue = [];
    let buffer = [];
    const flush = () => {
      if (buffer.length) chunk(buffer.join(" ")).forEach((t) => queue.push({ text: t }));
      buffer = [];
    };
    segments.forEach((seg) => (seg.img ? (flush(), queue.push(seg)) : buffer.push(seg.text)));
    flush();
    if (!queue.length) return false;

    queue.forEach((item) => {
      const u = new SpeechSynthesisUtterance(item.text);
      u.lang = lang;
      u.rate = settings.speechRate;
      if (item.img) {
        u.onstart = () => highlightImage(item.img, item.text);
        u.onend = () => { if (currentImg === item.img) clearImageHighlight(); };
      }
      window.speechSynthesis.speak(u);
    });
    return true;
  }

  /* ---------- Aplicar configurações ---------- */
  function applyAll(changed) {
    const has = (...keys) => !changed || keys.some((k) => k in changed);
    if (has("textAdjust", "font", "fontSize", "lineHeight", "letterSpacing", "wordSpacing")) applyText();
    if (has("theme")) applyTheme();
    if (has("focus")) settings.focus ? enableFocus() : disableFocus();
    if (has("ruler")) settings.ruler ? enableRuler() : disableRuler();
  }

  chrome.storage.sync.get(DEFAULTS, (saved) => {
    settings = { ...DEFAULTS, ...saved };
    applyAll(null);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue;
    applyAll(changes);
  });

  // Teclado: Esc interrompe a leitura em voz alta
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && window.speechSynthesis.speaking) stop();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "speak") sendResponse({ ok: speak() });
    else if (msg.type === "stop") { stop(); sendResponse({ ok: true }); }
    else if (msg.type === "status") sendResponse({ speaking: window.speechSynthesis.speaking });
  });
})();
