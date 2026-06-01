<div align="center">

# Speak Plainly · 说人话

**让文字写得像人，也站得住。**

一个开源写作工作台：把初稿里的「AI 味」去掉，并生成有证据支撑的文章 —— 支持 **中文和英文**。

[![License: MIT](https://img.shields.io/badge/License-MIT-22a06b.svg)](LICENSE)
![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-ff8fab.svg)

[English](README.md) · 中文

</div>

---

Speak Plainly 能把 Word 文章改得更自然、去掉常见的 AI 腔，也能根据领域或标题一键生成文章，并自动检索 arXiv、RSS 新闻源和公开网页信息，为文章补上引用、图片、表格和证据链。界面与生成内容都可以在 **中文 / 英文** 之间切换。

它不是「再套一层提示词」的 AI 写作壳。目标是把内容生产拆成可检查的步骤：选题、资料、论点、段落、图片、表格、引用、导出，每一步都尽量留下来源和编辑入口。

## 截图

<table>
<tr>
<td width="50%" align="center">
<img src="assets/screenshots/01-rewrite.png" alt="Word 去 AI 味改写" /><br/>
<sub><b>Word 去 AI 味改写</b></sub>
</td>
<td width="50%" align="center">
<img src="assets/screenshots/02-generate.png" alt="文章生成" /><br/>
<sub><b>带实时资料的文章生成</b></sub>
</td>
</tr>
</table>

## 适合做什么

- 把 AI 初稿改成更像真人写的文章。
- 上传 `.docx` 后按内置风格或参考范文进行整篇改写。
- 点击单句获取多个替代表达，再手动微调。
- 按领域自动生成选题。
- 输入标题后，让 AI 自动判断领域并生成文章。
- 自动聚合 arXiv、新闻 RSS、科技媒体和网页图片，作为写作素材。
- 生成带图片、表格、参考文献和来源说明的文章。
- 导出新的 Word 文档，继续进入人工编辑或发布流程。

## 功能亮点

| 能力 | 说明 |
| --- | --- |
| 去 AI 味改写 | 对 Word 正文做风格化改写，减少口号式、模板式、泛泛而谈的表达。 |
| 范文风格学习 | 可选择内置写作风格，也可上传 `.docx` / `.txt` 范文提取风格画像。 |
| 逐句编辑 | 文章生成或改写后，点击句子即可获取候选表达，支持直接手动改。 |
| 选题规划 | 按领域生成选题，覆盖 AI 科技、商业财经、职场成长、教育、健康、文化、社会观察、自媒体等方向。 |
| 标题直达 | 用户只输入标题，后端调用 AI 判断领域，再走同一套研究和生成链路。 |
| 实时资料支持 | 聚合 arXiv 与 RSS/Atom 来源，并做去重、截断、缓存和安全上下文包装。 |
| 图表与引用 | 生成文章时输出结构化正文、来源图片、证据表格和参考文献。 |
| Word 导出 | 改写文档保留原始结构；生成文章可导出为 `.docx`。 |
| 中英双语 | 界面与生成内容都可在中文 / 英文之间切换。 |

## 工作流

```text
输入标题或选择领域
        ↓
AI 判断领域 / 自动生成选题
        ↓
检索 arXiv、RSS、新闻与公开网页图片
        ↓
生成正文、图、表格、引用和参考文献
        ↓
Web 端结构化预览与逐句编辑
        ↓
导出 Word
```

Word 改写链路：

```text
上传 Word + 可选范文
        ↓
解析 docx 段落与标题
        ↓
提取风格画像
        ↓
整篇改写 / 单句候选 / 标题候选
        ↓
只替换改动段落并导出 Word
```

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | React, Vite, TypeScript, Zustand |
| 后端 | Node.js, TypeScript, Express |
| 文档处理 | jszip 解析与导出 `.docx` |
| 模型接口 | OpenAI SDK 兼容接口，默认 DeepSeek |
| 研究资料 | arXiv, RSS/Atom, 公开网页元信息 |
| 输出结构 | 段落、图片、表格、参考文献、Word 文档 |

## 项目结构

```text
speak-plainly/
├── backend/
│   └── src/
│       ├── server.ts              # Express API 路由
│       ├── prompts.ts             # 改写 / 选题 / 文章生成提示词（中英）
│       ├── i18n.ts                # 后端语言文案
│       ├── styles.ts              # 内置风格画像
│       ├── services/
│       │   ├── article.ts         # 文章生成、图表、引用和渲染块
│       │   ├── docx.ts            # Word 解析与导出
│       │   ├── llm.ts             # 模型调用
│       │   ├── rewrite.ts         # 去 AI 味改写链路
│       │   └── research/          # arXiv、RSS、图片提取、缓存、限流
│       └── scripts/               # 本地测试脚本
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── api.ts
│       ├── i18n.ts                # 界面文案字典（中英）
│       ├── store.ts
│       └── components/
├── assets/screenshots/
└── README.md
```

## 快速开始

需要 Node.js 18 或更高版本。

### 1. 配置模型 Key

复制示例配置并填入自己的 Key：

```bash
cp backend/.env.example backend/.env
```

Windows PowerShell：

```powershell
Copy-Item backend/.env.example backend/.env
```

`backend/.env` 内容示例：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-pro
LLM_THINKING_TYPE=enabled
LLM_REASONING_EFFORT=high
PORT=8787
```

也可以使用通用变量：

```env
LLM_API_KEY=your_openai_compatible_api_key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-pro
```

读取优先级：`LLM_API_KEY` 优先，其次 `DEEPSEEK_API_KEY`。

不要把真实 API Key 提交到 GitHub。`.env` 已在 `.gitignore` 中忽略。

### 2. 启动后端

```bash
cd backend
npm install
npm start
```

默认后端地址：`http://localhost:8787`

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端通过 Vite 代理访问后端。需要改后端地址时：

```bash
BACKEND_URL=http://localhost:8787 npm run dev
```

Windows PowerShell：

```powershell
$env:BACKEND_URL="http://localhost:8787"
npm run dev
```

用右上角的 **EN / 中文** 开关切换语言；选择会被记住，并决定生成内容的语言。

## 使用指南

### 改写 Word

1. 进入「改写 Word」。
2. 上传待改写的 `.docx`。
3. 选择内置风格，或上传参考范文。
4. 点击上传并解析。
5. 点击整篇润色，或在编辑器中逐句查看候选表达。
6. 检查结果后导出 Word。

### 生成文章

1. 进入「生成文章」。
2. 输入标题直接生成，或选择领域后自动生成选题。
3. 系统会检索论文、新闻和公开网页信息。
4. 生成文章后检查正文、图片、表格与参考文献。
5. 在编辑器中继续逐句调整。
6. 导出 Word。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 检查模型服务连通性 |
| `GET` | `/api/styles?lang=` | 获取内置写作风格 |
| `POST` | `/api/upload` | 上传 Word 与参考范文 |
| `POST` | `/api/rewrite` | 整篇去 AI 味改写 |
| `POST` | `/api/title` | 基于全文生成标题候选 |
| `POST` | `/api/sentence/alternatives` | 获取单句候选表达 |
| `POST` | `/api/export` | 导出 Word |
| `GET` | `/api/article/domains?lang=` | 获取文章领域 |
| `POST` | `/api/article/topics` | 按领域生成选题 |
| `POST` | `/api/article/generate` | 按选题生成文章 |
| `POST` | `/api/article/generate-from-title` | 按标题自动匹配领域并生成文章 |
| `POST` | `/api/research/preview` | 预览研究资料聚合结果 |

所有内容相关接口都接受 `lang` 字段（`"en"` 或 `"zh"`），用于控制生成内容的语言。

## 测试与构建

后端：

```bash
cd backend
npm run test:docx
npm run test:article
npm run test:research
npm run build
```

前端：

```bash
cd frontend
npm run build
```

模型连通性测试（需要有效 API Key）：

```bash
cd backend
npm run test:llm
```

## 资料来源

Speak Plainly 当前支持：

- **arXiv**：用于获取开放论文条目和摘要。
- **RSS/Atom**：用于获取公开新闻、科技、财经和中文内容源。
- **公开网页元信息**：优先读取来源页面的 `og:image`、`twitter:image` 等图片信息。

注意：不同媒体的 RSS、图片和转载规则不一样。项目只做技术聚合，不自动授予转载权。公开发布前需要人工确认来源、版权、事实和引用格式。

## 内容质量原则

生成文章时，项目提示词会尽量约束以下要求：

- 不写 AI 口头禅。
- 不用空泛过渡句堆篇幅。
- 观点必须绑定资料、数据或明确来源。
- 段落要有清晰推进关系。
- 图片优先来自引用来源，并显示说明与来源。
- 参考文献使用接近学术论文的格式。

模型仍可能出错。高风险内容、事实判断、财经医疗法律内容必须人工复核。

## 当前限制

- 生成结果依赖模型质量和实时来源质量，需要人工复核。
- RSS 来源可用性会变化，部分站点可能没有稳定公开 feed。
- Word 导出会尽量保留结构，但被改写段落的段内字符级样式不能完全还原。
- 文档当前存放在后端内存中，服务重启后会失效。
- 公网部署前需要补鉴权、限流、持久化存储和更严格的上传文件限制。

## Roadmap

- 生成结果页截图与演示 GIF。
- Docker Compose。
- 封面图、卡片和长图导出。
- 上传资料库，按自有资料生成文章。
- 来源可信度评分与引用格式模板。
- 用户级任务历史和草稿管理。

## 贡献

欢迎提交 Issue 或 Pull Request。建议 PR 尽量小，并说明：

- 改动目标
- 主要实现方式
- 已执行测试
- 可能影响的模块

## License

本项目基于 [MIT License](LICENSE) 开源，可自由使用、修改和二次开发，仅需保留版权与许可声明。
