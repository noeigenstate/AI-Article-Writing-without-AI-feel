import { useEffect, useMemo, useState } from "react";
import {
  fetchArticleTopics,
  previewResearch,
  type ResearchItemDTO,
  type TargetLength,
  type TopicOptionDTO,
} from "../api.js";
import { useStore } from "../store.js";
import { Sparkle } from "./icons.js";
import { messages } from "../i18n.js";

export default function ArticleGenerator() {
  const styles = useStore((s) => s.styles);
  const loadStyles = useStore((s) => s.loadStyles);
  const domains = useStore((s) => s.articleDomains);
  const loadArticleDomains = useStore((s) => s.loadArticleDomains);
  const doGenerateArticle = useStore((s) => s.doGenerateArticle);
  const doGenerateArticleFromTitle = useStore((s) => s.doGenerateArticleFromTitle);
  const research = useStore((s) => s.research);
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
  const [targetLength, setTargetLength] = useState<TargetLength>("medium");
  const [topics, setTopics] = useState<TopicOptionDTO[]>([]);
  const [topicBusy, setTopicBusy] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);

  useEffect(() => {
    loadStyles();
    loadArticleDomains();
  }, [loadArticleDomains, loadStyles]);

  useEffect(() => {
    if (!domainId && domains[0]) setDomainId(domains[0].id);
  }, [domainId, domains]);

  const selectedDomain = useMemo(
    () => domains.find((d) => d.id === domainId),
    [domainId, domains]
  );

  async function loadTopics() {
    setTopicBusy(true);
    setTopicError(null);
    setResearchError(null);
    try {
      const response = await fetchArticleTopics(domainId, domainId === "custom" ? customDomain : "", 6, lang);
      setTopics(response.topics);
      setResearch(response.research ?? null);
    } catch (e) {
      setTopicError((e as Error).message);
    } finally {
      setTopicBusy(false);
    }
  }

  async function loadResearch() {
    setResearchBusy(true);
    setResearchError(null);
    try {
      const bundle = await previewResearch(domainId, domainId === "custom" ? customDomain : "", "", lang);
      setResearch(bundle);
    } catch (e) {
      setResearchError((e as Error).message);
    } finally {
      setResearchBusy(false);
    }
  }

  function clearDomainState(nextDomainId: string) {
    setDomainId(nextDomainId);
    setTopics([]);
    setResearch(null);
    setTopicError(null);
    setResearchError(null);
    setGeneratingTopicId(null);
  }

  async function generate(topic: TopicOptionDTO) {
    setGeneratingTopicId(topic.id);
    setTopicError(null);
    setResearchError(null);
    try {
      await doGenerateArticle(domainId, domainId === "custom" ? customDomain : "", topic, styleId, targetLength);
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
      await doGenerateArticleFromTitle(title, styleId, targetLength);
    } finally {
      setGeneratingTopicId(null);
    }
  }

  const customDisabled = domainId === "custom" && !customDomain.trim();
  const isGeneratingArticle = Boolean(generatingTopicId);
  const previewItems = research?.items.slice(0, 5) ?? [];

  return (
    <div className="generator">
      <div className="step lavender">
        <div className="step-head">
          <span className="badge lavender">1</span>
          <h2>{t.genStep1}</h2>
        </div>

        <div className="title-generate">
          <input
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

        <div className="domain-grid">
          {domains.map((d) => (
            <button
              key={d.id}
              className={`domain-card${domainId === d.id ? " active" : ""}`}
              onClick={() => {
                clearDomainState(d.id);
              }}
            >
              <span>{d.name}</span>
              <small>{d.desc}</small>
            </button>
          ))}
          <button
            className={`domain-card custom${domainId === "custom" ? " active" : ""}`}
            onClick={() => {
              clearDomainState("custom");
            }}
          >
            <span>{t.customDomain}</span>
            <small>{t.customDomainDesc}</small>
          </button>
        </div>
        {domainId === "custom" && (
          <input
            className="text-input"
            value={customDomain}
            onChange={(e) => {
              setCustomDomain(e.target.value);
              setTopics([]);
              setResearch(null);
              setTopicError(null);
              setResearchError(null);
              setGeneratingTopicId(null);
            }}
            placeholder={t.customDomainPlaceholder}
          />
        )}
      </div>

      <div className="step mint">
        <div className="step-head">
          <span className="badge mint">2</span>
          <h2>{t.genStep2}</h2>
        </div>
        <div className="generator-row">
          <select
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
          <div className="segment">
            {LENGTHS.map((item) => (
              <button
                key={item.id}
                className={targetLength === item.id ? "active" : ""}
                onClick={() => setTargetLength(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button className="primary" disabled={topicBusy || customDisabled || isGeneratingArticle} onClick={loadTopics}>
            <Sparkle />
            {topicBusy ? t.generating : t.autoTopics}
          </button>
          <button className="primary" disabled={researchBusy || customDisabled || isGeneratingArticle} onClick={loadResearch}>
            <Sparkle />
            {researchBusy ? t.researching : t.researchBtn}
          </button>
        </div>
        {topicError && <div className="error topic-error">{topicError}</div>}
        {researchError && <div className="error topic-error">{researchError}</div>}
        {selectedDomain && !topics.length && !topicBusy && (
          <p className="hint pick-desc">{t.currentDomain(selectedDomain.name)}</p>
        )}
        {generatingTopicId && <p className="hint pick-desc">{t.generatingNote}</p>}
        {research && (
          <section className="research-strip">
            <div className="research-head">
              <strong>{t.researchHead}</strong>
              <span>{t.sourceCount(research.items.length)}</span>
            </div>
            <div className="research-list">
              {previewItems.map((item: ResearchItemDTO) => (
                <a className="research-item" key={item.id} href={item.url} target="_blank" rel="noreferrer">
                  <span>{item.sourceName}</span>
                  {item.publishedAt && <time>{new Date(item.publishedAt).toLocaleDateString(t.dateLocale)}</time>}
                  <strong>{item.title}</strong>
                </a>
              ))}
            </div>
            {research.unavailableSources.length > 0 && (
              <p className="research-unavailable">
                {t.unavailableSources(research.unavailableSources.join(lang === "zh" ? "、" : ", "))}
              </p>
            )}
          </section>
        )}
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
      </div>
    </div>
  );
}
