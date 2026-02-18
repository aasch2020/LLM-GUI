## LLM Setup

- Add your API key: in `.env` and set `GEMINI_API_KEY=<yourkey>` (or `GOOGLE_API_KEY`).

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
