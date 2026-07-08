import { Router } from "express";
import { formatGzhArticle, listGzhThemes } from "../services/gzh.js";
import { normalizeLang } from "../core/i18n.js";

/** Routes for the WeChat Official Account (公众号) formatting engine. */
const router = Router();

/** `GET /api/gzh/themes?lang=` — list the registered formatting themes. */
router.get("/api/gzh/themes", (req, res) => {
  const lang = normalizeLang(req.query.lang);
  res.json({ themes: listGzhThemes(lang) });
});

/**
 * `POST /api/gzh/format` — format a Markdown article into gzh-ready HTML.
 *
 * Body: `{ markdown, themeId, author?, lang }`. Returns the clean
 * `<section>` fragment plus compliance validation results.
 */
router.post("/api/gzh/format", async (req, res) => {
  try {
    const { markdown, themeId, author, lang: rawLang } = req.body as {
      markdown?: string;
      themeId?: string;
      author?: string;
      lang?: string;
    };
    const lang = normalizeLang(rawLang);
    if (typeof markdown !== "string" || !markdown.trim()) {
      res.status(400).json({ error: lang === "zh" ? "请输入要排版的文章内容" : "Article content is required." });
      return;
    }
    const result = await formatGzhArticle({
      markdown,
      themeId: themeId ?? "",
      author: typeof author === "string" ? author : "",
      lang,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
