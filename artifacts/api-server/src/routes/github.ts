import { Router } from "express";
import { FetchAppJsonBody } from "@workspace/api-zod";
import { parseGithubRepoUrl, fetchAppJsonFromGithub, AppJsonFetchError } from "../lib/github";

const router = Router();

router.post("/github/fetch-app-json", async (req, res) => {
  const parsed = FetchAppJsonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const repo = parseGithubRepoUrl(parsed.data.repoUrl);
  if (!repo) {
    res.status(400).json({ error: "That doesn't look like a GitHub URL. Use https://github.com/owner/repo." });
    return;
  }
  try {
    const { data } = await fetchAppJsonFromGithub(repo);
    res.json(data);
  } catch (e) {
    if (e instanceof AppJsonFetchError) {
      res.status(e.statusCode === 404 ? 400 : e.statusCode).json({ error: e.message });
      return;
    }
    throw e;
  }
});

export default router;
