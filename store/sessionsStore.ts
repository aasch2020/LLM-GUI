// Global sessions + maps store: manages multiple chat sessions,
// each with its own React Flow nodes/edges. Actions keep maps
// independent per chat and limit node dragging to the top handle.
import { create } from 'zustand';
import { initializeNodeWithGemini, expandNodeWithGemini } from '../lib/llm';
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
  createSession: (title?: string) => string;
  selectSession: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  createRoot: (label: string) => void;
  addDemoNode: (label?: string) => void;
  addPreNode: (label?: string) => void;
  addInfoNode: (label?: string) => void;
  expandSelectedNodeWithGemini: () => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  updateNodeType: (nodeId: string, nodeType: string) => void;
}

// New sessions start with empty maps
const defaultNodes: Node[] = [];
const defaultEdges: Edge[] = [];

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
        initializeNodeWithGemini({ nodeId: 'root', context: label }).then(({ title, clarifies, branches }) => {
          set((innerState) => {
            const innerSid = innerState.selectedId; if (!innerSid) return innerState as SessionsState;
            const innerMap = innerState.maps[innerSid] ?? { nodes: [], edges: [] };
            const sourceNode = innerMap.nodes.find((n) => n.id === 'root');
            const nodesUpdated = innerMap.nodes.map((n) => n.id === 'root'
              ? { ...n, data: { ...(n.data ?? {}), label: title, title } }
              : n);
            const existingIds = new Set(nodesUpdated.map((n) => n.id));
            // Branch nodes below (post links)
            const branchNodes = branches
              .filter((b) => !existingIds.has(b.id))
              .map<Node>((b, idx) => ({
                id: b.id,
                position: { x: (sourceNode?.position?.x ?? 250) - 120 + idx * 180, y: (sourceNode?.position?.y ?? 120) + 160 },
                data: { label: b.label, nodeType: 'step' },
                type: 'mind',
                dragHandle: '.drag-handle',
              }));
            const branchEdges = branchNodes.map<Edge>((n) => ({
              id: `e-root-${n.id}`,
              source: 'root',
              target: n.id,
              data: { linkType: 'post' },
            }));
            const infoNodes = clarifies
              .filter((c) => !existingIds.has(c.id))
              .map<Node>((c, idx) => ({
                id: c.id,
                position: { x: (sourceNode?.position?.x ?? 250) + 200, y: (sourceNode?.position?.y ?? 120) + (idx * 60) - 30 },
                data: { label: c.label, nodeType: 'info' },
                type: 'mind',
                dragHandle: '.drag-handle',
              }));
            const infoEdges = infoNodes.map<Edge>((n) => ({
              id: `e-root-${n.id}`,
              source: 'root',
              target: n.id,
              data: { linkType: 'info' },
              sourceHandle: 'right',
              targetHandle: 'left',
              type: 'smoothstep',
            }));
            return {
              maps: {
                ...innerState.maps,
                [innerSid]: {
                  nodes: [...nodesUpdated, ...branchNodes, ...infoNodes],
                  edges: [...innerMap.edges, ...branchEdges, ...infoEdges],
                },
              },
            };
          });
        }).catch(() => {/* swallow LLM errors for non-blocking UX */});
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
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'smoothstep',
        };
        return { maps: { ...state.maps, [sid]: { nodes: [...baseNodes, newNode], edges: [...map.edges, newEdge] } } };
      }),
    // Expand the selected node using LLM; add branches as 'post' and clarifies as 'info' side nodes
    expandSelectedNodeWithGemini: () =>
      set((state) => {
        const sid = state.selectedId;
        if (!sid) return state as SessionsState;
        const map = state.maps[sid] ?? { nodes: [], edges: [] };
        const sourceId = state.selectedNodeId ?? 'root';
        const sourceNode = map.nodes.find((n) => n.id === sourceId);
        const contextLabel = (sourceNode?.data as any)?.label ?? (sourceNode?.data as any)?.title ?? 'Idea';

        // Fire async LLM expansion and apply when ready
        expandNodeWithGemini({ nodeId: sourceId, context: String(contextLabel) }).then(({ branches, clarifies }) => {
          set((inner) => {
            const innerSid = inner.selectedId; if (!innerSid) return inner as SessionsState;
            const innerMap = inner.maps[innerSid] ?? { nodes: [], edges: [] };
            const existingIds = new Set(innerMap.nodes.map((n) => n.id));

            // Branch nodes below (post links)
            const branchNodes = branches
              .filter((b) => !existingIds.has(b.id))
              .map<Node>((b, idx) => ({
                id: b.id,
                position: { x: (sourceNode?.position?.x ?? 250) - 120 + idx * 180, y: (sourceNode?.position?.y ?? 120) + 160 },
                data: { label: b.label, nodeType: 'step' },
                type: 'mind',
                dragHandle: '.drag-handle',
              }));
            const branchEdges = branchNodes.map<Edge>((n) => ({
              id: `e-${sourceId}-${n.id}`,
              source: sourceId,
              target: n.id,
              data: { linkType: 'post' },
            }));

            // Clarify nodes to the right (info links)
            const clarifyNodes = clarifies
              .filter((c) => !existingIds.has(c.id))
              .map<Node>((c, idx) => ({
                id: c.id,
                position: { x: (sourceNode?.position?.x ?? 250) + 200, y: (sourceNode?.position?.y ?? 120) + (idx * 60) - 30 },
                data: { label: c.label, nodeType: 'info' },
                type: 'mind',
                dragHandle: '.drag-handle',
              }));
            const clarifyEdges = clarifyNodes.map<Edge>((n) => ({
              id: `e-${sourceId}-${n.id}`,
              source: sourceId,
              target: n.id,
              data: { linkType: 'info' },
              sourceHandle: 'right',
              targetHandle: 'left',
              type: 'smoothstep',
            }));

            return {
              maps: {
                ...inner.maps,
                [innerSid]: {
                  nodes: [...innerMap.nodes, ...branchNodes, ...clarifyNodes],
                  edges: [...innerMap.edges, ...branchEdges, ...clarifyEdges],
                },
              },
            };
          });
        }).catch(() => state as SessionsState);
        return state as SessionsState;
      }),
  };
});
