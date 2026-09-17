/**
 * Provider-agnostic LLM contract. The interview engine talks ONLY to this
 * interface, never to a concrete provider — keeps the engine portable.
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionOptions {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for a strict JSON object response when supported. */
  json?: boolean;
  /** Abort signal so callers can cancel in-flight requests. */
  signal?: AbortSignal;
}

export interface LLMClient {
  /** Non-streaming completion; returns the full text. */
  complete(options: LLMCompletionOptions): Promise<string>;
}

/** Thrown for non-retryable provider errors (auth, bad request, etc.). */
export class LLMClientError extends Error {
  readonly status?: number;
  readonly retryable: boolean;
  constructor(message: string, status?: number, retryable = false) {
    super(message);
    this.name = "LLMClientError";
    this.status = status;
    this.retryable = retryable;
  }
}
