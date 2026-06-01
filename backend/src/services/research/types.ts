export type ResearchSourceKind = "paper" | "news";

export type NewsSourceType = "international" | "technology" | "finance" | "chinese";

export interface NewsSource {
  id: string;
  name: string;
  type: NewsSourceType;
  url: string;
  enabled: boolean;
}

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

export interface ResearchBundle {
  query: string;
  generatedAt: string;
  items: ResearchItem[];
  unavailableSources: string[];
}
