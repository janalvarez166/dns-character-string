# DNS Character String

Encode and decode the length-prefixed character-string format used in DNS TXT and HINFO records (RFC 1035 §3.3). Each string is one length octet followed by that many opaque bytes.

## Usage

```js
import { encodeCharacterString, decodeCharacterString } from 'dns-character-string';
import { Buffer } from 'node:buffer';

const encoded = encodeCharacterString('v=spf1 include:_spf.example.net -all');
// <Buffer 27 76 3d 73 70 66 31 20 69 6e 63 6c 75 64 65 3a 5f ...>

const { value, next } = decodeCharacterString(encoded, 0);
value.toString('utf8'); // 'v=spf1 include:_spf.example.net -all'
```

## Why this exists

DNS character-strings are length-prefixed on the wire, but most off-the-shelf DNS libraries hand you TXT record data as pre-split strings and hide the framing. If you are constructing or parsing raw record data yourself — for zone-file tooling, custom resolvers, or test vectors — you need the framing back, and you need it for arbitrary bytes, not just printable text.

This library does exactly that and nothing else. It treats every payload as raw bytes (`Buffer`), so a round-trip loses no information and no code point has to survive a UTF-8 detour. String inputs are UTF-8 encoded for convenience; binary payloads are accepted as `Buffer`.

## Edge cases

The length octet caps a single string at 255 bytes; `encodeCharacterString` throws `RangeError` for anything longer. The wire format permits zero-length strings, which this library produces as a single `0x00` byte and decodes as an empty `Buffer`. Decoding reads a slice of the input buffer rather than copying — fine for reading, but mutate the result and you mutate the source.

## Exports

- `encodeCharacterString(input: Buffer | string): Buffer` — prefix a length octet.
- `decodeCharacterString(buf: Buffer, start = 0): { value: Buffer, next: number, length: number }` — read one string starting at `start`; `next` is the offset just past it.

ESM only. Node's `Buffer` from `node:buffer` is the only dependency.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

## Limitations

Values are coerced to floats, so very large integers lose precision. If you need
exact integer aggregates over a window, this is the wrong tool.

