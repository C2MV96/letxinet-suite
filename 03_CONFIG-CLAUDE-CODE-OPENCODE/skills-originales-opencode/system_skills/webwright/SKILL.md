---
name: webwright-browser-agent
slug: webwright-browser-agent
description: |
  State-of-the-art browser agent workflow utilizing Microsoft Playwright inside Python scripts (code-as-action) for multi-session navigation, end-to-end web scraping, and visual task verification.
  Use when the task requires:
  - Complex web scraping, flight searches, listings, or weather data from dynamic sites.
  - Form filling, multiple browser session automation, or screenshot QA.
  - Creating re-runnable Python Playwright scripts that act as browser agents.
  - Interactive "Task2UI" tasks that render browser history and results directly in HTML templates.
---

# SKILL: Webwright: A Terminal Is All You Need For Web Agents

Webwright turns LLMs into state-of-the-art browser agents by providing a sandboxed terminal environment with a Playwright-based browser. In this paradigm, the agent's browsing history is a single executable Python script ("code-as-action"), rather than deep orchestration graphs or complex multi-agent frameworks.

## 🌟 CORE ARCHITECTURE & PREREQUISITES

Webwright wraps standard Playwright automated page interactions into robust python modules.

```
webwright/
├── pyproject.toml           # package: webwright
├── src/webwright/
│   ├── run/cli.py           # CLI entrypoint (`webwright`)
│   ├── agents/default.py    # core agent loop
│   ├── environments/        # Playwright browser workspace
│   ├── tools/               # image_qa, self_reflection
│   ├── models/              # openai_model, anthropic_model, base
│   └── utils/
├── assets/
│   └── task_showcase/       # Flask dashboard for repeating/displaying runs
│       ├── app.py
│       └── tasks/<task>/    # task.json + report.json per task
```

### Installation 
To configure a machine or environment to run Webwright scripts, execute:
```bash
pip install -e .
playwright install chromium
```

---

## 🛠️ USAGE PATTERNS & COMMANDS

### 1. Basic Agent Execution
To execute a web task (e.g., flight booking lookup, weather report, active listings extraction) via CLI:
```bash
python -m webwright.run.cli \
    -c base.yaml -c model_openai.yaml \
    -t "Buscar vuelos de SEA a JFK para el 15 de agosto de 2026" \
    --start-url https://www.google.com/flights \
    --task-id demo_vuelos_openai \
    -o outputs/default
```

### 2. Task2UI Dashboard mode (Added May 2026)
Consolidates Webwright runs for repeatable actions into an HTML dashboard, dropping small `task.json` (metadata) and `report.json` (structured metrics/tables) files at runtime:
```bash
# Run task and write UI metrics 
python -m webwright.run.cli \
    -c base.yaml -c model_openai.yaml -c task_showcase.yaml \
    -t "Analizar ofertas de hoteles en Lima" \
    --task-id hotel_ofertas_lima \
    -o outputs/default

# Serve Flask UI
pip install flask
python assets/task_showcase/app.py --tasks-dir outputs/default/hotel_ofertas_lima/task_showcase/tasks
```

---

## 🧠 BEST PRACTICES FOR CODING BROWSER AGENTS

1. **Prefer Code-as-Action**: Keep agent commands straightforward. Write reusable Python utilities executing pure Playwright calls (e.g., clicks, text inputs, selectors) rather than prediction heuristics.
2. **Handle Page Layout Shift**: Insert sufficient wait timeouts (`page.wait_for_selector()`, `page.wait_for_timeout(2000)`) to survive sluggish network conditions or deferred react mounts.
3. **Use Vision & Reflection (image_qa)**: When selectors are dynamic or anti-bot protections are trigger-happy, capture a snapshot or let the `self_reflection` tool verify that the target task succeeded.
4. **Isolate Browser State**: Run headless or isolated per-run directories to avoid cross-session caching and session contamination.
