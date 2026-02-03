import { NextRequest, NextResponse } from 'next/server';
import { expandNode } from '../../../lib/llm';
import type { NodeContext, Branch } from '../../../lib/types';

/**
 * POST /api/expand-node
 *
 * Expands a mind-map node into suggested branches.
 * Currently delegates to a stubbed `expandNode(ctx)` from `lib/llm` and returns `{ branches }`.
 * Expects a JSON body containing `{ nodeId, context }`.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const ctx: NodeContext = {
    nodeId: body.nodeId ?? 'unknown',
    context: body.context,
  };

  // For now, return mock branches via stub
  const branches: Branch[] = await expandNode(ctx);
  return NextResponse.json({ branches });
}
