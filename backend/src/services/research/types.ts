/** Whether a research item came from a paper or a news source. */
export type ResearchSourceKind = "paper" | "news";

/** Category of a news/RSS source, used to pick feeds per domain. */
export type NewsSourceType = "international" | "technology" | "finance" | "chinese";

/** A configured news/RSS feed. */
export interface NewsSource {
  id: string;
  name: string;
  type: NewsSourceType;
  url: string;
  enabled: boolean;
}

/** A normalized research result from any source (paper or news). */
export interface ResearchItem {
  id: string;
  sourceKind: ResearchSourceKind;
  sourceName: string;
  sourceId: string;
  title: string;
  summary: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  authors: string[];
  query: string;
}

/** The full result of one research collection: items plus any source failures. */
export interface ResearchBundle {
  query: string;
  generatedAt: string;
  items: ResearchItem[];
  unavailableSources: string[];
}
