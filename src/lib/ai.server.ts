// Groq chat completions for the non-interview AI features (admin question
// generation, assessment feedback). Reuses the interview engine's Groq
// client/config, so all AI features share one key: BUSTLER_GROQ_API_KEY.
// Server-only.
import { createEngineConfig, GroqClient, LLMClientError } from "./interview-engine";
import { parseJsonObject } from "./interview-engine/utils/json";

export function isAiConfigured(): boolean {
  return !!createEngineConfig().apiKey;
}

/**
 * Ask the model for a JSON object and parse it. The JSON shape is requested
 * in the prompt rather than via `response_format` — strict JSON mode fails
 * on Groq's gpt-oss models (see GroqClient.body()).
 */
export async function completeJson<T>(args: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const config = createEngineConfig();
  const client = new GroqClient(config);
  const content = await client.complete({
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    model: config.model,
    maxTokens: args.maxTokens ?? 1024,
    temperature: args.temperature ?? 0.4,
  });
  if (!content.trim()) throw new LLMClientError("The AI returned an empty response.");
  return parseJsonObject<T>(content);
}

export { LLMClientError };
