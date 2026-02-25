'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const { execSync } = require('child_process');
const { parseVCD } = require('./vcdMapper');
const { parseInstructionMemory } = require('./instructionMemory');
const { parseDataMemory } = require('./dataMemory');

const app = express();
app.use(cors());
app.use(express.json());

const PIPELINE_DIR = path.join(__dirname, '..', 'hardware', 'pipeline');
const VCD_PATH = path.join(__dirname, '..', 'hardware', 'pipeline', 'sim', 'proc.vcd');
const FETCH_V_PATH = path.join(__dirname, '..', 'hardware', 'pipeline', 'src', 'fetch.v');
const DATA_MEM_PATH = path.join(__dirname, '..', 'hardware', 'pipeline', 'DATA_MEM.txt');

/**
 * GET /api/simulate
 *
 * Optionally re-runs the Verilog simulation (if iverilog is available),
 * then parses proc.vcd and returns cycle-by-cycle pipeline state.
 *
 * Response: { cycles: [...], total: N }
 */
app.get('/api/simulate', (req, res) => {
  let dataMemory = null;
  try {
    // Capture the memory image that the simulation will read at startup.
    dataMemory = parseDataMemory(DATA_MEM_PATH);
  } catch (memErr) {
    console.warn('Could not parse data memory:', memErr.message);
  }

  // Try to regenerate the VCD by running iverilog + vvp
  try {
    execSync('iverilog -I src -o src/proc.vvp src/proc.v && vvp src/proc.vvp', {
      cwd: PIPELINE_DIR,
      timeout: 30000,
      stdio: 'pipe',
    });
    console.log('Simulation re-run successfully.');
  } catch (err) {
    // iverilog may not be installed; fall through to use existing proc.vcd
    const stderr = err.stderr ? String(err.stderr).trim().split('\n')[0] : null;
    const detail = stderr || err.message.split('\n')[0];
    console.warn('Could not run iverilog (using pre-existing proc.vcd):', detail);
  }

  // Parse the VCD
  try {
    const cycles = parseVCD(VCD_PATH);
    let instructionMemory = null;
    try {
      instructionMemory = parseInstructionMemory(FETCH_V_PATH);
    } catch (memErr) {
      console.warn('Could not parse instruction memory:', memErr.message);
    }
    res.json({ cycles, total: cycles.length, instructionMemory, dataMemory });
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
  console.log(`VCD source: ${VCD_PATH}`);
});
