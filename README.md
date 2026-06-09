<div align="center">

# Speak Plainly · 说人话

**Turn AI-shaped drafts into writing that reads like a person wrote it.**

Open-source AI writing workbench for **Word rewriting**, **human-likeness scoring**, and **source-backed article generation**. It works in English and Chinese.

[![License: MIT](https://img.shields.io/badge/License-MIT-22a06b.svg)](LICENSE)
![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)

[中文说明](README.zh.md)

</div>

---

## At A Glance

<div align="center">
  <img src="assets/screenshots/demo-generate.gif" alt="Speak Plainly interface demo" width="820" />
  <br />
  <sub>Liquid-glass UI, Word rewriting, and article generation in one workspace.</sub>
</div>

| Rewrite Word | Generate Articles |
| --- | --- |
| <img src="assets/screenshots/01-rewrite.png" alt="Rewrite Word page" /> | <img src="assets/screenshots/02-generate.png" alt="Generate article page" /> |

## What It Does

- **Rewrite a `.docx` draft** and export it back to Word.
- **Score how human the text feels** with a local 0-100 human-likeness score.
- **Click any sentence** to get alternatives or edit it by hand.
- **Learn your style** from uploaded `.docx` or `.txt` samples.
- **Generate an article from a title or domain** with arXiv papers and RSS news sources.
- **Run privately** with any OpenAI-compatible endpoint, including local model servers.

## Basic Environment

You need:

| Tool | Why |
| --- | --- |
| Node.js 18+ | Runs the frontend and backend |
| npm | Installs project packages |
| A model API key | DeepSeek/OpenAI-compatible by default |
| Or a local model server | Ollama, LM Studio, vLLM, etc. |
| `.docx` files | Required for Word rewrite mode |

Optional but useful: Git Bash on Windows if you want to run `./run.sh`.

## Quick Start

Use one terminal:

```bash
./run.sh
```

On Windows you can also double-click or run:

```bat
run.bat
```

The script checks basic dependencies, prepares `backend/.env` on first run, installs packages, clears the same service port before starting, and opens one frontend/backend session.

Manual start:

```bash
cp backend/.env.example backend/.env
cd backend
npm install
npm start
```

```bash
cd frontend
npm install
npm run dev
```

Backend: `http://localhost:8787`  
Frontend: Vite will print the local URL, normally `http://localhost:51773`

## Human-Likeness Score

Higher is better.

```text
human-likeness score = round(length_confidence * (100 - total_penalty))
total_penalty = min(100, sum(capped category penalties))
```

The score is fully local. It does not call a model or upload your text.

The scorer normalizes evidence by text length: one unit is **120 Chinese characters** or **100 English words**. Very short text has lower confidence: empty text scores 0; text under 40 Chinese characters or 25 English words uses `length_confidence = 0.65`.

| Signal | Max deduction | What it catches |
| --- | ---: | --- |
| Boilerplate opener/closer | 26 | Stock endings like “in conclusion” / “总而言之” |
| Empty filler | 22 | Correct but hollow phrases |
| AI buzzwords | 18-20 | Overused model-style vocabulary |
| Model catchphrases | 18 | Viral/content-farm phrasing such as “接住”, “更狠一点”, “直接拉满” in Chinese output |
| Mechanical connectives | 18 | Repeated sentence-start transitions |
| Generic frames | 14 | Formulaic “the key is...” structures |
| Parallelism | 14-16 | Too-neat paired sentence patterns |
| Leaked Markdown | 20 | `##`, bullets, bold markers left in prose |
| Uniform sentence length | 12 | Sentences that are suspiciously even |
| Repeated wording | 10 | Excess repeated non-trivial words/phrases |
| Few concrete anchors | 8 | Not enough numbers, names, citations, or quoted specifics |

The rewrite prompt also applies a creator workflow: humanize the prose first, keep concrete evidence from the source material, preserve names/numbers/dates, and add specific scene-level detail only when the original supports it.

| Score | Meaning |
| --- | --- |
| 70-100 | Reads human |
| 40-69 | Getting natural |
| 0-39 | Needs a human pass |

## Live Sources

Article generation can collect live context from arXiv and RSS feeds. Slow or blocked feeds are recorded as unavailable instead of breaking the whole article.

Current enabled RSS sources include NPR World, France 24, CNBC World, UN News, TechCrunch, Ars Technica, Wired, MIT Technology Review, Engadget, Hacker News via HNRSS, CNBC Top News, MarketWatch, and 36Kr.

## Private Local Mode

Point the backend at a local OpenAI-compatible server:

```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=qwen2.5:14b
LLM_THINKING_TYPE=off
LLM_REASONING_EFFORT=off
```

## Useful Commands

```bash
cd backend
npm run build
npm run test:research
npm run test:score
```

```bash
cd frontend
npm run build
```

## Project Map

```text
backend/
  src/routes/      API endpoints
  src/services/    rewrite, article, docx, score, research
  src/prompts/     model prompts

frontend/
  src/components/  upload, generate, editor, common UI
  src/lib/         API client, store, i18n

assets/screenshots/  README screenshots and GIF
docs/                design notes and background image
```

## Notes

- Generated articles still need human fact-checking.
- Live sources can change or go offline.
- Documents are stored in backend memory and disappear after restart.
- Public deployment should add authentication, rate limits, and persistent storage.

## License

[MIT](LICENSE)
