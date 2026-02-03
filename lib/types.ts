import type { Node as FlowNode, Edge as FlowEdge } from 'reactflow';

/**
 * Branch
 * Represents a suggested child branch for a node expansion.
 */
export type Branch = {
  id: string;
  label: string;
};

/**
 * NodeContext
 * Context payload for expanding a specific node, optionally with extra text.
 */
export type NodeContext = {
  nodeId: string;
  context?: string;
};

/**
 * MindMap
 * Container for the React Flow graph: nodes and edges.
 */
export type MindMap = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

/**
 * LinkType
 * Semantic type for edges: 'pre' (incoming), 'post' (outgoing), or 'info' (side info).
 */
export type LinkType = 'pre' | 'post' | 'info';

/**
 * NodeData
 * Additional metadata for a mind map node used by UI components.
 */
export type NodeData = {
  label?: string;
  title?: string;
  subtitle?: string;
  details?: string;
  hasInput?: boolean;
  inputPlaceholder?: string;
  inputValue?: string;
};
