"use client";
// Custom React Flow node with a top drag handle and protected content area.
// Drag starts only from the `.drag-handle`; the content uses `nodrag`
// and stops pointer events so inputs can be focused and typed normally.
import React, { useState, useEffect } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import { useRouter } from 'next/navigation';
import { useSessionsStore } from '../store/sessionsStore';
import type { NodeData } from '../lib/types';

/**
 * MindNode
 *
 * Custom React Flow node with a dedicated drag handle and protected content area.
 * Prevents drag/selection from inputs, persists input changes to the session store,
 * and exposes side handles for semantic linking.
 */
const MindNode: React.FC<NodeProps<NodeData>> = ({ id, data, selected }) => {
  const router = useRouter();
  // Persist input changes into the per-chat store map
  const updateNodeData = useSessionsStore((s) => s.updateNodeData);
  const nodeType = (data as any)?.nodeType ?? 'default';
  const title = data?.title ?? data?.label ?? 'Node Title';
  const subtitle = data?.subtitle ?? 'Subtitle or summary';
  const details = data?.details ?? 'Additional details go here.';
  const hasInput = data?.hasInput ?? true;
  const inputPlaceholder = data?.inputPlaceholder ?? 'Type notes or ideas…';
    // Color variants per node type
    const typeColors: Record<string, { border: string; ring: string; bg: string; handleBg: string }> = {
      default: { bg: 'bg-black', border: 'border-gray-200', ring: 'ring-blue-400', handleBg: 'bg-gray-900' },
      root: { bg: 'bg-slate-900', border: 'border-slate-500', ring: 'ring-slate-400', handleBg: 'bg-slate-800' },
      step: { bg: 'bg-neutral-900', border: 'border-gray-500', ring: 'ring-blue-400', handleBg: 'bg-neutral-800' },
      pre: { bg: 'bg-neutral-900', border: 'border-gray-500', ring: 'ring-gray-400', handleBg: 'bg-neutral-800' },
      info: { bg: 'bg-zinc-900', border: 'border-amber-500', ring: 'ring-amber-400', handleBg: 'bg-amber-900' },
    };
    const colors = typeColors[nodeType] ?? typeColors.default;
  const initialInput = typeof (data as any)?.inputValue === 'string' ? (data as any).inputValue : '';
  // Mirror `data.inputValue` locally for responsive typing UX
  const [inputValue, setInputValue] = useState<string>(initialInput);
  useEffect(() => {
    // React Flow may reuse node instances when ids match (e.g., 'root').
    // Re-sync local input whenever the node id or store value changes.
    setInputValue(initialInput);
  }, [initialInput, id]);
  return (
    <div
      className={
        `rounded ${colors.bg} shadow px-4 py-3 text-sm border ${selected ? `ring-2 ${colors.ring} ${colors.border}` : colors.border}`
      }

      aria-selected={selected}
      style={{ width: 320 }}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      {/* Target: incoming edge from above */}
      <Handle type="target" position={Position.Top} />
      {/* Target: incoming edge from the left (for side info) */}
      <Handle type="target" position={Position.Left} id="left" />
      {/* Drag handle at top: only this area initiates node dragging */}
      <div
        className={`drag-handle cursor-grab select-none -mx-4 -mt-3 mb-3 px-5 py-3 ${colors.handleBg} border-b border-gray-800 rounded-t text-gray-200 text-sm flex items-center gap-2`}
        aria-label="Drag node"
      >
        <span className="inline-block w-4 h-4 bg-gray-700 rounded-sm" aria-hidden="true"></span>
        <span>Drag node</span>
      </div>
      {/* Content is marked `nodrag` so dragging cannot start here */}
      <div className="space-y-2 nodrag">
        <div
          className="text-white text-base font-semibold cursor-pointer hover:underline"
          role="link"
          aria-label="Open node detail"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); router.push(`/node/${id}`); }}
        >
          {title}
        </div>
        <div className="text-gray-200 text-sm">{subtitle}</div>
        <div className="text-gray-300 text-xs leading-snug">{details}</div>
        {hasInput && (
          <input

            type="text"
            className="mt-2 w-full rounded bg-gray-800 text-gray-100 placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 px-2 py-1 nodrag"
            placeholder={inputPlaceholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            // Stop pointer/mouse events from bubbling to React Flow so typing/focus works
            onPointerDownCapture={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            onBlur={(e) => updateNodeData(id, { inputValue: e.currentTarget.value })}
            // Allow normal input interactions inside the node content
            style={{ pointerEvents: 'auto', userSelect: 'text' }}
          />
        )}
      </div>
      {/* Source: outgoing edge to nodes below */}
      <Handle type="source" position={Position.Bottom} />
      {/* Source: outgoing edge to the right (for side info) */}
      <Handle type="source" position={Position.Right} id="right" />
    </div>
  );
};

export default MindNode;
