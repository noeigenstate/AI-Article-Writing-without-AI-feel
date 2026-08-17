import assert from "node:assert/strict";
import {
  buildLicensedMediaQueries,
  parseOpenverseImageSearch,
  searchLicensedMediaForArticle,
  searchOpenverseImages,
  type LicensedMediaItem,
} from "../services/research/licensedMedia.js";
import {
  articleToRenderBlocks,
  enrichArticleWithResearch,
  type GeneratedArticle,
} from "../services/article.js";
import type { SafeImageBinary } from "../services/research/images.js";
import type { ResearchItem } from "../services/research/types.js";

const validRaw = {
  id: "bcc83f0a-04f5-4527-980f-d7c4074a1ac6",
  title: "Children explore a science museum exhibit",
  creator: "Example Photographer",
  creator_url: "https://photos.example.org/creators/example",
  license: "by",
  license_version: "4.0",
  license_url: "https://creativecommons.org/licenses/by/4.0/",
  foreign_landing_url: "https://photos.example.org/works/museum-children",
  url: "https://cdn.example.org/media/museum-children.jpg",
  attribution: '"Children explore a science museum exhibit" by Example Photographer is licensed under CC BY 4.0.',
  filetype: null,
  category: null,
  width: 1600,
  height: 900,
  mature: false,
  unstable__sensitivity: [],
  tags: [{ name: "children" }, { name: "science" }, { name: "museum" }, { name: "exhibit" }],
};

const parsed = parseOpenverseImageSearch({ results: [validRaw] }, "children science museum exhibit");
assert.equal(parsed.length, 1);
assert.equal(parsed[0]?.licenseName, "CC BY 4.0");
assert.equal(parsed[0]?.mimeType, "image/jpeg", "a null filetype may use a safe raster URL extension");
assert.match(parsed[0]?.thumbnailUrl ?? "", /^https:\/\/api\.openverse\.org\/v1\/images\//u);

const strongerSceneMatch = {
  ...validRaw,
  id: "b295cf31-da18-4872-a993-f66ab5be3995",
  title: "Interactive science exhibition",
  foreign_landing_url: "https://photos.example.org/works/interactive-science-exhibition",
  url: "https://cdn.example.org/media/interactive-science-exhibition.jpg",
};
const weakerSceneMatch = {
  ...validRaw,
  id: "d3d57dc0-1fd1-453a-874a-e084314fc283",
  title: "Museum opening",
  foreign_landing_url: "https://photos.example.org/works/museum-opening",
  url: "https://cdn.example.org/media/museum-opening.jpg",
  tags: [{ name: "museum" }, { name: "exhibit" }],
};
assert.equal(
  parseOpenverseImageSearch(
    { results: [weakerSceneMatch, strongerSceneMatch] },
    "children science museum exhibit"
  ).length,
  1,
  "a four-anchor scene query must reject a weak image matching only museum/exhibit"
);
assert.equal(
  parseOpenverseImageSearch(
    { results: [weakerSceneMatch, strongerSceneMatch] },
    "children science museum exhibit"
  )[0]?.id,
  strongerSceneMatch.id,
  "scene coverage, not provider order, should select the most relevant real photograph first"
);

const invalidMutations: Array<[string, Record<string, unknown>]> = [
  ["missing creator", { creator: null }],
  ["missing license", { license: null }],
  ["missing landing page", { foreign_landing_url: null }],
  ["unsafe landing page", { foreign_landing_url: "http://127.0.0.1/private" }],
  ["unsafe creator page", { creator_url: "http://[::1]/private" }],
  ["creator page equals download", { creator_url: validRaw.url }],
  ["creator page is a raster asset", { creator_url: "https://photos.example.org/creators/example.jpg" }],
  ["unsafe license page", { license_url: "http://127.0.0.1/license" }],
  ["NC license", { license: "by-nc", license_url: "https://creativecommons.org/licenses/by-nc/4.0/" }],
  ["ND license", { license: "by-nd", license_url: "https://creativecommons.org/licenses/by-nd/4.0/" }],
  ["mature media", { mature: true }],
  ["sensitive media", { unstable__sensitivity: ["sensitive_text"] }],
  ["logo", { title: "Flora AI Educations Logo" }],
  ["wrong license URL", { license_url: "https://example.org/licenses/by/4.0/" }],
  ["invented license version", { license_version: "99.99", license_url: "https://creativecommons.org/licenses/by/99.99/" }],
  ["missing dimensions", { width: null }],
  ["unsupported MIME", { filetype: "svg", url: "https://cdn.example.org/media/work.svg" }],
  ["locally irrelevant", { title: "Corporate headquarters", tags: [{ name: "business" }] }],
  ["URL-like title", { title: "Children visit https://cdn.example.org/media/work.jpg at a science museum exhibit" }],
  ["URL-like creator", { creator: "https://creator.example.org/profile" }],
  ["direct raster landing page", { foreign_landing_url: "https://photos.example.org/works/museum-children.jpg" }],
  ["landing page equals download", { foreign_landing_url: validRaw.url }],
  ["landing page decorates download", { foreign_landing_url: `${validRaw.url}?credit=1#details` }],
  [
    "landing page equals Openverse thumbnail",
    { foreign_landing_url: `https://api.openverse.org/v1/images/${validRaw.id}/thumb/?compressed=true` },
  ],
  [
    "landing page decorates Openverse thumbnail",
    { foreign_landing_url: `https://api.openverse.org/v1/images/${validRaw.id}/thumb/?compressed=true#credit` },
  ],
];
for (const [label, mutation] of invalidMutations) {
  assert.equal(
    parseOpenverseImageSearch({ results: [{ ...validRaw, ...mutation }] }, "children science museum exhibit").length,
    0,
    label
  );
}

const providerAttributionWithAssetUrl = parseOpenverseImageSearch({
  results: [{
    ...validRaw,
    attribution: "Credit and direct media https://cdn.example.org/media/museum-children.jpg",
  }],
}, "children science museum exhibit");
assert.equal(providerAttributionWithAssetUrl.length, 1);
assert.equal(
  providerAttributionWithAssetUrl[0]?.attribution.includes(validRaw.url),
  false,
  "provider attribution is reconstructed from validated fields and cannot leak the asset URL"
);

const queryArticle: GeneratedArticle = {
  title: "AI研学团挤进科技馆，孩子学到的是AI还是人设",
  paragraphs: ["孩子在科技馆里观察互动展项。"],
  mediaHints: [],
};
assert.deepEqual(
  buildLicensedMediaQueries(queryArticle, ["AI learning exhibits children"]),
  ["ai education exhibit child", "children science museum exhibit", "interactive museum exhibit"]
);
assert.deepEqual(buildLicensedMediaQueries(queryArticle, ["AI news"]), []);

let requestedUrl = "";
const searched = await searchOpenverseImages("children science museum exhibit", 8, {
  fetchJson: async (url) => {
    requestedUrl = url;
    return { results: [validRaw] };
  },
});
assert.equal(searched.length, 1);
const request = new URL(requestedUrl);
assert.equal(request.origin + request.pathname, "https://api.openverse.org/v1/images/");
assert.equal(request.searchParams.get("q"), "children science museum exhibit");
assert.equal(request.searchParams.get("license"), "cc0,pdm,by,by-sa");
assert.equal(request.searchParams.get("mature"), "false");
assert.equal(request.searchParams.get("filter_dead"), "true");
assert.equal(request.searchParams.get("categories"), "photograph");
assert.equal(request.searchParams.get("page_size"), "8");

let sharedQueryCalls = 0;
let releaseSharedQuery: (() => void) | undefined;
const sharedQueryBarrier = new Promise<void>((resolve) => {
  releaseSharedQuery = resolve;
});
const sharedQueryFetch = async () => {
  sharedQueryCalls += 1;
  await sharedQueryBarrier;
  return { results: [validRaw] };
};
const sharedQuerySearches = Array.from({ length: 6 }, () =>
  searchOpenverseImages("children science museum exhibit", 8, { fetchJson: sharedQueryFetch })
);
await new Promise<void>((resolve) => setTimeout(resolve, 0));
assert.equal(sharedQueryCalls, 1, "simultaneous identical queries must share one in-flight provider call");
releaseSharedQuery?.();
const sharedQueryResults = await Promise.all(sharedQuerySearches);
assert.equal(sharedQueryResults.every((items) => items.length === 1), true);

let activeOpenverseQueries = 0;
let peakOpenverseQueries = 0;
const startedOpenverseQueries: string[] = [];
const gatedFetch = async (url: string) => {
  activeOpenverseQueries += 1;
  peakOpenverseQueries = Math.max(peakOpenverseQueries, activeOpenverseQueries);
  startedOpenverseQueries.push(new URL(url).searchParams.get("q") ?? "");
  await new Promise<void>((resolve) => setTimeout(resolve, 8));
  activeOpenverseQueries -= 1;
  return { results: [] };
};
const gatedQueries = Array.from({ length: 6 }, (_, index) => `museum exhibit scene${index} detail${index}`);
await Promise.all(gatedQueries.map((query) => searchOpenverseImages(query, 8, { fetchJson: gatedFetch })));
assert.equal(peakOpenverseQueries, 2, "Openverse searches must share one process-wide two-slot gate");
assert.deepEqual(startedOpenverseQueries, gatedQueries, "queued Openverse searches must start in FIFO order");

let transientFailureCalls = 0;
const transientFailureFetch = async (): Promise<unknown> => {
  transientFailureCalls += 1;
  throw new Error("simulated Openverse 429");
};
const transientFailures = await Promise.allSettled(
  Array.from({ length: 4 }, () =>
    searchOpenverseImages("children science museum exhibit", 8, { fetchJson: transientFailureFetch })
  )
);
assert.equal(transientFailureCalls, 1, "concurrent failing queries still share one in-flight attempt");
assert.equal(transientFailures.every((result) => result.status === "rejected"), true);
await assert.rejects(
  searchOpenverseImages("children science museum exhibit", 8, { fetchJson: transientFailureFetch }),
  /simulated Openverse 429/u
);
assert.equal(transientFailureCalls, 2, "a failed provider call must be evicted and remain retryable");

let malformedResponseCalls = 0;
const malformedResponseFetch = async (): Promise<unknown> => {
  malformedResponseCalls += 1;
  return "not an Openverse response";
};
await assert.rejects(
  searchOpenverseImages("children science museum exhibit", 8, { fetchJson: malformedResponseFetch }),
  /invalid response/u
);
await assert.rejects(
  searchOpenverseImages("children science museum exhibit", 8, { fetchJson: malformedResponseFetch }),
  /invalid response/u
);
assert.equal(malformedResponseCalls, 2, "a malformed response must never be cached");

const malformedArticleSearch = await searchLicensedMediaForArticle(
  queryArticle,
  ["AI learning exhibits children"],
  2,
  { fetchJson: malformedResponseFetch }
);
assert.deepEqual(malformedArticleSearch, [], "malformed provider responses must not block article generation");

let queryCalls = 0;
const articleSearch = await searchLicensedMediaForArticle(queryArticle, ["AI learning exhibits children"], 1, {
  fetchJson: async () => {
    queryCalls += 1;
    return { results: [validRaw] };
  },
});
assert.equal(queryCalls, 1, "the provider sequence stops once enough licensed media is found");
assert.equal(articleSearch.length, 1);

let unavailableQueryCalls = 0;
const unavailableSearch = await searchLicensedMediaForArticle(queryArticle, ["AI learning exhibits children"], 1, {
  fetchJson: async () => {
    unavailableQueryCalls += 1;
    throw new Error("simulated provider outage");
  },
});
assert.equal(unavailableSearch.length, 0);
assert.equal(unavailableQueryCalls, 3, "provider failures remain bounded to three sequential queries");

function evidence(index: number): ResearchItem {
  return {
    id: `evidence-${index}`,
    sourceKind: "article",
    sourceName: `Evidence ${index}`,
    sourceId: `evidence-${index}`,
    region: "global",
    title: "Unrelated corporate quarterly filing",
    summary: "Balance sheet notes and market guidance.",
    url: `https://evidence.example.org/${index}`,
    imageUrl: `https://images.example.org/broken-${index}.jpg`,
    publishedAt: "2026-08-01T00:00:00Z",
    authors: [`Author ${index}`],
    query: "AI learning exhibits children",
  };
}

const draft: GeneratedArticle = {
  title: "Children learn from interactive science museum exhibits",
  paragraphs: [
    "Children gather around an interactive science museum exhibit [1].",
    "A hands-on display turns an abstract idea into a shared experiment.",
  ],
  mediaHints: [{
    afterParagraphIndex: 0,
    kind: "image",
    purpose: "scene",
    query: "children science museum exhibit",
    alt: "Children exploring a science museum exhibit",
    sourceRefs: [],
  }],
};

const brokenEvidence = [1, 2, 3, 4].map(evidence);
let brokenFetches = 0;
const fetchImage = async (url: string): Promise<SafeImageBinary | undefined> => {
  if (url.includes("broken-")) {
    brokenFetches += 1;
    return undefined;
  }
  if (url === parsed[0]?.downloadUrl) return undefined;
  if (url === parsed[0]?.thumbnailUrl) {
    return {
      bytes: Buffer.from([1, 2, 3, 4]),
      mimeType: "image/jpeg",
      finalUrl: url,
      width: 1200,
      height: 800,
    };
  }
  return undefined;
};

const firstPass = await enrichArticleWithResearch(draft, brokenEvidence, new Date("2026-08-16"), "en", {
  fetchImage,
});
assert.equal(Number(Boolean(firstPass.figure)) + (firstPass.bodyFigures?.length ?? 0), 0);

const licensed = parsed[0] as LicensedMediaItem;
const secondPass = await enrichArticleWithResearch(draft, brokenEvidence, new Date("2026-08-16"), "en", {
  fetchImage,
  supplementalMedia: [licensed],
});
const figures = [secondPass.figure, ...(secondPass.bodyFigures ?? [])].filter(Boolean);
assert.equal(figures.length, 1, "broken/unrelated evidence images still allow a real licensed fallback");
assert.equal(figures[0]?.sourceRef, 5, "supplemental media references append after stable evidence IDs");
assert.match(secondPass.paragraphs[0] ?? "", /\[1\]/u);
assert.equal(secondPass.references?.[0]?.id, 1);
assert.equal(secondPass.references?.[4]?.id, 5);
assert.match(secondPass.references?.[4]?.text ?? "", /CC BY 4\.0/u);
assert.match(secondPass.references?.[4]?.text ?? "", /creativecommons\.org\/licenses\/by\/4\.0/u);
assert.match(secondPass.references?.[4]?.text ?? "", /photos\.example\.org\/works\/museum-children/u);
assert.match(figures[0]?.caption ?? "", /verify the terms/u);
assert.ok(brokenFetches >= 1, "a cited but broken evidence image is attempted and does not block fallback");

const serializedArticle = JSON.stringify(secondPass);
const renderBlocks = articleToRenderBlocks(secondPass);
assert.equal(serializedArticle.includes(licensed.downloadUrl), false, "download URL does not enter the article DTO");
assert.equal(serializedArticle.includes(licensed.thumbnailUrl), false, "thumbnail URL does not enter the article DTO");
assert.equal(JSON.stringify(renderBlocks).includes(licensed.downloadUrl), false, "download URL does not enter render blocks");
assert.equal(
  renderBlocks.some((block) => block.type === "figure" && block.sourceUrl === licensed.landingUrl),
  true
);

const noQualifiedMedia = await enrichArticleWithResearch(draft, [], new Date("2026-08-16"), "en", {
  fetchImage,
  supplementalMedia: [],
});
assert.equal(Number(Boolean(noQualifiedMedia.figure)) + (noQualifiedMedia.bodyFigures?.length ?? 0), 0);

console.log("licensed media tests passed");
