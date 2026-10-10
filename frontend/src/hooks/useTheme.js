import { useCallback, useEffect, useState } from 'react';
import { readStored, writeStored } from './storage.js';

const KEY = 'y86-pipeline-theme';
const query = () => window.matchMedia?.('(prefers-color-scheme: light)');

function systemTheme() {
  return query()?.matches ? 'light' : 'dark';
}

/** Explicit choice wins; otherwise follow the OS setting, live. */
export function useTheme() {
  const [explicit, setExplicit] = useState(() => {
    const saved = readStored(KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  });
  const [system, setSystem] = useState(systemTheme);
  const theme = explicit ?? system;

  useEffect(() => {
    const mq = query();
    if (!mq) return undefined;
    const onChange = () => setSystem(mq.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setExplicit(next);
    writeStored(KEY, next);
  }, [theme]);

  return { theme, toggle };
}
