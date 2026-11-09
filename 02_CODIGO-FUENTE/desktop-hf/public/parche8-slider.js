// =============================================================================
// Parche 8 Fase 3 (2026-08-15) — Slider maxPages OAI-PMH en Panel de Control
// =============================================================================
// Carga como script externo via <script> en index.html (no toca el bundle).
// Observa el DOM con MutationObserver, detecta el panel "Sources Academicas
// (variante B)" del modal Settings > API Keys e inyecta un sub-panel nuevo
// con slider 1-10 + input + boton "Guardar profundidad".
//
// Endpoint fuente: GET /api/config/sources, POST /api/config/sources
// Fuente MCP-V11: provider oai-pmh.ts (IIFE con 3 niveles de override)
// =============================================================================

(function() {
  "use strict";

  const CONFIG_ENDPOINT = "/api/config/sources";
  const INJECTED_FLAG = "parche8-slider-injected";
  const PANEL_TITLE_MARKER = "Sources Acad\u00e9micas (variante B)";
  // fallback tambien probar version sin acento (EN)
  const PANEL_TITLE_MARKER_FALLBACK = "Sources Academicas";

  // ----- helpers DOM -----
  function findAcademicPanel() {
    // el panel usa <div> con texto = PANEL_TITLE_MARKER (puede estar en child)
    const divs = document.querySelectorAll("div");
    for (const d of divs) {
      if (d.children.length === 0 && d.textContent && d.textContent.trim().startsWith(PANEL_TITLE_MARKER)) {
        // subir al contenedor zp + section
        let parent = d.parentElement;
        while (parent && parent.tagName !== "SECTION" && parent.tagName !== "FORM" && parent.parentElement) {
          parent = parent.parentElement;
          if (parent.classList && parent.classList.contains("parche8-panel")) return null; // no re-procesar
        }
        if (parent && parent.parentElement) return parent.parentElement;
      }
    }
    // fallback: probar variantes
    for (const d of divs) {
      if (d.children.length === 0 && d.textContent && d.textContent.trim().startsWith(PANEL_TITLE_MARKER_FALLBACK)) {
        let parent = d.parentElement;
        while (parent && parent.tagName !== "SECTION" && parent.tagName !== "FORM" && parent.parentElement) {
          parent = parent.parentElement;
        }
        if (parent && parent.parentElement) return parent.parentElement;
      }
    }
    return null;
  }

  // ----- construccion del sub-panel -----
  async function fetchConfig() {
    try {
      const r = await fetch(CONFIG_ENDPOINT);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      console.warn("[Parche 8] No se pudo cargar /api/config/sources:", e.message);
      return null;
    }
  }

  async function saveConfig(maxPages) {
    try {
      const body = JSON.stringify({ oai: { maxPages: parseInt(maxPages, 10) } });
      const r = await fetch(CONFIG_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`HTTP ${r.status}: ${err}`);
      }
      return await r.json();
    } catch (e) {
      console.error("[Parche 8] Error guardando config:", e.message);
      return { ok: false, error: e.message };
    }
  }

  function createPanel(config) {
    const oai = config?.oai || { maxPages: 7, min: 1, max: 10, label: "Profundidad de busqueda OAI-PMH", coverageNote: "" };
    const wrap = document.createElement("div");
    wrap.className = "parche8-panel mt-4 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300 text-sm";
    wrap.setAttribute("data-parche8", INJECTED_FLAG);
    wrap.style.marginTop = "1rem";

    const title = document.createElement("div");
    title.className = "font-semibold mb-2 flex items-center gap-2";
    title.innerHTML = '<span style="font-size:1.2rem">\u2699</span> ' + (oai.label || "Profundidad de busqueda OAI-PMH");
    wrap.appendChild(title);

    const sliderRow = document.createElement("div");
    sliderRow.className = "flex items-center gap-3 mb-2";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(oai.min || 1);
    slider.max = String(oai.max || 10);
    slider.value = String(oai.maxPages || 7);
    slider.className = "flex-1 accent-amber-600";

    const valSpan = document.createElement("span");
    valSpan.className = "font-mono font-bold text-base min-w-[2rem] text-center px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-800";
    valSpan.textContent = String(slider.value);

    slider.addEventListener("input", () => {
      valSpan.textContent = slider.value;
    });

    sliderRow.appendChild(slider);
    sliderRow.appendChild(valSpan);
    wrap.appendChild(sliderRow);

    if (oai.coverageNote) {
      const note = document.createElement("p");
      note.className = "text-xs mt-1 opacity-80 leading-snug";
      note.textContent = oai.coverageNote;
      wrap.appendChild(note);
    }

    const hint = document.createElement("p");
    hint.className = "text-xs mt-1 opacity-60";
    hint.textContent = `Default: ${oai.defaultMaxPages || 7}. Rango: ${oai.min || 1}-${oai.max || 10}. Fuente: ${oai.source || "renati (SUNEDU)"}.`;
    wrap.appendChild(hint);

    const btnRow = document.createElement("div");
    btnRow.className = "flex items-center gap-2 mt-3";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors";
    btn.textContent = "Guardar profundidad";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Guardando...";
      const newVal = parseInt(slider.value, 10);
      const resp = await saveConfig(newVal);
      btn.disabled = false;
      if (resp.ok) {
        btn.textContent = "\u2713 Guardado";
        valSpan.textContent = String(newVal);
        if (resp.restart?.ok === false && resp.restart?.accessDenied) {
          btn.textContent = "Guardado (reinicie Suite)";
        }
        const msg = document.createElement("div");
        msg.className = "text-xs mt-2 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400";
        msg.textContent = resp.message || "Configuracion guardada";
        wrap.appendChild(msg);
        setTimeout(() => { try { wrap.removeChild(msg); } catch(_) {} }, 5000);
        setTimeout(() => { btn.textContent = original; }, 2000);
      } else {
        btn.textContent = "\u2717 Error";
        const msg = document.createElement("div");
        msg.className = "text-xs mt-2 px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400";
        msg.textContent = resp.error || resp.propagation?.error || "Error desconocido";
        wrap.appendChild(msg);
        setTimeout(() => { try { wrap.removeChild(msg); } catch(_) {} }, 6000);
        setTimeout(() => { btn.textContent = original; }, 2500);
      }
    });
    btnRow.appendChild(btn);

    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "px-2 py-1.5 rounded-md border border-amber-400 text-amber-700 dark:text-amber-300 text-xs transition-colors hover:bg-amber-100 dark:hover:bg-amber-800";
    refreshBtn.textContent = "Recargar";
    refreshBtn.addEventListener("click", async () => {
      const cfg = await fetchConfig();
      if (cfg?.oai) {
        slider.value = String(cfg.oai.maxPages);
        valSpan.textContent = String(cfg.oai.maxPages);
      }
    });
    btnRow.appendChild(refreshBtn);

    wrap.appendChild(btnRow);

    const schemaNotice = document.createElement("div");
    schemaNotice.className = "text-xs mt-2 opacity-50";
    schemaNotice.textContent = "Parche 8 Fase 3 \u00b7 v1 \u00b7 _schemaVersion=1";
    wrap.appendChild(schemaNotice);

    return wrap;
  }

  async function tryInject() {
    // evitar doble inyeccion
    if (document.querySelector(`[data-parche8="${INJECTED_FLAG}"]`)) return;

    const target = findAcademicPanel();
    if (!target) return;

    const config = await fetchConfig();
    if (!config) {
      console.warn("[Parche 8] No se pudo obtener config. Slider no se inyectara.");
      return;
    }

    const panel = createPanel(config);
    target.parentElement.insertBefore(panel, target.nextSibling);
    console.log("[Parche 8] Slider maxPages inyectado en Panel de Control");
  }

  // ----- MutationObserver: detecta cuando el modal Settings abre -----
  function startObserver() {
    if (typeof MutationObserver === "undefined") return;
    const obs = new MutationObserver(() => {
      tryInject();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    console.log("[Parche 8 Fase 3] Observador DOM activo");
    // intento inicial
    setTimeout(tryInject, 800);
    setTimeout(tryInject, 2000);
    setTimeout(tryInject, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver);
  } else {
    startObserver();
  }
})();
