# Speak Plainly · 去 AI 味文章改写工具

上传一篇 Word 文章 + 几篇风格相近的范文，让 AI 模仿范文风格改写正文、去除"AI 味"；
改写后逐句对照，**点任意句子即可获取多个表达选项**，也可手动编辑，最终导出新的 Word。

详细设计见 [`开发计划.md`](开发计划.md)。

## 技术栈

- 后端：Node + TypeScript + Express，`jszip` 解析/导出 docx，`openai` SDK 走 OpenAI 兼容接口
- 前端：React + Vite + TypeScript + Zustand
- 模型：Xiaomi MiMo `mimo-v2.5-pro`（OpenAI 兼容，可在 `backend/.env` 换）

## 运行

需要 Node ≥ 18。

### 1. 后端

```bash
cd backend
npm install
npm start            # 启动在 http://localhost:8787
```

模型配置在 `backend/.env`（`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`）。

### 2. 前端

```bash
cd frontend
npm install
npm run dev          # 打开 http://localhost:5173
```

前端通过 Vite 代理把 `/api` 转发到后端 8787，直接用即可。

## 使用流程

1. 上传待改写的 `.docx`，可选上传若干风格范文（`.docx`/`.txt`）。
2. 点「整篇改写（去 AI 味）」，等待整篇改写完成。
3. 点任意句子 → 弹出 3 个候选表达，或在编辑框手动改 → 「采用这段」。
4. 点「导出 Word」下载结果（保留原文档段落级格式）。

## 验收脚本（backend）

```bash
npm run test:docx    # 解析/切句/导出往返（无需模型）
npm run test:llm     # 模型连通性 + 单句候选（需有效 API Key）
npm run test:full    # 整篇改写 + 段落对齐
```

## 已知限制（MVP）

- Word 格式只保 **段落级**（标题/正文/列表）；字符级格式（个别字加粗/变色）暂不保留。
- 文档存于后端内存，重启后失效。
- 整篇改写按 12 段一块并行调用模型；超长文档可调 `rewrite.ts` 的 `chunkSize`。
