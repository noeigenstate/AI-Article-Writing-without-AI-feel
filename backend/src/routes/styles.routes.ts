import { Router } from "express";
import { getBuiltinStyles } from "../data/styles.js";
import { normalizeLang } from "../core/i18n.js";

/** Routes exposing the built-in writing styles. */
const router = Router();

/** `GET /api/styles?lang=` — list built-in style profiles (distilled "skills"). */
router.get("/api/styles", (req, res) => {
  const lang = normalizeLang(req.query.lang);
  res.json({ styles: getBuiltinStyles(lang).map(({ id, name, desc }) => ({ id, name, desc })) });
});

export default router;
