"use client";
import React, { useCallback, useMemo, useRef } from 'react';
import ReactFlow, { Background, Controls, NodeMouseHandler, applyNodeChanges, applyEdgeChanges, EdgeChange, NodeChange } from 'reactflow';
import 'reactflow/dist/style.css';
import { useSessionsStore } from '../store/sessionsStore';
import MindNode from './MindNode';
import { useRouter } from 'next/navigation';

// Node types are defined at module scope and frozen so React Flow
// receives a stable reference across renders/HMR and avoids error 002.
const nodeTypes = Object.freeze({ mind: MindNode });
/**
 * MindMap
 *
 * Controlled React Flow canvas driven by the per-session store.
 * Handles selection, double-click navigation to node detail, and persists
 * node/edge changes back to the store. Styles edges by semantic link type.
 */
const MindMap: React.FC = () => {

  
  const selectedId = useSessionsStore((s) => s.selectedId);
  const selectedNodeId = useSessionsStore((s) => s.selectedNodeId);
  const maps = useSessionsStore((s) => s.maps);
  const setSelectedNodeId = useSessionsStore((s) => s.setSelectedNodeId);
  const setNodes = useSessionsStore((s) => s.setNodes);
  const setEdges = useSessionsStore((s) => s.setEdges);
  const router = useRouter();

  const rawNodes = selectedId ? maps[selectedId]?.nodes ?? [] : [];
  const rawEdges = selectedId ? maps[selectedId]?.edges ?? [] : [];
  const ignoreNextSelectionChangeRef = useRef(false);

  const nodes = useMemo(
    () => rawNodes.map((n) => ({ ...n, selected: n.id === selectedNodeId })),
    [rawNodes, selectedNodeId]
  );

  // When selection was set by store (e.g. after reprompt), ignore the next onSelectionChange to avoid loop
  const prevSelectedNodeIdRef = useRef(selectedNodeId);
  if (prevSelectedNodeIdRef.current !== selectedNodeId) {
    prevSelectedNodeIdRef.current = selectedNodeId;
    ignoreNextSelectionChangeRef.current = true;
  }

  // Select a node unless the click originates from an interactive element
  /**
   * onNodeClick
   * Selects the clicked node unless the event originated from an interactive child element.
   */
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    const target = event?.target as HTMLElement | null;
    if (target && target.closest('input,textarea,select,button,[contenteditable="true"]')) return;
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  // Navigate to the node detail page on double click, but ignore
  // double-clicks inside interactive elements like inputs.
  /**
   * onNodeDoubleClick
   * Navigates to the node detail page on double-click, ignoring interactive child elements.
   */
  const onNodeDoubleClick: NodeMouseHandler = useCallback((event, node) => {
    const target = event?.target as HTMLElement | null;
    if (target && target.closest('input,textarea,select,button,[contenteditable="true"]')) return;
    router.push(`/node/${node.id}`);
  }, [router]);

  // Clicking the empty pane clears the current selection
  /**
   * onPaneClick
   * Clears the current selection when clicking on the empty pane.
   */
  const onPaneClick = useCallback(() => setSelectedNodeId(null), [setSelectedNodeId]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Persist node changes (position/size) into the store. Use ref for nodes to avoid callback identity changes triggering more changes.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const nonSelectionChanges = changes.filter((change) => change.type !== 'select');
    if (nonSelectionChanges.length === 0) return;
    const updated = applyNodeChanges(nonSelectionChanges, nodesRef.current);
    setNodes(updated);
  }, [setNodes]);

  const rawEdgesRef = useRef(rawEdges);
  rawEdgesRef.current = rawEdges;

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updated = applyEdgeChanges(changes, rawEdgesRef.current);
    setEdges(updated);
  }, [setEdges]);

  // Keep store selection in sync with React Flow's selection state
  const onSelectionChange = useCallback((params: { nodes: Array<{ id: string }> }) => {
    if (ignoreNextSelectionChangeRef.current) {
      ignoreNextSelectionChangeRef.current = false;
      return;
    }
    const first = params?.nodes?.[0]?.id ?? null;
    setSelectedNodeId(first);
  }, [setSelectedNodeId]);

  // Memoize nodeTypes so the reference stays stable per render
  // nodeTypes provided from module scope (stable reference)

  // Style edges by semantic link type: info (orange dashed), pre (gray), post (blue)
  const edges = useMemo(() => rawEdges.map((e) => {
    const t = e.data?.linkType as 'pre' | 'post' | 'info' | undefined;
    const style = t === 'info'
      ? { stroke: '#f59e0b', strokeDasharray: '4 2' }
      : t === 'pre'
      ? { stroke: '#6b7280' }
      : { stroke: '#2563eb' };
    return { ...e, style };
  }), [rawEdges]);

  return (
    <div className="w-full h-[70vh]">
      <ReactFlow
        // Controlled React Flow, driven by the per-chat store state
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        // Nodes are draggable; drag start is limited via each node's dragHandle
        nodesDraggable={true}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default MindMap;
