import { Buffer } from 'node:buffer';

// DNS character-strings (RFC 1035 §3.3.14 and §3.3.2) are a single length octet
// followed by that many opaque bytes. The content is arbitrary bytes; TXT records
// commonly carry ASCII key=value pairs but the wire format does not constrain that,
// and HINFO's first string historically carries an arbitrary CPU label. This library
// treats every string as a raw Buffer so no information is lost through an encoding
// round-trip. Callers who want text can call .toString() on the Buffer themselves.

/**
 * Minimum and maximum length (in bytes) of the character-string payload, as
 * imposed by the single length-octet wire format (RFC 1035 §3.3).
 */
export const MIN_LENGTH = 0;
export const MAX_LENGTH = 255;

/**
 * Encode an arbitrary byte payload into a DNS character-string: one length octet
 * followed by the payload bytes.
 *
 * @param {Buffer|string} input - The payload. A string is interpreted as UTF-8,
 *   which preserves bytes for ASCII input and round-trips for arbitrary Unicode.
 * @returns {Buffer} A Buffer of length `input.length + 1`: the length octet then
 *   the payload.
 * @throws {TypeError} If `input` is not a Buffer or a string.
 * @throws {RangeError} If the payload exceeds 255 bytes (a single length octet
 *   cannot express more).
 */
export function encodeCharacterString(input) {
  const payload = typeof input === 'string'
    ? Buffer.from(input, 'utf8')
    : Buffer.isBuffer(input)
      ? input
      : null;
  if (payload === null) {
    throw new TypeError('input must be a Buffer or a string');
  }
  if (payload.length > MAX_LENGTH) {
    throw new RangeError(`character-string payload exceeds 255 bytes (got ${payload.length})`);
  }
  const out = Buffer.allocUnsafe(payload.length + 1);
  out[0] = payload.length;
  payload.copy(out, 1);
  return out;
}

/**
 * Decode a DNS character-string starting at offset `start` in `buf`.
 *
 * Returns the decoded payload Buffer, the offset just past the string, and the
 * string's length — enough for a caller to advance through a TXT record that
 * concatenates several character-strings end to end.
 *
 * @param {Buffer} buf - The buffer holding the length-prefixed string.
 * @param {number} [start=0] - Offset of the length octet within `buf`.
 * @returns {{value: Buffer, next: number, length: number}}
 *   - value: the payload bytes (a slice, not a copy; mutate at your own risk)
 *   - next: the offset in `buf` immediately following the string
 *   - length: the decoded payload length in bytes
 * @throws {TypeError} If `buf` is not a Buffer or `start` is not a safe integer.
 * @throws {RangeError} If `start` is negative, the length octet sits beyond the
 *   buffer, or the payload runs past the buffer's end.
 */
export function decodeCharacterString(buf, start = 0) {
  if (!Buffer.isBuffer(buf)) {
    throw new TypeError('buf must be a Buffer');
  }
  if (!Number.isSafeInteger(start)) {
    throw new TypeError('start must be a safe integer');
  }
  if (start < 0) {
    throw new RangeError('start must be non-negative');
  }
  if (start >= buf.length) {
    throw new RangeError(`start (${start}) is beyond buffer end (${buf.length})`);
  }
  const len = buf[start];
  const valueStart = start + 1;
  const valueEnd = valueStart + len;
  if (valueEnd > buf.length) {
    throw new RangeError(`character-string payload of ${len} bytes at offset ${valueStart} runs past buffer end (${buf.length})`);
  }
  return {
    value: buf.subarray(valueStart, valueEnd),
    next: valueEnd,
    length: len,
  };
}
