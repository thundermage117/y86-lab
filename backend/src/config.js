import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const HARDWARE_DIR = join(ROOT, 'hardware');
export const BUILD_DIR = join(HARDWARE_DIR, 'build');
export const PROGRAMS_DIR = join(ROOT, 'programs');

export const PORT = Number(process.env.PORT ?? 3001);
export const MAX_SOURCE_BYTES = 64 * 1024;
export const DEFAULT_MAX_CYCLES = 3000;
export const MAX_CYCLES_LIMIT = 10000;
export const SIM_TIMEOUT_MS = 30_000;
export const CACHE_ENTRIES = 16;
