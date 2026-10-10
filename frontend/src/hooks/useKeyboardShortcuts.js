import { useEffect, useRef } from 'react';

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
    || Boolean(el.closest?.('.cm-editor'));
}

function isActivatable(el) {
  const tag = el?.tagName?.toLowerCase();
  return tag === 'button' || tag === 'a' || el?.getAttribute?.('role') === 'tab' || tag === 'summary';
}

/**
 * Global playback shortcuts. `handlers` keys: prev, next, toggle, first, last,
 * prevHazard, nextHazard, run. Space/arrows defer to focused controls.
 */
export function useKeyboardShortcuts(handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event) => {
      const h = ref.current;
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        h.run?.();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (isTypingTarget(target)) return;
      const onTab = target?.getAttribute?.('role') === 'tab';

      const map = {
        ArrowLeft: onTab ? null : h.prev,
        ArrowRight: onTab ? null : h.next,
        ' ': isActivatable(target) ? null : h.toggle,
        Home: onTab ? null : h.first,
        End: onTab ? null : h.last,
        '[': h.prevHazard,
        ']': h.nextHazard,
      };
      const fn = map[event.key];
      if (fn) {
        event.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
