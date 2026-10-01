import { act } from '@testing-library/react';
import { vi } from 'vitest';

/** Replaces IntersectionObserver so a test can bring a list's start or end sentinel into view. */
export function stubIntersections() {
  const live = new Map<Element, IntersectionObserverCallback>();
  vi.stubGlobal('IntersectionObserver', class {
    callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) { this.callback = callback; }
    observe(node: Element) { live.set(node, this.callback); }
    unobserve(node: Element) { live.delete(node); }
    disconnect() { for (const [node, callback] of live) if (callback === this.callback) live.delete(node); }
  });
  return {
    /** Fires the observed sentinel before (`start`) or after (`end`) the given list. */
    async reach(list: Element, edge: 'start' | 'end') {
      const before = edge === 'start' ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING;
      const node = [...live.keys()].find(item => item.isConnected && item.compareDocumentPosition(list) & before);
      if (!node) throw new Error(`The ${edge} of this list is not waiting to load.`);
      const callback = live.get(node)!;
      await act(async () => callback([{ isIntersecting: true, target: node } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
    },
    waiting(list: Element, edge: 'start' | 'end') {
      const before = edge === 'start' ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING;
      return [...live.keys()].some(item => item.isConnected && item.compareDocumentPosition(list) & before);
    },
  };
}
