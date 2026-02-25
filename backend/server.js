'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const { execSync } = require('child_process');
const { parseVCD } = require('./vcdMapper');
const { parseSequentialVCD } = require('./sequentialVcdMapper');
const { parseInstructionMemory } = require('./instructionMemory');
const { parseDataMemory } = require('./dataMemory');
const { parseRegisterFileMemory } = require('./registerFileMemory');
const { extractVcdClockInfo } = require('./vcdClockInfo');

const app = express();
app.use(cors());
app.use(express.json());

const PIPELINE_DIR = path.join(__dirname, '..', 'hardware', 'pipeline');
const PIPELINE_VCD_PATH = path.join(__dirname, '..', 'hardware', 'pipeline', 'sim', 'proc.vcd');
const PIPELINE_FETCH_V_PATH = path.join(__dirname, '..', 'hardware', 'pipeline', 'src', 'fetch.v');
const PIPELINE_DATA_MEM_PATH = path.join(__dirname, '..', 'hardware', 'pipeline', 'DATA_MEM.txt');
const SEQUENTIAL_DIR = path.join(__dirname, '..', 'hardware', 'sequential');
const SEQUENTIAL_VCD_PATH = path.join(__dirname, '..', 'hardware', 'sequential', 'sim', 'seq.vcd');
const SEQUENTIAL_FETCH_V_PATH = path.join(__dirname, '..', 'hardware', 'sequential', 'src', 'fetch.v');
const SEQUENTIAL_DATA_MEM_PATH = path.join(__dirname, '..', 'hardware', 'sequential', 'DATA_MEM.txt');
const SEQUENTIAL_REG_MEM_PATH = path.join(__dirname, '..', 'hardware', 'sequential', 'REG_MEM.txt');

function tryParseMemoryAssets(fetchPath, dataMemPath) {
  let instructionMemory = null;
  let dataMemory = null;

  try {
    instructionMemory = parseInstructionMemory(fetchPath);
  } catch (err) {
    console.warn(`Could not parse instruction memory (${fetchPath}):`, err.message);
  }

  try {
    dataMemory = parseDataMemory(dataMemPath);
  } catch (err) {
    console.warn(`Could not parse data memory (${dataMemPath}):`, err.message);
  }

  return { instructionMemory, dataMemory };
}

function tryRunSimulation(command, cwd, label, fallbackLabel) {
  try {
    execSync(command, {
      cwd,
      timeout: 30000,
      stdio: 'pipe',
    });
    console.log(`${label} simulation re-run successfully.`);
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim().split('\n')[0] : null;
    const detail = stderr || err.message.split('\n')[0];
    console.warn(`Could not run ${label} simulation (using pre-existing ${fallbackLabel}):`, detail);
  }
}

/**
 * GET /api/simulate
 *
 * Optionally re-runs the Verilog simulation (if iverilog is available),
 * then parses proc.vcd and returns cycle-by-cycle pipeline state.
 *
 * Response: { cycles: [...], total: N }
 */
app.get('/api/simulate', (req, res) => {
  const pipelineAssets = tryParseMemoryAssets(PIPELINE_FETCH_V_PATH, PIPELINE_DATA_MEM_PATH);
  const sequentialAssets = tryParseMemoryAssets(SEQUENTIAL_FETCH_V_PATH, SEQUENTIAL_DATA_MEM_PATH);
  let sequentialRegisterMemory = null;
  try {
    sequentialRegisterMemory = parseRegisterFileMemory(SEQUENTIAL_REG_MEM_PATH);
  } catch (err) {
    console.warn(`Could not parse sequential register memory (${SEQUENTIAL_REG_MEM_PATH}):`, err.message);
  }

  tryRunSimulation(
    'iverilog -I src -o src/proc.vvp src/proc.v && vvp src/proc.vvp',
    PIPELINE_DIR,
    'pipeline',
    'proc.vcd',
  );
  tryRunSimulation(
    'iverilog -o seq.vvp src/seq.v && vvp seq.vvp',
    SEQUENTIAL_DIR,
    'sequential',
    'seq.vcd',
  );

  // Parse the VCD
  try {
    const pipelineClock = extractVcdClockInfo(PIPELINE_VCD_PATH, ['clock']);
    const sequentialClock = extractVcdClockInfo(SEQUENTIAL_VCD_PATH, ['clk', 'clock']);
    const pipelineCycles = parseVCD(PIPELINE_VCD_PATH);
    const sequentialCycles = parseSequentialVCD(SEQUENTIAL_VCD_PATH, {
      initialRegisters: sequentialRegisterMemory?.registers ?? null,
    });

    const modes = {
      pipelined: {
        mode: 'pipelined',
        cycles: pipelineCycles,
        total: pipelineCycles.length,
        instructionMemory: pipelineAssets.instructionMemory,
        dataMemory: pipelineAssets.dataMemory,
        clock: pipelineClock,
      },
      sequential: {
        mode: 'sequential',
        cycles: sequentialCycles,
        total: sequentialCycles.length,
        instructionMemory: sequentialAssets.instructionMemory,
        dataMemory: sequentialAssets.dataMemory,
        clock: sequentialClock,
      },
    };

    // Backward-compatible top-level fields remain pipeline defaults.
    res.json({
      cycles: pipelineCycles,
      total: pipelineCycles.length,
      instructionMemory: pipelineAssets.instructionMemory,
      dataMemory: pipelineAssets.dataMemory,
      clock: pipelineClock,
      modes,
    });
  } catch (err) {
    console.error('Failed to parse VCD:', err);
    res.status(500).json({ error: 'Failed to parse VCD file: ' + err.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Y86-64 backend listening on http://localhost:${PORT}`);
  console.log(`Pipeline VCD source: ${PIPELINE_VCD_PATH}`);
  console.log(`Sequential VCD source: ${SEQUENTIAL_VCD_PATH}`);
});
