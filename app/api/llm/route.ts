import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * POST /api/llm
 *
 * Non-streaming text generation endpoint backed by Google Gemini.
 * Accepts an OpenAI-style payload `{ prompt, messages, model, temperature }`,
 * maps to Gemini `contents` and optional `systemInstruction`, and returns `{ text }`.
 * Uses `GEMINI_API_KEY` or `GOOGLE_API_KEY` from the environment.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, messages, model, temperature } = body ?? {};

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY/GOOGLE_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const sys = process.env.LLM_SYSTEM_PROMPT ?? "You are a helpful assistant.";
    // Map OpenAI-style messages to Gemini contents; use systemInstruction when present
    const oaiMessages: Array<{ role: string; content: string }> = messages ?? [];
    let systemInstruction: string | undefined = sys;
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    if (oaiMessages.length === 0) {
      // Fallback to prompt-only interaction
      contents.push({ role: "user", parts: [{ text: String(prompt ?? "") }] });
    } else {
      for (const m of oaiMessages) {
        if (m.role === "system") {
          systemInstruction = m.content ?? systemInstruction;
          continue;
        }
        const role = m.role === "assistant" ? "model" : "user";
        contents.push({ role, parts: [{ text: String(m.content ?? "") }] });
      }
    }

    const useModel = String(model ?? "gemini-2.0-flash");
    const temperatureValue = typeof temperature === "number" ? temperature : 0.2;

    const geminiModel = genAI.getGenerativeModel({
      model: useModel,
      systemInstruction,
    });

    const result = await geminiModel.generateContent({
      contents,
      generationConfig: { temperature: temperatureValue },
    });

    const text = result.response?.text() ?? "";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
