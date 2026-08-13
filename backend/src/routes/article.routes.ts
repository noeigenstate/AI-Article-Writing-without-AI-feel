import { Router } from "express";
import { createDocxFromBlocks, parseDocx } from "../services/docx.js";
import { splitSentences } from "../services/splitter.js";
import {
  getArticleDomains,
  articleToDocBlocks,
  articleToRenderBlocks,
  enrichArticleWithResearch,
  generateArticleDraft,
  ArticleCitationTargetError,
  ArticleLengthTargetError,
  generateTopicOptions,
  matchArticleDomainFromTitle,
  resolveArticleDomain,
  type ArticleDomain,
  type ArticleRenderBlock,
  type TopicOption,
} from "../services/article.js";
import { collectResearch, formatResearchContext } from "../services/research/aggregate.js";
import { enrichResearchImages } from "../services/research/images.js";
import { titleIndexOf } from "../services/rewrite.js";
import { saveDoc } from "../core/store.js";
import { getBuiltinStyle } from "../data/styles.js";
import { writingSceneProfile } from "../data/writingScenes.js";
import { normalizeLang, SERVER_MESSAGES, ARTICLE_LABELS, tr, type Lang } from "../core/i18n.js";
import {
  isArticleLengthTier,
  measureArticleLength,
  type ArticleLengthTier,
} from "../services/articleLength.js";

/** Routes for topic planning, research preview, and article generation. */
const router = Router();

/** `GET /api/article/domains?lang=` — list the supported article domains. */
router.get("/api/article/domains", (req, res) => {
  const lang = normalizeLang(req.query.lang);
  res.json({ domains: getArticleDomains(lang) });
});

/** `POST /api/article/topics` — auto-generate topic options for a domain. */
router.post("/api/article/topics", async (req, res) => {
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
    const researchContext = formatResearchContext(bundle.items, 12);
    const topics = await generateTopicOptions({
      domain,
      n: n ?? 6,
      researchContext,
      researchCoverage: bundle.coverage,
      lang,
    });
    res.json({ domain, topics, research: bundle });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** `POST /api/research/preview` — aggregate live sources for a domain/query. */
router.post("/api/research/preview", async (req, res) => {
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
    res.json({ ...bundle, context: formatResearchContext(bundle.items, 10) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** `POST /api/article/generate` — generate a full article from a chosen topic. */
router.post("/api/article/generate", async (req, res) => {
  try {
    const { domainId, customDomain, topic, styleId, sceneId, targetLength, lang: rawLang } = req.body as {
      domainId?: string;
      customDomain?: string;
      topic: TopicOption | string;
      styleId?: string;
      sceneId?: string;
      targetLength?: unknown;
      lang?: string;
    };
    const lang = normalizeLang(rawLang);
    if (targetLength !== undefined && !isArticleLengthTier(targetLength)) {
      return res.status(400).json({ error: tr(SERVER_MESSAGES.invalidTargetLength, lang) });
    }
    if (!topic) return res.status(400).json({ error: tr(SERVER_MESSAGES.missingTopic, lang) });

    const domain = resolveArticleDomain(domainId, customDomain, lang);
    res.json(await generateArticlePayload({ domain, topic, styleId, sceneId, targetLength, lang }));
  } catch (e) {
    if (e instanceof ArticleLengthTargetError) {
      res.status(422).json({ error: e.message, length: e.length });
      return;
    }
    if (e instanceof ArticleCitationTargetError) {
      res.status(422).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: (e as Error).message });
  }
});

/** `POST /api/article/generate-from-title` — infer the domain from a title, then generate. */
router.post("/api/article/generate-from-title", async (req, res) => {
  try {
    const { title, styleId, sceneId, targetLength, lang: rawLang } = req.body as {
      title?: string;
      styleId?: string;
      sceneId?: string;
      targetLength?: unknown;
      lang?: string;
    };
    const lang = normalizeLang(rawLang);
    const cleanTitle = title?.trim() ?? "";
    if (!cleanTitle) return res.status(400).json({ error: tr(SERVER_MESSAGES.missingTitle, lang) });
    if (cleanTitle.length > 120) return res.status(400).json({ error: tr(SERVER_MESSAGES.titleTooLong, lang) });
    if (targetLength !== undefined && !isArticleLengthTier(targetLength)) {
      return res.status(400).json({ error: tr(SERVER_MESSAGES.invalidTargetLength, lang) });
    }

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
      sceneId,
      targetLength,
      lang,
    });
    res.json({ ...payload, domain: matchedDomain.domain, matchedDomain });
  } catch (e) {
    if (e instanceof ArticleLengthTargetError) {
      res.status(422).json({ error: e.message, length: e.length });
      return;
    }
    if (e instanceof ArticleCitationTargetError) {
      res.status(422).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * Run the full generation pipeline: research → draft → enrich → docx → store.
 *
 * Shared by both the topic-based and title-based generation routes.
 *
 * @param input Resolved domain, topic, optional style/length, and language.
 * @returns The API payload (docId, render blocks, paragraphs, research bundle).
 */
async function generateArticlePayload(input: {
  domain: ArticleDomain;
  topic: TopicOption | string;
  styleId?: string;
  sceneId?: string;
  targetLength?: ArticleLengthTier;
  lang: Lang;
}) {
  const { lang } = input;
  const targetLength = input.targetLength ?? "medium";
  const topicTitle = typeof input.topic === "string" ? input.topic : input.topic.title;
  const bundle = await collectResearch(input.domain.name, topicTitle);
  const imageItems = await enrichResearchImages(bundle.items);
  const bundleWithImages = { ...bundle, items: imageItems };
  const researchContext = formatResearchContext(bundleWithImages.items, 16);
  const builtin = input.styleId ? getBuiltinStyle(input.styleId, lang) : undefined;
  const sceneProfile = writingSceneProfile(input.sceneId, lang);
  const styleSummary = [sceneProfile, builtin?.profile ?? tr(ARTICLE_LABELS.defaultStyleSummary, lang)]
    .filter(Boolean)
    .join("\n\n");
  const draft = await generateArticleDraft({
    domainName: input.domain.name,
    topic: input.topic,
    styleSummary,
    targetLength,
    researchContext,
    researchCoverage: bundle.coverage,
    lang,
  });
  const article = await enrichArticleWithResearch(draft, bundleWithImages.items, new Date(bundle.generatedAt), lang);
  const length = measureArticleLength(article.paragraphs, lang, targetLength);

  const docx = await createDocxFromBlocks(articleToDocBlocks(article, lang));
  const parsed = await parseDocx(docx);
  const renderBlocks = articleToRenderBlocks(article, parsed.paragraphs, lang);
  const rewriteIndices = renderBlocks
    .filter((block): block is Extract<ArticleRenderBlock, { type: "paragraph" }> => block.type === "paragraph")
    .map((block) => block.paragraphIndex)
    .filter((index): index is number => typeof index === "number");
  const rec = saveDoc({ buf: docx, paragraphs: parsed.paragraphs, styleSummary, rewriteIndices });

  return {
    docId: rec.id,
    styleSummary,
    length,
    research: bundleWithImages,
    renderBlocks,
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

export default router;
