import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import JSZip from "jszip";
import { createApp } from "../app.js";
import { parseDocx, exportDocx, createDocxFromBlocks, createDocxFromParagraphs } from "../services/docx.js";
import {
  ARTICLE_DOMAINS,
  articleBodyLength,
  articleToDocBlocks,
  articleToDocParagraphs,
  articleToRenderBlocks,
  enrichArticleWithResearch,
  ArticleModelOutputError,
  generateArticleDraft,
  generateTopicOptions,
  matchArticleDomainFromTitle,
} from "../services/article.js";
import { articleDraftPrompt, articleLengthFixPrompt, articleTopicsPrompt } from "../prompts/article.prompts.js";
import { writingSceneProfile } from "../data/writingScenes.js";
import {
  ARTICLE_LENGTH_SPECS,
  countArticleBody,
  isArticleLengthTier,
  measureArticleLength,
} from "../services/articleLength.js";

const docx = await createDocxFromParagraphs([
  { kind: "heading1", text: "这是一篇公众号文章标题" },
  { kind: "normal", text: "第一段正文，保留自然语气。" },
  { kind: "normal", text: "第二段正文，继续展开观点。" },
]);

const parsed = await parseDocx(docx);
assert.equal(parsed.paragraphs.length, 3);
assert.equal(parsed.paragraphs[0].kind, "heading1");
assert.equal(parsed.paragraphs[0].text, "这是一篇公众号文章标题");

const exported = await exportDocx(docx, ["换一个更有钩子的标题", undefined, "第二段改成新的表达。"]);
const reparsed = await parseDocx(exported);
assert.equal(reparsed.paragraphs[0].text, "换一个更有钩子的标题");
assert.equal(reparsed.paragraphs[1].text, "第一段正文，保留自然语气。");
assert.equal(reparsed.paragraphs[2].text, "第二段改成新的表达。");

const domain = ARTICLE_DOMAINS[0];
const lengthPromptBase = {
  domainName: domain.name,
  topic: { id: "length", title: "AI agents for small teams", angle: "cost and workflow", audience: "founders", keywords: ["AI"] },
  lang: "zh" as const,
  researchCoverage: { domestic: 2, international: 2, global: 0, uniqueSources: 4 },
};
assert.deepEqual(ARTICLE_LENGTH_SPECS.zh, {
  short: { unit: "characters", min: 450, max: 650 },
  medium: { unit: "characters", min: 1000, max: 1300 },
  long: { unit: "characters", min: 3000, max: 3800 },
});
assert.deepEqual(ARTICLE_LENGTH_SPECS.en, {
  short: { unit: "words", min: 350, max: 500 },
  medium: { unit: "words", min: 850, max: 1100 },
  long: { unit: "words", min: 2200, max: 2800 },
});
assert.ok(articleDraftPrompt({ ...lengthPromptBase, targetLength: "short" }).includes("450-650 字正文"));
assert.ok(articleDraftPrompt({ ...lengthPromptBase, targetLength: "medium" }).includes("1000-1300 字正文"));
assert.ok(articleDraftPrompt({ ...lengthPromptBase, targetLength: "long" }).includes("3000-3800 字正文"));
assert.ok(
  articleDraftPrompt({ ...lengthPromptBase, lang: "en", targetLength: "medium" }).includes("850-1100 body words")
);
assert.ok(
  articleDraftPrompt({
    ...lengthPromptBase,
    researchCoverage: { domestic: 3, international: 0, global: 0, uniqueSources: 3 },
  }).includes("不要虚构国际观点")
);
assert.ok(
  articleDraftPrompt({
    ...lengthPromptBase,
    lang: "en",
    researchCoverage: { domestic: 0, international: 3, global: 0, uniqueSources: 3 },
  }).includes("do not invent domestic views")
);
assert.ok(articleDraftPrompt({ ...lengthPromptBase, targetLength: "medium" }).includes("同时使用国内外材料"));
assert.ok(
  articleDraftPrompt({ ...lengthPromptBase, lang: "en", targetLength: "medium" }).includes(
    "Use both domestic and international material"
  )
);
const crossRegionFixPrompt = articleLengthFixPrompt(
  { title: "短稿", paragraphs: ["内容不足。"] },
  { ...lengthPromptBase, targetLength: "medium" },
  5
);
assert.ok(crossRegionFixPrompt.includes("优先补充国内外材料的跨区域对照"));
assert.ok(crossRegionFixPrompt.includes("不要把来源数量当成共识证据"));
assert.ok(articleTopicsPrompt("科技", "技术变化", 3, "", "zh").includes("国内外视角的共同点"));
assert.ok(
  articleTopicsPrompt("Technology", "technical change", 3, "", "en").includes(
    "domestic and international perspectives"
  )
);
assert.equal(isArticleLengthTier("short"), true);
assert.equal(isArticleLengthTier("medium"), true);
assert.equal(isArticleLengthTier("long"), true);
assert.equal(isArticleLengthTier("regular"), false);
assert.equal(isArticleLengthTier(3), false);

// 两个生成入口都必须在进入研究/模型流程前拒绝非法 targetLength。
const app = createApp();
const server = app.listen(0);
await once(server, "listening");
try {
  const port = (server.address() as AddressInfo).port;
  for (const request of [
    { path: "/api/article/generate", body: { topic: "Runtime validation", targetLength: "regular" } },
    {
      path: "/api/article/generate-from-title",
      body: { title: "Runtime validation", targetLength: "regular" },
    },
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}${request.path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
    });
    assert.equal(response.status, 400);
    assert.match(String((await response.json() as { error?: unknown }).error), /targetLength/);
  }
  const malformedTopic = await fetch(`http://127.0.0.1:${port}/api/article/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic: {}, lang: "zh" }),
  });
  assert.equal(malformedTopic.status, 400);
  assert.match(String((await malformedTopic.json() as { error?: unknown }).error), /选题格式无效/);
} finally {
  server.close();
  await once(server, "close");
}

// 标题不计入正文；中文去空白后按 Unicode code points（代理对 emoji 只算 1）计数。
assert.equal(countArticleBody(["你 好", "🙂\n界"], "zh"), 4);
assert.equal(countArticleBody(["正文[1]仍是正文[12]"], "zh"), 6);
assert.equal(articleBodyLength({ title: "这个标题很长很长", paragraphs: ["正文"] }, "zh"), 2);
assert.equal(countArticleBody(["One  two", "three\nfour"], "en"), 4);
assert.equal(countArticleBody(["One claim [1] and another [22]"], "en"), 4);
assert.deepEqual(measureArticleLength(["word ".repeat(350)], "en", "short"), {
  tier: "short",
  unit: "words",
  actual: 350,
  min: 350,
  max: 500,
  inRange: true,
});
assert.ok(writingSceneProfile("wechat", "zh").includes("公众号"));
assert.ok(writingSceneProfile("technical", "en").includes("technical docs"));

let topicPrompt = "";
const topicResearchTitle = "Useful AI Agents for Small Teams";
const topics = await generateTopicOptions(
  {
    domain,
    n: 2,
    researchContext: `来源：arXiv\n${topicResearchTitle}`,
  },
  async (prompt, opts) => {
    topicPrompt = prompt;
    assert.equal(opts?.disableThinking, true);
    return JSON.stringify([
      {
        title: "AI 应用开始进入小团队",
        angle: "从成本和交付效率切入",
        audience: "创业者、产品经理",
        keywords: ["AI", "效率"],
      },
      {
        title: "大模型工具的隐形门槛",
        angle: "讲清楚普通团队踩坑的地方",
        audience: "内容创作者",
        keywords: ["大模型", "工作流"],
      },
    ]);
  }
);
assert.equal(topics.length, 2);
assert.ok(topics[0].id);
assert.ok(topicPrompt.includes(domain.name));
assert.ok(topicPrompt.includes(topicResearchTitle));
assert.deepEqual(topics[0].keywords, ["AI", "效率"]);

const wrappedTopics = await generateTopicOptions(domain, 1, async () =>
  JSON.stringify({
    topics: [
      {
        title: "包装在对象里的选题",
        angle: "验证模型返回对象时也能解析",
        audience: "产品经理",
        keywords: ["解析"],
      },
    ],
  })
);
assert.equal(wrappedTopics.length, 1);
assert.equal(wrappedTopics[0].title, "包装在对象里的选题");

let topicRepairCalls = 0;
const repairedTopics = await generateTopicOptions(domain, 1, async () => {
  topicRepairCalls += 1;
  if (topicRepairCalls === 1) {
    return '{"topics":[{"title":"Broken topic","angle":"Missing tail"';
  }
  return JSON.stringify([
    {
      title: "修复后的选题",
      angle: "验证坏 JSON 会自动修复",
      audience: "测试用户",
      keywords: ["repair"],
    },
  ]);
});
assert.equal(topicRepairCalls, 2);
assert.equal(repairedTopics.length, 1);
assert.equal(repairedTopics[0].title, "修复后的选题");

const matchedDomain = await matchArticleDomainFromTitle("孩子用 AI 写作业，学校到底该怎么管", "zh", async (prompt, opts) => {
  assert.ok(prompt.includes("孩子用 AI 写作业"));
  assert.equal(opts?.disableThinking, true);
  return JSON.stringify({
    domainId: "education",
    confidence: 91,
    reasons: ["标题核心对象是学生和学校", "争议焦点是教育管理"],
  });
});
assert.equal(matchedDomain.domain.id, "education");
assert.equal(matchedDomain.score, 91);
assert.equal(matchedDomain.reasons.length, 2);

let articlePrompt = "";
let articleDraftCalls = 0;
const articleResearchTitle = "Small Teams Adopt Agentic Workflows";
// 四段各 136 字，总长落在 zh short 档的精确区间内，不应触发长度纠偏
const inBandParagraph = "小团队先把重复流程挑出来，再决定要不要上工具，这一步决定后面的成败。".repeat(4);
const article = await generateArticleDraft(
  {
    domainName: domain.name,
    topic: topics[0],
    styleSummary: "短句多，少套话，开头直接。",
    targetLength: "short",
    researchContext: `来源：Industry Report\n${articleResearchTitle}`,
    lang: "zh",
  },
  async (prompt, opts) => {
    articleDraftCalls += 1;
    articlePrompt = prompt;
    assert.equal(opts?.disableThinking, true);
    return JSON.stringify({
      title: "小团队用 AI，先别急着买工具",
      paragraphs: [inBandParagraph, inBandParagraph, inBandParagraph, inBandParagraph],
    });
  }
);
assert.equal(article.title, "小团队用 AI，先别急着买工具");
assert.equal(article.paragraphs.length, 4);
assert.ok(articlePrompt.includes(articleResearchTitle));
// 长度已达标：只调用一次，不触发纠偏
assert.equal(articleDraftCalls, 1);
assert.deepEqual(article.length, {
  tier: "short",
  unit: "characters",
  actual: 544,
  min: 450,
  max: 650,
  inRange: true,
});

// 草稿明显低于目标档位时，触发一次扩写纠偏并采用达标结果
let lengthFixCalls = 0;
let lengthFixPrompt = "";
const expandedParagraph = "这里有足够的案例细节、数据对比和机制解释来支撑观点，读者能看懂结论从哪来。".repeat(4);
const expandedArticle = await generateArticleDraft(
  {
    domainName: domain.name,
    topic: "长度档位测试",
    targetLength: "medium",
    researchContext: "来源：Industry Report\n测试资料",
    lang: "zh",
  },
  async (prompt, opts) => {
    lengthFixCalls += 1;
    assert.equal("maxTokens" in (opts ?? {}), false);
    assert.equal(opts?.disableThinking, true);
    if (lengthFixCalls === 1) {
      return JSON.stringify({ title: "太短的草稿", paragraphs: ["只有一小段，远低于常规档的字数要求。"] });
    }
    lengthFixPrompt = prompt;
    return JSON.stringify({
      title: "扩写后的文章",
      paragraphs: Array.from({ length: 8 }, () => expandedParagraph),
    });
  }
);
assert.equal(lengthFixCalls, 2);
assert.ok(lengthFixPrompt.includes("1000-1300 字"));
assert.ok(lengthFixPrompt.includes("扩写"));
assert.ok(lengthFixPrompt.includes("太短的草稿"));
const expandedLength = articleBodyLength(expandedArticle, "zh");
assert.ok(expandedLength >= 1000 && expandedLength <= 1300, `expanded length ${expandedLength} out of band`);
assert.equal(expandedArticle.length?.actual, expandedLength);
assert.equal(expandedArticle.length?.inRange, true);

// 最多两次纠偏：持续未达标时明确失败，不能把 off-band 草稿当成完成态。
let boundedFixCalls = 0;
await assert.rejects(
  () => generateArticleDraft(
    {
      domainName: domain.name,
      topic: "bounded retries",
      targetLength: "short",
      lang: "en",
    },
    async () => {
      boundedFixCalls += 1;
      const words = boundedFixCalls === 1 ? 10 : boundedFixCalls === 2 ? 100 : 200;
      return JSON.stringify({ title: "Retry cap", paragraphs: ["word ".repeat(words)] });
    }
  ),
  /actual 200, target 350-500/
);
assert.equal(boundedFixCalls, 3);

// 模型常把引用编号/标点也算进字数，容易在边界上下偏约 1-2%。
// 两轮模型校准后，小幅超出应本地收敛到上限，小幅不足应补非事实性收束句。
let overrunCalls = 0;
const exactZhParagraphs = (length: number, count = 10) =>
  Array.from({ length: count }, (_, index) => {
    const size = Math.floor(length / count) + (index < length % count ? 1 : 0);
    return `${"甲".repeat(Math.max(1, size - 1))}。`;
  });
const normalizedOverrun = await generateArticleDraft(
  {
    domainName: domain.name,
    topic: "small length overrun",
    targetLength: "medium",
    lang: "zh",
  },
  async (_prompt, opts) => {
    overrunCalls += 1;
    assert.equal(opts?.disableThinking, true);
    const lengths = [1500, 1400, 1319];
    return JSON.stringify({
      title: "边界压缩",
      paragraphs: exactZhParagraphs(lengths[overrunCalls - 1]),
    });
  }
);
assert.equal(overrunCalls, 3);
assert.ok((normalizedOverrun.length?.actual ?? 0) >= 1000);
assert.ok((normalizedOverrun.length?.actual ?? 0) <= 1300);
assert.equal(normalizedOverrun.length?.inRange, true);

let underrunCalls = 0;
const normalizedUnderrun = await generateArticleDraft(
  {
    domainName: domain.name,
    topic: "small length underrun",
    targetLength: "medium",
    lang: "zh",
  },
  async (_prompt, opts) => {
    underrunCalls += 1;
    assert.equal(opts?.disableThinking, true);
    const lengths = [700, 850, 981];
    return JSON.stringify({ title: "边界扩充", paragraphs: ["乙".repeat(lengths[underrunCalls - 1])] });
  }
);
assert.equal(underrunCalls, 3);
assert.ok((normalizedUnderrun.length?.actual ?? 0) >= 1000);
assert.ok((normalizedUnderrun.length?.actual ?? 0) <= 1300);
assert.equal(normalizedUnderrun.length?.inRange, true);

// 引用用于事实核验，但不再是整篇文章的阻断门槛：开头、过渡、分析和收束
// 可以没有编号，也不应触发额外的强制引用重写。
let uncitedDraftCalls = 0;
const uncitedArticle = await generateArticleDraft(
  {
    domainName: domain.name,
    topic: "non-blocking citation guidance",
    targetLength: "short",
    lang: "en",
    researchContext: "--- 来源资料 1 ---\n标题: Verified source\n来源: Example\n链接: https://example.com/source",
  },
  async (_prompt, opts) => {
    uncitedDraftCalls += 1;
    assert.equal(opts?.disableThinking, true);
    return JSON.stringify({
      title: "Citations help without blocking",
      paragraphs: [`${"word ".repeat(349)}analysis`],
    });
  }
);
assert.equal(uncitedDraftCalls, 1);
assert.equal(uncitedArticle.length?.actual, 350);
assert.equal(uncitedArticle.paragraphs[0].includes("["), false);

let articleRepairCalls = 0;
const repairedArticle = await generateArticleDraft(
  {
    domainName: domain.name,
    topic: topics[0],
    targetLength: "short",
  },
  async (_prompt, opts) => {
    articleRepairCalls += 1;
    assert.equal(opts?.disableThinking, true);
    if (articleRepairCalls === 1) {
      return '{"title":"Broken article","paragraphs":["Missing tail"';
    }
    return JSON.stringify({
      title: "修复后的文章",
      paragraphs: ["word ".repeat(articleRepairCalls === 2 ? 100 : 350)],
    });
  }
);
// 三次调用：草稿（坏 JSON）→ JSON 修复 → 一次长度纠偏并达标。
assert.equal(articleRepairCalls, 3);
assert.equal(repairedArticle.title, "修复后的文章");
assert.equal(repairedArticle.length?.actual, 350);

// 思考模型可能耗尽 token 后返回空 content：必须跳过无意义的 JSON 修复，
// 用完整生成提示重试一次，并且每次都显式关闭 provider thinking。
let emptyDraftCalls = 0;
const recoveredEmptyDraft = await generateArticleDraft(
  {
    domainName: domain.name,
    topic: "empty visible content",
    targetLength: "short",
    lang: "en",
  },
  async (_prompt, opts) => {
    emptyDraftCalls += 1;
    assert.equal(opts?.disableThinking, true);
    if (emptyDraftCalls === 1) return "";
    return JSON.stringify({ title: "Recovered draft", paragraphs: ["word ".repeat(350)] });
  }
);
assert.equal(emptyDraftCalls, 2);
assert.equal(recoveredEmptyDraft.title, "Recovered draft");
assert.equal(recoveredEmptyDraft.length?.inRange, true);

let transientProviderCalls = 0;
const recoveredProviderDraft = await generateArticleDraft(
  {
    domainName: domain.name,
    topic: "transient provider error",
    targetLength: "short",
    lang: "en",
  },
  async (_prompt, opts) => {
    transientProviderCalls += 1;
    assert.equal(opts?.disableThinking, true);
    if (transientProviderCalls === 1) throw new Error("temporary provider failure");
    return JSON.stringify({ title: "Recovered provider draft", paragraphs: ["word ".repeat(350)] });
  }
);
assert.equal(transientProviderCalls, 2);
assert.equal(recoveredProviderDraft.length?.inRange, true);

let unusableDraftCalls = 0;
await assert.rejects(
  () => generateArticleDraft(
    {
      domainName: domain.name,
      topic: "persistently empty visible content",
      targetLength: "short",
      lang: "en",
    },
    async (_prompt, opts) => {
      unusableDraftCalls += 1;
      assert.equal(opts?.disableThinking, true);
      return "";
    }
  ),
  (error: unknown) => error instanceof ArticleModelOutputError
);
assert.equal(unusableDraftCalls, 2);

const docParagraphs = articleToDocParagraphs(article);
assert.equal(docParagraphs[0].kind, "heading1");
assert.equal(docParagraphs[0].text, article.title);
assert.equal(docParagraphs[1].kind, "normal");

const enriched = await enrichArticleWithResearch(
  {
    title: "Evidence driven article",
    paragraphs: [
      "Evidence driven article has a real citation. [1]",
      "This paragraph cites a missing source. [9]",
      "This paragraph has no citation.",
    ],
    length: {
      tier: "short",
      unit: "words",
      actual: 20,
      min: 350,
      max: 500,
      inRange: false,
    },
  },
  [
    {
      id: "arxiv:1",
      sourceKind: "paper",
      region: "international",
      sourceName: "arXiv",
      sourceId: "arxiv",
      title: "Useful AI Agents for Small Teams",
      summary: "Agent workflows can reduce coordination cost when tasks are scoped.",
      url: "https://arxiv.org/abs/2601.12345",
      publishedAt: "2026-01-04T08:30:00.000Z",
      authors: ["Ada Chen", "Ben Rao"],
      query: "ai agents",
    },
    {
      id: "news:1",
      sourceKind: "news",
      region: "international",
      sourceName: "Example Tech",
      sourceId: "example-tech",
      title: "Evidence Driven Article Chart",
      summary: "A chart for evidence driven article workflows and source checks.",
      url: "https://example.com/research-briefs",
      imageUrl: "https://example.com/chart.jpg",
      publishedAt: "2026-01-05T10:00:00.000Z",
      authors: [],
      query: "technology",
    },
  ],
  new Date("2026-06-01T00:00:00.000Z"),
  "zh"
);
// 真实引用保留；越界引用被清理；无引用段落不再被补造引用
assert.ok(enriched.paragraphs[0].includes("[1]"));
assert.ok(!enriched.paragraphs[1].includes("[9]"));
assert.ok(!/\[\d+\]/.test(enriched.paragraphs[2]));
assert.equal(enriched.length?.actual, countArticleBody(enriched.paragraphs, "zh"));
assert.equal(enriched.length?.tier, "short");
assert.equal(enriched.references?.length, 2);
assert.ok(enriched.references?.[0].text.includes("Ada Chen, Ben Rao"));
assert.ok(
  [enriched.figure?.imageUrl, ...(enriched.bodyFigures ?? []).map((figure) => figure.imageUrl)].includes(
    "https://example.com/chart.jpg"
  )
);

const matchedImageArticle = await enrichArticleWithResearch(
  {
    title: "Climate Teams Track River Flood Risk",
    paragraphs: [
      "Cities are using river sensors and flood models to plan emergency routes.",
      "The most useful charts compare rainfall, river level, and evacuation time.",
    ],
  },
  [
    {
      id: "news:wrong-image",
      sourceKind: "news",
      region: "international",
      sourceName: "Example Markets",
      sourceId: "example-markets",
      title: "Chip Stocks Rise After Earnings",
      summary: "Semiconductor shares moved higher after quarterly guidance.",
      url: "https://example.com/chips",
      imageUrl: "https://example.com/chip.jpg",
      publishedAt: "2026-01-05T10:00:00.000Z",
      authors: [],
      query: "markets",
    },
    {
      id: "news:right-image",
      sourceKind: "news",
      region: "international",
      sourceName: "Example Climate",
      sourceId: "example-climate",
      title: "River Flood Models Help Cities Prepare",
      summary: "Rainfall sensors and flood forecasts guide emergency planning.",
      url: "https://example.com/flood",
      imageUrl: "https://example.com/flood.jpg",
      publishedAt: "2026-01-05T10:00:00.000Z",
      authors: [],
      query: "climate",
    },
  ],
  new Date("2026-06-01T00:00:00.000Z"),
  "en"
);
assert.equal(matchedImageArticle.figure?.imageUrl, "https://example.com/flood.jpg");
assert.ok(!matchedImageArticle.bodyFigures?.some((f) => f.imageUrl === "https://example.com/chip.jpg"));
assert.equal(matchedImageArticle.bodyFigures?.length ?? 0, 0);

// 强相关图不足时，弱相关（有词面重叠）的图回填补足；零重叠的图仍然不用
const backfilledArticle = await enrichArticleWithResearch(
  {
    title: "Flood Sensors Guide City Planning",
    paragraphs: [
      "Cities install river sensors to track flood risk in real time.",
      "Emergency teams use flood maps when planning evacuation routes.",
    ],
  },
  [
    {
      id: "news:strong-image",
      sourceKind: "news",
      region: "international",
      sourceName: "Example Climate",
      sourceId: "example-climate",
      title: "River Flood Sensors Help Cities",
      summary: "Flood sensors and river data guide city planning.",
      url: "https://example.com/flood-sensors",
      imageUrl: "https://example.com/strong.jpg",
      publishedAt: "2026-01-05T10:00:00.000Z",
      authors: [],
      query: "flood sensors",
    },
    {
      id: "news:weak-image",
      sourceKind: "news",
      region: "international",
      sourceName: "Example Hardware",
      sourceId: "example-hardware",
      title: "Sensor Prices Fall",
      summary: "Hardware prices drop.",
      url: "https://example.com/sensor-prices",
      imageUrl: "https://example.com/weak.jpg",
      publishedAt: "2026-01-05T10:00:00.000Z",
      authors: [],
      query: "sensors",
    },
    {
      id: "news:zero-image",
      sourceKind: "news",
      region: "international",
      sourceName: "Example Markets",
      sourceId: "example-markets",
      title: "Chip Stocks Rise",
      summary: "Semiconductor earnings beat expectations.",
      url: "https://example.com/chip-stocks",
      imageUrl: "https://example.com/zero.jpg",
      publishedAt: "2026-01-05T10:00:00.000Z",
      authors: [],
      query: "markets",
    },
  ],
  new Date("2026-06-01T00:00:00.000Z"),
  "en"
);
const backfilledImageUrls = [
  backfilledArticle.figure?.imageUrl,
  ...(backfilledArticle.bodyFigures ?? []).map((figure) => figure.imageUrl),
];
assert.ok(backfilledImageUrls.includes("https://example.com/strong.jpg"));
assert.ok(backfilledImageUrls.includes("https://example.com/weak.jpg"));
assert.ok(!backfilledImageUrls.includes("https://example.com/zero.jpg"));

const bodyImageArticle = await enrichArticleWithResearch(
  {
    title: "Remote Work Budget Choices",
    paragraphs: [
      "The opening explains why managers are reviewing remote work policy.",
      "The practical question is how teams compare travel budgets, office leases, and hiring costs.",
    ],
  },
  [
    {
      id: "news:budget-image",
      sourceKind: "news",
      region: "international",
      sourceName: "Example Work",
      sourceId: "example-work",
      title: "Travel Budget Charts Shape Remote Work Decisions",
      summary: "Budget charts compare travel costs, office leases, and hiring plans.",
      url: "https://example.com/budget",
      imageUrl: "https://example.com/budget.jpg",
      publishedAt: "2026-01-05T10:00:00.000Z",
      authors: [],
      query: "remote work budget",
    },
  ],
  new Date("2026-06-01T00:00:00.000Z"),
  "en"
);
assert.equal(bodyImageArticle.figure?.imageUrl, undefined);
assert.equal(bodyImageArticle.bodyFigures?.[0]?.imageUrl, "https://example.com/budget.jpg");
const bodyImageBlocks = articleToDocBlocks(bodyImageArticle);
const matchedParagraphIndex = bodyImageBlocks.findIndex(
  (block) => block.type === "paragraph" && block.text.includes("travel budgets")
);
const matchedFigureIndex = bodyImageBlocks.findIndex((block) => block.type === "figure");
assert.equal(matchedFigureIndex, matchedParagraphIndex + 1);

const richBlocks = articleToDocBlocks(enriched);
assert.ok(richBlocks.some((block) => block.type === "figure"));
assert.ok(!richBlocks.some((block) => block.type === "table"));
const richDocx = await createDocxFromBlocks(richBlocks);
const richZip = await JSZip.loadAsync(richDocx);
assert.ok(richZip.file("word/media/figure1.svg"));
assert.ok(richZip.file("word/media/figure1.png"));
const richXml = await richZip.file("word/document.xml")?.async("string");
const richRels = await richZip.file("word/_rels/document.xml.rels")?.async("string");
const richContentTypes = await richZip.file("[Content_Types].xml")?.async("string");
assert.ok(richXml?.includes('<a:blip r:embed="rIdFigurePng1">'));
assert.ok(richXml?.includes('<asvg:svgBlip r:embed="rIdFigureSvg1"/>'));
assert.ok(richRels?.includes("rIdFigurePng1"));
assert.ok(richRels?.includes("rIdFigureSvg1"));
assert.ok(richContentTypes?.includes('Extension="png" ContentType="image/png"'));
assert.ok(!richXml?.includes("<w:tbl>"));
const richParsed = await parseDocx(richDocx);
assert.ok(richParsed.paragraphs.some((p) => p.text === "References"));
assert.ok(!richParsed.paragraphs.some((p) => p.text.includes("表1 主要证据与出处")));

const renderBlocks = articleToRenderBlocks(enriched, richParsed.paragraphs);
assert.ok(renderBlocks.some((block) => block.type === "figure"));
assert.ok(
  renderBlocks
    .filter((block): block is Extract<(typeof renderBlocks)[number], { type: "figure" }> => block.type === "figure")
    .every((block) => block.svg.length > 0 && !("imageUrl" in block)),
  "browser render blocks expose only backend-vetted inline SVG figures"
);
assert.ok(!renderBlocks.some((block) => block.type === "table"));
assert.ok(renderBlocks.some((block) => block.type === "references"));

console.log("article generation tests passed");
