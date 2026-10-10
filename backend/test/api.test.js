import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const post = (path, body) => fetch(base + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('GET /api/health reports the simulator', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.match(body.simulator, /Icarus/);
});

test('GET /api/examples lists programs with metadata', async () => {
  const { examples } = await (await fetch(`${base}/api/examples`)).json();
  assert.ok(examples.length >= 10);
  const sum = examples.find((e) => e.id === '01_sum_1_to_100');
  assert.equal(sum.title, 'Sum 1 to 100');
  assert.ok(sum.concepts.includes('forwarding'));
  assert.match(sum.source, /irmovq/);
});

test('POST /api/assemble returns listing or line-numbered errors', async () => {
  const ok = await post('/api/assemble', { source: 'irmovq $5, %rax\nhalt' });
  assert.equal(ok.status, 200);
  const { program } = await ok.json();
  assert.equal(program.image, '30f0050000000000000000');
  const bad = await post('/api/assemble', { source: 'irmovq $5' });
  assert.equal(bad.status, 422);
  assert.equal((await bad.json()).program.errors[0].line, 1);
});

test('POST /api/simulate returns both modes', async () => {
  const res = await post('/api/simulate', { source: 'irmovq $5, %rax\naddq %rax, %rax\nhalt' });
  assert.equal(res.status, 200);
  const { program, modes } = await res.json();
  assert.equal(program.ok, true);
  assert.equal(modes.pipelined.ok, true);
  assert.equal(modes.sequential.total, 3);
  assert.equal(modes.pipelined.cycles.at(-1).registers.rax, '0x000000000000000a');
});

test('bad requests are rejected with 400', async () => {
  assert.equal((await post('/api/simulate', {})).status, 400);
  assert.equal((await post('/api/simulate', '{not json')).status, 400);
  assert.equal((await post('/api/simulate', { source: 'x'.repeat(70 * 1024) })).status, 400);
  assert.equal((await post('/api/simulate', { source: 'halt', maxCycles: 0 })).status, 400);
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
});
