/**
 * 探测特定模型（MiMo）的「口头禅」。
 *
 * 原理：让模型写一批**话题互不相关**的短文，统计**跨话题反复出现**的词组。
 *      话题都不同还高频共现的短语 = 风格性口头禅（而非话题词）。
 *
 * 用法：
 *   npm run probe:tics            生成 + 分析（需有效 API Key，约几分钟）
 *   npm run probe:tics -- --reuse 只用上次缓存的输出重新分析（不调模型）
 */
import { writeFile, readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { chat } from "../services/llm.js";
import { splitSentences } from "../services/splitter.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.resolve(here, "../../probe-outputs.json");

/** 话题互不相关、体裁多样的写作任务（故意不给任何"去 AI 味"指令，要的是默认风格） */
const PROMPTS = [
  "写一段 150 字左右的短文，谈谈你对城市夜跑的看法。",
  "用 150 字介绍一下潮汐是怎么形成的。",
  "写一段 150 字的影评，评价一部你喜欢的悬疑电影。",
  "用 150 字聊聊远程办公的利弊。",
  "写一段 150 字，介绍一道家常菜的做法和它的来历。",
  "用 150 字谈谈短视频对注意力的影响。",
  "写一段 150 字的科普，解释为什么天空是蓝色的。",
  "用 150 字评论一下当下年轻人的断舍离风潮。",
  "写一段 150 字，描述一次难忘的旅行经历。",
  "用 150 字介绍咖啡因对身体的作用。",
  "写一段 150 字，谈谈纸质书和电子书你更偏爱哪种。",
  "用 150 字解释什么是复利，并举个例子。",
  "写一段 150 字的随笔，主题是雨天。",
  "用 150 字聊聊养猫和养狗的区别。",
  "写一段 150 字，介绍马拉松新手如何起步。",
  "用 150 字谈谈你对人工智能写作的态度。",
  "写一段 150 字的产品测评，评价一款无线耳机。",
  "用 150 字解释为什么熬夜对健康不好。",
  "写一段 150 字，谈谈小城市生活的好处。",
  "用 150 字介绍极简主义的设计理念。",
];

const KNOWN_TICS = [
  "综上所述", "总而言之", "总的来说", "总之", "一言以蔽之", "由此可见",
  "值得注意的是", "值得一提的是", "不难发现", "不难看出", "显而易见",
  "与此同时", "在当今", "当今社会", "随着", "不仅", "而且", "其实",
  "换言之", "首先", "其次", "再者", "最后", "因此", "然而", "此外",
  "无论是", "还是", "归根结底", "毫无疑问", "正因如此", "让我们", "重要的是",
];

const SPLIT = /[\s，。、；：！？""''（）()[\]【】《》…—\-~·\n\t0-9a-zA-Z]+/;

async function generate(): Promise<string[]> {
  const outputs: string[] = new Array(PROMPTS.length);
  const concurrency = 4;
  let i = 0;
  async function worker() {
    while (i < PROMPTS.length) {
      const idx = i++;
      process.stdout.write(`  生成 ${idx + 1}/${PROMPTS.length}…\n`);
      try {
        outputs[idx] = await chat(PROMPTS[idx], { temperature: 0.7 });
      } catch (e) {
        outputs[idx] = "";
        console.error(`  ✗ #${idx + 1} 失败: ${(e as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  await writeFile(CACHE, JSON.stringify(outputs, null, 2));
  return outputs;
}

/** 文档频率（出现在多少篇里）+ 总频次 */
function docFreq(outputs: string[], phrase: string) {
  let df = 0;
  let total = 0;
  for (const o of outputs) {
    const c = o.split(phrase).length - 1;
    if (c > 0) df++;
    total += c;
  }
  return { df, total };
}

function analyze(outputs: string[]) {
  const N = outputs.filter((o) => o.trim()).length;
  console.log(`\n有效样本: ${N} 篇\n`);

  // 1) 已知 AI 腔命中情况
  console.log("=== 已知 AI 口头禅命中（按文档频率排序）===");
  const knownHits = KNOWN_TICS.map((t) => ({ t, ...docFreq(outputs, t) }))
    .filter((x) => x.df > 0)
    .sort((a, b) => b.df - a.df || b.total - a.total);
  for (const k of knownHits) {
    const pct = ((k.df / N) * 100).toFixed(0);
    console.log(`  ${k.t.padEnd(8)} 出现在 ${k.df}/${N} 篇 (${pct}%)，共 ${k.total} 次`);
  }

  // 2) 数据驱动：跨话题高频短语（字符 n-gram，长度 2..10）
  const dfMap = new Map<string, Set<number>>();
  outputs.forEach((o, di) => {
    if (!o.trim()) return;
    const seen = new Set<string>();
    for (const seg of o.split(SPLIT)) {
      const chars = Array.from(seg);
      for (let len = 2; len <= 10; len++) {
        for (let s = 0; s + len <= chars.length; s++) {
          seen.add(chars.slice(s, s + len).join(""));
        }
      }
    }
    for (const p of seen) {
      if (!dfMap.has(p)) dfMap.set(p, new Set());
      dfMap.get(p)!.add(di);
    }
  });

  const minDf = Math.max(3, Math.ceil(N * 0.2)); // 至少 20% 的不相关话题都出现
  const cands = [...dfMap.entries()]
    .map(([p, set]) => ({ p, df: set.size }))
    .filter((c) => c.df >= minDf)
    .sort((a, b) => b.df - a.df || b.p.length - a.p.length);

  // 取极大短语：若某短语被一个 df 不更低的更长短语包含，则丢弃（信息量更小）
  const kept: { p: string; df: number }[] = [];
  for (const c of cands) {
    const covered = kept.some((k) => k.p.length > c.p.length && k.p.includes(c.p) && k.df >= c.df);
    if (!covered) kept.push(c);
  }

  console.log(`\n=== 数据驱动·跨话题高频短语（df ≥ ${minDf}，取前 40）===`);
  for (const c of kept.slice(0, 40)) {
    const pct = ((c.df / N) * 100).toFixed(0);
    console.log(`  ${c.p.padEnd(12)} ${c.df}/${N} 篇 (${pct}%)`);
  }

  console.log(`\n=== 其中 ≥3 字的招牌短语（口头禅重点，df ≥ 3）===`);
  for (const c of kept.filter((k) => Array.from(k.p).length >= 3 && k.df >= 3).slice(0, 30)) {
    const pct = ((c.df / N) * 100).toFixed(0);
    console.log(`  ${c.p.padEnd(12)} ${c.df}/${N} 篇 (${pct}%)`);
  }

  // 3) 句子开头偏好（AI 爱用固定开场）
  const openers = new Map<string, number>();
  for (const o of outputs) {
    for (const sent of splitSentences(o)) {
      const head = Array.from(sent.trim().replace(/^[^一-龥a-zA-Z]+/, "")).slice(0, 2).join("");
      if (head.length === 2) openers.set(head, (openers.get(head) ?? 0) + 1);
    }
  }
  const topOpeners = [...openers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`\n=== 高频句首二字 ===`);
  for (const [h, c] of topOpeners) console.log(`  ${h}  ${c} 次`);

  console.log(`\n（缓存输出已存于 ${CACHE}，可加 --reuse 重新分析）`);
}

const reuse = process.argv.includes("--reuse");
const outputs = reuse
  ? (JSON.parse(await readFile(CACHE, "utf8")) as string[])
  : await generate();
analyze(outputs);
