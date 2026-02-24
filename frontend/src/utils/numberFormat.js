const HEX_STRING_RE = /^0x[0-9a-f]+$/i;

function getHexDigitCount(value) {
  if (typeof value !== 'string' || !HEX_STRING_RE.test(value)) return 0;
  return value.slice(2).length;
}

function toSignedBigInt(unsignedValue, bitWidth) {
  if (!bitWidth || bitWidth <= 0) return unsignedValue;

  const width = BigInt(bitWidth);
  const signBit = 1n << (width - 1n);
  const modulus = 1n << width;
  return (unsignedValue & signBit) !== 0n ? unsignedValue - modulus : unsignedValue;
}

export function formatNumericString(value, numberFormat = 'dec', options = {}) {
  const { signed = false, bitWidth } = options;

  if (value === null || value === undefined) return 'x';
  if (value === 'x') return 'x';
  if (typeof value !== 'string' || !HEX_STRING_RE.test(value)) return String(value);
  if (numberFormat === 'hex') return value;

  try {
    const parsed = BigInt(value);
    if (!signed) return parsed.toString(10);

    const inferredBitWidth = bitWidth ?? Math.min(64, Math.max(1, getHexDigitCount(value) * 4));
    return toSignedBigInt(parsed, inferredBitWidth).toString(10);
  } catch {
    return value;
  }
}

export function formatOpcodeValue(opcode, numberFormat = 'dec') {
  if (opcode === null || opcode === undefined) return 'x';
  if (numberFormat === 'hex') return `0x${opcode.toString(16).toUpperCase()}`;
  return String(opcode);
}
