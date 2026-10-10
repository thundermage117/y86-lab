import { createApp } from './app.js';
import { PORT } from './config.js';
import { ensureBuilt, simulatorVersion } from './sim/runner.js';

const app = createApp();

app.listen(PORT, async () => {
  console.log(`Y86-64 API listening on http://localhost:${PORT}`);
  const version = await simulatorVersion();
  if (!version) {
    console.warn('Icarus Verilog not found: /api/simulate will return 503 until it is installed.');
    return;
  }
  console.log(`Simulator: ${version}`);
  try {
    await ensureBuilt();
    console.log('Hardware build is up to date.');
  } catch (err) {
    console.error(err.message);
  }
});
