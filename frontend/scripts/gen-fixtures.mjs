// Regenerates frontend test fixtures from the real Verilog CPUs.
// Usage: node frontend/scripts-gen-fixtures.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { simulateSource } from '../../backend/src/sim/runner.js';

const ids = ['03_load_use', '04_branch_mispredict', '05_call_ret', '07_push_pop', '09_bad_address'];
for (const id of ids) {
  const source = readFileSync(new URL(`../../programs/${id}.ys`, import.meta.url), 'utf8');
  const result = await simulateSource(source, { maxCycles: 200 });
  writeFileSync(new URL(`../src/utils/__fixtures__/${id}.json`, import.meta.url), JSON.stringify(result));
  console.log(id, result.modes.pipelined.total, 'cycles');
}
