export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  jsonMode?: boolean;
  onToken?: (token: string) => void;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
}

export interface CompletionResult {
  content: string;
  usage: Usage;
  model: string;
  finishReason: string;
}

const PRICING = {
  "deepseek-chat": { input: 0.14, output: 0.28 },
} as const;

export class DeepSeekClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  totalTokensUsed: number = 0;
  totalCostUSD: number = 0;

  constructor(config: DeepSeekConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.deepseek.com/v1").replace(/\/$/, "");
    this.model = config.model ?? "deepseek-chat";
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async complete(messages: DeepSeekMessage[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const body = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      top_p: options.topP ?? 1,
      stream: false,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    };

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after") ?? 2) * 1000;
          lastError = new Error(`Rate limited (429). Retrying in ${retryAfter}ms`);
          await new Promise((r) => setTimeout(r, retryAfter));
          continue;
        }

        if (res.status === 401) {
          throw new Error("DeepSeek API: invalid API key (401)");
        }

        if (res.status === 402) {
          throw new Error("DeepSeek API: insufficient balance (402)");
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`DeepSeek API error ${res.status}: ${errText}`);
        }

        const data = (await res.json()) as {
          id: string;
          object: string;
          created: number;
          model: string;
          choices: {
            index: number;
            message: { role: string; content: string };
            finish_reason: string;
          }[];
          usage: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
            prompt_cache_hit_tokens?: number;
          };
        };

        this.totalTokensUsed += data.usage.total_tokens;
        const pricing = PRICING[this.model as keyof typeof PRICING] ?? PRICING["deepseek-chat"];
        this.totalCostUSD +=
          (data.usage.prompt_tokens * pricing.input + data.usage.completion_tokens * pricing.output) / 1_000_000;

        return {
          content: data.choices[0]?.message?.content ?? "",
          usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
            cachedTokens: data.usage.prompt_cache_hit_tokens ?? 0,
          },
          model: data.model,
          finishReason: data.choices[0]?.finish_reason ?? "stop",
        };
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        if (isAbort) {
          throw new Error(`DeepSeek API: request timed out after ${this.timeoutMs}ms`);
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        const retryable = lastError.message.includes("429") || lastError.message.includes("5") || lastError.message.includes("timed out");
        if (!retryable || attempt === this.maxRetries) {
          break;
        }
      }
    }

    throw lastError ?? new Error("DeepSeek API: unknown error");
  }

  async completeJSON<T = Record<string, unknown>>(messages: DeepSeekMessage[], schema?: { parse: (data: unknown) => T }, options: CompletionOptions = {}): Promise<T> {
    const result = await this.complete(messages, { ...options, jsonMode: true });
    const cleaned = result.content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (schema) return schema.parse(parsed);
    return parsed as T;
  }

  getStats() {
    return {
      totalTokens: this.totalTokensUsed,
      totalCostUSD: this.totalCostUSD,
      remainingBalanceUSD: 10 - this.totalCostUSD,
    };
  }
}
