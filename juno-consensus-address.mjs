// Bech32 consensus identity decoding, isolated from the pinned personal-pilot graph.
const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let sum = 1;
  for (const value of values) {
    const top = sum >>> 25;
    sum = ((sum & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) sum ^= generators[i];
  }
  return sum >>> 0;
}
function expand(prefix) {
  return [...prefix]
    .map((c) => c.charCodeAt(0) >>> 5)
    .concat(
      0,
      [...prefix].map((c) => c.charCodeAt(0) & 31)
    );
}
function decodeAddress(address, prefix, length) {
  if (typeof address !== 'string' || address !== address.toLowerCase() || address.length > 90)
    throw Error('Use a lowercase Bech32 address.');
  const split = address.lastIndexOf('1');
  const words = [...address.slice(split + 1)].map((c) => alphabet.indexOf(c));
  if (
    address.slice(0, split) !== prefix ||
    words.length !== length + 6 ||
    words.some((w) => w < 0) ||
    polymod([...expand(prefix), ...words]) !== 1
  )
    throw Error(`Invalid ${prefix} address or checksum.`);
  return words.slice(0, -6);
}
export function junoConsensusHex(address) {
  const words = decodeAddress(address, 'junovalcons', 32),
    bytes = [];
  let value = 0,
    bits = 0;
  for (const word of words) {
    value = (value << 5) | word;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  return bytes
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
