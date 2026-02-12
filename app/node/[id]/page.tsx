"use client";
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSessionsStore } from '../../../store/sessionsStore';
import MindNode from '../../../components/MindNode';
import type { Node } from 'reactflow';

// Node detail page layout:
// - Top bar: incoming (previous) nodes rendered as clickable cards
// - Left sidebar: side info nodes rendered vertically as cards
// - Bottom bar: outgoing (next) nodes rendered as clickable cards
// The center shows the current node’s details.
/**
 * NodePage
 *
 * Detailed view for a single node at `/node/[id]`.
 * Shows incoming (previous) nodes, side info, the node details with editable notes,
 * and outgoing (next) nodes. Provides navigation back to the chat map.
 */
export default function NodePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const selectedSessionId = useSessionsStore((s) => s.selectedId);
  const sessionMap = useSessionsStore((s) => (selectedSessionId ? s.maps[selectedSessionId] : undefined));
  const nodes = sessionMap?.nodes ?? [];
  const edges = sessionMap?.edges ?? [];

  const findNode = (nid: string) => nodes.find((n) => n.id === nid);
  const labelFor = (nid: string) => findNode(nid)?.data?.label ?? nid;

  // Link groups derived from the selected session’s edges
  const incomingIds = edges.filter((e) => e.target === id && e.data?.linkType !== 'info').map((e) => e.source);
  const outgoingIds = edges.filter((e) => e.source === id && e.data?.linkType !== 'info').map((e) => e.target);
  const sideInfoIds = edges.filter((e) => e.source === id && e.data?.linkType === 'info').map((e) => e.target);

  const incomingNodes = incomingIds.map(findNode).filter(Boolean) as typeof nodes;
  const outgoingNodes = outgoingIds.map(findNode).filter(Boolean) as typeof nodes;
  const sideInfoNodes = sideInfoIds.map(findNode).filter(Boolean) as typeof nodes;
  const currentNode = findNode(id);
  const updateNodeData = useSessionsStore((s) => s.updateNodeData);
  const repromptRootWithClarify = useSessionsStore((s) => s.repromptRootWithClarify);
  const expandAnswerPath = useSessionsStore((s) => s.expandAnswerPath);

  // Editable notes field bound to the current node's inputValue
  const initialNotes = typeof (currentNode?.data as any)?.inputValue === 'string'
    ? (currentNode?.data as any).inputValue
    : '';
  const [notes, setNotes] = useState<string>(initialNotes);
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes, id]);

  const nodeType = (currentNode?.data as any)?.nodeType ?? 'default';
  const nodeTitle = currentNode?.data?.title ?? currentNode?.data?.label ?? '';

  const handleNotesSubmit = () => {
    const value = notes.trim();
    if (!value) return;
    if (nodeType === 'root') {
      repromptRootWithClarify(value);
      setNotes('');
      updateNodeData(id, { inputValue: '' });
      return;
    }
    if (nodeType === 'info') {
      const question = nodeTitle || (currentNode?.data as any)?.label;
      repromptRootWithClarify(value, question);
      setNotes('');
      updateNodeData(id, { inputValue: '' });
      return;
    }
    if (nodeType === 'step' || nodeType === 'pre') {
      expandAnswerPath(id, value);
      setNotes('');
      updateNodeData(id, { inputValue: '' });
      return;
    }
    updateNodeData(id, { details: value, inputValue: '' });
    setNotes('');
  };

  const notesSubmitLabel =
    nodeType === 'root'
      ? 'Reprompt with context'
      : nodeType === 'info'
        ? 'Submit & reprompt'
        : nodeType === 'step' || nodeType === 'pre'
          ? 'Expand path'
          : 'Update details';

  // Render actual MindNode (standalone = no Handles, no drag bar) for consistent look and behavior
  const NodeCard = ({ node }: { node: Node }) => (
    <div className="shrink-0 cursor-pointer">
      <MindNode id={node.id} data={node.data ?? {}} selected={false} standalone />
    </div>
  );

  return (
    <main className="p-6">
      {/* Top bar: incoming/previous nodes */}
      <div className="mb-4">
        <div className="text-sm font-semibold mb-2">Previous</div>
        {incomingNodes.length ? (
          <div className="flex gap-4 overflow-x-auto pb-1">
            {incomingNodes.map((n) => (
              <NodeCard key={n.id} node={n} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No incoming links.</p>
        )}
      </div>

      {/* Middle: left sidebar for side info, main content for current node */}
      <div className="flex gap-6">
        {/* Left sidebar: side info - actual MindNode components */}
        <aside className="shrink-0">
          <div className="text-sm font-semibold mb-2">Side Info</div>
          {sideInfoNodes.length ? (
            <div className="space-y-4 flex flex-col">
              {sideInfoNodes.map((n) => (
                <NodeCard key={n.id} node={n} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No side info links.</p>
          )}
        </aside>

        {/* Main panel: current node details */}
        <section className="flex-1">
          <div className="rounded border border-gray-200 bg-white px-4 py-3 shadow">
            <div className="text-xl font-semibold text-gray-900">{currentNode?.data?.title ?? labelFor(id)}</div>
            {currentNode?.data?.content && (
              <div className="text-sm text-gray-700 mt-1">{currentNode.data.content}</div>
            )}
            {currentNode?.data && (
              <div className="mt-3 text-sm text-gray-800">
                <div className="text-gray-600">Additional details:</div>
                <div className="mt-1 text-gray-700">
                  {currentNode.data.details ?? 'No details provided.'}
                </div>
                <div className="mt-3">
                  <div className="text-gray-600">Notes:</div>
                  <div className="mt-1 flex gap-2">
                    <textarea
                      className="flex-1 min-w-0 min-h-[100px] rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Type notes or ideas…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={() => updateNodeData(id, { inputValue: notes })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleNotesSubmit();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleNotesSubmit}
                      className="shrink-0 self-end rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 border border-blue-500 h-[36px]"
                      aria-label={notesSubmitLabel}
                    >
                      {notesSubmitLabel}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3">
            <Link href={`/chat/${selectedSessionId ?? ''}`} className="text-sm text-gray-700 hover:underline">Back to map</Link>
          </div>
        </section>
      </div>

      {/* Bottom bar: outgoing/next nodes - actual MindNode components */}
      <div className="mt-6">
        <div className="text-sm font-semibold mb-2">Next</div>
        {outgoingNodes.length ? (
          <div className="flex gap-4 overflow-x-auto pb-1">
            {outgoingNodes.map((n) => (
              <NodeCard key={n.id} node={n} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No outgoing links.</p>
        )}
      </div>
    </main>
  );
}
