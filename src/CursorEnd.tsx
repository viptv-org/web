import { useEffect, useRef } from 'react';

/** Invisible paging boundary; no manually-operated pagination controls. */
export function CursorEnd({ onLoad, disabled, generation }: { onLoad: () => void; disabled: boolean; generation: number }) {
  const node = useRef<HTMLDivElement>(null);
  const callback = useRef(onLoad); callback.current = onLoad;
  useEffect(() => {
    if (disabled || !node.current || typeof IntersectionObserver === 'undefined') return;
    let root = node.current.parentElement;
    while (root && !['auto', 'scroll'].includes(getComputedStyle(root).overflowY)) root = root.parentElement;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); callback.current(); }
    }, { root, rootMargin: '320px 0px' });
    observer.observe(node.current); return () => observer.disconnect();
  }, [disabled, generation]);
  return <div ref={node} aria-hidden="true" style={{ height: 1 }} />;
}
