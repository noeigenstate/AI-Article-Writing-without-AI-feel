import { Router } from "express";
import { health } from "../services/llm.js";

/** Routes for model connectivity checks. */
const router = Router();

/** `GET /api/health` — report whether the configured model is reachable. */
router.get("/api/health", async (_req, res) => {
  res.json(await health());
});

export default router;
