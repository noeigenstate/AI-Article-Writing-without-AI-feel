import express from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config.js";
import { createDocxFromBlocks, parseDocx, exportDocx } from "./services/docx.js";
import { splitSentences } from "./services/splitter.js";
import { health } from "./services/llm.js";
import {
  ARTICLE_DOMAINS,
  articleToDocBlocks,
  articleToRenderBlocks,
  enrichArticleWithResearch,
  generateArticleDraft,
  generateTopicOptions,
  matchArticleDomainFromTitle,
  resolveArticleDomain,
  type ArticleDomain,
  type TopicOption,
} from "./services/article.js";
import { collectResearch, formatResearchContext } from "./services/research/aggregate.js";
import { enrichResearchImages } from "./services/research/images.js";
import {
  extractStyleProfile,
  rewriteDocument,
  generateAlternatives,
  generateTitles,
  titleIndexOf,
  fullText,
} from "./services/rewrite.js";
import { saveDoc, getDoc } from "./store.js";
import { BUILTIN_STYLES, getBuiltinStyle } from "./styles.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({ storage: multer.memoryStorage() });

/** 健康检查：模型连通性 */
app.get("/api/health", async (_req, res) => {
  res.json(await health());
});

/** 内置风格列表（蒸馏自作者作品的 skill） */
app.get("/api/styles", (_req, res) => {
  res.json({ styles: BUILTIN_STYLES.map(({ id, name, desc }) => ({ id, name, desc })) });
});

/** 公众号文章生成：领域列表 */
app.get("/api/article/domains", (_req, res) => {
  res.json({ domains: ARTICLE_DOMAINS });
});

/** 公众号文章生成：按领域自动生成选题 */
app.post("/api/article/topics", async (req, res) => {
  try {
    const { domainId, customDomain, n } = req.body as {
      domainId?: string;
      customDomain?: string;
      n?: number;
    };
    const domain = resolveArticleDomain(domainId, customDomain);
    const bundle = await collectResearch(domain.name, domain.name);
    const researchContext = formatResearchContext(bundle.items, 10);
    const topics = await generateTopicOptions({ domain, n: n ?? 6, researchContext });
    res.json({ domain, topics, research: bundle });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Research preview context aggregation */
app.post("/api/research/preview", async (req, res) => {
  try {
    const { domainId, customDomain, query } = req.body as {
      domainId?: string;
      customDomain?: string;
      query?: string;
    };
    const domain = resolveArticleDomain(domainId, customDomain);
    const bundle = await collectResearch(domain.name, query?.trim() || domain.name);
    res.json({ ...bundle, context: formatResearchContext(bundle.items, 8) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 公众号文章生成：从选题生成完整文章，并进入现有编辑/导出链路 */
app.post("/api/article/generate", async (req, res) => {
  try {
    const { domainId, customDomain, topic, styleId, targetLength } = req.body as {
      domainId?: string;
      customDomain?: string;
      topic: TopicOption | string;
      styleId?: string;
      targetLength?: "short" | "medium" | "long";
    };
    if (!topic) return res.status(400).json({ error: "缺少选题 topic" });

    const domain = resolveArticleDomain(domainId, customDomain);
    res.json(await generateArticlePayload({ domain, topic, styleId, targetLength }));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 公众号文章生成：输入标题，自动匹配领域并生成文章 */
app.post("/api/article/generate-from-title", async (req, res) => {
  try {
    const { title, styleId, targetLength } = req.body as {
      title?: string;
      styleId?: string;
      targetLength?: "short" | "medium" | "long";
    };
    const cleanTitle = title?.trim() ?? "";
    if (!cleanTitle) return res.status(400).json({ error: "缺少文章标题 title" });
    if (cleanTitle.length > 120) return res.status(400).json({ error: "标题太长，请控制在 120 字以内" });

    const matchedDomain = await matchArticleDomainFromTitle(cleanTitle);
    const topic: TopicOption = {
      id: "title-input",
      title: cleanTitle,
      angle: `围绕用户标题展开，领域自动匹配为：${matchedDomain.domain.name}`,
      audience: "公众号读者",
      keywords: matchedDomain.reasons.filter((reason) => reason !== "默认匹配"),
    };

    const payload = await generateArticlePayload({
      domain: matchedDomain.domain,
      topic,
      styleId,
      targetLength,
    });
    res.json({ ...payload, domain: matchedDomain.domain, matchedDomain });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

async function generateArticlePayload(input: {
  domain: ArticleDomain;
  topic: TopicOption | string;
  styleId?: string;
  targetLength?: "short" | "medium" | "long";
}) {
  const topicTitle = typeof input.topic === "string" ? input.topic : input.topic.title;
  const bundle = await collectResearch(input.domain.name, topicTitle);
  const imageItems = await enrichResearchImages(bundle.items);
  const bundleWithImages = { ...bundle, items: imageItems };
  const researchContext = formatResearchContext(bundleWithImages.items, 8);
  const builtin = input.styleId ? getBuiltinStyle(input.styleId) : undefined;
  const styleSummary = builtin?.profile ?? "公众号文章生成：去 AI 味、短句优先、信息密度高。";
  const draft = await generateArticleDraft({
    domainName: input.domain.name,
    topic: input.topic,
    styleSummary,
    targetLength: input.targetLength ?? "medium",
    researchContext,
  });
  const article = enrichArticleWithResearch(draft, bundleWithImages.items, new Date(bundle.generatedAt));

  const docx = await createDocxFromBlocks(articleToDocBlocks(article));
  const parsed = await parseDocx(docx);
  const rec = saveDoc({ buf: docx, paragraphs: parsed.paragraphs, styleSummary });

  return {
    docId: rec.id,
    styleSummary,
    research: bundleWithImages,
    renderBlocks: articleToRenderBlocks(article, parsed.paragraphs),
    titleIndex: titleIndexOf(parsed.paragraphs),
    paragraphs: parsed.paragraphs.map((p) => ({
      index: p.index,
      kind: p.kind,
      original: p.text,
      rewritten: p.text,
      sentences: splitSentences(p.text),
    })),
  };
}

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

      // 风格来源：内置 skill（styleId）+/或 上传范文
      const styleId = (req.body?.styleId as string) || "";
      const builtin = styleId ? getBuiltinStyle(styleId) : undefined;

      let sampleText = "";
      for (const f of files?.references ?? []) {
        if (f.originalname.toLowerCase().endsWith(".docx")) {
          const p = await parseDocx(f.buffer);
          sampleText += p.paragraphs.map((x) => x.text).join("\n") + "\n\n";
        } else {
          sampleText += f.buffer.toString("utf8") + "\n\n";
        }
      }
      const extracted = sampleText.trim()
        ? await extractStyleProfile(sampleText).catch(() => "")
        : "";

      const styleSummary = [builtin?.profile, extracted && `补充范文风格：\n${extracted}`]
        .filter(Boolean)
        .join("\n\n");

      const rec = saveDoc({ buf: target.buffer, paragraphs: parsed.paragraphs, styleSummary });

      res.json({
        docId: rec.id,
        styleSummary,
        titleIndex: titleIndexOf(parsed.paragraphs),
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

/** 标题候选：基于全文生成 N 个标题 */
app.post("/api/title", async (req, res) => {
  try {
    const { docId, n } = req.body as { docId: string; n?: number };
    const rec = getDoc(docId);
    if (!rec) return res.status(404).json({ error: "文档不存在或已过期" });
    const titles = await generateTitles(rec.styleSummary, fullText(rec.paragraphs), n ?? 3);
    res.json({ titles });
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
  console.log(`mozheng backend listening on http://localhost:${config.port}`);
});
