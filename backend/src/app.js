import express from 'express';
import { DEFAULT_MAX_CYCLES, MAX_CYCLES_LIMIT, MAX_SOURCE_BYTES } from './config.js';
import { loadExamples } from './sim/examples.js';
import {
  SimulatorUnavailableError, assembleSource, simulateSource, simulatorVersion,
} from './sim/runner.js';

class BadRequest extends Error {}

function readSource(body) {
  const source = body?.source;
  if (typeof source !== 'string') throw new BadRequest('Request body must be JSON with a "source" string.');
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    throw new BadRequest(`Program source is larger than ${MAX_SOURCE_BYTES / 1024} KB.`);
  }
  return source;
}

function readMaxCycles(body) {
  const value = body?.maxCycles ?? DEFAULT_MAX_CYCLES;
  if (!Number.isInteger(value) || value < 1 || value > MAX_CYCLES_LIMIT) {
    throw new BadRequest(`maxCycles must be an integer between 1 and ${MAX_CYCLES_LIMIT}.`);
  }
  return value;
}

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', asyncRoute(async (_req, res) => {
    res.json({ ok: true, simulator: await simulatorVersion() });
  }));

  app.get('/api/examples', asyncRoute(async (_req, res) => {
    res.json({ examples: await loadExamples() });
  }));

  app.post('/api/assemble', (req, res) => {
    const program = assembleSource(readSource(req.body));
    res.status(program.ok ? 200 : 422).json({ program });
  });

  app.post('/api/simulate', asyncRoute(async (req, res) => {
    const result = await simulateSource(readSource(req.body), { maxCycles: readMaxCycles(req.body) });
    res.status(result.program.ok ? 200 : 422).json(result);
  }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof BadRequest || err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof SimulatorUnavailableError) {
      return res.status(503).json({ error: err.message, code: 'SIMULATOR_UNAVAILABLE' });
    }
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  });

  return app;
}
