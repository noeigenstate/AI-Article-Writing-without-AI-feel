<div align="center">

# Speak Plainly · 说人话

**Write like a human, not a bot.**

An open-source writing workbench that strips the "AI smell" out of your drafts — and shows you the score before and after. Works in **English and Chinese**.

[![License: MIT](https://img.shields.io/badge/License-MIT-22a06b.svg)](LICENSE)
![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-ff8fab.svg)

English · [中文](README.zh.md)

</div>

---

## The problem

AI drafts read like AI. The same boilerplate openers, the same buzzwords, the same too-neat parallel sentences — readers feel it, and so do reviewers. Most "humanizer" tools just try to slip past detectors. Speak Plainly does something more useful: it **measures** the AI smell, **rewrites** it out, and lets you **keep the Word file you already have**.

## What you can do with it

- **Drop in a Word draft and get it back reading like a person wrote it** — whole-document de-AI rewrite, exported straight back to `.docx` with the original layout intact.
- **See a before/after score**, not a vibe — a 0–100 AI-smell gauge that points at the exact tells it found (boilerplate, buzzwords, leaked Markdown, robotic transitions, too-uniform sentences).
- **Make it sound like *you*** — pick a built-in voice or upload your own `.docx`/`.txt` samples to copy their style.
- **Fix it sentence by sentence** — click any line for alternative phrasings, or edit by hand.
- **Write from scratch with sources** — give a title or a domain and it pulls arXiv papers and news RSS to draft an article with figures, a citation table, and references.
- **Keep it private** — point it at a local model (Ollama / LM Studio / vLLM) and nothing leaves your machine. The score is computed locally regardless.

## Demo

<div align="center">
<img src="assets/screenshots/demo-generate.gif" alt="Generating a full article from a title" width="760" /><br/>
<sub><b>From a title to a sourced article — research, figures, and citations, in one run.</b></sub>
</div>

<table>
<tr>
<td width="50%" align="center">
<img src="assets/screenshots/01-rewrite.png" alt="De-AI editor with local AI-smell score" /><br/>
<sub><b>De-AI editor with a local AI-smell score and per-pattern breakdown</b></sub>
</td>
<td width="50%" align="center">
<img src="assets/screenshots/02-generate.png" alt="Pick a domain or type a title" /><br/>
<sub><b>Start from a title or a domain</b></sub>
</td>
</tr>
</table>

## Why this one, not the others

Most open-source tools in this space are either a **single prompt** you paste into a chatbot, or a **detector-bypass** service. Speak Plainly is a different bet:

| | Prompt / skill repos | Detector-bypass tools | **Speak Plainly** |
| --- | :---: | :---: | :---: |
| Runnable app with a UI | ✗ | ✓ | ✓ |
| Before/after AI-smell score | ✗ | rarely | ✓ (local) |
| Word in → Word out, layout kept | ✗ | ✗ | ✓ |
| Learns *your* style from samples | rarely | ✗ | ✓ |
| Research-backed article generation | ✗ | ✗ | ✓ |
| Runs fully local / private | ✗ | ✗ | ✓ |
| Goal | humanize | beat Turnitin | **read like a human & hold up** |

We deliberately don't chase "100% undetectable." The aim is text a real editor would pass.

## Quick start

Requires Node.js 18+.

**One click** — creates `backend/.env` on first run, installs dependencies, and starts both servers:

```bash
./run.sh      # macOS / Linux / Windows (Git Bash)
```

```bat
run.bat       :: Windows — double-click, or run in a terminal
```

<details>
<summary>Or start the two servers manually</summary>

```bash
# 1. configure a model key
cp backend/.env.example backend/.env   # then edit it

# 2. backend
cd backend && npm install && npm start        # http://localhost:8787

# 3. frontend (new terminal)
cd frontend && npm install && npm run dev
```

</details>

Any OpenAI-compatible endpoint works (DeepSeek is the default). Use the **EN / 中文** toggle to switch the UI and the language of generated content.

### Private / local mode

Want nothing to leave your machine? In `backend/.env`, point at a local server and turn off the cloud-only reasoning flags:

```env
LLM_BASE_URL=http://localhost:11434/v1   # Ollama
LLM_API_KEY=ollama
LLM_MODEL=qwen2.5:14b
LLM_THINKING_TYPE=off
LLM_REASONING_EFFORT=off
```

The AI-smell score never calls a model — it's always local.

## Try the score in 10 seconds

```bash
cd backend
npm run test:score              # scores AI-flavored vs. human samples, offline
npm run test:score -- --rewrite # also rewrites with your model and prints before → after
```

## Good to know

- Output quality tracks the model and the live sources — human review is still needed, especially for factual, financial, medical, or legal content.
- Generated articles aggregate sources technically; they don't grant reuse rights. Check copyright and facts before publishing.
- Documents live in backend memory and are lost on restart. A public deployment needs auth, rate limiting, and persistent storage.

<details>
<summary><b>Under the hood</b> (stack, structure, API)</summary>

**Stack:** React + Vite + Zustand (frontend), Node + Express + TypeScript (backend), `jszip` for `.docx`, any OpenAI-compatible model API. The AI-smell score is a pure heuristic in `backend/src/services/aiScore.ts` — no network, no model.

**Layout:** the backend is split into `core/` (config, i18n, store), `routes/` (one router per feature, assembled by `app.ts`), `services/` (`rewrite`, `article`, `docx`, `aiScore`, `research/`), `prompts/`, `data/`, and shared `lib/` helpers. The frontend keeps state/api/i18n in `frontend/src/lib/` and groups UI under `frontend/src/components/{editor,generate,upload,common}/`.

**Main API:** `POST /api/upload` · `POST /api/rewrite` (returns before/after score) · `POST /api/score` · `POST /api/sentence/alternatives` · `POST /api/title` · `POST /api/article/generate` · `POST /api/export`. All content endpoints take a `lang` of `"en"` or `"zh"`.

**Build & test:**

```bash
cd backend  && npm run build && npm run test:docx && npm run test:article && npm run test:score
cd frontend && npm run build
```

</details>

## Roadmap

- Score breakdown panel in the editor (hover a tell → see the sentences).
- Docker Compose.
- Personal source library and generate-from-it.
- Per-user history and draft management.

## Contributing

Issues and PRs welcome — keep them small and say what changed, why, and what you tested.

## License

[MIT](LICENSE).
