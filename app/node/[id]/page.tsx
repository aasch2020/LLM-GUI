"use client";
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSessionsStore } from '../../../store/sessionsStore';

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

  // Editable notes field bound to the current node's inputValue
  const initialNotes = typeof (currentNode?.data as any)?.inputValue === 'string'
    ? (currentNode?.data as any).inputValue
    : '';
  const [notes, setNotes] = useState<string>(initialNotes);
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes, id]);

  // Small clickable node card used in sidebars
  /**
   * NodeCard
   *
   * Small clickable card representing a node. Clicking navigates to the node's detail page.
   */
  const NodeCard = ({ node }: { node: NonNullable<typeof nodes[number]> }) => (
    <button
      onClick={() => router.push(`/node/${node.id}`)}
      className="text-left w-full rounded border border-gray-200 bg-white/70 hover:bg-white transition px-3 py-2 shadow-sm"
    >
      <div className="text-sm font-medium text-gray-900">{node.data?.title ?? node.data?.label ?? node.id}</div>
      {node.data?.subtitle && (
        <div className="text-xs text-gray-600">{node.data.subtitle}</div>
      )}
      {typeof (node.data as any)?.inputValue === 'string' && (node.data as any).inputValue ? (
        <div className="mt-1 text-[11px] text-gray-700 line-clamp-2">{(node.data as any).inputValue}</div>
      ) : null}
    </button>
  );

  return (
    <main className="p-6">
      {/* Top bar: incoming/previous nodes */}
      <div className="mb-4">
        <div className="text-sm font-semibold mb-2">Previous</div>
        {incomingNodes.length ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {incomingNodes.map((n) => (
              <div key={n.id} className="min-w-[200px]">
                <NodeCard node={n} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No incoming links.</p>
        )}
      </div>

      {/* Middle: left sidebar for side info, main content for current node */}
      <div className="flex gap-6">
        {/* Left sidebar: side info */}
        <aside className="w-64 shrink-0">
          <div className="text-sm font-semibold mb-2">Side Info</div>
          {sideInfoNodes.length ? (
            <div className="space-y-2">
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
            {currentNode?.data?.subtitle && (
              <div className="text-sm text-gray-700 mt-1">{currentNode.data.subtitle}</div>
            )}
            {currentNode?.data && (
              <div className="mt-3 text-sm text-gray-800">
                <div className="text-gray-600">Additional details:</div>
                <div className="mt-1 text-gray-700">
                  {currentNode.data.details ?? 'No details provided.'}
                </div>
                <div className="mt-3">
                  <div className="text-gray-600">Notes:</div>
                  <textarea
                    className="mt-1 w-full min-h-[100px] rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Type notes or ideas…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => updateNodeData(id, { inputValue: notes })}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="mt-3">
            <Link href={`/chat/${selectedSessionId ?? ''}`} className="text-sm text-gray-700 hover:underline">Back to map</Link>
          </div>
        </section>
      </div>

      {/* Bottom bar: outgoing/next nodes */}
      <div className="mt-6">
        <div className="text-sm font-semibold mb-2">Next</div>
        {outgoingNodes.length ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {outgoingNodes.map((n) => (
              <div key={n.id} className="min-w-[200px]">
                <NodeCard node={n} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No outgoing links.</p>
        )}
      </div>
    </main>
  );
}
