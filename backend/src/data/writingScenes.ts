import type { Lang } from "../core/i18n.js";

export type WritingSceneId = "general" | "wechat" | "business" | "academic" | "official" | "social" | "technical";

interface WritingScene {
  id: WritingSceneId;
  profile: Record<Lang, string>;
}

const SCENES: WritingScene[] = [
  {
    id: "general",
    profile: {
      zh: "文体场景：通用自然表达。要求：保留原文信息密度，减少模板句和口号，语气自然但不过度口语化。",
      en: "Writing scene: general natural prose. Keep the information density, reduce templated phrasing, and sound natural without becoming too casual.",
    },
  },
  {
    id: "wechat",
    profile: {
      zh: "文体场景：公众号文章。要求：开头直接给场景或判断，段落短，论点先行；允许轻微口语感，但不要营销号夸张和假互动。",
      en: "Writing scene: newsletter/article. Open with a scene or judgment, keep paragraphs short, lead with claims, and avoid hype or fake engagement.",
    },
  },
  {
    id: "business",
    profile: {
      zh: "文体场景：商务沟通。要求：克制、清楚、可执行；少情绪词，多结论、风险、影响和下一步。",
      en: "Writing scene: business communication. Be restrained, clear, and actionable; prefer conclusions, risks, impact, and next steps over emotional wording.",
    },
  },
  {
    id: "academic",
    profile: {
      zh: "文体场景：学术/报告。要求：概念准确，因果谨慎，避免口语化；每个判断尽量有证据、边界或限定条件。",
      en: "Writing scene: academic/report writing. Keep concepts precise, causality cautious, and claims bounded by evidence, scope, or limitations.",
    },
  },
  {
    id: "official",
    profile: {
      zh: "文体场景：公文/正式说明。要求：语气稳妥、结构清晰、少修辞；避免网络词和过度口语，保留责任边界。",
      en: "Writing scene: formal notice. Use a steady tone, clear structure, limited rhetoric, and keep responsibility boundaries explicit.",
    },
  },
  {
    id: "social",
    profile: {
      zh: "文体场景：社媒短文。要求：短句、强切口、少铺垫；可以口语，但必须具体，不要堆热词和夸张情绪。",
      en: "Writing scene: social post. Use short sentences and a sharp angle; be conversational but concrete, without buzzword stacking or exaggerated emotion.",
    },
  },
  {
    id: "technical",
    profile: {
      zh: "文体场景：技术文档/README。要求：步骤清楚、术语稳定、少形容词；命令、参数、限制和注意事项不能被改写错。",
      en: "Writing scene: technical docs/README. Keep steps clear, terminology stable, adjectives sparse, and never distort commands, parameters, limits, or caveats.",
    },
  },
];

export function writingSceneProfile(id: string | undefined, lang: Lang): string {
  const scene = SCENES.find((item) => item.id === id) ?? SCENES[0];
  return scene.profile[lang];
}
