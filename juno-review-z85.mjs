// Z85's printable alphabet avoids quotes, backslashes and Markdown fence bytes.
// A length prefix records the unpadded gzip length. Padding must be zero.
// This changes transport only; the full decoded review hash is still verified.
const alphabet =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
const maximum = 750000;
export function encodeZ85(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > maximum)
    throw Error('Invalid compact review bytes.');
  let encoded = bytes.length + ':';
  for (let i = 0; i < bytes.length; i += 4) {
    let value = 0;
    for (let j = 0; j < 4; j++) value = value * 256 + (bytes[i + j] || 0);
    let group = '';
    for (let j = 0; j < 5; j++) {
      group = alphabet[value % 85] + group;
      value = Math.floor(value / 85);
    }
    encoded += group;
  }
  return encoded;
}
export function decodeZ85(text) {
  if (typeof text !== 'string' || text.length > maximum * 1.25 + 12)
    throw Error('Invalid compact review encoding.');
  const match = /^([1-9]\d{0,5}):(.+)$/.exec(text);
  if (!match) throw Error('Invalid compact review encoding.');
  const length = Number(match[1]),
    encoded = match[2];
  if (length > maximum || encoded.length !== Math.ceil(length / 4) * 5)
    throw Error('Invalid compact review length.');
  const bytes = new Uint8Array(Math.ceil(length / 4) * 4);
  for (let i = 0; i < encoded.length; i += 5) {
    let value = 0;
    for (let j = 0; j < 5; j++) {
      const digit = alphabet.indexOf(encoded[i + j]);
      if (digit < 0) throw Error('Invalid compact review character.');
      value = value * 85 + digit;
    }
    if (value > 0xffffffff) throw Error('Invalid compact review group.');
    for (let j = 3; j >= 0; j--) {
      bytes[(i / 5) * 4 + j] = value % 256;
      value = Math.floor(value / 256);
    }
  }
  if (bytes.subarray(length).some((b) => b !== 0)) throw Error('Invalid compact review padding.');
  return bytes.slice(0, length);
}
