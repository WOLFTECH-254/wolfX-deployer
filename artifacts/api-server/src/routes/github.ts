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

type FetchResult =
  | { ok: true; appJson: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export async function fetchAppJsonFromGithub(owner: string, repo: string): Promise<FetchResult> {
  const branches = ["HEAD", "main", "master"];

  for (const branch of branches) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/app.json`;
    let response: Response;
    try {
      response = await fetch(rawUrl);
    } catch {
      return { ok: false, status: 502, error: `Network error reaching raw.githubusercontent.com for ${owner}/${repo}.` };
    }

    if (response.ok) {
      const text = await response.text();
      try {
        const appJson = JSON.parse(text) as Record<string, unknown>;
        if (typeof appJson !== "object" || appJson === null || Array.isArray(appJson)) {
          return { ok: false, status: 422, error: "The app.json file is not a valid JSON object." };
        }
        return { ok: true, appJson };
      } catch {
        return { ok: false, status: 422, error: "The app.json file exists but contains invalid JSON." };
      }
    }
    if (response.status !== 404) {
      return { ok: false, status: 400, error: `GitHub returned HTTP ${response.status} when fetching app.json.` };
    }
  }

  return {
    ok: false,
    status: 404,
    error: `No app.json found at the root of ${owner}/${repo} on the default, main, or master branch. Make sure the repository is public and contains an app.json file at the root.`,
  };
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
    res.status(400).json({ error: "That doesn't look like a GitHub URL. Use the form https://github.com/owner/repo." });
    return;
  }

  const result = await fetchAppJsonFromGithub(parts.owner, parts.repo);
  if (!result.ok) {
    res.status(result.status === 502 ? 502 : 400).json({ error: result.error });
    return;
  }
  res.json(result.appJson);
});

export default router;
