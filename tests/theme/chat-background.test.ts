// A member's own chat background (lib/chat-background.ts): what may be saved, and who may choose.
// Run: npm run test:theme
import assert from "node:assert/strict";
import { CHAT_COLOURS, canChooseChatBackground, chatBackgroundStyle, chatPicturePrefix, cleanChatBackground } from "../../lib/chat-background";

const prefix = chatPicturePrefix("https://media.notesapp.name.ng/", "u1");
assert.equal(prefix, "https://media.notesapp.name.ng/chatbg/u1/");
assert.deepEqual(cleanChatBackground({ kind: "pattern" }), { kind: "pattern" });
assert.deepEqual(cleanChatBackground({ kind: "plain", extra: 1 }), { kind: "plain" }, "extra fields are dropped");
assert.deepEqual(cleanChatBackground({ kind: "colour", id: "kente" }), { kind: "colour", id: "kente" });
assert.equal(cleanChatBackground({ kind: "colour", id: "#ff0000" }), null, "only our colours");
assert.deepEqual(cleanChatBackground({ kind: "picture", url: `${prefix}1-bg.webp` }, prefix), { kind: "picture", url: `${prefix}1-bg.webp` });
assert.equal(cleanChatBackground({ kind: "picture", url: "https://media.notesapp.name.ng/chatbg/someone-else/x.webp" }, prefix), null, "only your own pictures");
assert.equal(cleanChatBackground({ kind: "picture", url: "https://evil.example/x.webp" }, prefix), null);
assert.equal(cleanChatBackground({ kind: "picture", url: `${prefix}x.webp") , url("https://evil` }, prefix), null, "nothing that breaks out of the CSS");
assert.equal(cleanChatBackground({ kind: "nope" }), null);
assert.equal(cleanChatBackground("pattern"), null);

for (const t of ["pro", "business", "enterprise"] as const) assert.ok(canChooseChatBackground(t), `${t} chooses`);
for (const t of ["standard", "basic", undefined] as const) assert.ok(!canChooseChatBackground(t), `${t ?? "signed out"} doesn't`);

assert.equal(chatBackgroundStyle({ kind: "pattern" }, false).className, "na-pattern");
assert.equal(chatBackgroundStyle({ kind: "colour", id: "adire" }, true).style?.backgroundColor, CHAT_COLOURS.find((c) => c.id === "adire")!.night, "Night shade at night");
assert.match(chatBackgroundStyle({ kind: "picture", url: `${prefix}a.webp` }, true).style!.backgroundImage, /rgba\(30, 4, 14, 0\.55\).*a\.webp/, "a dark wash at night");
console.log("CHAT BACKGROUND OK");
