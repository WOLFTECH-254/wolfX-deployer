import { Router } from "express";
import { FetchAppJsonBody } from "@workspace/api-zod";

const router = Router();

function parseGithubUrl(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(repoUrl);
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

router.post("/github/fetch-app-json", async (req, res) => {
  const parsed = FetchAppJsonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { repoUrl } = parsed.data;
  const parts = parseGithubUrl(repoUrl);
  if (!parts) {
    res.status(400).json({ error: "Invalid GitHub repository URL" });
    return;
  }

  const rawUrl = `https://raw.githubusercontent.com/${parts.owner}/${parts.repo}/HEAD/app.json`;
  try {
    const response = await fetch(rawUrl);
    if (!response.ok) {
      res.status(400).json({ error: "Could not find app.json in the repository. Make sure the repo is public and has an app.json at the root." });
      return;
    }
    const appJson = await response.json() as Record<string, unknown>;
    res.json(appJson);
  } catch {
    res.status(400).json({ error: "Failed to fetch app.json from the repository" });
  }
});

export default router;
