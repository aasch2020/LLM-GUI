import { Branch, NodeContext } from './types';

export async function expandNode(_ctx: NodeContext): Promise<Branch[]> {
  // Placeholder for future LLM integration
  return [
    { id: 'mock-1', label: 'Mock branch 1' },
    { id: 'mock-2', label: 'Mock branch 2' },
    { id: 'mock-3', label: 'Mock branch 3' },
  ];
}

export default { expandNode };
