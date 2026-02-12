// Global sessions + maps store: manages multiple chat sessions,
// each with its own React Flow nodes/edges. Actions keep maps
// independent per chat and limit node dragging to the top handle.
import { create } from 'zustand';
import { initializeNodeWithGemini, expandNodeWithGemini, repromptRootWithClarify, expandAnswerPathWithGemini } from '../lib/llm';
import type { Branch } from '../lib/types';
import type { Node, Edge } from 'reactflow';

// Basic metadata for a chat session
export type Session = {
  id: string;
  title: string;
  createdAt: number;
};

// A mind map consists of nodes and edges for a given session
type MapData = { nodes: Node[]; edges: Edge[] };

interface SessionsState {
  sessions: Session[];
  selectedId: string | null;
  maps: Record<string, MapData>;
  selectedNodeId: string | null;
  promptLoading: boolean;
  createSession: (title?: string) => string;
  selectSession: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  createRoot: (label: string) => void;
  addDemoNode: (label?: string) => void;
  addPreNode: (label?: string) => void;
  addInfoNode: (label?: string) => void;
  expandSelectedNodeWithGemini: () => void;
  repromptRootWithClarify: (userAnswer: string, clarifyingQuestion?: string) => void;
  expandAnswerPath: (nodeId: string, userInput: string) => Promise<void> | void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  updateNodeType: (nodeId: string, nodeType: string) => void;
}

// New sessions start with empty maps
const defaultNodes: Node[] = [];
const defaultEdges: Edge[] = [];

// Layout: spread nodes (branch spacing, vertical offset, info offset)
const LAYOUT = {
  branchOffsetX: -240,
  branchSpacingX: 360,
  branchDy: 280,
  infoOffsetX: 400,
  infoSpacingY: 100,
  infoOffsetY: -50,
} as const;

// Approximate node size for overlap / push-away
const NODE_WIDTH = 320;
const NODE_HEIGHT = 120;
const EXPANSION_PADDING = 48;

/**
 * Shift existing nodes that overlap the expansion region so they sit outside it.
 * Expansion region = bounds of step node + new branch + clarify nodes (with padding).
 * Pushes each overlapping node away from the expansion center along the axis that resolves overlap.
 */
function pushNodesAwayFromExpansion(
  existingNodes: Node[],
  expansionNodes: Node[],
  excludeIds: Set<string>
): Node[] {
  if (expansionNodes.length === 0) return existingNodes;
  const minX = Math.min(...expansionNodes.map((n) => n.position.x)) - EXPANSION_PADDING;
  const maxX = Math.max(...expansionNodes.map((n) => n.position.x)) + NODE_WIDTH + EXPANSION_PADDING;
  const minY = Math.min(...expansionNodes.map((n) => n.position.y)) - EXPANSION_PADDING;
  const maxY = Math.max(...expansionNodes.map((n) => n.position.y)) + NODE_HEIGHT + EXPANSION_PADDING;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return existingNodes.map((n) => {
    if (excludeIds.has(n.id)) return n;
    const nx = n.position.x;
    const ny = n.position.y;
    const nRight = nx + NODE_WIDTH;
    const nBottom = ny + NODE_HEIGHT;
    const overlapLeft = nRight - minX;
    const overlapRight = maxX - nx;
    const overlapTop = nBottom - minY;
    const overlapBottom = maxY - ny;
    const overlapsX = overlapLeft > 0 && overlapRight > 0;
    const overlapsY = overlapTop > 0 && overlapBottom > 0;
    if (!overlapsX && !overlapsY) return n;

    let dx = 0;
    let dy = 0;
    if (overlapsX) {
      const pushLeft = overlapLeft;
      const pushRight = overlapRight;
      dx = nx < cx ? -pushLeft : pushRight;
    }
    if (overlapsY) {
      const pushUp = overlapTop;
      const pushDown = overlapBottom;
      dy = ny < cy ? -pushUp : pushDown;
    }
    return { ...n, position: { x: nx + dx, y: ny + dy } };
  });
}

// Create a new session id + metadata
/**
 * newSession
 * Creates a new `Session` object with a unique id and timestamp.
 */
function newSession(title?: string): Session {
  return { id: `s-${Date.now()}`, title: title ?? 'New Chat', createdAt: Date.now() };
}
export const useSessionsStore = create<SessionsState>((set, get) => {
  const initial = newSession('Session 1');
  return {
    sessions: [initial],
    selectedId: initial.id,
    maps: { [initial.id]: { nodes: defaultNodes, edges: defaultEdges } },
    selectedNodeId: null,
    promptLoading: false,
    /**
     * createSession
     * Creates a new chat session, selects it, and initializes its map.
     * Returns the new session id.
     */
    createSession: (title) => {
      let newId = '';
      set((state) => {
        const s = newSession(title);
        newId = s.id;
        return {
          sessions: [s, ...state.sessions],
          selectedId: s.id,
          maps: { ...state.maps, [s.id]: { nodes: defaultNodes.map(n => ({ ...n })), edges: defaultEdges.map(e => ({ ...e })) } },
          selectedNodeId: null,
        } as SessionsState;
      });
      return newId;
    },
    // Patch a node's data in the selected session map
    /**
     * updateNodeData
     * Shallow merges `patch` into the specified node's `data` for the selected session.
     */
    updateNodeData: (nodeId, patch) => set((state) => {
      console.log("udpatenode stste", nodeId, patch, state);
      const sid = state.selectedId; if (!sid) return state as SessionsState;
      const map = state.maps[sid] ?? { nodes: [], edges: [] };
      const nodes = map.nodes.map((n) => n.id === nodeId ? { ...n, data: { ...(n.data ?? {}), ...patch } } : n);
      return { maps: { ...state.maps, [sid]: { ...map, nodes } } };
    }),
    // Update a node's type for color/style semantics
    /**
     * updateNodeType
     * Sets a semantic `nodeType` on the node's `data` for styling.
     */
    updateNodeType: (nodeId, nodeType) => set((state) => {
      const sid = state.selectedId; if (!sid) return state as SessionsState;
      const map = state.maps[sid] ?? { nodes: [], edges: [] };
      const nodes = map.nodes.map((n) => n.id === nodeId ? { ...n, data: { ...(n.data ?? {}), nodeType } } : n);
      return { maps: { ...state.maps, [sid]: { ...map, nodes } } };
    }),
    // Create or rename the root node for the selected session
    /**
     * createRoot
     * Creates a root node if missing, or renames and marks the existing root.
     * Also selects the root node.
     */
    createRoot: (label) => set((state) => {
      const sid = state.selectedId; if (!sid) return state as SessionsState;
      const map = state.maps[sid] ?? { nodes: [], edges: [] };
      const hasRoot = map.nodes.some((n) => n.id === 'root');
      if (hasRoot) {
        const nodes = map.nodes.map((n) => n.id === 'root' ? { ...n, data: { ...(n.data ?? {}), label, title: label, nodeType: 'root' } } : n);
        return { maps: { ...state.maps, [sid]: { ...map, nodes } }, selectedNodeId: 'root' };
      }
      // Limit node dragging to the top handle via `dragHandle`; mark root type
      const root: Node = { id: 'root', position: { x: 250, y: 120 }, data: { label, title: label, nodeType: 'root' }, type: 'mind', dragHandle: '.drag-handle' };
      // Initialize the root node via Gemini: set title, add branches (post) and clarifies (info)
      setTimeout(() => {
        set({ promptLoading: true });
        initializeNodeWithGemini({ nodeId: 'root', context: label }).then(({ title, content, clarifies, branches, answers = [] }) => {
          set((innerState) => {
            const innerSid = innerState.selectedId; if (!innerSid) return innerState as SessionsState;
            const innerMap = innerState.maps[innerSid] ?? { nodes: [], edges: [] };
            const sourceNode = innerMap.nodes.find((n) => n.id === 'root');
            const nodesUpdated = innerMap.nodes.map((n) => n.id === 'root'
              ? { ...n, data: { ...(n.data ?? {}), label: title, title, ...(content != null ? { content } : {}) } }
              : n);
            const existingIds = new Set(nodesUpdated.map((n) => n.id));
            const sx = sourceNode?.position?.x ?? 250;
            const sy = sourceNode?.position?.y ?? 120;
            // Step nodes below (post links)
            const branchNodes = branches
              .filter((b) => !existingIds.has(b.id))
              .map<Node>((b, idx) => ({
                id: b.id,
                position: {
                  x: sx + LAYOUT.branchOffsetX + idx * LAYOUT.branchSpacingX,
                  y: sy + LAYOUT.branchDy,
                },
                data: { label: b.label, ...((b as any).content != null ? { content: (b as any).content } : {}), nodeType: 'step' },
                type: 'mind',
                dragHandle: '.drag-handle',
              }));
            const stepCount = branchNodes.length;
            const answerNodes = (answers as Branch[]).filter((b) => !existingIds.has(b.id)).map<Node>((b, idx) => ({
              id: b.id,
              position: {
                x: sx + LAYOUT.branchOffsetX + (stepCount + idx) * LAYOUT.branchSpacingX,
                y: sy + LAYOUT.branchDy,
              },
              data: { label: b.label, ...((b as any).content != null ? { content: (b as any).content } : {}), nodeType: 'answer' },
              type: 'mind',
              dragHandle: '.drag-handle',
            }));
            const branchEdges = branchNodes.map<Edge>((n) => ({
              id: `e-root-${n.id}`,
              source: 'root',
              target: n.id,
              data: { linkType: 'post' },
            }));
            const answerEdges = answerNodes.map<Edge>((n) => ({
              id: `e-root-${n.id}`,
              source: 'root',
              target: n.id,
              data: { linkType: 'post' },
            }));
            const infoArr = clarifies.filter((c) => !existingIds.has(c.id));
            const infoMid = Math.ceil(infoArr.length / 2);
            const infoNodes = infoArr.map<Node>((c, idx) => {
              const isLeft = idx < infoMid;
              const sx = sourceNode?.position?.x ?? 250;
              const sy = sourceNode?.position?.y ?? 120;
              const rowIdx = isLeft ? idx : idx - infoMid;
              return {
                id: c.id,
                position: {
                  x: sx + (isLeft ? -LAYOUT.infoOffsetX : LAYOUT.infoOffsetX),
                  y: sy + rowIdx * LAYOUT.infoSpacingY + LAYOUT.infoOffsetY,
                },
                data: { label: c.label, nodeType: 'info' },
                type: 'mind',
                dragHandle: '.drag-handle',
              };
            });
            const infoEdges = infoNodes.map<Edge>((n, i) => ({
              id: `e-root-${n.id}`,
              source: 'root',
              target: n.id,
              data: { linkType: 'info' },
              sourceHandle: i < infoMid ? 'left' : 'rightSource',
              targetHandle: i < infoMid ? 'right' : 'leftTarget',
              type: 'smoothstep',
            }));
            return {
              maps: {
                ...innerState.maps,
                [innerSid]: {
                  nodes: [...nodesUpdated, ...branchNodes, ...answerNodes, ...infoNodes],
                  edges: [...innerMap.edges, ...branchEdges, ...answerEdges, ...infoEdges],
                },
              },
              promptLoading: false,
            };
          });
        }).catch(() => set({ promptLoading: false }));
      }, 0);
      return { maps: { ...state.maps, [sid]: { ...map, nodes: [root] } }, selectedNodeId: 'root' };
    }),
    /**
     * selectSession
     * Sets the active session id and clears node selection.
     */
    selectSession: (id) => set({ selectedId: id, selectedNodeId: null }),
    /**
     * setSelectedNodeId
     * Updates the selected node id within the active session.
     */
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    
    // Replace all nodes for the selected session map
    /**
     * setNodes
     * Replaces all nodes in the active session's map.
     */
    setNodes: (nodes) => set((state) => {
      const sid = state.selectedId; if (!sid) return state as SessionsState;
      const map = state.maps[sid] ?? { nodes: [], edges: [] };
      return { maps: { ...state.maps, [sid]: { ...map, nodes } } };
    }),
    // Replace all edges for the selected session map
    /**
     * setEdges
     * Replaces all edges in the active session's map.
     */
    setEdges: (edges) => set((state) => {
      const sid = state.selectedId; if (!sid) return state as SessionsState;
      const map = state.maps[sid] ?? { nodes: [], edges: [] };
      return { maps: { ...state.maps, [sid]: { ...map, edges } } };
    }),
    // Add a post-linked node below the selection (or root if none)
    /**
     * addDemoNode
     * Adds a new node linked as a 'post' from the selected node (or root).
     * Ensures a root exists for the session.
     */
    addDemoNode: (label = 'Demo Node') =>
      set((state) => {
        const sid = state.selectedId;
        if (!sid) return state as SessionsState;
        const existingMap = state.maps[sid];
        const map = existingMap ?? { nodes: [], edges: [] };
        // Ensure a root exists for this chat
        const hasRoot = map.nodes.some((n) => n.id === 'root');
        const baseNodes = hasRoot ? map.nodes : [{ id: 'root', position: { x: 250, y: 120 }, data: { label: 'Root' }, type: 'mind', dragHandle: '.drag-handle' }, ...map.nodes];
        const baseEdges = map.edges;
        const id = `demo-${Date.now()}`;
        const position = {
          x: 150 + Math.round(Math.random() * 300),
          y: 300 + Math.round(Math.random() * 100),
        };
        const newNode: Node = { id, position, data: { label, nodeType: 'step' }, type: 'mind', dragHandle: '.drag-handle' };
        const sourceId = state.selectedNodeId ?? 'root';
        const newEdge: Edge = { id: `e-${sourceId}-${id}`, source: sourceId, target: id, data: { linkType: 'post' } };
        return {
          maps: {
            ...state.maps,
            [sid]: {
              nodes: [...baseNodes, newNode],
              edges: [...baseEdges, newEdge],
            },
          },
        };
      }),
    // Add a pre-linked node above the selection (or root if none)
    /**
     * addPreNode
     * Adds a new node linked as 'pre' to the selected node (or root).
     */
    addPreNode: (label = 'Pre Node') =>
      set((state) => {
        const sid = state.selectedId;
        if (!sid) return state as SessionsState;
        const map = state.maps[sid] ?? { nodes: [], edges: [] };
        const hasRoot = map.nodes.some((n) => n.id === 'root');
        const baseNodes = hasRoot ? map.nodes : [{ id: 'root', position: { x: 250, y: 120 }, data: { label: 'Root' }, type: 'mind', dragHandle: '.drag-handle' }, ...map.nodes];
        const id = `pre-${Date.now()}`;
        const position = { x: 150 + Math.round(Math.random() * 300), y: 50 + Math.round(Math.random() * 100) };
        const newNode: Node = { id, position, data: { label, nodeType: 'pre' }, type: 'mind', dragHandle: '.drag-handle' };
        const targetId = state.selectedNodeId ?? 'root';
        const newEdge: Edge = { id: `e-${id}-${targetId}`, source: id, target: targetId, data: { linkType: 'pre' } };
        return { maps: { ...state.maps, [sid]: { nodes: [...baseNodes, newNode], edges: [...map.edges, newEdge] } } };
      }),
    // Add a right-positioned side info node linked with a dashed orange edge
    /**
     * addInfoNode
     * Adds a side info node positioned to the right with a dashed orange edge.
     */
    addInfoNode: (label = 'Info Node') =>
      set((state) => {
        const sid = state.selectedId;
        if (!sid) return state as SessionsState;
        const map = state.maps[sid] ?? { nodes: [], edges: [] };
        const hasRoot = map.nodes.some((n) => n.id === 'root');
        const baseNodes = hasRoot ? map.nodes : [{ id: 'root', position: { x: 250, y: 120 }, data: { label: 'Root' }, type: 'mind', dragHandle: '.drag-handle' }, ...map.nodes];
        const id = `info-${Date.now()}`;
        const sourceId = state.selectedNodeId ?? 'root';
        const sourceNode = baseNodes.find((n) => n.id === sourceId);
        const sx = sourceNode?.position?.x ?? 250;
        const sy = sourceNode?.position?.y ?? 100;
        const position = { x: sx + 180, y: sy + (Math.round(Math.random() * 40) - 20) };
        const newNode: Node = { id, position, data: { label, nodeType: 'info' }, type: 'mind', dragHandle: '.drag-handle' };
        const newEdge: Edge = {
          id: `e-${sourceId}-${id}`,
          source: sourceId,
          target: id,
          data: { linkType: 'info' },
          sourceHandle: 'rightSource',
          targetHandle: 'leftTarget',
          type: 'smoothstep',
        };
        return { maps: { ...state.maps, [sid]: { nodes: [...baseNodes, newNode], edges: [...map.edges, newEdge] } } };
      }),
    /**
     * repromptRootWithClarify
     * Sends the root's current title/content and the user's clarification text to the LLM,
     * then updates the root and replaces all child nodes with the new branches and clarifies.
     */
    repromptRootWithClarify: (userAnswer, clarifyingQuestion) => {
      const state = get();
      const sid = state.selectedId;
      if (!sid) return;
      const map = state.maps[sid] ?? { nodes: [], edges: [] };
      const rootNode = map.nodes.find((n) => n.id === 'root');
      if (!rootNode) return;
      const rootTitle = (rootNode.data as any)?.title ?? (rootNode.data as any)?.label ?? 'Root';
      const rootContent = (rootNode.data as any)?.content;
      const rootPosition = rootNode.position ?? { x: 250, y: 120 };

      set({ promptLoading: true });
      repromptRootWithClarify({ rootTitle, rootContent, clarifyingQuestion, userAnswer })
        .then(({ title, content, branches, answers = [], clarifies }) => {
          set((innerState) => {
            const innerSid = innerState.selectedId;
            if (!innerSid) return innerState as SessionsState;
            const innerMap = innerState.maps[innerSid] ?? { nodes: [], edges: [] };
            const updatedRoot: Node = {
              ...rootNode,
              position: rootPosition,
              data: { ...(rootNode.data ?? {}), label: title, title, content, nodeType: 'root' },
            };
            const branchNodes = branches.map<Node>((b, idx) => ({
              id: b.id,
              position: {
                x: rootPosition.x + LAYOUT.branchOffsetX + idx * LAYOUT.branchSpacingX,
                y: rootPosition.y + LAYOUT.branchDy,
              },
              data: { label: b.label, ...((b as any).content != null ? { content: (b as any).content } : {}), nodeType: 'step' },
              type: 'mind',
              dragHandle: '.drag-handle',
            }));
            const stepCount = branchNodes.length;
            const answerNodes = (answers as Branch[]).map<Node>((b, idx) => ({
              id: b.id,
              position: {
                x: rootPosition.x + LAYOUT.branchOffsetX + (stepCount + idx) * LAYOUT.branchSpacingX,
                y: rootPosition.y + LAYOUT.branchDy,
              },
              data: { label: b.label, ...((b as any).content != null ? { content: (b as any).content } : {}), nodeType: 'answer' },
              type: 'mind',
              dragHandle: '.drag-handle',
            }));
            const branchEdges = branchNodes.map<Edge>((n) => ({
              id: `e-root-${n.id}`,
              source: 'root',
              target: n.id,
              data: { linkType: 'post' },
            }));
            const answerEdges = answerNodes.map<Edge>((n) => ({
              id: `e-root-${n.id}`,
              source: 'root',
              target: n.id,
              data: { linkType: 'post' },
            }));
            const infoMid = Math.ceil(clarifies.length / 2);
            const infoNodes = clarifies.map<Node>((c, idx) => {
              const isLeft = idx < infoMid;
              const rowIdx = isLeft ? idx : idx - infoMid;
              return {
                id: c.id,
                position: {
                  x: rootPosition.x + (isLeft ? -LAYOUT.infoOffsetX : LAYOUT.infoOffsetX),
                  y: rootPosition.y + rowIdx * LAYOUT.infoSpacingY + LAYOUT.infoOffsetY,
                },
                data: { label: c.label, nodeType: 'info' },
                type: 'mind',
                dragHandle: '.drag-handle',
              };
            });
            const infoEdges = infoNodes.map<Edge>((n, i) => ({
              id: `e-root-${n.id}`,
              source: 'root',
              target: n.id,
              data: { linkType: 'info' },
              sourceHandle: i < infoMid ? 'left' : 'rightSource',
              targetHandle: i < infoMid ? 'right' : 'leftTarget',
              type: 'smoothstep',
            }));
            return {
              maps: {
                ...innerState.maps,
                [innerSid]: {
                  nodes: [updatedRoot, ...branchNodes, ...answerNodes, ...infoNodes],
                  edges: [...branchEdges, ...answerEdges, ...infoEdges],
                },
              },
              selectedNodeId: 'root',
              promptLoading: false,
            };
          });
        })
        .catch(() => set({ promptLoading: false }));
    },

    /**
     * expandAnswerPath
     * Prompts the LLM with root, clarifiers, the chosen step path, and user input;
     * adds returned branches and clarifies as children of the step node, and saves user input to details.
     */
    expandAnswerPath: (nodeId, userInput) => {
      const state = get();
      const sid = state.selectedId;
      if (!sid) return;
      const map = state.maps[sid] ?? { nodes: [], edges: [] };
      const rootNode = map.nodes.find((n) => n.id === 'root');
      const sourceNode = map.nodes.find((n) => n.id === nodeId);
      if (!rootNode || !sourceNode) return;

      const rootTitle = (rootNode.data as any)?.title ?? (rootNode.data as any)?.label ?? 'Root';
      const rootContent = (rootNode.data as any)?.content;
      const clarifierTargetIds = map.edges
        .filter((e) => e.source === 'root' && (e.data as any)?.linkType === 'info')
        .map((e) => e.target);
      const clarifiers = clarifierTargetIds.map((targetId) => {
        const node = map.nodes.find((n) => n.id === targetId);
        const question = (node?.data as any)?.label ?? (node?.data as any)?.title ?? '';
        const answer = (node?.data as any)?.details ?? (node?.data as any)?.inputValue;
        return { question, answer };
      }).filter((c) => c.question);
      const chosenPath = (sourceNode.data as any)?.label ?? (sourceNode.data as any)?.title ?? 'Step';

      set({ promptLoading: true });
      return expandAnswerPathWithGemini({
        rootTitle,
        rootContent,
        clarifiers,
        chosenPath,
        userInput,
        nodeId,
      })
        .then(({ branches, answers = [], clarifies }) => {
          set((innerState) => {
            const innerSid = innerState.selectedId;
            if (!innerSid) return innerState as SessionsState;
            const innerMap = innerState.maps[innerSid] ?? { nodes: [], edges: [] };
            const existingIds = new Set(innerMap.nodes.map((n) => n.id));
            const source = innerMap.nodes.find((n) => n.id === nodeId);
            const pos = source?.position ?? { x: 250, y: 120 };

            const nodesUpdated = innerMap.nodes.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...(n.data ?? {}), details: userInput, inputValue: '' } }
                : n
            );
            const branchNodes = branches
              .filter((b) => !existingIds.has(b.id))
              .map<Node>((b, idx) => ({
                id: b.id,
                position: {
                  x: pos.x + LAYOUT.branchOffsetX + idx * LAYOUT.branchSpacingX,
                  y: pos.y + LAYOUT.branchDy,
                },
                data: { label: b.label, ...((b as any).content != null ? { content: (b as any).content } : {}), nodeType: 'step' },
                type: 'mind',
                dragHandle: '.drag-handle',
              }));
            const stepCount = branchNodes.length;
            const answerNodes = (answers as Branch[]).filter((b) => !existingIds.has(b.id)).map<Node>((b, idx) => ({
              id: b.id,
              position: {
                x: pos.x + LAYOUT.branchOffsetX + (stepCount + idx) * LAYOUT.branchSpacingX,
                y: pos.y + LAYOUT.branchDy,
              },
              data: { label: b.label, ...((b as any).content != null ? { content: (b as any).content } : {}), nodeType: 'answer' },
              type: 'mind',
              dragHandle: '.drag-handle',
            }));
            const branchEdges = branchNodes.map<Edge>((n) => ({
              id: `e-${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              data: { linkType: 'post' },
            }));
            const answerEdges = answerNodes.map<Edge>((n) => ({
              id: `e-${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              data: { linkType: 'post' },
            }));
            const allNewIds = new Set([...nodesUpdated.map((n) => n.id), ...branchNodes.map((n) => n.id), ...answerNodes.map((n) => n.id)]);
            const clarifyList = clarifies.filter((c) => !allNewIds.has(c.id));
            const clarifyMid = Math.ceil(clarifyList.length / 2);
            const clarifyNodes = clarifyList.map<Node>((c, idx) => {
              const isLeft = idx < clarifyMid;
              const rowIdx = isLeft ? idx : idx - clarifyMid;
              return {
                id: c.id,
                position: {
                  x: pos.x + (isLeft ? -LAYOUT.infoOffsetX : LAYOUT.infoOffsetX),
                  y: pos.y + rowIdx * LAYOUT.infoSpacingY + LAYOUT.infoOffsetY,
                },
                data: { label: c.label, nodeType: 'info' },
                type: 'mind',
                dragHandle: '.drag-handle',
              };
            });
            const clarifyEdges = clarifyNodes.map<Edge>((n, i) => ({
              id: `e-${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              data: { linkType: 'info' },
              sourceHandle: i < clarifyMid ? 'left' : 'rightSource',
              targetHandle: i < clarifyMid ? 'right' : 'leftTarget',
              type: 'smoothstep',
            }));

            const stepNode = nodesUpdated.find((n) => n.id === nodeId)!;
            const expansionNodes: Node[] = [
              { ...stepNode, position: pos },
              ...branchNodes,
              ...answerNodes,
              ...clarifyNodes,
            ];
            const excludeIds = new Set([nodeId]);
            const shiftedExisting = pushNodesAwayFromExpansion(
              nodesUpdated,
              expansionNodes,
              excludeIds
            );

            return {
              maps: {
                ...innerState.maps,
                [innerSid]: {
                  nodes: [...shiftedExisting, ...branchNodes, ...answerNodes, ...clarifyNodes],
                  edges: [...innerMap.edges, ...branchEdges, ...answerEdges, ...clarifyEdges],
                },
              },
              selectedNodeId: nodeId,
              promptLoading: false,
            };
          });
        })
        .catch(() => set({ promptLoading: false })) as Promise<void>;
    },

    // Expand the selected node using LLM; add branches as 'post' and clarifies as 'info' side nodes
    expandSelectedNodeWithGemini: () =>
      set((state) => {
        const sid = state.selectedId;
        if (!sid) return state as SessionsState;
        const map = state.maps[sid] ?? { nodes: [], edges: [] };
        const sourceId = state.selectedNodeId ?? 'root';
        const sourceNode = map.nodes.find((n) => n.id === sourceId);
        const contextLabel = (sourceNode?.data as any)?.label ?? (sourceNode?.data as any)?.title ?? 'Idea';

        set({ promptLoading: true });
        expandNodeWithGemini({ nodeId: sourceId, context: String(contextLabel) }).then(({ branches, answers = [], clarifies }) => {
          set((inner) => {
            const innerSid = inner.selectedId; if (!innerSid) return inner as SessionsState;
            const innerMap = inner.maps[innerSid] ?? { nodes: [], edges: [] };
            const existingIds = new Set(innerMap.nodes.map((n) => n.id));
            const sx = sourceNode?.position?.x ?? 250;
            const sy = sourceNode?.position?.y ?? 120;

            // Step nodes below (post links)
            const branchNodes = branches
              .filter((b) => !existingIds.has(b.id))
              .map<Node>((b, idx) => ({
                id: b.id,
                position: {
                  x: sx + LAYOUT.branchOffsetX + idx * LAYOUT.branchSpacingX,
                  y: sy + LAYOUT.branchDy,
                },
                data: { label: b.label, ...((b as any).content != null ? { content: (b as any).content } : {}), nodeType: 'step' },
                type: 'mind',
                dragHandle: '.drag-handle',
              }));
            const stepCount = branchNodes.length;
            const answerNodes = (answers as Branch[]).filter((b) => !existingIds.has(b.id)).map<Node>((b, idx) => ({
              id: b.id,
              position: {
                x: sx + LAYOUT.branchOffsetX + (stepCount + idx) * LAYOUT.branchSpacingX,
                y: sy + LAYOUT.branchDy,
              },
              data: { label: b.label, ...((b as any).content != null ? { content: (b as any).content } : {}), nodeType: 'answer' },
              type: 'mind',
              dragHandle: '.drag-handle',
            }));
            const branchEdges = branchNodes.map<Edge>((n) => ({
              id: `e-${sourceId}-${n.id}`,
              source: sourceId,
              target: n.id,
              data: { linkType: 'post' },
            }));
            const answerEdges = answerNodes.map<Edge>((n) => ({
              id: `e-${sourceId}-${n.id}`,
              source: sourceId,
              target: n.id,
              data: { linkType: 'post' },
            }));

            // Clarify nodes 50/50 left and right (info links)
            const expandClarifyList = clarifies.filter((c) => !existingIds.has(c.id));
            const expandClarifyMid = Math.ceil(expandClarifyList.length / 2);
            const clarifyNodes = expandClarifyList.map<Node>((c, idx) => {
              const isLeft = idx < expandClarifyMid;
              const rowIdx = isLeft ? idx : idx - expandClarifyMid;
              return {
                id: c.id,
                position: {
                  x: sx + (isLeft ? -LAYOUT.infoOffsetX : LAYOUT.infoOffsetX),
                  y: sy + rowIdx * LAYOUT.infoSpacingY + LAYOUT.infoOffsetY,
                },
                data: { label: c.label, nodeType: 'info' },
                type: 'mind',
                dragHandle: '.drag-handle',
              };
            });
            const clarifyEdges = clarifyNodes.map<Edge>((n, i) => ({
              id: `e-${sourceId}-${n.id}`,
              source: sourceId,
              target: n.id,
              data: { linkType: 'info' },
              sourceHandle: i < expandClarifyMid ? 'left' : 'rightSource',
              targetHandle: i < expandClarifyMid ? 'right' : 'leftTarget',
              type: 'smoothstep',
            }));

            return {
              maps: {
                ...inner.maps,
                [innerSid]: {
                  nodes: [...innerMap.nodes, ...branchNodes, ...answerNodes, ...clarifyNodes],
                  edges: [...innerMap.edges, ...branchEdges, ...answerEdges, ...clarifyEdges],
                },
              },
              promptLoading: false,
            };
          });
        }).catch(() => set({ promptLoading: false }));
        return state as SessionsState;
      }),
  };
});
