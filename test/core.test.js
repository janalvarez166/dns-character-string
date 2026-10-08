import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

import {
  encodeCharacterString,
  decodeCharacterString,
} from '../src/index.js';

const { deepStrictEqual, throws, ok, strictEqual } = assert;

test('encodeCharacterString: encodes an empty string as a single length octet', () => {
  deepStrictEqual(encodeCharacterString(''), Buffer.from([0]));
});

test('encodeCharacterString: encodes a short ASCII string with a length prefix', () => {
  const input = 'hello';
  const buf = encodeCharacterString(input);
  const expected = Buffer.from([5, 104, 101, 108, 108, 111]);
  deepStrictEqual(buf, expected);
});

test('encodeCharacterString: encodes a Buffer input verbatim, no re-encoding', () => {
  const payload = Buffer.from([0xff, 0x00, 0x7f]);
  deepStrictEqual(encodeCharacterString(payload), Buffer.from([3, 0xff, 0x00, 0x7f]));
});

test('encodeCharacterString: encodes a 255-byte payload, the maximum length', () => {
  const payload = Buffer.alloc(255, 0x41);
  const encoded = encodeCharacterString(payload);
  strictEqual(encoded.length, 256);
  strictEqual(encoded[0], 255);
  strictEqual(encoded[255], 0x41);
});

test('encodeCharacterString: rejects a payload longer than 255 bytes', () => {
  const tooLong = Buffer.alloc(256, 0x41);
  throws(() => encodeCharacterString(tooLong), RangeError);
});

test('encodeCharacterString: rejects non-Buffer, non-string input', () => {
  throws(() => encodeCharacterString(42), TypeError);
  throws(() => encodeCharacterString(null), TypeError);
});

test('decodeCharacterString: decodes a length-prefixed string at offset 0', () => {
  const encoded = Buffer.from([5, 104, 101, 108, 108, 111]);
  const result = decodeCharacterString(encoded);
  deepStrictEqual(result.value, Buffer.from('hello', 'utf8'));
  strictEqual(result.next, 6);
  strictEqual(result.length, 5);
});

test('decodeCharacterString: decodes an empty character-string', () => {
  const result = decodeCharacterString(Buffer.from([0]));
  strictEqual(result.value.length, 0);
  strictEqual(result.next, 1);
  strictEqual(result.length, 0);
});

test('decodeCharacterString: decodes a string at a non-zero offset', () => {
  const buf = Buffer.from([0xff, 0xff, 4, 119, 111, 114, 107]);
  const result = decodeCharacterString(buf, 2);
  deepStrictEqual(result.value, Buffer.from('work', 'utf8'));
  strictEqual(result.next, 7);
  strictEqual(result.length, 4);
});

test('decodeCharacterString: decodes arbitrary non-ASCII bytes without re-encoding', () => {
  const encoded = Buffer.from([3, 0xff, 0x00, 0x7f]);
  const result = decodeCharacterString(encoded);
  deepStrictEqual(result.value, Buffer.from([0xff, 0x00, 0x7f]));
});

test('decodeCharacterString: rejects a length octet beyond the buffer', () => {
  throws(() => decodeCharacterString(Buffer.from([]), 0), RangeError);
});

test('decodeCharacterString: rejects a payload that runs past the buffer end', () => {
  // length says 5 but only 2 payload bytes follow
  const truncated = Buffer.from([5, 1, 2]);
  throws(() => decodeCharacterString(truncated), RangeError);
});

test('decodeCharacterString: rejects a negative start offset', () => {
  throws(() => decodeCharacterString(Buffer.from([0]), -1), RangeError);
});

test('decodeCharacterString: rejects non-Buffer input', () => {
  throws(() => decodeCharacterString([0]), TypeError);
});

test('round-trip: encode then decode recovers the original payload bytes', () => {
  const payload = Buffer.from([0, 1, 2, 0xff, 0xfe, 0x7f, 0x80]);
  const encoded = encodeCharacterString(payload);
  const decoded = decodeCharacterString(encoded);
  deepStrictEqual(decoded.value, payload);
});

test('round-trip: concatening two encoded strings and decoding both in sequence', () => {
  const a = encodeCharacterString('cpu');
  const b = encodeCharacterString('os');
  const combined = Buffer.concat([a, b]);
  const first = decodeCharacterString(combined, 0);
  const second = decodeCharacterString(combined, first.next);
  ok(first.value.equals(Buffer.from('cpu', 'utf8')));
  ok(second.value.equals(Buffer.from('os', 'utf8')));
  strictEqual(second.next, combined.length);
});
