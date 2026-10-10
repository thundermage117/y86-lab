import { useCallback, useEffect, useRef, useState } from 'react';
import { readStored, writeStored } from './storage.js';

const SOURCE_KEY = 'y86-source';
const EXAMPLE_KEY = 'y86-example';

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function networkMessage(err) {
  if (err?.name === 'TypeError') {
    return 'Could not reach the backend. Start it with `npm run dev` from the project root '
      + '(the API runs on port 3001).';
  }
  return err?.message ?? String(err);
}

/**
 * Program source, examples, and the result of the last successful run.
 * status: 'idle' | 'running' | 'error'
 */
export function useSimulation() {
  const [examples, setExamples] = useState([]);
  const [exampleId, setExampleId] = useState(() => readStored(EXAMPLE_KEY));
  const [source, setSourceState] = useState(() => readStored(SOURCE_KEY, ''));
  const [result, setResult] = useState(null);
  const [ranSource, setRanSource] = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const inflight = useRef(null);

  const setSource = useCallback((text) => {
    setSourceState(text);
    writeStored(SOURCE_KEY, text);
  }, []);

  const run = useCallback(async (text) => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setStatus('running');
    setError(null);
    setErrorCode(null);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: text }),
        signal: controller.signal,
      });
      const body = await readJson(res);
      if (res.status === 422 && body?.program) {
        setDiagnostics(body.program.errors);
        setStatus('error');
        setError(`Assembly failed: ${body.program.errors.length} error${body.program.errors.length === 1 ? '' : 's'}.`);
        return false;
      }
      if (!res.ok || !body) {
        setErrorCode(body?.code ?? null);
        throw new Error(body?.error ?? `Server error ${res.status}`);
      }
      const failed = Object.values(body.modes).find((m) => !m.ok);
      if (failed) throw new Error(failed.error);
      setDiagnostics([]);
      setResult(body);
      setRanSource(text);
      setStatus('idle');
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
      setStatus('error');
      setError(networkMessage(err));
      return false;
    } finally {
      if (inflight.current === controller) inflight.current = null;
    }
  }, []);

  const selectExample = useCallback((id, list = examples) => {
    const ex = list.find((e) => e.id === id);
    if (!ex) return;
    setExampleId(id);
    writeStored(EXAMPLE_KEY, id);
    setSource(ex.source);
    setDiagnostics([]);
    run(ex.source);
  }, [examples, setSource, run]);

  const loadExamples = useCallback(async () => {
    try {
      const res = await fetch('/api/examples');
      const body = await readJson(res);
      if (!res.ok || !body) throw new Error(body?.error ?? `Server error ${res.status}`);
      setExamples(body.examples);
      return body.examples;
    } catch (err) {
      setStatus('error');
      setError(networkMessage(err));
      return null;
    }
  }, []);

  // First load: fetch examples, seed the editor if empty, and run it.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const list = await loadExamples();
      if (!list?.length) return;
      let text = readStored(SOURCE_KEY, '');
      if (!text.trim()) {
        const first = list[0];
        setExampleId(first.id);
        setSourceState(first.source);
        text = first.source;
      }
      run(text);
    })();
  }, [loadExamples, run]);

  const retry = useCallback(async () => {
    if (examples.length === 0) {
      const list = await loadExamples();
      if (!list?.length) return;
    }
    run(source || examples[0]?.source || '');
  }, [examples, loadExamples, run, source]);

  return {
    examples,
    exampleId,
    example: examples.find((e) => e.id === exampleId) ?? null,
    selectExample,
    source,
    setSource,
    dirty: result !== null && source !== ranSource,
    run: () => run(source),
    retry,
    result,
    diagnostics,
    status,
    error,
    errorCode,
  };
}
