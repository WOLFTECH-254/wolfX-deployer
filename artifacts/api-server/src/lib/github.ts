export interface ParsedRepo {
  owner: string;
  name: string;
  url: string;
}

export function parseGithubRepoUrl(input: string): ParsedRepo | null {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)/i);
  if (!match) return null;
  return { owner: match[1], name: match[2], url: `https://github.com/${match[1]}/${match[2]}` };
}

export interface FetchedAppJson {
  data: Record<string, unknown>;
  branch: "HEAD" | "main" | "master";
}

export class AppJsonFetchError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchAppJsonFromGithub(repo: ParsedRepo): Promise<FetchedAppJson> {
  const branches: Array<"HEAD" | "main" | "master"> = ["HEAD", "main", "master"];
  let lastStatus = 0;
  for (const branch of branches) {
    const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${branch}/app.json`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": "WaBotDeploy" } });
    } catch (e) {
      throw new AppJsonFetchError(502, `Network error fetching ${url}: ${(e as Error).message}`);
    }
    if (res.ok) {
      const text = await res.text();
      try {
        const data = JSON.parse(text) as Record<string, unknown>;
        return { data, branch };
      } catch {
        throw new AppJsonFetchError(
          422,
          `app.json on ${branch} is not valid JSON. Please check the repository.`,
        );
      }
    }
    lastStatus = res.status;
    if (res.status !== 404) {
      throw new AppJsonFetchError(res.status, `GitHub returned ${res.status} fetching app.json`);
    }
  }
  throw new AppJsonFetchError(
    404,
    `app.json not found on HEAD, main, or master branches of ${repo.owner}/${repo.name}. Make sure the repo is public and has app.json at the root. (last status: ${lastStatus})`,
  );
}
