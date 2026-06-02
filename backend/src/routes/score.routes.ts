import { Router } from "express";
import { scoreText } from "../services/aiScore.js";
import { normalizeLang } from "../core/i18n.js";

/** Routes for the local AI-smell score. */
const router = Router();

/**
 * `POST /api/score` — score text for AI smell.
 *
 * Body: `{ text, lang }`. Purely local heuristic: no model call, no network.
 */
router.post("/api/score", (req, res) => {
  const { text, lang: rawLang } = req.body as { text?: string; lang?: string };
  res.json(scoreText(text ?? "", normalizeLang(rawLang)));
});

export default router;
