import { formatWord } from '../../utils/format.js';

/** A 64-bit value in the chosen format; the other formats appear on hover. */
export default function Value({ hex, numberFormat }) {
  if (hex === null || hex === undefined) return <span className="value">—</span>;
  const shown = formatWord(hex, numberFormat);
  const alt = [
    numberFormat === 'hex' ? formatWord(hex, 'dec') : formatWord(hex, 'hex'),
  ];
  const unsigned = formatWord(hex, 'dec', { signed: false });
  if (unsigned !== formatWord(hex, 'dec')) alt.push(`${unsigned} unsigned`);
  return <span className="value" title={alt.join(' · ')}>{shown}</span>;
}
