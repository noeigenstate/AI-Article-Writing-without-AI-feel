import { Router } from "express";
import { diagnoseText, scoreText } from "../services/aiScore.js";
import { normalizeLang } from "../core/i18n.js";

/** Routes for the local human-likeness score. */
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

/**
 * `POST /api/diagnose` — return a local, explainable AI-smell report.
 *
 * Body: `{ text, lang }`. Does not rewrite content and does not call a model.
 */
router.post("/api/diagnose", (req, res) => {
  const { text, lang: rawLang } = req.body as { text?: string; lang?: string };
  res.json(diagnoseText(text ?? "", normalizeLang(rawLang)));
});

export default router;
