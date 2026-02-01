import type { Node as FlowNode, Edge as FlowEdge } from 'reactflow';

export type Branch = {
  id: string;
  label: string;
};

export type NodeContext = {
  nodeId: string;
  context?: string;
};

export type MindMap = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type LinkType = 'pre' | 'post' | 'info';

export type NodeData = {
  label?: string;
  title?: string;
  subtitle?: string;
  details?: string;
  hasInput?: boolean;
  inputPlaceholder?: string;
  inputValue?: string;
};
