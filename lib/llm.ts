import type { NodeContext, Branch } from './types';
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
 * - Default model: 'gemini-flash-latest'
 *
 * Messages format:
 * - [{ role: 'system' | 'user' | 'assistant', content: string }]
 * - 'system' (optional) becomes Gemini systemInstruction
 *
 * Example:
 *   const { text } = await generateText({
 *     prompt: 'Suggest three branches for the "Travel" node',
 *     model: 'gemini-flash-latest',
 *     temperature: 0.2,
 *   });
 *
 * Streaming:
 * - streamText() will work when /api/llm/stream is implemented
 *
 * System Prompt:
 * - Controlled via `LLM_SYSTEM_PROMPT` (env) or uses a safe default.
 */
export type LlmRequest = {
  prompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  promptType?: 'init' | 'expand';
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

/**
 * initializeNodeWithGemini
 *
 * Generates a concise title for a node from its context using Gemini.
 * Returns a short phrase suitable as the node's label/title.
 */
export type InitializeResult = { title: string; clarifies: Branch[]; branches: Branch[] };
export async function initializeNodeWithGemini(ctx: NodeContext): Promise<InitializeResult> {
  const prompt = `Node Context: ${ctx.context ?? 'None provided'}.`;
  const { text } = await generateText({
    prompt,
    model: 'gemini-flash-latest',
    temperature: 0.2,
    promptType: 'init',
  });
  const nid = ctx.nodeId || 'node';
  const branches = parseBranchesFromText(text, nid);
  const clarifies = parseClarifiesFromText(text, nid);
  const rootTitle = parseRootFromText(text);
  const title = rootTitle || branches[0]?.label || (text || '').split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || 'New Node';
  return { title, clarifies, branches };
}

/**
 * expandNode
 *
 * Stubbed helper to expand a node into suggested branches.
 * Uses the provided context to generate simple placeholder labels.
 */
export async function expandNode(ctx: NodeContext): Promise<Branch[]> {
  const base = (ctx.context ?? 'Idea').trim() || 'Idea';
  const nid = ctx.nodeId || 'node';
  return [
    { id: `${nid}-opt-a`, label: `${base} — Option A` },
    { id: `${nid}-opt-b`, label: `${base} — Option B` },
    { id: `${nid}-opt-c`, label: `${base} — Option C` },
  ];
}

/**
 * expandNodeWithGemini (demo)
 *
 * Calls the `/api/llm` Gemini-backed endpoint to generate branch labels
 * and parses the response into `Branch[]`.
 *
 * Example usage:
 *   const branches = await expandNodeWithGemini({ nodeId: 'root', context: 'Travel planning' });
 */
export type ExpandResult = { branches: Branch[]; clarifies: Branch[] };
export async function expandNodeWithGemini(ctx: NodeContext): Promise<ExpandResult> {
  const prompt = [
    `Node Context: ${ctx.context ?? 'None provided'}.`
  ].join('\n');
  console.log("calling expand")
  const { text } = await generateText({
    prompt,
    model: 'gemini-flash-latest',
    temperature: 0.2,
    promptType: 'expand',
  });
 
  const nid = ctx.nodeId || 'node';
  console.log(text, nid)
  const branches = parseBranchesFromText(text, nid);
  const clarifies = parseClarifiesFromText(text, nid);
  return { branches, clarifies };
}

function parseBranchesFromText(text: string, nid: string): Branch[] {
  const labels: string[] = [];
  // Primary: extract <answer>...</answer> elements (XML per base-systemprompt)
  const answerRegex = /<answer>([\s\S]*?)<\/answer>/gi;
  let match: RegExpExecArray | null;
  while ((match = answerRegex.exec(text)) !== null) {
    const raw = match[1]?.trim() ?? '';
    if (raw) labels.push(raw);
  }
  console.log("unique is ", labels)
  const unique = Array.from(new Set(labels)).slice(0, 5);
  return unique.map((label, i) => ({ id: `${nid}-gen-${i + 1}`, label }));
}

function parseClarifiesFromText(text: string, nid: string): Branch[] {
  const labels: string[] = [];
  const clarifyRegex = /<clarify>([\s\S]*?)<\/clarify>/gi;
  let match: RegExpExecArray | null;
  while ((match = clarifyRegex.exec(text)) !== null) {
    const raw = match[1]?.trim() ?? '';
    if (raw) labels.push(raw);
  }
    console.log("unique is ", labels)
  const unique = Array.from(new Set(labels)).slice(0, 4);
  return unique.map((label, i) => ({ id: `${nid}-clar-${i + 1}`, label }));
}

function parseRootFromText(text: string): string | null {
  const rootRegex = /<root>([\s\S]*?)<\/root>/i;
  const m = rootRegex.exec(text);
  const raw = m?.[1]?.trim() ?? '';
  return raw || null;
}
