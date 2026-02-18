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
export type MindNodeProps = NodeProps<NodeData> & { standalone?: boolean };

const MindNode: React.FC<MindNodeProps> = ({ id, data, selected, standalone }) => {
  const router = useRouter();
  // Persist input changes into the per-chat store map
  const updateNodeData = useSessionsStore((s) => s.updateNodeData);
  const repromptRootWithClarify = useSessionsStore((s) => s.repromptRootWithClarify);
  const expandAnswerPath = useSessionsStore((s) => s.expandAnswerPath);
  const nodeType = (data as any)?.nodeType ?? 'default';
  const title = data?.title ?? data?.label ?? 'Node Title';
  const content = data?.content ?? '';
  const details = data?.details ?? '';
  const hasInput = data?.hasInput ?? true;
  const inputPlaceholder = data?.inputPlaceholder ?? 'Add Context!';
    // Color variants per node type
    const typeColors: Record<string, { border: string; ring: string; bg: string; handleBg: string }> = {
      default: { bg: 'bg-black', border: 'border-gray-200', ring: 'ring-blue-400', handleBg: 'bg-gray-900' },
      root: { bg: 'bg-slate-900', border: 'border-slate-500', ring: 'ring-slate-400', handleBg: 'bg-slate-800' },
      step: { bg: 'bg-neutral-900', border: 'border-gray-500', ring: 'ring-blue-400', handleBg: 'bg-neutral-800' },
      pre: { bg: 'bg-neutral-900', border: 'border-gray-500', ring: 'ring-gray-400', handleBg: 'bg-neutral-800' },
      info: { bg: 'bg-zinc-900', border: 'border-amber-500', ring: 'ring-amber-400', handleBg: 'bg-amber-900' },
      answer: { bg: 'bg-emerald-900', border: 'border-emerald-500', ring: 'ring-emerald-400', handleBg: 'bg-emerald-800' },
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

  const handleSubmit = () => {
    const value = inputValue.trim();
    if (!value) return;
    if (nodeType === 'root') {
      repromptRootWithClarify(value);
      setInputValue('');
      updateNodeData(id, { inputValue: '' });
      return;
    }
    if (nodeType === 'info') {
      const question = title || (data as any)?.label;
      repromptRootWithClarify(value, question);
      setInputValue('');
      updateNodeData(id, { inputValue: '' });
      return;
    }
    if (nodeType === 'step' || nodeType === 'pre') {
      expandAnswerPath(id, value);
      setInputValue('');
      updateNodeData(id, { inputValue: '' });
      return;
    }
    if (nodeType === 'answer') {
      updateNodeData(id, { details: value, inputValue: '' });
      setInputValue('');
      return;
    }
    updateNodeData(id, { details: value, inputValue: '' });
    setInputValue('');
  };

  const submitLabel =
    nodeType === 'root'
      ? 'Reprompt with context'
      : nodeType === 'info'
        ? 'Submit & reprompt'
        : nodeType === 'step' || nodeType === 'pre'
          ? 'Expand path'
          : nodeType === 'answer'
            ? 'Update details'
            : 'Update details';

  return (
    <div
      className={
        `rounded ${colors.bg} shadow px-4 py-3 text-sm border ${selected ? `ring-2 ${colors.ring} ${colors.border}` : colors.border}`
      }

      aria-selected={selected}
      style={{ width: 320 }}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      {!standalone && (
        <>
          <Handle type="target" position={Position.Top} />
          <Handle type="target" position={Position.Left} id="leftTarget" />
          <Handle type="source" position={Position.Left} id="left" />
        </>
      )}
      {!standalone && (
        <div
          className={`drag-handle cursor-grab select-none -mx-4 -mt-3 mb-3 px-5 py-3 ${colors.handleBg} border-b border-gray-800 rounded-t text-gray-200 text-sm flex items-center gap-2`}
          aria-label="Drag node"
        >
          <span className="inline-block w-4 h-4 bg-gray-700 rounded-sm" aria-hidden="true"></span>
          <span>Drag node</span>
        </div>
      )}
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
        {nodeType !== 'info' && content ? (
          <div className="text-gray-200 text-sm">{content}</div>
        ) : null}
        {details ? (
          <div className="text-gray-300 text-xs leading-snug">{details}</div>
        ) : null}
        {hasInput && nodeType !== 'answer' && (
          <div className="mt-2 flex gap-2 nodrag">
            <input
              type="text"
              className="flex-1 min-w-0 rounded bg-gray-800 text-gray-100 placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 px-2 py-1"
              placeholder={inputPlaceholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              onPointerDownCapture={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              onFocus={(e) => e.stopPropagation()}
              onBlur={(e) => updateNodeData(id, { inputValue: e.currentTarget.value })}
              style={{ pointerEvents: 'auto', userSelect: 'text' }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleSubmit();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="shrink-0 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 border border-blue-500"
              aria-label={submitLabel}
            >
              {submitLabel}
            </button>
          </div>
        )}
      </div>
      {!standalone && (
        <>
          <Handle type="source" position={Position.Bottom} />
          <Handle type="target" position={Position.Right} id="right" />
          <Handle type="source" position={Position.Right} id="rightSource" />
        </>
      )}
    </div>
  );
};

export default MindNode;
