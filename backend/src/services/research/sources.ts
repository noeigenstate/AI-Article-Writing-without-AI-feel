import type { NewsSource, NewsSourceType } from "./types.js";

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "bbc-world",
    name: "BBC World",
    type: "international",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    enabled: true,
  },
  {
    id: "guardian-world",
    name: "Guardian World",
    type: "international",
    url: "https://www.theguardian.com/world/rss",
    enabled: true,
  },
  {
    id: "guardian-technology",
    name: "Guardian Technology",
    type: "technology",
    url: "https://www.theguardian.com/technology/rss",
    enabled: true,
  },
  {
    id: "al-jazeera",
    name: "Al Jazeera",
    type: "international",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    enabled: true,
  },
  {
    id: "the-verge",
    name: "The Verge",
    type: "technology",
    url: "https://www.theverge.com/rss/index.xml",
    enabled: true,
  },
  {
    id: "techcrunch",
    name: "TechCrunch",
    type: "technology",
    url: "https://techcrunch.com/feed/",
    enabled: true,
  },
  {
    id: "ars-technica",
    name: "Ars Technica",
    type: "technology",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    enabled: true,
  },
  {
    id: "hacker-news",
    name: "Hacker News",
    type: "technology",
    url: "https://news.ycombinator.com/rss",
    enabled: true,
  },
  {
    id: "cnbc-top-news",
    name: "CNBC Top News",
    type: "finance",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    enabled: true,
  },
  {
    id: "marketwatch-top-stories",
    name: "MarketWatch Top Stories",
    type: "finance",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    enabled: true,
  },
  {
    id: "36kr",
    name: "36kr",
    type: "chinese",
    url: "https://36kr.com/feed",
    enabled: true,
  },
  {
    id: "huxiu",
    name: "Huxiu",
    type: "chinese",
    url: "https://www.huxiu.com/rss/0.xml",
    enabled: false,
  },
  { id: "reuters", name: "Reuters", type: "international", url: "", enabled: false },
  { id: "ap", name: "AP", type: "international", url: "", enabled: false },
  { id: "yahoo-finance", name: "Yahoo Finance", type: "finance", url: "", enabled: false },
  { id: "cctv", name: "CCTV", type: "chinese", url: "", enabled: false },
  { id: "the-paper", name: "The Paper", type: "chinese", url: "", enabled: false },
  { id: "caixin", name: "Caixin", type: "chinese", url: "", enabled: false },
  { id: "jiemian", name: "Jiemian", type: "chinese", url: "", enabled: false },
];

export function enabledNewsSources(): NewsSource[] {
  return NEWS_SOURCES.filter((source) => source.enabled && source.url);
}

export function newsSourcesForDomain(domainName: string): NewsSource[] {
  const normalizedDomain = domainName.trim().toLowerCase();
  let sourceTypes: NewsSourceType[];

  if (isFinanceDomain(normalizedDomain)) {
    sourceTypes = ["finance", "international"];
  } else if (isTechnologyDomain(normalizedDomain)) {
    sourceTypes = ["technology", "international"];
  } else if (isChineseDomain(normalizedDomain)) {
    sourceTypes = ["chinese"];
  } else {
    sourceTypes = ["international", "technology"];
  }

  const typeSet = new Set(sourceTypes);
  return enabledNewsSources().filter((source) => typeSet.has(source.type));
}

function isFinanceDomain(domainName: string): boolean {
  return [
    "bloomberg",
    "cnbc",
    "finance",
    "ft.com",
    "market",
    "marketwatch",
    "reuters",
    "stock",
    "wsj",
    "yahoo",
    "商业",
    "投资",
    "消费",
    "财经",
  ].some((keyword) => domainName.includes(keyword));
}

function isTechnologyDomain(domainName: string): boolean {
  return [
    "ai",
    "anthropic",
    "arstechnica",
    "github",
    "google",
    "hacker",
    "microsoft",
    "openai",
    "tech",
    "technology",
    "techcrunch",
    "theverge",
    "verge",
    "wired",
    "大模型",
    "技术",
    "科技",
  ].some((keyword) => domainName.includes(keyword));
}

function isChineseDomain(domainName: string): boolean {
  return [
    ".cn",
    "36kr",
    "baidu",
    "caixin",
    "china",
    "chinese",
    "cctv",
    "huxiu",
    "jiemian",
    "qq.com",
    "sina",
    "thepaper",
    "weibo",
    "zhihu",
    "中国",
    "中文",
    "国内",
  ].some((keyword) => domainName.includes(keyword));
}
