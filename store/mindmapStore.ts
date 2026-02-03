import { create } from 'zustand';
import type { Node, Edge } from 'reactflow';

interface MindMapState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  addDemoNode: (label?: string) => void;
}

const initialNodes: Node[] = [
  { id: 'root', position: { x: 250, y: 100 }, data: { label: 'Start' }, type: 'mind' },
  { id: 'child-1', position: { x: 100, y: 250 }, data: { label: 'Idea A' }, type: 'mind' },
  { id: 'child-2', position: { x: 400, y: 250 }, data: { label: 'Idea B' }, type: 'mind' },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'root', target: 'child-1' },
  { id: 'e2', source: 'root', target: 'child-2' },
];

export const useMindMapStore = create<MindMapState>((set) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  /**
   * setNodes
   * Replace the entire nodes array.
   */
  setNodes: (nodes) => set({ nodes }),
  /**
   * setEdges
   * Replace the entire edges array.
   */
  setEdges: (edges) => set({ edges }),
  /**
   * setSelectedNodeId
   * Update the currently selected node id.
   */
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  /**
   * addDemoNode
   * Adds a new demo node and links it from the selected node (or root).
   */
  addDemoNode: (label = 'Demo Node') =>
    set((state) => {
      const id = `demo-${Date.now()}`;
      const position = {
        x: 150 + Math.round(Math.random() * 300),
        y: 300 + Math.round(Math.random() * 100),
      };
      const newNode: Node = { id, position, data: { label }, type: 'mind' };

      const sourceId = state.selectedNodeId ?? 'root';
      const newEdge: Edge = { id: `e-${sourceId}-${id}`, source: sourceId, target: id };

      return {
        nodes: [...state.nodes, newNode],
        edges: [...state.edges, newEdge],
      };
    }),
}));
