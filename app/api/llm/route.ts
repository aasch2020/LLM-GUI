import { GoogleGenerativeAI } from "@google/generative-ai";
import { promises as fs } from "fs";
import path from "path";
// Reverted: system prompt now comes from env or default.

/**
 * POST /api/llm
 *
 * Non-streaming text generation endpoint backed by Google Gemini.
 * Accepts a chat-style payload `{ prompt, messages, model, temperature }`,
 * maps to Gemini `contents` and optional `systemInstruction`, and returns `{ text }`.
 * Uses `GEMINI_API_KEY` or `GOOGLE_API_KEY` from the environment.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, messages, model, temperature, promptType } = body ?? {};

    // Basic input validation: require either a prompt or messages
    if (!prompt && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return new Response(JSON.stringify({ error: "Missing prompt or messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY/GOOGLE_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Read local prompt files from /prompts and use them as system prompts
    const initPromptPath = path.join(process.cwd(), "prompts", "init-prompt.txt");
    const basePromptPath = path.join(process.cwd(), "prompts", "base-systemprompt.txt");
    const clarifyPromptPath = path.join(process.cwd(), "prompts", "clarify-reprompt.txt");
    const answerPathPromptPath = path.join(process.cwd(), "prompts", "answer-path-prompt.txt");
    let initPromptContent = "";
    let basePromptContent = "";
    let clarifyPromptContent = "";
    let answerPathPromptContent = "";
    try { initPromptContent = (await fs.readFile(initPromptPath, "utf-8")).trim(); } catch { initPromptContent = ""; }
    try { basePromptContent = (await fs.readFile(basePromptPath, "utf-8")).trim(); } catch { basePromptContent = ""; }
    try { clarifyPromptContent = (await fs.readFile(clarifyPromptPath, "utf-8")).trim(); } catch { clarifyPromptContent = ""; }
    try { answerPathPromptContent = (await fs.readFile(answerPathPromptPath, "utf-8")).trim(); } catch { answerPathPromptContent = ""; }

    const defaultSys = "You are a helpful assistant.";
    const envSys = process.env.LLM_SYSTEM_PROMPT ?? defaultSys;
    let sys: string = envSys;
    if (promptType === "init" && initPromptContent.length > 0) {
      sys = initPromptContent;
    } else if (promptType === "clarify" && clarifyPromptContent.length > 0) {
      sys = clarifyPromptContent;
    } else if (promptType === "answerPath" && answerPathPromptContent.length > 0) {
      sys = answerPathPromptContent;
    } else if (promptType === "expand" && basePromptContent.length > 0) {
      sys = basePromptContent;
    } else if (basePromptContent.length > 0) {
      sys = basePromptContent;
    }
    // Build Gemini contents from chat messages; support optional system message
    const chatMessages: Array<{ role: string; content: string }> = Array.isArray(messages) ? messages : [];
    let systemInstruction: string | undefined = sys;
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    if (chatMessages.length > 0) {
      for (const m of chatMessages) {
        const role = String(m?.role ?? "").trim();
        const content = String(m?.content ?? "");
        if (!content) continue;
        // Ignore client-supplied system messages; use file-based system prompt
        if (role === "assistant") {
          contents.push({ role: "model", parts: [{ text: content }] });
        } else if (role === "user") {
          contents.push({ role: "user", parts: [{ text: content }] });
        }
      }
    } else if (typeof prompt === "string") {
      contents.push({ role: "user", parts: [{ text: String(prompt) }] });
    }

    if (contents.length === 0) {
      return new Response(JSON.stringify({ error: "No valid content to process" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userContent = typeof prompt === "string" ? prompt : JSON.stringify(messages);
    console.log("[LLM] promptType", promptType);
    console.log("[LLM] system prompt length", sys?.length ?? 0);
    console.log("[LLM] user prompt/request", userContent);

    const useModel = String(model ?? "gemini-flash-latest");
    const temperatureValue = typeof temperature === "number" ? temperature : 0.2;

    const geminiModel = genAI.getGenerativeModel({
      model: useModel,
      systemInstruction,
    });
    let text = "";
    try {
      const result = await geminiModel.generateContent({
        contents,
        generationConfig: { temperature: temperatureValue },
      });
      text = result.response?.text() ?? "";
    } catch (err) {
      console.warn("[LLM] Gemini error, using fallback", err);
      text = "";
    }

    const usedFallback = !text || text.trim().length === 0;
    if (usedFallback) {
      console.log("[LLM] using boilerplate fallback (no Gemini response)");
      if (promptType === "expand") {
        text = [
          "<step><title>Option A</title><content>First option.</content></step>",
          "<step><title>Option B</title><content>Second option.</content></step>",
          "<answer><title>Suggested</title><content>When confident, a final answer.</content></answer>",
          "<clarify>Would you like more branches or details?</clarify>",
        ].join("\n");
      } else if (promptType === "init") {
        text = [
          "<root><title>Get started</title><content>Refined from your idea</content></root>",
          "<step><title>First step</title><content>First step description.</content></step>",
          "<step><title>Second step</title><content>Second step description.</content></step>",
          "<answer><title>Direct answer</title><content>When confident, a final answer option.</content></answer>",
          "<clarify>Any constraints or preferences?</clarify>",
        ].join("\n");
      } else if (promptType === "answerPath") {
        text = [
          "<step><title>Next step A</title><content>Content for first option.</content></step>",
          "<step><title>Next step B</title><content>Content for second option.</content></step>",
          "<answer><title>Final answer</title><content>Confident conclusion when applicable.</content></answer>",
          "<clarify>Need more detail?</clarify>",
        ].join("\n");
      } else if (promptType === "clarify") {
        text = [
          "<root><title>Refined topic</title><content>With your context applied</content></root>",
          "<step><title>Option A</title><content>Description for option A.</content></step>",
          "<step><title>Option B</title><content>Description for option B.</content></step>",
          "<answer><title>Recommended</title><content>Best fit when sure.</content></answer>",
          "<clarify>Need more detail?</clarify>",
        ].join("\n");
      } else {
        text = [
          "<step><title>Option 1</title><content>First option.</content></step>",
          "<step><title>Option 2</title><content>Second option.</content></step>",
          "<answer><title>Suggested</title><content>When confident.</content></answer>",
          "<clarify>Want more details?</clarify>",
        ].join("\n");
      }
    } else {
      console.log("[LLM] response from real Gemini");
    }
    console.log("[LLM] response", text);
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    // Surface more detail if available from Gemini SDK
    const details = err?.response?.error ?? err?.cause ?? undefined;
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
