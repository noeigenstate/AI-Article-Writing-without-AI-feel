import express from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config.js";
import { parseDocx, exportDocx } from "./services/docx.js";
import { splitSentences } from "./services/splitter.js";
import { health } from "./services/llm.js";
import {
  extractStyleProfile,
  rewriteDocument,
  generateAlternatives,
} from "./services/rewrite.js";
import { saveDoc, getDoc } from "./store.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({ storage: multer.memoryStorage() });

/** 健康检查：模型连通性 */
app.get("/api/health", async (_req, res) => {
  res.json(await health());
});

/**
 * 上传目标 docx（字段 file）+ 可选范文（字段 references[]，docx 或 txt）。
 * 返回 docId、段落结构（含原句切分）、风格画像。
 */
app.post(
  "/api/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "references", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const target = files?.file?.[0];
      if (!target) return res.status(400).json({ error: "缺少目标文件 file" });

      const parsed = await parseDocx(target.buffer);

      // 范文 → 文本
      let sampleText = "";
      for (const f of files?.references ?? []) {
        if (f.originalname.toLowerCase().endsWith(".docx")) {
          const p = await parseDocx(f.buffer);
          sampleText += p.paragraphs.map((x) => x.text).join("\n") + "\n\n";
        } else {
          sampleText += f.buffer.toString("utf8") + "\n\n";
        }
      }
      const styleSummary = await extractStyleProfile(sampleText).catch(() => "");

      const rec = saveDoc({ buf: target.buffer, paragraphs: parsed.paragraphs, styleSummary });

      res.json({
        docId: rec.id,
        styleSummary,
        paragraphs: parsed.paragraphs.map((p) => ({
          index: p.index,
          kind: p.kind,
          original: p.text,
          sentences: splitSentences(p.text),
        })),
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

/** 整篇改写 */
app.post("/api/rewrite", async (req, res) => {
  try {
    const { docId } = req.body as { docId: string };
    const rec = getDoc(docId);
    if (!rec) return res.status(404).json({ error: "文档不存在或已过期" });

    const map = await rewriteDocument(
      rec.styleSummary,
      rec.paragraphs.map((p) => ({ index: p.index, kind: p.kind, text: p.text }))
    );

    res.json({
      paragraphs: rec.paragraphs.map((p) => {
        const text = map.get(p.index) ?? p.text;
        return {
          index: p.index,
          kind: p.kind,
          original: p.text,
          rewritten: text,
          sentences: splitSentences(text),
        };
      }),
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 单句候选 */
app.post("/api/sentence/alternatives", async (req, res) => {
  try {
    const { docId, context, sentence, n } = req.body as {
      docId: string;
      context: string;
      sentence: string;
      n?: number;
    };
    const rec = getDoc(docId);
    if (!rec) return res.status(404).json({ error: "文档不存在或已过期" });
    const alts = await generateAlternatives(rec.styleSummary, context, sentence, n ?? 3);
    res.json({ alternatives: alts });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 导出：body.texts 为 {段落序号: 最终文本}，缺省段落保持原样 */
app.post("/api/export", async (req, res) => {
  try {
    const { docId, texts } = req.body as { docId: string; texts: Record<string, string> };
    const rec = getDoc(docId);
    if (!rec) return res.status(404).json({ error: "文档不存在或已过期" });

    const max = rec.paragraphs.length;
    const arr: (string | undefined)[] = new Array(max).fill(undefined);
    for (const [k, v] of Object.entries(texts ?? {})) {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0 && i < max) arr[i] = v;
    }

    const out = await exportDocx(rec.buf, arr);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", 'attachment; filename="rewritten.docx"');
    res.send(out);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.listen(config.port, () => {
  console.log(`speak-plainly backend listening on http://localhost:${config.port}`);
});
