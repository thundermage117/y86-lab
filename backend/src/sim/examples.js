// Loads example programs from programs/*.ys. Metadata comes from header
// comments: `# @title`, `# @summary`, `# @concepts a, b, c`.

import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { PROGRAMS_DIR } from '../config.js';

const META_RE = /^#\s*@(\w+)\s+(.*)$/;

export function parseExample(id, source) {
  const meta = {};
  for (const line of source.split('\n')) {
    const m = META_RE.exec(line.trim());
    if (m) meta[m[1]] = m[2].trim();
    else if (line.trim() && !line.trim().startsWith('#')) break;
  }
  return {
    id,
    title: meta.title ?? id,
    summary: meta.summary ?? '',
    concepts: meta.concepts ? meta.concepts.split(',').map((s) => s.trim()).filter(Boolean) : [],
    source,
  };
}

export async function loadExamples() {
  const files = (await readdir(PROGRAMS_DIR)).filter((f) => f.endsWith('.ys')).sort();
  return Promise.all(files.map(async (file) => {
    const source = await readFile(join(PROGRAMS_DIR, file), 'utf8');
    return parseExample(basename(file, '.ys'), source);
  }));
}
