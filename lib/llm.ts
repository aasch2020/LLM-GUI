/**
 * LLM Client Usage (Gemini)
 *
 * Setup:
 * - Create .env from .env.example
 * - Set GEMINI_API_KEY (or GOOGLE_API_KEY)
 *
 * API:
 * - POST /api/llm accepts { prompt, messages, model, temperature }
 * - Returns { text } from the Gemini model
 * - Default model: 'gemini-2.0-flash'
 *
 * Messages format:
 * - [{ role: 'system' | 'user' | 'assistant', content: string }]
 * - 'system' (optional) becomes Gemini systemInstruction
 *
 * Example:
 *   const { text } = await generateText({
 *     prompt: 'Suggest three branches for the "Travel" node',
 *     model: 'gemini-2.0-flash',
 *     temperature: 0.2,
 *   });
 *
 * Streaming:
 * - streamText() will work when /api/llm/stream is implemented
 */
export type LlmRequest = {
  prompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
};

/**
 * generateText
 *
 * Sends a non-streaming text generation request to the `/api/llm` endpoint.
 * The server maps OpenAI-style `messages` (including optional `system`) to
 * Gemini's request, applies the chosen `model` and `temperature`, and returns
 * a single `{ text }` string response.
 *
 * How it works:
 * - Performs a `POST` to `/api/llm` with the provided `LlmRequest` payload.
 * - Expects a JSON response containing `{ text: string }`.
 * - Throws an error if the HTTP status is not OK.
 *
 * Typical usage:
 *   await generateText({ prompt: 'Hello', model: 'gemini-2.0-flash' })
 *
 * @param req Request body including `prompt` or `messages`, optional `model` and `temperature`.
 * @returns A promise resolving to `{ text: string }` with the generated content.
 */
export async function generateText(req: LlmRequest): Promise<{ text: string }> {
  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`LLM error: ${res.status}`);
  }
  return res.json();
}

/**
 * streamText
 *
 * Streams generated text chunks from the `/api/llm/stream` endpoint.
 * This function reads the response body as it arrives and calls `onChunk`
 * for each decoded chunk. It completes when the stream ends.
 *
 * How it works:
 * - Performs a `POST` to `/api/llm/stream` with the provided `LlmRequest` payload.
 * - Uses the Fetch API ReadableStream reader to read incremental chunks.
 * - Decodes bytes to text and invokes `onChunk(text)` for each piece.
 * - Resolves when the stream signals `done`.
 *
 * Note: Ensure a streaming server route exists; otherwise this will error.
 *
 * @param req Request body including `prompt` or `messages`, optional `model` and `temperature`.
 * @param onChunk Callback invoked with each streamed text chunk.
 * @returns A promise that resolves when the stream completes.
 */
export async function streamText(
  req: LlmRequest,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/llm/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`LLM stream error: ${res.status}`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    onChunk(text);
  }
}

/**
 * Default export
 *
 * Convenience bundle for importing both helpers:
 *   import llm from '@/lib/llm';
 *   await llm.generateText(...);
 *   await llm.streamText(...);
 */
export default { generateText, streamText };
