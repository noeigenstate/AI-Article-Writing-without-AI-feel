import assert from "node:assert/strict";
import JSZip from "jszip";
import { parseDocx, exportDocx, createDocxFromBlocks, createDocxFromParagraphs } from "../services/docx.js";
import {
  ARTICLE_DOMAINS,
  articleToDocBlocks,
  articleToDocParagraphs,
  articleToRenderBlocks,
  enrichArticleWithResearch,
  generateArticleDraft,
  generateTopicOptions,
  matchArticleDomainFromTitle,
} from "../services/article.js";

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
let topicPrompt = "";
const topicResearchTitle = "Useful AI Agents for Small Teams";
const topics = await generateTopicOptions(
  {
    domain,
    n: 2,
    researchContext: `来源：arXiv\n${topicResearchTitle}`,
  },
  async (prompt) => {
    topicPrompt = prompt;
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

const matchedDomain = await matchArticleDomainFromTitle("孩子用 AI 写作业，学校到底该怎么管", async (prompt) => {
  assert.ok(prompt.includes("孩子用 AI 写作业"));
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
const articleResearchTitle = "Small Teams Adopt Agentic Workflows";
const article = await generateArticleDraft(
  {
    domainName: domain.name,
    topic: topics[0],
    styleSummary: "短句多，少套话，开头直接。",
    targetLength: "short",
    researchContext: `来源：Industry Report\n${articleResearchTitle}`,
  },
  async (prompt) => {
    articlePrompt = prompt;
    return JSON.stringify({
      title: "小团队用 AI，先别急着买工具",
      paragraphs: [
        "过去一年，很多团队都在试 AI。",
        "真正拉开差距的不是工具数量，而是任务拆得够不够细。",
        "先从一个重复流程做起，比一口气重做整套系统更稳。",
      ],
    });
  }
);
assert.equal(article.title, "小团队用 AI，先别急着买工具");
assert.equal(article.paragraphs.length, 3);
assert.ok(articlePrompt.includes(articleResearchTitle));

let articleRepairCalls = 0;
const repairedArticle = await generateArticleDraft(
  {
    domainName: domain.name,
    topic: topics[0],
    targetLength: "short",
  },
  async () => {
    articleRepairCalls += 1;
    if (articleRepairCalls === 1) {
      return '{"title":"Broken article","paragraphs":["Missing tail"';
    }
    return JSON.stringify({
      title: "修复后的文章",
      paragraphs: ["第一段", "第二段"],
    });
  }
);
assert.equal(articleRepairCalls, 2);
assert.equal(repairedArticle.title, "修复后的文章");
assert.equal(repairedArticle.paragraphs.length, 2);

const docParagraphs = articleToDocParagraphs(article);
assert.equal(docParagraphs[0].kind, "heading1");
assert.equal(docParagraphs[0].text, article.title);
assert.equal(docParagraphs[1].kind, "normal");

const enriched = enrichArticleWithResearch(
  {
    title: "证据驱动的文章",
    paragraphs: ["第一段必须有来源支撑。", "第二段继续推进判断。"],
  },
  [
    {
      id: "arxiv:1",
      sourceKind: "paper",
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
      sourceName: "Example Tech",
      sourceId: "example-tech",
      title: "Small Teams Adopt Research Briefs",
      summary: "Teams use short briefs to make faster product choices.",
      url: "https://example.com/research-briefs",
      imageUrl: "https://example.com/chart.jpg",
      publishedAt: "2026-01-05T10:00:00.000Z",
      authors: [],
      query: "technology",
    },
  ],
  new Date("2026-06-01T00:00:00.000Z")
);
assert.ok(enriched.paragraphs[0].includes("[1]"));
assert.equal(enriched.references?.length, 2);
assert.ok(enriched.references?.[0].text.includes("Ada Chen, Ben Rao"));
assert.equal(enriched.figure?.imageUrl, "https://example.com/chart.jpg");

const richBlocks = articleToDocBlocks(enriched);
assert.ok(richBlocks.some((block) => block.type === "figure"));
assert.ok(richBlocks.some((block) => block.type === "table"));
const richDocx = await createDocxFromBlocks(richBlocks);
const richZip = await JSZip.loadAsync(richDocx);
assert.ok(richZip.file("word/media/figure1.svg"));
const richXml = await richZip.file("word/document.xml")?.async("string");
assert.ok(richXml?.includes("<w:tbl>"));
const richParsed = await parseDocx(richDocx);
assert.ok(richParsed.paragraphs.some((p) => p.text === "参考文献"));
assert.ok(richParsed.paragraphs.some((p) => p.text.includes("表1 主要证据与出处")));

const renderBlocks = articleToRenderBlocks(enriched, richParsed.paragraphs);
assert.ok(renderBlocks.some((block) => block.type === "figure"));
assert.ok(renderBlocks.some((block) => block.type === "table"));
assert.ok(renderBlocks.some((block) => block.type === "references"));

console.log("article generation tests passed");
