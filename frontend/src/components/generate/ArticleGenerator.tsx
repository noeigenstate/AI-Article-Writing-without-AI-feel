import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchArticleTopics,
  previewResearch,
  type ResearchItemDTO,
  type TargetLength,
  type TopicOptionDTO,
  type WritingSceneId,
} from "../../lib/api.js";
import { useStore } from "../../lib/store.js";
import { ArrowLeft, Sparkle } from "../common/icons.js";
import ProgressBanner from "../common/ProgressBanner.js";
import { messages } from "../../lib/i18n.js";

/** "Generate article" view: title-first or domain → topics → research → generate. */
export type GeneratorView = "setup" | "results";

interface ArticleGeneratorProps {
  onViewChange?: (view: GeneratorView) => void;
}

export default function ArticleGenerator({ onViewChange }: ArticleGeneratorProps) {
  const styles = useStore((s) => s.styles);
  const loadStyles = useStore((s) => s.loadStyles);
  const domains = useStore((s) => s.articleDomains);
  const loadArticleDomains = useStore((s) => s.loadArticleDomains);
  const doGenerateArticle = useStore((s) => s.doGenerateArticle);
  const doGenerateArticleFromTitle = useStore((s) => s.doGenerateArticleFromTitle);
  const research = useStore((s) => (s.mode === "generate" ? s.research : s.workspaces.generate.research));
  const setResearch = useStore((s) => s.setResearch);
  const lang = useStore((s) => s.lang);
  const t = messages[lang];
  const LENGTHS: { id: TargetLength; label: string }[] = [
    { id: "medium", label: t.lengthRegular },
    { id: "short", label: t.lengthShort },
    { id: "long", label: t.lengthLong },
  ];
  const [domainId, setDomainId] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [styleId, setStyleId] = useState("");
  const [sceneId, setSceneId] = useState<WritingSceneId>("wechat");
  const [targetLength, setTargetLength] = useState<TargetLength>("medium");
  const [topics, setTopics] = useState<TopicOptionDTO[]>([]);
  const [topicBusy, setTopicBusy] = useState(false);
  const [topicProgress, setTopicProgress] = useState<{ task: "articleTopics"; startedAt: number } | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);
  const [view, setView] = useState<GeneratorView>("setup");
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const topicsButtonRef = useRef<HTMLButtonElement>(null);
  const researchButtonRef = useRef<HTMLButtonElement>(null);
  const revisitButtonRef = useRef<HTMLButtonElement>(null);
  const resultsOriginRef = useRef<"topics" | "research" | "revisit">("topics");

  useEffect(() => {
    loadStyles();
    loadArticleDomains();
  }, [loadArticleDomains, loadStyles]);

  useEffect(() => {
    if (!domainId && domains[0]) setDomainId(domains[0].id);
  }, [domainId, domains]);

  useEffect(() => {
    if (view !== "results") return;
    const frame = requestAnimationFrame(() => resultsHeadingRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [view]);

  const selectedDomain = useMemo(
    () => domains.find((d) => d.id === domainId),
    [domainId, domains]
  );

  async function loadTopics() {
    setTopicBusy(true);
    setTopicProgress({ task: "articleTopics", startedAt: Date.now() });
    setTopicError(null);
    setResearchError(null);
    try {
      const response = await fetchArticleTopics(domainId, domainId === "custom" ? customDomain : "", 6, lang);
      setTopics(response.topics);
      setResearch(response.research ?? null, "generate");
      if (response.topics.length > 0 || response.research) openResults("topics");
    } catch (e) {
      setTopicError((e as Error).message);
    } finally {
      setTopicBusy(false);
      setTopicProgress(null);
    }
  }

  async function loadResearch() {
    setResearchBusy(true);
    setResearchError(null);
    try {
      const bundle = await previewResearch(domainId, domainId === "custom" ? customDomain : "", "", lang);
      setResearch(bundle, "generate");
      openResults("research");
    } catch (e) {
      setResearchError((e as Error).message);
    } finally {
      setResearchBusy(false);
    }
  }

  function clearDomainState(nextDomainId: string) {
    setDomainId(nextDomainId);
    setTopics([]);
    setResearch(null, "generate");
    setTopicError(null);
    setResearchError(null);
    setGeneratingTopicId(null);
    setTopicProgress(null);
  }

  function openResults(origin: "topics" | "research" | "revisit") {
    resultsOriginRef.current = origin;
    setView("results");
    onViewChange?.("results");
  }

  function backToSetup() {
    setView("setup");
    onViewChange?.("setup");
    requestAnimationFrame(() => {
      const origin = resultsOriginRef.current;
      const target = origin === "research"
        ? researchButtonRef.current
        : origin === "revisit"
          ? revisitButtonRef.current
          : topicsButtonRef.current;
      target?.focus();
    });
  }

  async function generate(topic: TopicOptionDTO) {
    setGeneratingTopicId(topic.id);
    setTopicError(null);
    setResearchError(null);
    try {
      await doGenerateArticle(domainId, domainId === "custom" ? customDomain : "", topic, styleId, sceneId, targetLength);
    } finally {
      setGeneratingTopicId(null);
    }
  }

  async function generateFromTitle() {
    const title = titleInput.trim();
    if (!title) {
      setTopicError(t.enterTitleErr);
      return;
    }
    setGeneratingTopicId("title-input");
    setTopicError(null);
    setResearchError(null);
    try {
      await doGenerateArticleFromTitle(title, styleId, sceneId, targetLength);
    } finally {
      setGeneratingTopicId(null);
    }
  }

  const customDisabled = domainId === "custom" && !customDomain.trim();
  const isGeneratingArticle = Boolean(generatingTopicId);
  const previewItems = research?.items.slice(0, 5) ?? [];
  const hasResults = topics.length > 0 || Boolean(research);
  const hasBothResultPanels = topics.length > 0 && Boolean(research);
  const domainLabel = domainId === "custom" ? customDomain.trim() : selectedDomain?.name;
  const styleLabel = styles.find((style) => style.id === styleId)?.name ?? t.defaultTone;
  const sceneLabel = sceneOptions(t).find((scene) => scene.id === sceneId)?.label ?? t.sceneGeneral;
  const lengthLabel = LENGTHS.find((length) => length.id === targetLength)?.label ?? t.lengthRegular;

  if (view === "results" && hasResults) {
    return (
      <div className="generator-results">
        <header className="generator-results-head">
          <button type="button" className="generator-back" onClick={backToSetup}>
            <ArrowLeft />
            {t.backToGeneratorSetup}
          </button>
          <div className="generator-results-copy">
            <h1 ref={resultsHeadingRef} tabIndex={-1}>
              {topics.length > 0 ? t.topicResultsTitle : t.researchHead}
            </h1>
            <p>{topics.length > 0 ? t.topicResultsSub : t.researchResultsSub}</p>
          </div>
          <ul className="generator-results-meta" aria-label={t.generatorOptionsSummary}>
            {domainLabel && <li>{domainLabel}</li>}
            <li>{styleLabel}</li>
            <li>{sceneLabel}</li>
            <li>{lengthLabel}</li>
          </ul>
        </header>

        {generatingTopicId && <p className="generator-results-status" role="status">{t.generatingNote}</p>}
        {topicError && <div className="error topic-error" role="alert">{topicError}</div>}
        {researchError && <div className="error topic-error" role="alert">{researchError}</div>}

        <div className={`generator-results-layout${hasBothResultPanels ? "" : " single"}`}>
          {topics.length > 0 && (
            <section className="generator-results-panel topic-results-panel" aria-labelledby="topic-results-heading">
              <div className="generator-panel-head">
                <h2 id="topic-results-heading">{t.topicResultsCount(topics.length)}</h2>
              </div>
              <div className="topic-grid">
                {topics.map((topic) => (
                  <article className="topic-card" key={topic.id}>
                    <div>
                      <h3>{topic.title}</h3>
                      <p>{topic.angle}</p>
                    </div>
                    <div className="topic-meta">
                      <span>{topic.audience}</span>
                      {topic.keywords.slice(0, 3).map((kw) => (
                        <span key={kw}>{kw}</span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="primary"
                      disabled={isGeneratingArticle}
                      onClick={() => {
                        void generate(topic);
                      }}
                    >
                      {generatingTopicId === topic.id ? t.generating : t.generateArticleBtn}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {research && (
            <section className="generator-results-panel research-results-panel" aria-labelledby="research-results-heading">
              <div className="research-head generator-panel-head">
                <h2 id="research-results-heading">{t.researchHead}</h2>
                <span className="research-coverage">
                  {t.researchCoverage(
                    research.coverage.domestic,
                    research.coverage.international,
                    research.coverage.global,
                    research.coverage.uniqueSources
                  )}
                </span>
              </div>
              {previewItems.length > 0 ? (
                <div className="research-list">
                  {previewItems.map((item: ResearchItemDTO) => (
                    <a className="research-item" key={item.id} href={item.url} target="_blank" rel="noreferrer">
                      <span>
                        {item.sourceName} · {researchRegionLabel(item.region, t)} · {researchKindLabel(item.sourceKind, lang)}
                      </span>
                      {item.publishedAt && <time>{new Date(item.publishedAt).toLocaleDateString(t.dateLocale)}</time>}
                      <strong>{item.title}</strong>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="generator-empty">{t.noResearchResults}</p>
              )}
              {research.unavailableSources.length > 0 && (
                <p className="research-unavailable">
                  {t.unavailableSources(research.unavailableSources.join(lang === "zh" ? "、" : ", "))}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="generator">
      <section className="step generator-compose">
        <div className="step-head">
          <span className="badge lavender">1</span>
          <h2>{t.genStep1}</h2>
        </div>

        <div className="title-generate">
          <label className="sr-only" htmlFor="article-title-input">
            {lang === "zh" ? "文章标题" : "Article title"}
          </label>
          <input
            id="article-title-input"
            className="text-input title-input"
            value={titleInput}
            maxLength={120}
            onChange={(e) => {
              setTitleInput(e.target.value);
              setTopicError(null);
            }}
            placeholder={t.titlePlaceholder}
          />
          <button
            type="button"
            className="primary"
            disabled={isGeneratingArticle || !titleInput.trim()}
            onClick={() => {
              void generateFromTitle();
            }}
          >
            <Sparkle />
            {generatingTopicId === "title-input" ? t.generating : t.generateByTitle}
          </button>
        </div>

        <div
          className="domain-grid"
          role="group"
          aria-label={lang === "zh" ? "文章领域" : "Article domain"}
        >
          {domains.map((d, index) => (
            <button
              key={d.id}
              type="button"
              className={`domain-card${domainId === d.id ? " active" : ""}`}
              aria-pressed={domainId === d.id}
              onClick={() => {
                clearDomainState(d.id);
              }}
            >
              <span className="domain-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="domain-name">{d.name}</span>
              <small>{d.desc}</small>
            </button>
          ))}
          <button
            type="button"
            className={`domain-card custom${domainId === "custom" ? " active" : ""}`}
            aria-pressed={domainId === "custom"}
            onClick={() => {
              clearDomainState("custom");
            }}
          >
            <span className="domain-index" aria-hidden="true">{String(domains.length + 1).padStart(2, "0")}</span>
            <span className="domain-name">{t.customDomain}</span>
            <small>{t.customDomainDesc}</small>
          </button>
        </div>
        {domainId === "custom" && (
          <>
            <label className="sr-only" htmlFor="custom-domain-input">
              {t.customDomain}
            </label>
            <input
              id="custom-domain-input"
              className="text-input"
              value={customDomain}
              onChange={(e) => {
                setCustomDomain(e.target.value);
                setTopics([]);
                setResearch(null, "generate");
                setTopicError(null);
                setResearchError(null);
                setGeneratingTopicId(null);
                setTopicProgress(null);
              }}
              placeholder={t.customDomainPlaceholder}
            />
          </>
        )}
      </section>

      <section className="step generator-desk">
        <div className="step-head">
          <span className="badge mint">2</span>
          <h2>{t.genStep2}</h2>
        </div>
        <div className="generator-row">
          <label className="sr-only" htmlFor="article-style-select">
            {lang === "zh" ? "文章口吻" : "Article tone"}
          </label>
          <select
            id="article-style-select"
            className="styleselect compact"
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
          >
            <option value="">{t.defaultTone}</option>
            {styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="article-scene-select">
            {t.sceneLabel}
          </label>
          <select
            id="article-scene-select"
            className="styleselect compact"
            value={sceneId}
            onChange={(e) => setSceneId(e.target.value as WritingSceneId)}
          >
            {sceneOptions(t).map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.label}
              </option>
            ))}
          </select>
          <div
            className="segment"
            role="group"
            aria-label={lang === "zh" ? "文章长度" : "Article length"}
          >
            {LENGTHS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={targetLength === item.id ? "active" : ""}
                aria-pressed={targetLength === item.id}
                onClick={() => setTargetLength(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            ref={topicsButtonRef}
            type="button"
            className="primary"
            disabled={topicBusy || customDisabled || isGeneratingArticle}
            onClick={loadTopics}
          >
            <Sparkle />
            {topicBusy ? t.generating : t.autoTopics}
          </button>
          <button
            ref={researchButtonRef}
            type="button"
            className="primary"
            disabled={researchBusy || customDisabled || isGeneratingArticle}
            onClick={loadResearch}
          >
            <Sparkle />
            {researchBusy ? t.researching : t.researchBtn}
          </button>
          {hasResults && (
            <button
              ref={revisitButtonRef}
              type="button"
              className="generator-revisit"
              onClick={() => openResults("revisit")}
            >
              {t.viewGeneratedResults}
            </button>
          )}
        </div>
        <p className="sr-only" role="status" aria-atomic="true">
          {researchBusy ? t.researching : research ? t.sourceCount(research.items.length) : ""}
        </p>
        {topicError && <div className="error topic-error" role="alert">{topicError}</div>}
        {researchError && <div className="error topic-error" role="alert">{researchError}</div>}
        {topicProgress && <ProgressBanner busy={t.generating} progress={topicProgress} lang={lang} />}
        {selectedDomain && !topicBusy && (
          <p className="hint pick-desc">{t.currentDomain(selectedDomain.name)}</p>
        )}
        {generatingTopicId && <p className="hint pick-desc">{t.generatingNote}</p>}
      </section>
    </div>
  );
}

function sceneOptions(t: (typeof messages)["en"]): { id: WritingSceneId; label: string }[] {
  return [
    { id: "general", label: t.sceneGeneral },
    { id: "wechat", label: t.sceneWechat },
    { id: "business", label: t.sceneBusiness },
    { id: "academic", label: t.sceneAcademic },
    { id: "official", label: t.sceneOfficial },
    { id: "social", label: t.sceneSocial },
    { id: "technical", label: t.sceneTechnical },
  ];
}

function researchKindLabel(kind: ResearchItemDTO["sourceKind"], lang: "en" | "zh"): string {
  const labels = {
    en: { paper: "paper", news: "news", article: "web article", comment: "public comment" },
    zh: { paper: "论文", news: "新闻", article: "网页文章", comment: "公开评论" },
  } as const;
  return labels[lang][kind];
}

function researchRegionLabel(region: ResearchItemDTO["region"], t: (typeof messages)["en"]): string {
  if (region === "domestic") return t.regionDomestic;
  if (region === "international") return t.regionInternational;
  return t.regionGlobal;
}
