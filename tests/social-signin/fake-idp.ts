// A stand-in LinkedIn for the tests: an RSA key published as a JWKS, and ID tokens signed with it (or with a key LinkedIn doesn't publish).
import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import type { Jwk } from "../../lib/social-oidc";

const pair = () => generateKeyPairSync("rsa", { modulusLength: 2048 });
export const good = pair();
export const rogue = pair();
export const KID = "test-key-1";
export const jwks = (kid = KID): Jwk[] => [{ ...(good.publicKey.export({ format: "jwk" }) as Jwk), kid, alg: "RS256", use: "sig" }];

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function sign(claims: Record<string, unknown>, o: { key?: KeyObject; kid?: string; alg?: string } = {}): string {
  const head = enc({ alg: o.alg ?? "RS256", kid: o.kid ?? KID, typ: "JWT" });
  const body = enc(claims);
  const s = createSign("RSA-SHA256");
  s.update(`${head}.${body}`);
  return `${head}.${body}.${s.sign(o.key ?? good.privateKey).toString("base64url")}`;
}
