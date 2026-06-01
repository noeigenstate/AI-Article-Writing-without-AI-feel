/**
 * 提示词模板 —— 去 AI 味改写的核心逻辑都在这里，便于单独调优。
 */

import type { GenerateArticleInput, TopicOption } from "./services/article.js";

/** 「AI 味」的可操作定义，所有改写共用 */
export const ANTI_AI_RULES = `你在帮中文作者去除文章里的"AI 味"。AI 味的典型表现：
1. 套话式开头/收尾：综上所述、总而言之、值得注意的是、在当今社会、随着……的发展。
2. 空泛的总结句和正确的废话，信息密度低。
3. 排比和对仗堆砌，句式过于整齐对称。
4. 形容词、副词过度修饰；"不仅……而且""既……又"滥用。
5. 机械的过渡词：首先/其次/然而/因此 连用。
6. 把简单意思绕成长句、用力拔高。

本模型（MiMo）实测出的高频口头禅，尤其要避开：
- 句首连接词"此外""总之""当然"——能不用就不用，需要承接时换更自然的说法或直接去掉。
- 泛化套路句式"……是一种……""关键/重点在于……""这种……""我们……"——尽量改成具体主语和动词。

格式硬规则：只输出纯文本。禁止任何 Markdown 标记（## 标题、** 加粗、- / * 列表、> 引用、\`代码\` 等），这些符号会原样出现在 Word 文档里。

改写目标：说人话。短句优先、信息密度高、有具体细节、语气自然，像一个真人专栏作者写的。
绝不能改变原文的事实、数据、人名、观点立场。只改表达，不改信息。`;

/** 从范文提取风格画像 */
export function styleProfilePrompt(samples: string): string {
  return `下面是若干篇风格相近的范文片段。请用 5 条以内的要点，总结它们的写作风格特征（句长、用词习惯、语气、节奏、标点偏好等），供后续改写对齐。只输出要点，不要解释。

范文：
"""
${samples}
"""`;
}

/** 整篇按段改写。要求逐段对齐返回 JSON。 */
export function rewriteDocPrompt(
  styleSummary: string,
  paragraphs: { index: number; kind: string; text: string }[]
): string {
  const list = paragraphs
    .map((p) => `[${p.index}] (${p.kind}) ${p.text}`)
    .join("\n");

  return `${ANTI_AI_RULES}

要模仿的风格：
${styleSummary || "（无范文，按上面的去 AI 味原则即可）"}

下面是原文段落，每行以 [序号] (类型) 开头。请逐段改写，保持段落数量和顺序完全一致。
标题（heading*）只做轻微润色、不要扩写。列表（list）保持简短。

严格只输出 JSON 数组，每项形如 {"index": 序号, "text": "改写后的整段文本"}，不要任何额外文字、不要 markdown 代码块。

原文：
${list}`;
}

/** 标题改写规则：概括全文 + 抓住注意力 */
export const TITLE_RULES = `这是文章标题，要求和正文完全不同：
1. 用一句话概括全文核心，第一眼就能抓住读者注意力。
2. 必须基于文章真实内容，点出最具体、最有信息量或最有反差的那个点；不要泛泛而谈，也不要夸大或与正文不符的标题党。
3. 简洁有力：多用具体名词、数字，以及"首次/刚刚/解决/来了/史上"等带张力的词；可用"事件：判断"的冒号结构或感叹收尾。
4. 不堆形容词、不喊空口号。只输出标题文字本身，不要书名号或引号包裹。`;

/** 标题改写：基于全文生成多个标题候选 */
export function rewriteTitlePrompt(styleSummary: string, fullText: string, n: number): string {
  return `${ANTI_AI_RULES}

要模仿的风格：
${styleSummary || "（按下面的标题规则即可）"}

${TITLE_RULES}

下面是整篇文章。请基于全文，拟 ${n} 个不同的标题（角度或句式可以不同）。
严格只输出 JSON 字符串数组，如 ["标题一","标题二"]，不要任何额外文字、不要 markdown 代码块。

全文：
"""
${fullText}
"""`;
}

/** 单句生成多个候选表达 */
export function alternativesPrompt(
  styleSummary: string,
  context: string,
  sentence: string,
  n: number
): string {
  return `${ANTI_AI_RULES}

要模仿的风格：
${styleSummary || "（按去 AI 味原则即可）"}

下面这句话出现在这段上下文里：
"""
${context}
"""

请只针对【目标句】给出 ${n} 个不同的表达方式，长短、语气可以有差异，但必须保持原意和事实不变。
目标句：${sentence}

严格只输出 JSON 字符串数组，例如 ["写法一","写法二"]，不要任何额外文字、不要 markdown 代码块。`;
}

/** 按领域自动生成公众号选题 */
export function articleTopicsPrompt(
  domainName: string,
  domainDesc: string,
  n: number,
  researchContext = ""
): string {
  return `${ANTI_AI_RULES}

你是一个公众号选题策划。请围绕下面领域生成 ${n} 个适合公众号文章的一手选题。

领域：${domainName}
领域说明：${domainDesc}

最新参考资料：
${researchContext || "（暂无实时资料，按领域常识生成，但不要编造具体事实。）"}

选题要求：
1. 选题要具体，不要泛泛写"趋势""启示""思考"。
2. 每个选题要有清晰切口，读者一看就知道文章会讲什么。
3. 避开营销号标题党，不能承诺无法验证的结果。
4. 优先给出能写成长文、能展开案例和观点的题目。

严格只输出 JSON 数组，每项形如：
{"title":"选题标题","angle":"文章切入角度","audience":"适合读者","keywords":["关键词1","关键词2"]}
不要任何额外文字、不要 markdown 代码块。`;
}

/** 从选题生成完整公众号文章 */
export function articleDraftPrompt(input: GenerateArticleInput): string {
  const topic =
    typeof input.topic === "string" ? { title: input.topic } : (input.topic as TopicOption);
  const lengthHint =
    input.targetLength === "short"
      ? "约 900-1200 字，段落更短，适合快速发布。"
      : input.targetLength === "long"
        ? "约 1800-2400 字，需要有更充分的案例、判断和收束。"
        : "约 1300-1800 字，适合常规公众号文章。";

  return `${ANTI_AI_RULES}

你要直接写一篇可发布的中文公众号文章。不要写提纲，不要解释写作思路。

领域：${input.domainName}
选题：${topic.title}
切入角度：${"angle" in topic ? topic.angle : "围绕选题展开"}
目标读者：${"audience" in topic ? topic.audience : "公众号读者"}
目标长度：${lengthHint}

要模仿的风格：
${input.styleSummary || "（无特定范文，按去 AI 味原则写，短句优先，信息密度高。）"}

最新参考资料：
${input.researchContext || "（暂无实时资料。不要编造新闻、论文或数据。）"}

写作要求：
1. 开头直接进入问题或场景，不要说"在当今时代""随着发展"。
2. 只使用上方参考资料能支撑的事实、数据、机构名、论文结论和新闻事件。资料里没有的内容，不要写。
3. 每个判断段必须有数据、论文或新闻来源支撑，并在句末使用引用编号，如 [1]、[2]。引用编号只能来自"来源资料 N"。
4. 段落按逻辑推进：事实背景、关键证据、机制解释、反方或限制、可落地判断。每段只推进一个意思。
5. 禁止 AI 口头禅和废话：不要写"值得注意的是""不可忽视""赋能""新范式""深度融合""未来可期""综上所述"。
6. 不要擅自发散，不要写无法验证的预测，不要把推测写成事实。
7. 语言凝练，论点先行，论据跟上。短句优先，不堆形容词。
8. 不输出 Markdown，不用列表符号。图、表、参考文献由系统根据来源自动生成，你只负责写正文。

严格只输出 JSON 对象，格式如下：
{"title":"文章标题","paragraphs":["第一段正文","第二段正文"]}
不要任何额外文字、不要 markdown 代码块。`;
}
