import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVcd, toBigInt, toHex64 } from '../src/vcd/parser.js';

const VCD = `$date today $end
$version Icarus $end
$timescale 1ps $end
$scope module top $end
$var reg 1 ! clock $end
$var wire 64 " big [63:0] $end
$var wire 4 # nib [3:0] $end
$var wire 4 # alias [3:0] $end
$scope module sub $end
$var wire 1 $ clock $end
$upscope $end
$upscope $end
$enddefinitions $end
$comment
  multi-line comment
$end
#0
$dumpvars
0!
b0 "
bx #
0$
$end
#5
b1111111111111111111111111111111111111111111111111111111111111110 "
b0011 #
#10
1!
b101 #
#20
0!
#25
b1000000000000000000000000000000000000000000000000000000000000000 "
#30
1!
#40
0!
`;

test('samples settled values just before each rising edge', () => {
  const { samples, sampleTimes, timescale, signals } = parseVcd(VCD, { clock: 'clock' });
  assert.equal(timescale, '1ps');
  assert.deepEqual(sampleTimes, [10, 30]);
  assert.equal(samples.length, 2);
  // At t=10 the sample must not yet include the b101 written at t=10.
  assert.equal(toBigInt(samples[0]['top.nib']), 3n);
  assert.equal(toHex64(samples[0]['top.big']), '0xfffffffffffffffe');
  assert.equal(toBigInt(samples[1]['top.nib']), 5n);
  assert.equal(toBigInt(samples[1]['top.big']), 1n << 63n);
  // Aliased ids populate both names; nested scopes are kept apart.
  assert.equal(samples[1]['top.alias'], samples[1]['top.nib']);
  assert.ok(signals.includes('top.sub.clock'));
});

test('64-bit values keep full precision and x/z become null', () => {
  assert.equal(toBigInt('1'.repeat(64)), (1n << 64n) - 1n);
  assert.equal(toBigInt('10x1'), null);
  assert.equal(toHex64('z'), null);
});

test('missing clock is a clear error', () => {
  assert.throws(() => parseVcd(VCD, { clock: 'clk' }), /clock signal "clk" not found/);
});
