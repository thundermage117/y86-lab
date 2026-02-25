'use strict';

const fs = require('fs');

function extractVcdClockInfo(filePath, clockSignalNames = ['clock', 'clk']) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  const timescaleMatch = content.match(/\$timescale\s+([\s\S]*?)\s+\$end/);
  const timescaleRaw = timescaleMatch
    ? timescaleMatch[1].trim().replace(/\s+/g, ' ')
    : null;

  const symbolToName = {};
  for (const line of lines) {
    const m = line.match(/^\s*\$var\s+\S+\s+\d+\s+(\S+)\s+(\S+)/);
    if (!m) continue;
    const sym = m[1];
    const name = m[2].replace(/\[\d+:\d+\]/, '');
    symbolToName[sym] = name;
  }

  const clockSym = Object.keys(symbolToName).find((sym) => clockSignalNames.includes(symbolToName[sym]));
  if (!clockSym) {
    return { timescaleRaw, periodTicks: null, samples: 0 };
  }

  let currentTimestamp = 0;
  let prevClock = null;
  let currentClock = null;
  let lastPosedgeTimestamp = null;
  const intervals = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('$')) continue;

    if (line.startsWith('#')) {
      const ts = Number.parseInt(line.slice(1), 10);
      if (Number.isFinite(ts)) currentTimestamp = ts;
      continue;
    }

    if (line.length >= 2 && /^[01xXzZ]$/.test(line[0]) && !line.startsWith('b')) {
      const sym = line.slice(1);
      if (sym !== clockSym) continue;
      const bit = line[0];
      currentClock = /[xXzZ]/.test(bit) ? null : Number.parseInt(bit, 10);
      if (currentClock === 1 && prevClock !== 1) {
        if (lastPosedgeTimestamp !== null) {
          const delta = currentTimestamp - lastPosedgeTimestamp;
          if (Number.isFinite(delta) && delta > 0) intervals.push(delta);
        }
        lastPosedgeTimestamp = currentTimestamp;
      }
      prevClock = currentClock;
    }
  }

  if (intervals.length === 0) {
    return { timescaleRaw, periodTicks: null, samples: 0 };
  }

  const histogram = new Map();
  for (const delta of intervals) {
    histogram.set(delta, (histogram.get(delta) ?? 0) + 1);
  }
  const periodTicks = Array.from(histogram.entries())
    .sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))[0]?.[0] ?? null;

  return {
    timescaleRaw,
    periodTicks,
    samples: intervals.length,
  };
}

module.exports = { extractVcdClockInfo };
