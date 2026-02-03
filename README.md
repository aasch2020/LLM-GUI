## LLM Setup

- Add your API key: copy `.env.example` to `.env` and set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`).
- Install the Gemini SDK:

```bash
npm install @google/generative-ai
```

- API route: see `app/api/llm/route.ts` — it accepts `{ prompt, messages, model, temperature }` and returns `{ text }`.
- Client helper: use `generateText()` from `lib/llm.ts`.

### Quick Example

```ts
import { generateText } from '@/lib/llm';

const { text } = await generateText({
  prompt: 'Suggest three branches for the "Travel" node',
  model: 'gemini-2.0-flash',
});
```

### Notes

- For streaming, wire a `POST /api/llm/stream` route and consume with `streamText()` from `lib/llm.ts`.
- Configure a system prompt via `LLM_SYSTEM_PROMPT` (optional).
# Mind Map UI (Starter)

Interactive choose-your-own-adventure mind map built with Next.js (App Router), React, TypeScript, React Flow, Zustand, and Tailwind CSS.

## Getting Started

### Install dependencies

```bash
npm install
```

If you don't have a `package-lock.json`, run:

```bash
npm init -y
npm install next react react-dom zustand reactflow tailwindcss postcss autoprefixer typescript
```

### Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 to see the app.

## Structure

- app/
  - layout.tsx
  - page.tsx
  - api/expand-node/route.ts
- components/
  - MindMap.tsx
  - MindNode.tsx
- store/
  - mindmapStore.ts
- lib/
  - llm.ts
  - types.ts
- styles/
  - globals.css

## Notes

- API route `POST /api/expand-node` returns mock branches.
- `lib/llm.ts` is a stub to be replaced with real LLM calls later.
- `store/mindmapStore.ts` holds nodes, edges, and `selectedNodeId`.
- `components/MindMap.tsx` initializes a React Flow canvas with placeholder nodes.
