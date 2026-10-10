import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import loadUse from './utils/__fixtures__/03_load_use.json';
import App from './App.jsx';

const EXAMPLES = [{ id: '03_load_use', title: 'Load/use hazard', summary: 'An addq needs a value…', concepts: ['stall'], source: 'irmovq $1, %rax\nhalt\n' }];

afterEach(cleanup);

// jsdom has no layout; CodeMirror measures text ranges.
const noRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
Range.prototype.getClientRects = Range.prototype.getClientRects ?? noRects;
Range.prototype.getBoundingClientRect = Range.prototype.getBoundingClientRect ?? (() => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }));

beforeEach(() => {
  try { window.localStorage?.clear(); } catch { /* storage unavailable here */ }
  window.matchMedia = window.matchMedia ?? (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  globalThis.fetch = vi.fn(async (url) => {
    const body = url.endsWith('/api/examples') ? { examples: EXAMPLES } : loadUse;
    return { ok: true, status: 200, json: async () => body };
  });
});

describe('App', () => {
  test('loads the first example, runs it, and steps through the pipeline', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Halted OK')).toBeTruthy());
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/simulate', expect.objectContaining({ method: 'POST' }));

    // Playback only appears on the cycle-based views.
    expect(screen.queryByRole('button', { name: 'Next cycle' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next event' }));
    expect(screen.getByText(/Cycle/).textContent).toContain('4');
    expect(screen.getByText('Load/use hazard on %rax')).toBeTruthy();
    const decode = screen.getByRole('article', { name: /Decode stage/ });
    expect(within(decode).getByText('stall')).toBeTruthy();
    // Connectors: F->D held, D->E bubble at the load/use stall.
    expect(screen.getAllByText('held').length).toBeGreaterThan(0);
    expect(screen.getAllByText('bubble', { selector: '.connector-label' })).toHaveLength(1);
    // Mini-timeline shows the instructions in flight.
    expect(screen.getByText('Around this cycle')).toBeTruthy();
  });

  test('switching to the sequential CPU shows the datapath', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Halted OK')).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: 'Sequential' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Step' }));
    expect(screen.getByText('SEQ datapath')).toBeTruthy();
  });

  test('shows a helpful error when the backend is down', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    render(<App />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Could not reach the backend/));
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
