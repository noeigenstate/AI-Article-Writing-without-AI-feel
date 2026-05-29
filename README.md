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

1. 上传待改写的 `.docx`；在「选择改写风格」里选内置「我的风格」（蒸馏自公众号文章）或上传范文，两者可叠加。
2. 点「整篇改写（去 AI 味）」。标题会**单独按"概括全文+抓住注意力"改写**，正文逐段去 AI 味。
3. 点任意**句子** → 弹出 3 个候选表达；点**标题** → 弹出多个"概括全文"的标题方案；也可手动编辑 → 「采用这段」。
4. 点「导出 Word」下载结果。

## 验收脚本（backend）

```bash
npm run test:docx    # 解析/切句/导出往返（无需模型）
npm run test:llm     # 模型连通性 + 单句候选（需有效 API Key）
npm run test:full    # 整篇改写 + 段落对齐
```

## 已知限制（MVP）

- 导出复用原始 docx，**只替换你改动过的段落**，未改动段落一字节不动（含段内字符级格式）。
- 段落级格式（段落数/顺序/标题层级/列表）完整保留；**被改写**的段落，其段内字符级格式（个别字加粗/变色）会并入整段、不再保留——因为文字变了无法对回原 run。
- 文档存于后端内存，重启后失效。
- 整篇改写按 12 段一块并行调用模型；超长文档可调 `rewrite.ts` 的 `chunkSize`。
