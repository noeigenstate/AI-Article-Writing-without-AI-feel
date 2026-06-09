<div align="center">

# Speak Plainly · 说人话

**把 AI 味很重的初稿，改成更像真人写的文字。**

一个开源 AI 写作工作台：支持 **Word 改写**、**人类感评分**、**带资料来源的文章生成**。界面支持中文和英文。

[![License: MIT](https://img.shields.io/badge/License-MIT-22a06b.svg)](LICENSE)
![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)

[English](README.md) · 中文说明

</div>

---

## 一眼看懂

<div align="center">
  <img src="assets/screenshots/demo-generate.gif" alt="Speak Plainly 页面演示" width="820" />
  <br />
  <sub>玻璃质感界面，Word 改写和文章生成都在同一个工作台里。</sub>
</div>

| 改写 Word | 生成文章 |
| --- | --- |
| <img src="assets/screenshots/01-rewrite.png" alt="改写 Word 页面" /> | <img src="assets/screenshots/02-generate.png" alt="生成文章页面" /> |

## 它能做什么

- **上传 `.docx` 初稿**，改写后再导出成 Word。
- **给文字打“人类感评分”**，0-100 分，越高越像真人文章。
- **逐句修改**：点任意句子，选择替代表达，或者手动改。
- **学习你的口吻**：上传 `.docx` 或 `.txt` 范文，让输出更像你的风格。
- **按标题或领域生成文章**：自动查 arXiv 论文和新闻 RSS，带资料、图表和引用。
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
前端：Vite 会打印本地地址，通常是 `http://localhost:51773`

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

生成文章时，后端会尝试从 arXiv 和 RSS 源收集资料。某个来源慢或超时，不会让整篇文章失败，只会记录为“暂不可用”。

当前启用的 RSS 源包括 NPR World、France 24、CNBC World、UN News、TechCrunch、Ars Technica、Wired、MIT Technology Review、Engadget、Hacker News via HNRSS、CNBC Top News、MarketWatch 和 36Kr。

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
```

## 项目结构

```text
backend/
  src/routes/      API 路由
  src/services/    改写、文章、Word、评分、资料检索
  src/prompts/     模型提示词

frontend/
  src/components/  上传、生成、编辑器、通用组件
  src/lib/         API、状态、国际化文案

assets/screenshots/  README 截图和 GIF
docs/                设计资料和背景图
```

## 使用提醒

- 生成内容仍然需要人工核对事实。
- 实时来源可能会变慢、超时或下线。
- 文档目前存在后端内存里，重启后会丢失。
- 如果公开部署，需要自己加登录、限流和持久化存储。

## 许可证

[MIT](LICENSE)
