import express from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config.js";
import { createDocxFromBlocks, parseDocx, exportDocx } from "./services/docx.js";
import { splitSentences } from "./services/splitter.js";
import { health } from "./services/llm.js";
import {
  getArticleDomains,
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
import { getBuiltinStyles, getBuiltinStyle } from "./styles.js";
import { normalizeLang, SERVER_MESSAGES, ARTICLE_LABELS, tr, type Lang } from "./i18n.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({ storage: multer.memoryStorage() });

/** 健康检查：模型连通性 */
app.get("/api/health", async (_req, res) => {
  res.json(await health());
});

/** 内置风格列表（蒸馏自作者作品的 skill） */
app.get("/api/styles", (req, res) => {
  const lang = normalizeLang(req.query.lang);
  res.json({ styles: getBuiltinStyles(lang).map(({ id, name, desc }) => ({ id, name, desc })) });
});

/** 文章生成：领域列表 */
app.get("/api/article/domains", (req, res) => {
  const lang = normalizeLang(req.query.lang);
  res.json({ domains: getArticleDomains(lang) });
});

/** 文章生成：按领域自动生成选题 */
app.post("/api/article/topics", async (req, res) => {
  try {
    const { domainId, customDomain, n, lang: rawLang } = req.body as {
      domainId?: string;
      customDomain?: string;
      n?: number;
      lang?: string;
    };
    const lang = normalizeLang(rawLang);
    const domain = resolveArticleDomain(domainId, customDomain, lang);
    const bundle = await collectResearch(domain.name, domain.name);
    const researchContext = formatResearchContext(bundle.items, 10);
    const topics = await generateTopicOptions({ domain, n: n ?? 6, researchContext, lang });
    res.json({ domain, topics, research: bundle });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Research preview context aggregation */
app.post("/api/research/preview", async (req, res) => {
  try {
    const { domainId, customDomain, query, lang: rawLang } = req.body as {
      domainId?: string;
      customDomain?: string;
      query?: string;
      lang?: string;
    };
    const lang = normalizeLang(rawLang);
    const domain = resolveArticleDomain(domainId, customDomain, lang);
    const bundle = await collectResearch(domain.name, query?.trim() || domain.name);
    res.json({ ...bundle, context: formatResearchContext(bundle.items, 8) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 公众号文章生成：从选题生成完整文章，并进入现有编辑/导出链路 */
app.post("/api/article/generate", async (req, res) => {
  try {
    const { domainId, customDomain, topic, styleId, targetLength, lang: rawLang } = req.body as {
      domainId?: string;
      customDomain?: string;
      topic: TopicOption | string;
      styleId?: string;
      targetLength?: "short" | "medium" | "long";
      lang?: string;
    };
    const lang = normalizeLang(rawLang);
    if (!topic) return res.status(400).json({ error: tr(SERVER_MESSAGES.missingTopic, lang) });

    const domain = resolveArticleDomain(domainId, customDomain, lang);
    res.json(await generateArticlePayload({ domain, topic, styleId, targetLength, lang }));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 公众号文章生成：输入标题，自动匹配领域并生成文章 */
app.post("/api/article/generate-from-title", async (req, res) => {
  try {
    const { title, styleId, targetLength, lang: rawLang } = req.body as {
      title?: string;
      styleId?: string;
      targetLength?: "short" | "medium" | "long";
      lang?: string;
    };
    const lang = normalizeLang(rawLang);
    const cleanTitle = title?.trim() ?? "";
    if (!cleanTitle) return res.status(400).json({ error: tr(SERVER_MESSAGES.missingTitle, lang) });
    if (cleanTitle.length > 120) return res.status(400).json({ error: tr(SERVER_MESSAGES.titleTooLong, lang) });

    const matchedDomain = await matchArticleDomainFromTitle(cleanTitle, lang);
    const defaultMatch = tr(ARTICLE_LABELS.defaultMatch, lang);
    const topic: TopicOption = {
      id: "title-input",
      title: cleanTitle,
      angle: `${tr(ARTICLE_LABELS.titleAngle, lang)}${matchedDomain.domain.name}`,
      audience: tr(ARTICLE_LABELS.defaultAudience, lang),
      keywords: matchedDomain.reasons.filter((reason) => reason !== defaultMatch),
    };

    const payload = await generateArticlePayload({
      domain: matchedDomain.domain,
      topic,
      styleId,
      targetLength,
      lang,
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
  lang: Lang;
}) {
  const { lang } = input;
  const topicTitle = typeof input.topic === "string" ? input.topic : input.topic.title;
  const bundle = await collectResearch(input.domain.name, topicTitle);
  const imageItems = await enrichResearchImages(bundle.items);
  const bundleWithImages = { ...bundle, items: imageItems };
  const researchContext = formatResearchContext(bundleWithImages.items, 8);
  const builtin = input.styleId ? getBuiltinStyle(input.styleId, lang) : undefined;
  const styleSummary = builtin?.profile ?? tr(ARTICLE_LABELS.defaultStyleSummary, lang);
  const draft = await generateArticleDraft({
    domainName: input.domain.name,
    topic: input.topic,
    styleSummary,
    targetLength: input.targetLength ?? "medium",
    researchContext,
    lang,
  });
  const article = enrichArticleWithResearch(draft, bundleWithImages.items, new Date(bundle.generatedAt), lang);

  const docx = await createDocxFromBlocks(articleToDocBlocks(article, lang));
  const parsed = await parseDocx(docx);
  const rec = saveDoc({ buf: docx, paragraphs: parsed.paragraphs, styleSummary });

  return {
    docId: rec.id,
    styleSummary,
    research: bundleWithImages,
    renderBlocks: articleToRenderBlocks(article, parsed.paragraphs, lang),
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
      const lang = normalizeLang(req.body?.lang);
      const target = files?.file?.[0];
      if (!target) return res.status(400).json({ error: tr(SERVER_MESSAGES.missingFile, lang) });

      const parsed = await parseDocx(target.buffer);

      // 风格来源：内置 skill（styleId）+/或 上传范文
      const styleId = (req.body?.styleId as string) || "";
      const builtin = styleId ? getBuiltinStyle(styleId, lang) : undefined;

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
        ? await extractStyleProfile(sampleText, lang).catch(() => "")
        : "";

      const sampleLabel = lang === "zh" ? "补充范文风格：" : "Extra style from samples:";
      const styleSummary = [builtin?.profile, extracted && `${sampleLabel}\n${extracted}`]
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
    const { docId, lang: rawLang } = req.body as { docId: string; lang?: string };
    const lang = normalizeLang(rawLang);
    const rec = getDoc(docId);
    if (!rec) return res.status(404).json({ error: tr(SERVER_MESSAGES.docNotFound, lang) });

    const map = await rewriteDocument(
      rec.styleSummary,
      rec.paragraphs.map((p) => ({ index: p.index, kind: p.kind, text: p.text })),
      12,
      lang
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
    const { docId, n, lang: rawLang } = req.body as { docId: string; n?: number; lang?: string };
    const lang = normalizeLang(rawLang);
    const rec = getDoc(docId);
    if (!rec) return res.status(404).json({ error: tr(SERVER_MESSAGES.docNotFound, lang) });
    const titles = await generateTitles(rec.styleSummary, fullText(rec.paragraphs), n ?? 3, lang);
    res.json({ titles });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 单句候选 */
app.post("/api/sentence/alternatives", async (req, res) => {
  try {
    const { docId, context, sentence, n, lang: rawLang } = req.body as {
      docId: string;
      context: string;
      sentence: string;
      n?: number;
      lang?: string;
    };
    const lang = normalizeLang(rawLang);
    const rec = getDoc(docId);
    if (!rec) return res.status(404).json({ error: tr(SERVER_MESSAGES.docNotFound, lang) });
    const alts = await generateAlternatives(rec.styleSummary, context, sentence, n ?? 3, lang);
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
    if (!rec) return res.status(404).json({ error: tr(SERVER_MESSAGES.docNotFound, normalizeLang((req.body as { lang?: string }).lang)) });

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
  console.log(`Speak Plainly backend listening on http://localhost:${config.port}`);
});
