<div align="center">

# Speak Plainly · 说人话

**让文字写得像人，也站得住。**

一个开源写作工作台：把初稿里的「AI 味」去掉，并给出改写前后的分数。支持 **中文和英文**。

[![License: MIT](https://img.shields.io/badge/License-MIT-22a06b.svg)](LICENSE)
![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-ff8fab.svg)

[English](README.md) · 中文

</div>

---

## 它解决什么

AI 写出来的稿子，一眼就能看出是 AI 写的：千篇一律的套话开头、满屏黑话、过于工整的排比——读者有感觉，审稿的人更有感觉。市面上大多数「去 AI 味」工具只想着骗过检测器。Speak Plainly 做的是更实用的事：先**量化** AI 味，再把它**改掉**，而且**直接用你手上那份 Word**。

## 你能用它做什么

- **丢一份 Word 初稿进去，拿回一份像真人写的** —— 整篇去 AI 味改写，导回 `.docx` 时保留原有排版。
- **看到改写前后的分数，而不是凭感觉** —— 0–100 的 AI 味评分，并指出具体踩了哪些坑（套话、黑话、漏进正文的 Markdown、机械连接词、句长过于均匀）。
- **改成「你」的口吻** —— 选内置风格，或上传自己的 `.docx` / `.txt` 范文来模仿其文风。
- **逐句打磨** —— 点任意句子拿多个替代表达，也可以直接手改。
- **从零写、带出处** —— 给一个标题或领域，自动检索 arXiv 论文和新闻 RSS，生成带图表、证据表格和参考文献的文章。
- **可以完全本地、保护隐私** —— 指向本地模型（Ollama / LM Studio / vLLM），文本不出本机。评分本身永远在本地算。

## 演示

<div align="center">
<img src="assets/screenshots/demo-generate.gif" alt="输入标题，一键生成带出处的全文" width="760" /><br/>
<sub><b>从一个标题到一篇有出处的文章——检索、配图、引用，一次完成。</b></sub>
</div>

<table>
<tr>
<td width="50%" align="center">
<img src="assets/screenshots/01-rewrite.png" alt="去 AI 味编辑器 + 本地评分" /><br/>
<sub><b>去 AI 味编辑器，带本地 AI 味评分与命中痕迹明细</b></sub>
</td>
<td width="50%" align="center">
<img src="assets/screenshots/02-generate.png" alt="输入标题或选择领域" /><br/>
<sub><b>从标题或领域开始</b></sub>
</td>
</tr>
</table>

## 为什么选它

这个领域里，开源项目大多要么是**一段提示词**（粘进对话框用），要么是**过检测器**的服务。Speak Plainly 是另一种思路：

| | 提示词 / skill 仓库 | 过检测器工具 | **Speak Plainly** |
| --- | :---: | :---: | :---: |
| 可运行的应用 + 界面 | ✗ | ✓ | ✓ |
| 改写前后 AI 味评分 | ✗ | 很少 | ✓（本地） |
| Word 进 → Word 出，保留排版 | ✗ | ✗ | ✓ |
| 从范文学**你的**风格 | 很少 | ✗ | ✓ |
| 带研究资料的文章生成 | ✗ | ✗ | ✓ |
| 可完全本地运行 | ✗ | ✗ | ✓ |
| 目标 | 去味 | 骗过查重 | **像人写的，且站得住** |

我们刻意不追求「100% 不可检测」，目标是一份真人编辑能放行的稿子。

## 快速开始

需要 Node.js 18+。

**一键启动** —— 首次运行会自动创建 `backend/.env`、安装依赖并同时启动前后端：

```bash
./run.sh      # macOS / Linux / Windows（Git Bash）
```

```bat
run.bat       :: Windows —— 双击，或在终端里运行
```

<details>
<summary>或者手动分别启动两个服务</summary>

```bash
# 1. 配置模型 Key
cp backend/.env.example backend/.env   # 然后编辑它

# 2. 后端
cd backend && npm install && npm start        # http://localhost:8787

# 3. 前端（新开一个终端）
cd frontend && npm install && npm run dev
```

</details>

任何 OpenAI 兼容接口都能用（默认 DeepSeek）。用右上角 **EN / 中文** 切换界面和生成内容的语言。

### 私有 / 本地模式

想让文本完全不出本机？在 `backend/.env` 里指向本地服务，并关掉云端专属的推理参数：

```env
LLM_BASE_URL=http://localhost:11434/v1   # Ollama
LLM_API_KEY=ollama
LLM_MODEL=qwen2.5:14b
LLM_THINKING_TYPE=off
LLM_REASONING_EFFORT=off
```

AI 味评分永远在本地计算，不调用任何模型。

## 10 秒看效果

```bash
cd backend
npm run test:score              # 离线对比「AI 味样本」与「人话样本」的分数
npm run test:score -- --rewrite # 额外调用模型改写并打印「前 → 后」
```

## 使用须知

- 生成质量取决于模型和实时来源，仍需人工审核——尤其是事实、财经、医疗、法律类内容。
- 生成文章只做技术性聚合，不代表授予转载权。发布前请自行核对版权与事实。
- 文档存于后端内存，重启即丢。公开部署需自行加鉴权、限流和持久化存储。

<details>
<summary><b>技术细节</b>（栈 / 结构 / API）</summary>

**技术栈：** 前端 React + Vite + Zustand；后端 Node + Express + TypeScript；用 `jszip` 解析/导出 `.docx`；模型走任意 OpenAI 兼容接口。AI 味评分是 `backend/src/services/aiScore.ts` 里的纯启发式算法——不联网、不调模型。

**结构：** 后端拆为 `core/`（配置、i18n、store）、`routes/`（每个功能一个路由，由 `app.ts` 组装）、`services/`（`rewrite`、`article`、`docx`、`aiScore`、`research/`）、`prompts/`、`data/`、共享 `lib/`。前端把状态/接口/i18n 放在 `frontend/src/lib/`，UI 按 `frontend/src/components/{editor,generate,upload,common}/` 分组。

**主要 API：** `POST /api/upload` · `POST /api/rewrite`（返回改写前后评分）· `POST /api/score` · `POST /api/sentence/alternatives` · `POST /api/title` · `POST /api/article/generate` · `POST /api/export`。所有内容接口都接受 `lang`（`"en"` 或 `"zh"`）。

**构建与测试：**

```bash
cd backend  && npm run build && npm run test:docx && npm run test:article && npm run test:score
cd frontend && npm run build
```

</details>

## 路线图

- 编辑器内的评分明细面板（悬停某个坑 → 高亮对应句子）。
- Docker Compose。
- 个人素材库，从自己的素材生成。
- 按用户的历史记录与草稿管理。

## 参与贡献

欢迎 Issue 和 PR——保持小步提交，说清楚改了什么、为什么、测了什么。

## 许可证

[MIT](LICENSE)。
