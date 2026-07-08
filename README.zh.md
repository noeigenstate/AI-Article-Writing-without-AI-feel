<div align="center">

# Speak Plainly · 说人话

**把 AI 味很重的初稿，改成更像真人写的文字。**

一个开源 AI 写作工作台：支持 **Word 改写**、**人类感评分**、**带资料来源的文章生成**、**公众号一键排版**。界面支持中文和英文。

[![License: MIT](https://img.shields.io/badge/License-MIT-22a06b.svg)](LICENSE)
![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)

[English](README.md) · 中文说明

</div>

---

## 一眼看懂

| 改写 Word | 生成文章 | 公众号排版 |
| --- | --- | --- |
| <img src="assets/screenshots/01-rewrite.png" alt="改写 Word 页面" /> | <img src="assets/screenshots/02-generate.png" alt="生成文章页面" /> | <img src="assets/screenshots/03-gzh.png" alt="公众号排版页面" /> |

<div align="center">
  <sub>清爽的 SaaS 风格工作台：Word 改写、带来源文章生成和公众号排版，都在同一个侧边栏导航里。</sub>
</div>

## 它能做什么

- **上传 `.docx` 初稿**，改写后再导出成 Word。
- **给文字打“人类感评分”**，0-100 分，越高越像真人文章。
- **逐句修改**：点任意句子，选择替代表达，或者手动改。
- **学习你的口吻**：上传 `.docx` 或 `.txt` 范文，让输出更像你的风格。
- **显示模型工作进度**：生成文章、整篇润色、标题候选、选题生成都会显示百分比、当前阶段和日志。
- **按标题或领域生成文章**：自动查 arXiv 论文、新闻 RSS，并可选接入 Agent-Reach / Exa 全网搜索，带资料、图表和引用。
- **生成文章后一键排版公众号**：在文章编辑器里选主题、点「自动排版」，排版结果一键复制、直接粘贴进微信公众号编辑器，样式不丢。
- **可以本地私有运行**：支持 Ollama、LM Studio、vLLM 等 OpenAI 兼容接口。

## 基础环境

你需要先安装这些：

| 环境 | 用来做什么 |
| --- | --- |
| Node.js 18+ | 运行前端和后端 |
| npm | 安装项目依赖 |
| 模型 API Key | 默认可接 DeepSeek / OpenAI 兼容接口 |
| 或本地模型服务 | 例如 Ollama、LM Studio、vLLM |
| `.docx` 文件 | Word 改写模式需要 |

Windows 用户如果想运行 `./run.sh`，建议装 Git Bash。也可以直接用 `run.bat`。

如果想让文章资料来源更广，可以额外安装 [Agent-Reach](https://github.com/Panniantong/Agent-Reach)，并确保 `mcporter` 命令和 Exa 后端可用。Reddit、X/Twitter 等社交来源通常需要登录态或 cookies，目前不会默认自动启用。

## 快速启动

一个终端就够：

```bash
./run.sh
```

Windows 也可以双击或运行：

```bat
run.bat
```

启动脚本会检查基础依赖，首次运行会准备 `backend/.env`，安装依赖，并在启动前清理同一个服务端口，避免后台旧进程占用端口。

停止服务：

```bash
./stop.sh
```

```bat
stop.bat
```

手动启动：

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

后端：`http://localhost:8787`  
前端：Vite 会打印本地地址，通常是 `http://localhost:5173`

## 界面风格

当前界面是清爽的 SaaS 风格工作台：左侧白色边栏负责工具切换和语言切换，主区是柔和的极光渐变底、渐变大标题、白色圆角步骤卡片和紫色渐变主按钮。目标是一个像现代网页工具的写作工作台，而不是装饰性皮肤。

所有长耗时动作都会有明确反馈。前端会为文章生成、选题/标题生成和整篇润色显示进度面板，包括百分比、当前阶段和最近日志，避免用户空等。

## 人类感评分怎么算

分数越高越好。

```text
人类感评分 = round(文本长度置信度 * (100 - 总扣分))
总扣分 = min(100, 各类 AI 痕迹封顶扣分之和)
```

这个评分完全在本地计算，不调用模型，也不会上传你的文本。

评分会先按文本长度归一化：中文每 **120 个字** 算 1 个长度单位，英文每 **100 个词** 算 1 个长度单位。文本太短时证据不足，空文本为 0 分；少于 40 个中文字或 25 个英文词时，`文本长度置信度 = 0.65`。

| 信号 | 最高扣分 | 主要判断 |
| --- | ---: | --- |
| 套话开头/结尾 | 26 | “总而言之”“由此可见”等模板收束 |
| 空泛废话 | 22 | 正确但没有信息量的表达 |
| AI 黑话 | 18-20 | 赋能、闭环、cutting-edge 等高频模型词 |
| 模型腔口头禅 | 18 | “稳稳拖住”“接住”“更狠一点”“直接拉满”等短视频/模型腔表达 |
| 机械连接词 | 18 | 句首反复“此外/然而/因此”等 |
| 泛化框架句 | 14 | “关键在于”“核心在于”等套路结构 |
| 排比堆叠 | 14-16 | 过于整齐的并列句式 |
| Markdown 残留 | 20 | `##`、列表、加粗符号等泄漏到正文 |
| 句长过于均匀 | 12 | 句子长短变化太小 |
| 词语重复偏多 | 10 | 非停用词反复出现 |
| 具体锚点不足 | 8 | 数字、人名、引用、专有信息太少 |

整篇去 AI 味的提示词也会按内容创作者工作流约束：先去掉模型腔，再保留具体证据、名字、数字、时间；需要画面感时补具体场景，不用抽象口号硬拔高。

| 分数 | 含义 |
| --- | --- |
| 70-100 | 读起来像人 |
| 40-69 | 逐渐自然 |
| 0-39 | 需要人工润色 |

## 实时资料来源

生成文章时，后端会尝试从 arXiv、RSS 源和可选的 Agent-Reach / Exa 全网搜索收集资料。某个来源慢、超时或未配置，不会让整篇文章失败，只会记录为“暂不可用”。

当前启用的 RSS 源包括 NPR World、France 24、CNBC World、UN News、TechCrunch、Ars Technica、Wired、MIT Technology Review、Engadget、Hacker News via HNRSS、CNBC Top News、MarketWatch 和 36Kr。

目前 Agent-Reach 集成的是 Exa/mcporter 搜索路径，用作宽泛网页资料来源；Windows 下会经 cmd.exe 调用并正确转义参数，行为与 macOS/Linux 一致。Reddit、X/Twitter、小红书等需要登录态的社交来源，需要单独配置凭证/cookies，因此不会默认开启。

正文中的 `[n]` 引用只出现在模型真实引用了资料的位置——指向不存在参考文献的编号会被清理，而不是补造假引用。头图使用真实来源图片时，图片会被下载并内嵌进导出的 Word（Word 不会加载外链图片）。

## 公众号排版

生成文章后，编辑器顶部会出现排版工具条：下拉选一套主题、点「**自动排版**」，文章就被转成能安全粘贴进微信公众号编辑器的 HTML——全部内联样式、文字节点 `<span leaf="">` 包裹、不用 `<div>`/`class`/`id`、正文全角标点。

- **六套主题** 基于 [gzh-design-skill](https://github.com/isjiamu/gzh-design-skill) 的组件库：翡翠清新、红白杂志、石墨极简、禅意留白、创意票据、橄榄内刊。每套主题定义了封面、章节标题、引言卡、签名区等组件，模型按章节取组件装配。
- **确定性合规校验**（移植自该 skill 的 Python 校验器）：禁用标签/样式记为错误，漏包裹和半角标点记为提醒，违规块自动修复一轮。
- **一键粘贴**：预览即最终效果，点「复制到公众号」把富文本放进剪贴板直接去粘贴；下载的 HTML 是自带复制按钮的独立预览页。

## 本地私有模式

把 `backend/.env` 指向本地 OpenAI 兼容服务：

```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=qwen2.5:14b
LLM_THINKING_TYPE=off
LLM_REASONING_EFFORT=off
```

## 常用命令

```bash
cd backend
npm run build
npm run test:research
npm run test:score
```

```bash
cd frontend
npm run build
npm run test:progress
```

## 项目结构

```text
backend/
  src/routes/      API 路由
  src/services/    改写、文章、Word、评分、资料检索、公众号排版
  src/prompts/     模型提示词
  assets/gzh/      公众号主题组件库（来自 gzh-design-skill）

frontend/
  src/components/  上传、生成、公众号排版、编辑器、通用组件
  src/lib/         API、状态、国际化文案
  src/styles.css   浅色工作台主题（边栏、大标题、卡片）

assets/screenshots/  README 截图
docs/                设计资料
```

## 使用提醒

- 生成内容仍然需要人工核对事实。
- 实时来源可能会变慢、超时或下线。
- 文档目前存在后端内存里，重启后会丢失。
- 如果公开部署，需要自己加登录、限流和持久化存储。

## 许可证

本项目自身代码：[MIT](LICENSE)。

> **⚠️ 重点：内含 AGPL-3.0 内容。** 公众号排版功能整合了 [gzh-design-skill](https://github.com/isjiamu/gzh-design-skill)（作者：甲木 × 摸鱼小李）的主题组件库和校验规则，该项目采用 **AGPL-3.0** 协议（完整文本见 `backend/assets/gzh/LICENSE`）。

实际怎么遵循：

- **个人 / 内部使用**：没有额外义务，随便用、随便改。
- **署名**：保留上游版权声明和 `backend/assets/gzh/LICENSE` 文件（本仓库已保留）。
- **再分发本仓库（含公开 fork）**：内置主题库始终是 AGPL-3.0；包含它们的整体作品需要按 AGPL-3.0 条款分发。可行做法三选一——整体按 AGPL-3.0 分发（MIT 代码可以并入 AGPL 整体）、删掉或替换 `backend/assets/gzh/` 内容后再分发、或联系上游作者取得单独授权。
- **公开部署为网络服务**（AGPL 第 13 条）：必须向该服务的用户提供你正在运行的（含修改的）完整对应源码。
