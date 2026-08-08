import { createHash } from "node:crypto";

export type DeployProvider = "netlify" | "vercel";

export interface DeployConfig {
  provider: DeployProvider;
  token: string;
  siteName?: string;
}

export interface DeployResult {
  provider: DeployProvider;
  url: string;
  deployId: string;
  siteId: string;
}

export interface DeployInput {
  files: Record<string, string | Buffer | Uint8Array>;
  configPath?: string;
  /** Deploy as a draft/preview (Netlify draft deploy) instead of publishing to production */
  draft?: boolean;
}

const NETLIFY_API = "https://api.netlify.com/api/v1";

export class DeployClient {
  private readonly config: DeployConfig;

  constructor(config: DeployConfig) {
    this.config = config;
  }

  async deploy(input: DeployInput): Promise<DeployResult> {
    if (this.config.provider === "netlify") return this.deployNetlify(input);
    return this.deployVercel(input);
  }

  private async deployNetlify(input: DeployInput): Promise<DeployResult> {
    const siteId = await this.findOrCreateNetlifySite();

    // Step 1: create the deploy with a files map of path -> SHA1 digest
    const filesMap: Record<string, string> = {};
    const shaToPath = new Map<string, { path: string; content: string | Buffer | Uint8Array }>();
    for (const [path, content] of Object.entries(input.files)) {
      const raw = typeof content === "string" ? content : Buffer.from(content);
      const sha = createHash("sha1").update(raw as any).digest("hex");
      filesMap[path] = sha;
      shaToPath.set(sha, { path, content: raw });
    }

    const endpoint = `${NETLIFY_API}/sites/${siteId}/deploys`;

    const createRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: filesMap, ...(input.draft ? { draft: true } : {}) }),
    });

    if (!createRes.ok) {
      const err = await createRes.text().catch(() => "");
      throw new Error(`Netlify deploy create failed (${createRes.status}): ${err}`);
    }

    const deploy = (await createRes.json()) as {
      id: string;
      required?: string[];
      error_message?: string;
    };

    if (deploy.error_message) {
      throw new Error(`Netlify deploy error: ${deploy.error_message}`);
    }

    // Step 2: upload each required file's raw content keyed by its SHA1
    const requiredShas = deploy.required ?? [];
    for (const sha of requiredShas) {
      const entry = shaToPath.get(sha);
      if (!entry) continue;
      const uploadRes = await fetch(`${NETLIFY_API}/deploys/${deploy.id}/files/${sha}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/octet-stream",
        },
        body: entry.content as unknown as string,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.text().catch(() => "");
        throw new Error(`Netlify file upload failed for ${entry.path} (${uploadRes.status}): ${err}`);
      }
    }

    // Step 3: wait for the deploy to finish processing
    const url = await this.waitForNetlifyDeploy(deploy.id, input.draft);

    return {
      provider: "netlify",
      url,
      deployId: deploy.id,
      siteId,
    };
  }

  private async waitForNetlifyDeploy(deployId: string, isDraft = false, timeoutMs = 120_000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(`${NETLIFY_API}/deploys/${deployId}`, {
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          state: string;
          url: string;
          ssl_url?: string;
          deploy_ssl_url?: string;
          error_message?: string;
        };
        if (data.state === "ready" || data.state === "published") {
          // Draft deploys have a unique deploy_ssl_url (preview); production uses ssl_url
          if (isDraft) return data.deploy_ssl_url ?? data.url;
          return data.ssl_url ?? data.url;
        }
        if (data.state === "error") {
          throw new Error(`Netlify deploy failed: ${data.error_message ?? "unknown error"}`);
        }
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error(`Netlify deploy timed out after ${timeoutMs}ms`);
  }

  private async findOrCreateNetlifySite(): Promise<string> {
    if (this.config.siteName) {
      const existing = await fetch(
        `${NETLIFY_API}/sites?filter=all&per_page=100`,
        { headers: { Authorization: `Bearer ${this.config.token}` } }
      ).then((r) => r.json() as Promise<{ id: string; name?: string }[]>);

      const match = existing.find((s) => s.name === this.config.siteName);
      if (match) return match.id;
    }

    const createRes = await fetch(`${NETLIFY_API}/sites`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: this.config.siteName ?? `demo-${Date.now().toString(36)}`,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text().catch(() => "");
      throw new Error(`Netlify site create failed (${createRes.status}): ${err}`);
    }

    const data = (await createRes.json()) as { id: string };
    return data.id;
  }

  private async deployVercel(input: DeployInput): Promise<DeployResult> {
    const files: Record<string, { data: string }> = {};
    for (const [path, content] of Object.entries(input.files)) {
      const raw = typeof content === "string" ? content : Buffer.from(content).toString("base64");
      files[path] = { data: raw };
    }

    const res = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: this.config.siteName ?? `demo-${Date.now().toString(36)}`,
        files,
        projectSettings: {
          framework: null,
        },
        target: "production",
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Vercel deploy failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      id: string;
      url: string;
    };

    return {
      provider: "vercel",
      url: `https://${data.url}`,
      deployId: data.id,
      siteId: data.id,
    };
  }
}
