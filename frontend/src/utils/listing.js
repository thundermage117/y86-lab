// Helpers for the assembler listing.

const META_RE = /^\s*#\s*@\w+/;

/** Number of leading lines that are example metadata comments. */
export function metaHeaderLength(listing) {
  let n = 0;
  while (n < listing.length && META_RE.test(listing[n].text)) n += 1;
  return n;
}
