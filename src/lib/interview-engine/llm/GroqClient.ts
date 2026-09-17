import { withRetry } from "../utils/retry";
import { LLMClient, LLMClientError, LLMCompletionOptions } from "./LLMClient";

export interface GroqClientConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  requestTimeoutMs: number;
  maxRetries: number;
}

/** Groq adapter built on Groq's OpenAI-compatible Chat Completions API. */
export class GroqClient implements LLMClient {
  constructor(private readonly config: GroqClientConfig) {}

  private headers(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new LLMClientError(
        "No Groq API key configured. Set BUSTLER_GROQ_API_KEY.",
        undefined,
        false,
      );
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  private endpoint(): string {
    return `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  }

  private body(options: LLMCompletionOptions) {
    // Deliberately not sending `response_format: { type: "json_object" }`
    // here — verified against the currently-available Groq models that this
    // account can use (the `openai/gpt-oss-*` family) that strict JSON mode
    // fails validation on this API even for trivial prompts, while the same
    // prompts produce clean, parseable JSON in plain `content` when asked to
    // in the prompt text. `parseJsonObject` (utils/json.ts) already handles
    // stripping ```json fences / brace-matching defensively, so relying on
    // prompt-instructed JSON + defensive parsing is both more portable
    // across models and avoids this specific failure mode.
    return JSON.stringify({
      model: options.model ?? this.config.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      stream: false,
      // The openai/gpt-oss-* models available on this account spend a
      // variable, sometimes large, chunk of the token budget on hidden
      // reasoning before writing the actual (JSON) answer — at default
      // effort this occasionally ate enough of max_tokens to truncate the
      // JSON output mid-object. "low" cuts that down drastically (~12
      // reasoning tokens vs ~70+ at default, measured against this account)
      // while leaving answer quality unaffected for these short, structured
      // prompts.
      reasoning_effort: "low",
    });
  }

  /** Combine a caller signal with an internal timeout. */
  private timeoutSignal(signal?: AbortSignal): { signal: AbortSignal; clear: () => void } {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("Request timed out")),
      this.config.requestTimeoutMs,
    );
    if (signal) {
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
  }

  private static isRetryable(error: unknown): boolean {
    if (error instanceof LLMClientError) return error.retryable;
    return true;
  }

  async complete(options: LLMCompletionOptions): Promise<string> {
    return withRetry(
      async () => {
        const { signal, clear } = this.timeoutSignal(options.signal);
        try {
          const res = await fetch(this.endpoint(), {
            method: "POST",
            headers: this.headers(),
            body: this.body(options),
            signal,
          });
          if (!res.ok) {
            const text = await safeText(res);
            throw new LLMClientError(
              `LLM request failed (${res.status}): ${text}`,
              res.status,
              res.status >= 500 || res.status === 429,
            );
          }
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          return data?.choices?.[0]?.message?.content ?? "";
        } finally {
          clear();
        }
      },
      {
        retries: this.config.maxRetries,
        shouldRetry: GroqClient.isRetryable,
      },
    );
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
