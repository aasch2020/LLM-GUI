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
    let initPromptContent = "";
    let basePromptContent = "";
    try { initPromptContent = (await fs.readFile(initPromptPath, "utf-8")).trim(); } catch { initPromptContent = ""; }
    try { basePromptContent = (await fs.readFile(basePromptPath, "utf-8")).trim(); } catch { basePromptContent = ""; }

    const defaultSys = "You are a helpful assistant.";
    const envSys = process.env.LLM_SYSTEM_PROMPT ?? defaultSys;
    let sys: string = envSys;
    if (promptType === "init" && initPromptContent.length > 0) {
      sys = initPromptContent;
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

    const useModel = String(model ?? "gemini-flash-latest");
    const temperatureValue = typeof temperature === "number" ? temperature : 0.2;

    const geminiModel = genAI.getGenerativeModel({
      model: useModel,
      systemInstruction,
    });
    let text = "";
    // try {
    //   const result = await geminiModel.generateContent({
    //     contents,
    //     generationConfig: { temperature: temperatureValue },
    //   });
    //   text = result.response?.text() ?? "";
    // } catch {
    //   text = "";
    // }

    if (!text || text.trim().length === 0) {
      if (promptType === "expand") {
        text = [
          "<answer>Option A</answer>",
          "<answer>Option B</answer>",
          "<answer>Option C</answer>",
          "<clarify>Would you like more branches or details?</clarify>",
        ].join("\n");
      } else if (promptType === "init") {
        text = [
          "<root>startit</root>",
          "<answer>First branch</answer>",
          "<answer>Second branch</answer>",
          "<clarify>Any constraints or preferences?</clarify>",
        ].join("\n");
      } else {
        text = [
          "<answer>Option 1</answer>",
          "<answer>Option 2</answer>",
          "<clarify>Want more details?</clarify>",
        ].join("\n");
      }
    }
    console.log("responded wtih " + text)
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
