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

const LENGTHS: { id: TargetLength; label: string }[] = [
  { id: "medium", label: "常规" },
  { id: "short", label: "短文" },
  { id: "long", label: "长文" },
];

export default function ArticleGenerator() {
  const styles = useStore((s) => s.styles);
  const loadStyles = useStore((s) => s.loadStyles);
  const domains = useStore((s) => s.articleDomains);
  const loadArticleDomains = useStore((s) => s.loadArticleDomains);
  const doGenerateArticle = useStore((s) => s.doGenerateArticle);
  const doGenerateArticleFromTitle = useStore((s) => s.doGenerateArticleFromTitle);
  const research = useStore((s) => s.research);
  const setResearch = useStore((s) => s.setResearch);
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
      const response = await fetchArticleTopics(domainId, domainId === "custom" ? customDomain : "", 6);
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
      const bundle = await previewResearch(domainId, domainId === "custom" ? customDomain : "");
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
      setTopicError("请输入文章标题");
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
          <h2>输入标题或选择领域</h2>
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
            placeholder="输入标题，AI 自动判断领域并生成文章"
          />
          <button
            className="primary"
            disabled={isGeneratingArticle || !titleInput.trim()}
            onClick={() => {
              void generateFromTitle();
            }}
          >
            <Sparkle />
            {generatingTopicId === "title-input" ? "生成中…" : "按标题生成"}
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
            <span>自定义领域</span>
            <small>输入你想写的垂直方向</small>
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
            placeholder="例如：新能源车、本地生活、心理咨询"
          />
        )}
      </div>

      <div className="step mint">
        <div className="step-head">
          <span className="badge mint">2</span>
          <h2>生成并选择选题</h2>
        </div>
        <div className="generator-row">
          <select
            className="styleselect compact"
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
          >
            <option value="">默认公众号口吻</option>
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
            {topicBusy ? "生成中…" : "自动生成选题"}
          </button>
          <button className="primary" disabled={researchBusy || customDisabled || isGeneratingArticle} onClick={loadResearch}>
            <Sparkle />
            {researchBusy ? "检索中…" : "前沿资料"}
          </button>
        </div>
        {topicError && <div className="error topic-error">{topicError}</div>}
        {researchError && <div className="error topic-error">{researchError}</div>}
        {selectedDomain && !topics.length && !topicBusy && (
          <p className="hint pick-desc">当前领域：{selectedDomain.name}</p>
        )}
        {generatingTopicId && (
          <p className="hint pick-desc">正在生成文章，通常需要 30-90 秒，完成后会自动进入编辑页。</p>
        )}
        {research && (
          <section className="research-strip">
            <div className="research-head">
              <strong>前沿资料</strong>
              <span>{research.items.length} 条来源</span>
            </div>
            <div className="research-list">
              {previewItems.map((item: ResearchItemDTO) => (
                <a className="research-item" key={item.id} href={item.url} target="_blank" rel="noreferrer">
                  <span>{item.sourceName}</span>
                  {item.publishedAt && <time>{new Date(item.publishedAt).toLocaleDateString("zh-CN")}</time>}
                  <strong>{item.title}</strong>
                </a>
              ))}
            </div>
            {research.unavailableSources.length > 0 && (
              <p className="research-unavailable">
                部分来源暂不可用：{research.unavailableSources.join("、")}
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
                {generatingTopicId === topic.id ? "生成中…" : "一键生成文章"}
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
