import type { NodeContext, Branch } from './types';
import { useLlmSettingsStore } from '../store/llmSettingsStore';

/** Default from env. Override at runtime via toggle (useLlmSettingsStore). */
export const USE_MOCK_LLM_DEFAULT = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_USE_MOCK_LLM === 'true';

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
  promptType?: 'init' | 'expand' | 'clarify' | 'answerPath';
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
function getMockResponse(promptType?: string): string {
  switch (promptType) {
    case 'init':
      return [
        '<root><title>Get started</title><content>Refined from your idea</content></root>',
        '<step><title>First step</title><content>Initial step description.</content></step>',
        '<step><title>Second step</title><content>Second step description.</content></step>',
        '<step><title>Third step</title><content>Third step description.</content></step>',
        '<answer><title>Direct answer</title><content>When confident, a final answer option.</content></answer>',
        '<clarify>Any constraints or preferences?</clarify>',
        '<clarify>What’s your timeline?</clarify>',
      ].join('\n');
    case 'clarify':
      return [
        '<root><title>Refined topic</title><content>With your context applied</content></root>',
        '<step><title>Option A</title><content>Description for option A.</content></step>',
        '<step><title>Option B</title><content>Description for option B.</content></step>',
        '<answer><title>Recommended</title><content>Best fit when sure.</content></answer>',
        '<clarify>Need more detail?</clarify>',
      ].join('\n');
    case 'answerPath':
      return [
        '<step><title>Next step A</title><content>Content for first option.</content></step>',
        '<step><title>Next step B</title><content>Content for second option.</content></step>',
        '<answer><title>Final answer</title><content>Confident conclusion when applicable.</content></answer>',
        '<clarify>Need more detail?</clarify>',
      ].join('\n');
    case 'expand':
    default:
      return [
        '<step><title>Branch A</title><content>Option A.</content></step>',
        '<step><title>Branch B</title><content>Option B.</content></step>',
        '<answer><title>Suggested answer</title><content>When confident.</content></answer>',
        '<clarify>Would you like more branches or details?</clarify>',
      ].join('\n');
  }
}

function getUseMockLlm(): boolean {
  try {
    return useLlmSettingsStore.getState().useMockLlm ?? USE_MOCK_LLM_DEFAULT;
  } catch {
    return USE_MOCK_LLM_DEFAULT;
  }
}

export async function generateText(req: LlmRequest): Promise<{ text: string }> {
  const payload = { prompt: req.prompt, messages: req.messages, promptType: req.promptType };
  const useMock = getUseMockLlm();
  console.log('[LLM] mode:', useMock ? 'MOCK' : 'REAL API');
  console.log('[LLM] prompt/request', payload);

  if (useMock) {
    const text = getMockResponse(req.promptType);
    console.log('[LLM] response (mock)', text);
    return Promise.resolve({ text });
  }
  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`LLM error: ${res.status}`);
  }
  const data = await res.json();
  console.log('[LLM] response', data?.text ?? data);
  return data;
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
export type InitializeResult = { title: string; content?: string; clarifies: Branch[]; branches: Branch[]; answers: Branch[] };
export async function initializeNodeWithGemini(ctx: NodeContext): Promise<InitializeResult> {
  const prompt = `Node Context: ${ctx.context ?? 'None provided'}.`;
  const { text } = await generateText({
    prompt,
    model: 'gemini-flash-latest',
    temperature: 0.2,
    promptType: 'init',
  });
  const nid = ctx.nodeId || 'node';
  let branches = parseStepsFromText(text, nid);
  let answers = parseFinalAnswersFromText(text, nid);
  if (branches.length === 0 && answers.length > 0) {
    branches = parseBranchesFromText(text, nid);
    answers = [];
  }
  const clarifies = parseClarifiesFromText(text, nid);
  const rootParsed = parseClarifyRootFromText(text);
  const fallbackTitle = parseRootFromText(text) || branches[0]?.label || answers[0]?.label || (text || '').split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || 'New Node';
  const title = rootParsed.title || fallbackTitle;
  const content = rootParsed.content;
  return { title, content, clarifies, branches, answers };
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
export type ExpandResult = { branches: Branch[]; answers: Branch[]; clarifies: Branch[] };

export type AnswerPathContext = {
  rootTitle: string;
  rootContent?: string;
  clarifiers: Array<{ question: string; answer?: string }>;
  chosenPath: string;
  userInput: string;
  nodeId: string;
};

/**
 * Expand an answer path: prompt with root, clarifiers, chosen path, and user input;
 * return next-step branches and optional clarifies.
 */
export async function expandAnswerPathWithGemini(ctx: AnswerPathContext): Promise<ExpandResult> {
  const { rootTitle, rootContent, clarifiers, chosenPath, userInput, nodeId } = ctx;
  const clarifierLines = clarifiers.length
    ? clarifiers.map((c) => (c.answer != null ? `Clarifier: ${c.question} → User answer: ${c.answer}` : `Clarifier: ${c.question}`)).join('\n')
    : '(none)';
  const prompt = [
    `Root title: ${rootTitle}`,
    rootContent ? `Root content: ${rootContent}` : '',
    `Clarifiers:\n${clarifierLines}`,
    `Chosen answer path: ${chosenPath}`,
    `User submitted input: ${userInput}`,
  ]
    .filter(Boolean)
    .join('\n');

  const { text } = await generateText({
    prompt,
    model: 'gemini-flash-latest',
    temperature: 0.2,
    promptType: 'answerPath',
  });

  const nid = nodeId || 'node';
  let branches = parseStepsFromText(text, nid);
  let answers = parseFinalAnswersFromText(text, nid);
  if (branches.length === 0 && answers.length > 0) {
    branches = parseBranchesFromText(text, nid);
    answers = [];
  }
  const clarifies = parseClarifiesFromText(text, nid);
  return { branches, answers, clarifies };
}

export async function expandNodeWithGemini(ctx: NodeContext): Promise<ExpandResult> {
  const prompt = [
    `Node Context: ${ctx.context ?? 'None provided'}.`
  ].join('\n');
  const { text } = await generateText({
    prompt,
    model: 'gemini-flash-latest',
    temperature: 0.2,
    promptType: 'expand',
  });
  const nid = ctx.nodeId || 'node';
  let branches = parseStepsFromText(text, nid);
  let answers = parseFinalAnswersFromText(text, nid);
  if (branches.length === 0 && answers.length > 0) {
    branches = parseBranchesFromText(text, nid);
    answers = [];
  }
  const clarifies = parseClarifiesFromText(text, nid);
  return { branches, answers, clarifies };
}

/** Parse <step><title>...</title><content>...</content></step> into Branch[] (next-step options). */
function parseStepsFromText(text: string, nid: string): Branch[] {
  return parseTagBranches(text, nid, 'step', `${nid}-step`);
}

/** Parse <answer><title>...</title><content>...</content></answer> into Branch[] (final-answer options). */
function parseFinalAnswersFromText(text: string, nid: string): Branch[] {
  return parseTagBranches(text, nid, 'answer', `${nid}-ans`);
}

function parseTagBranches(text: string, nid: string, tag: string, idPrefix: string): Branch[] {
  const results: { label: string; content?: string }[] = [];
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1]?.trim() ?? '';
    if (!raw) continue;
    const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(raw);
    const contentMatch = /<content>([\s\S]*?)<\/content>/i.exec(raw);
    const subtitleMatch = /<subtitle>([\s\S]*?)<\/subtitle>/i.exec(raw);
    const label = (titleMatch?.[1]?.trim() ?? raw.replace(/<[^>]+>/g, '').trim()) || raw;
    const content = contentMatch?.[1]?.trim() ?? subtitleMatch?.[1]?.trim();
    results.push({ label, content });
  }
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.label)) return false;
    seen.add(r.label);
    return true;
  }).slice(0, 6);
  return unique.map((r, i) => ({ id: `${idPrefix}-${i + 1}`, label: r.label, content: r.content }));
}

/** Legacy: parse <answer> as branches (steps) for backward compatibility when <step> is absent. */
function parseBranchesFromText(text: string, nid: string): Branch[] {
  const fromStep = parseStepsFromText(text, nid);
  if (fromStep.length > 0) return fromStep;
  return parseTagBranches(text, nid, 'answer', `${nid}-gen`);
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

/** Parse <root><title>...</title><content>...</content></root> or plain <root>...</root> */
function parseClarifyRootFromText(text: string): { title: string; content?: string } {
  const rootRegex = /<root>([\s\S]*?)<\/root>/i;
  const m = rootRegex.exec(text);
  const raw = m?.[1]?.trim() ?? '';
  if (!raw) return { title: '' };
  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(raw);
  const contentMatch = /<content>([\s\S]*?)<\/content>/i.exec(raw);
  const subtitleMatch = /<subtitle>([\s\S]*?)<\/subtitle>/i.exec(raw);
  const title = (titleMatch?.[1]?.trim() ?? raw.replace(/<[^>]+>/g, '').trim()) || 'Root';
  const content = contentMatch?.[1]?.trim() ?? subtitleMatch?.[1]?.trim();
  return { title, content };
}

export type ClarifyRepromptResult = {
  title: string;
  content?: string;
  branches: Branch[];
  answers: Branch[];
  clarifies: Branch[];
};

/**
 * Reprompt the root with user clarification: call clarify prompt, then parse
 * updated root (title/content) and new child branches + clarify nodes.
 */
export async function repromptRootWithClarify(params: {
  rootTitle: string;
  rootContent?: string;
  clarifyingQuestion?: string;
  userAnswer: string;
}): Promise<ClarifyRepromptResult> {
  const { rootTitle, rootContent, clarifyingQuestion, userAnswer } = params;
  const prompt = [
    `Original root title: ${rootTitle}`,
    rootContent ? `Original root content: ${rootContent}` : '',
    clarifyingQuestion ? `Clarifying question: ${clarifyingQuestion}` : 'User provided additional context (no specific question).',
    `User's answer: ${userAnswer}`,
  ]
    .filter(Boolean)
    .join('\n');

  const { text } = await generateText({
    prompt,
    model: 'gemini-flash-latest',
    temperature: 0.2,
    promptType: 'clarify',
  });

  const rootParsed = parseClarifyRootFromText(text);
  const nid = 'root';
  let branches = parseStepsFromText(text, nid);
  let answers = parseFinalAnswersFromText(text, nid);
  if (branches.length === 0 && answers.length > 0) {
    branches = parseBranchesFromText(text, nid);
    answers = [];
  }
  const clarifies = parseClarifiesFromText(text, nid);
  return {
    title: rootParsed.title || rootTitle,
    content: rootParsed.content ?? rootContent,
    branches,
    answers,
    clarifies,
  };
}
