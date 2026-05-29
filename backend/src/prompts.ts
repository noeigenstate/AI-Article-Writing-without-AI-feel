/**
 * 提示词模板 —— 去 AI 味改写的核心逻辑都在这里，便于单独调优。
 */

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
