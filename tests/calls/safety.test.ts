// The call safety code (lib/calls.ts): both phones get the same code from the same two certificates, in either order, and a different code
// when one certificate is swapped (someone in the middle). Run: npm run test:calls → "ALL OK".
import assert from "node:assert/strict";
import { safetyCode, sdpFingerprint } from "../../lib/calls";

const sdp = (fp: string) => `v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 ${fp}\r\na=setup:actpass\r\n`;
const A = "4F:2A:91:0C:DE:77:10:5B:AA:01:9E:3C:44:7D:62:F0:81:9A:BB:0E:55:21:C3:7A:6D:90:12:EF:34:56:78:9A";
const B = "0e:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff";
const M = "DE:AD:BE:EF:DE:AD:BE:EF:DE:AD:BE:EF:DE:AD:BE:EF:DE:AD:BE:EF:DE:AD:BE:EF:DE:AD:BE:EF:DE:AD:BE:EF";

(async () => {
  const fa = sdpFingerprint(sdp(A)), fb = sdpFingerprint(sdp(B));
  assert.equal(fa, `SHA-256 ${A}`);
  assert.equal(fb, `SHA-256 ${B.toUpperCase()}`, "case doesn't matter");
  assert.equal(sdpFingerprint("v=0\r\ns=-\r\n"), null);
  assert.equal(sdpFingerprint(undefined), null);

  const onA = await safetyCode(fa!, fb!), onB = await safetyCode(fb!, fa!);
  assert.equal(onA, onB, "both phones show the same code");
  assert.match(onA, /^\d{3} \d{3} \d{3} \d{3}$/);
  // Someone in the middle: each phone sees the attacker's certificate instead of the other person's.
  const fm = sdpFingerprint(sdp(M))!;
  assert.notEqual(await safetyCode(fa!, fm), await safetyCode(fb!, fm), "a swapped certificate shows different codes");
  assert.notEqual(await safetyCode(fa!, fm), onA);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
