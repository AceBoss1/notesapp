import assert from "node:assert/strict";
import { cleanSocial, socialHref } from "../../lib/social-links";

// What members type in Edit profile → the link their profile shows.
assert.equal(socialHref("linkedin", "https://www.linkedin.com/in/ada"), "https://www.linkedin.com/in/ada");
assert.equal(socialHref("linkedin", "linkedin.com/in/ada"), "https://linkedin.com/in/ada");
assert.equal(socialHref("linkedin", "in/ada-okafor"), "https://www.linkedin.com/in/ada-okafor");
assert.equal(socialHref("twitter", "@ada_writes"), "https://x.com/ada_writes");
assert.equal(socialHref("instagram", "ada.okafor"), "https://instagram.com/ada.okafor");
assert.equal(socialHref("tiktok", "@ada"), "https://www.tiktok.com/@ada");
assert.equal(socialHref("facebook", "http://facebook.com/ada"), "https://facebook.com/ada");
assert.equal(socialHref("website", "adams.com.ng"), "https://adams.com.ng");
assert.equal(socialHref("whatsapp", "0803 123 4567"), "https://wa.me/2348031234567");
assert.equal(socialHref("whatsapp", "+234 803-123-4567"), "https://wa.me/2348031234567");
assert.equal(socialHref("whatsapp", "https://wa.me/2348031234567"), "https://wa.me/2348031234567");
// Never a link: empty, nonsense, other schemes.
assert.equal(socialHref("website", ""), null);
assert.equal(socialHref("website", "javascript:alert(1)"), null);
assert.equal(socialHref("website", "my website"), null);
assert.equal(socialHref("whatsapp", "call me"), null);
assert.deepEqual(cleanSocial({ twitter: "@ada", website: "not a link", instagram: "" }), { clean: { twitter: "https://x.com/ada" }, unreadable: ["website"] });
console.log("ALL OK");
