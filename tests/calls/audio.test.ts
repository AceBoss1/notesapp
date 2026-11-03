// Where a call's sound plays (lib/call-audio.ts): voice on the earpiece, video on the speaker, headphones and Bluetooth taking over,
// the person's own choice kept, and the device lists labelled. Run: npm run test:calls → "ALL OK" (once per test file).
import assert from "node:assert/strict";
import { ANDROID_NOTE, IPHONE_NOTE, NO_ROUTE_NOTE, audioChoices, chooseMic, chooseRoute, deviceLabel, micConstraints, platformOf, readSoundPrefs, type Caps, type Dev } from "../../lib/call-audio";

const caps = (platform: Caps["platform"], o: Partial<Caps> = {}): Caps => ({ platform, audioSession: false, setSinkId: false, selectAudioOutput: false, ...o });
const keys = (r: { key: string }[]) => r.map((x) => x.key);

// Platforms.
assert.equal(platformOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1"), "iphone");
assert.equal(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15", 5), "ipad", "iPadOS asks for the desktop site");
assert.equal(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15", 0), "desktop");
assert.equal(platformOf("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36"), "android");
assert.equal(platformOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36"), "desktop");

// The microphone: echo cancellation on (Android call mode), an exact device only when one is chosen.
assert.deepEqual(micConstraints(), { echoCancellation: true, noiseSuppression: true, autoGainControl: true });
assert.deepEqual(micConstraints("default"), { echoCancellation: true, noiseSuppression: true, autoGainControl: true });
assert.deepEqual(micConstraints("abc").deviceId, { exact: "abc" });

// Labels.
assert.equal(deviceLabel({ kind: "audiooutput", deviceId: "default", label: "Default - MacBook Pro Speakers (Built-in)" }, 0, "Speaker"), "System default (MacBook Pro Speakers)");
assert.equal(deviceLabel({ kind: "audiooutput", deviceId: "default", label: "" }, 0, "Speaker"), "System default");
assert.equal(deviceLabel({ kind: "audiooutput", deviceId: "x1", label: "" }, 1, "Speaker"), "Speaker 2", "no permission yet: numbered");
assert.equal(deviceLabel({ kind: "audioinput", deviceId: "x2", label: "Jabra Evolve (0b0e:0300)" }, 0, "Microphone"), "Jabra Evolve");

// iPhone with navigator.audioSession: earpiece (play-and-record) and speaker (auto).
const iphone = audioChoices([], caps("iphone", { audioSession: true }));
assert.deepEqual(iphone.routes.map((r) => [r.kind, r.session]), [["earpiece", "play-and-record"], ["speaker", "auto"]]);
assert.equal(iphone.note, IPHONE_NOTE);
assert.equal(chooseRoute({ kind: "audio", routes: iphone.routes })?.session, "play-and-record", "voice → earpiece");
assert.equal(chooseRoute({ kind: "video", routes: iphone.routes })?.session, "auto", "video → speaker");
assert.equal(chooseRoute({ kind: "audio", routes: iphone.routes, remembered: { key: "session:speaker", kind: "speaker", label: "Speaker" } })?.kind, "speaker", "remembered");
// Older iPhone (no audioSession) and iPad: nothing to choose.
assert.deepEqual(audioChoices([], caps("iphone")).routes, []);
assert.deepEqual(audioChoices([], caps("ipad", { audioSession: true })).routes, []);
assert.equal(chooseRoute({ kind: "audio", routes: [] }), null);

// Android Chrome: the call routes are in the microphone list, and the sound follows the microphone.
const androidDevs: Dev[] = [
  { kind: "audioinput", deviceId: "default", label: "" },
  { kind: "audioinput", deviceId: "s1", label: "Speakerphone" },
  { kind: "audioinput", deviceId: "e1", label: "Headset earpiece" },
  { kind: "audiooutput", deviceId: "default", label: "" },
];
const android = audioChoices(androidDevs, caps("android", { setSinkId: true }));
assert.deepEqual(android.routes.map((r) => [r.kind, r.label, r.via, r.deviceId]), [["earpiece", "Earpiece", "input", "e1"], ["speaker", "Speaker", "input", "s1"]]);
assert.equal(android.micFollowsRoute, true);
assert.deepEqual(android.mics, [], "no separate microphone list: it would fight the route");
assert.equal(android.note, ANDROID_NOTE);
assert.equal(chooseRoute({ kind: "audio", routes: android.routes })?.deviceId, "e1", "voice → earpiece");
assert.equal(chooseRoute({ kind: "video", routes: android.routes })?.deviceId, "s1", "video → speaker");
// Headphones plugged in mid-call: they take over, even over a remembered speaker...
const plugged = audioChoices([...androidDevs, { kind: "audioinput", deviceId: "w1", label: "Wired headset" }, { kind: "audioinput", deviceId: "b1", label: "Bluetooth headset" }], caps("android"));
assert.deepEqual(plugged.routes.map((r) => r.kind), ["earpiece", "speaker", "headphones", "bluetooth"]);
assert.equal(chooseRoute({ kind: "audio", routes: plugged.routes })?.kind, "headphones");
assert.equal(chooseRoute({ kind: "video", routes: plugged.routes, remembered: { key: "input:s1", kind: "speaker", label: "Speaker" } })?.kind, "headphones");
// ...but not over something picked during this call, and a remembered headset wins over another one.
assert.equal(chooseRoute({ kind: "audio", routes: plugged.routes, picked: android.routes[1] })?.kind, "speaker");
assert.equal(chooseRoute({ kind: "audio", routes: plugged.routes, remembered: { key: "input:b1", kind: "bluetooth", label: "Bluetooth" } })?.kind, "bluetooth");
// The pick goes away (Bluetooth switched off): back to the default for the call.
assert.equal(chooseRoute({ kind: "audio", routes: android.routes, picked: plugged.routes[3] })?.kind, "earpiece");
// Android browser without Chrome's route names: nothing to choose, and it says so.
const other = audioChoices([{ kind: "audioinput", deviceId: "default", label: "" }, { kind: "audiooutput", deviceId: "default", label: "" }], caps("android", { setSinkId: true }));
assert.deepEqual(other.routes, []);
assert.equal(other.note, NO_ROUTE_NOTE);

// Computers: speakers by setSinkId, microphones on their own; "communications" (Windows) left out.
const pc: Dev[] = [
  { kind: "audioinput", deviceId: "default", label: "Default - Built-in Microphone" },
  { kind: "audioinput", deviceId: "communications", label: "Communications - Built-in Microphone" },
  { kind: "audioinput", deviceId: "m2", label: "Jabra Evolve (0b0e:0300)" },
  { kind: "audiooutput", deviceId: "default", label: "Default - Speakers" },
  { kind: "audiooutput", deviceId: "communications", label: "Communications - Speakers" },
  { kind: "audiooutput", deviceId: "o2", label: "Jabra Evolve (0b0e:0300)" },
];
const desk = audioChoices(pc, caps("desktop", { setSinkId: true }));
assert.deepEqual(keys(desk.routes), ["sink:default", "sink:o2"]);
assert.deepEqual(desk.routes.map((r) => [r.kind, r.label, r.deviceId]), [["default", "System default (Speakers)", ""], ["device", "Jabra Evolve", "o2"]]);
assert.deepEqual(desk.mics.map((m) => m.label), ["System default (Built-in Microphone)", "Jabra Evolve"]);
assert.equal(chooseRoute({ kind: "audio", routes: desk.routes }), null, "computers: the system default, voice or video");
assert.equal(chooseRoute({ kind: "audio", routes: desk.routes, remembered: { key: "sink:o2", kind: "device", label: "Jabra Evolve" } })?.deviceId, "o2");
assert.equal(chooseRoute({ kind: "audio", routes: desk.routes, remembered: { key: "sink:gone", kind: "device", label: "Jabra Evolve" } })?.deviceId, "o2", "same name, new id");
// Without setSinkId there's no speaker choice; Firefox lists speakers only after selectAudioOutput.
assert.deepEqual(audioChoices(pc, caps("desktop")).routes, []);
const ff = audioChoices([{ kind: "audioinput", deviceId: "a", label: "Mic" }], caps("desktop", { setSinkId: true, selectAudioOutput: true }));
assert.deepEqual(ff.routes.map((r) => r.kind), ["default", "pick"]);
assert.equal(chooseRoute({ kind: "audio", routes: ff.routes }), null, "the picker itself is never chosen");
assert.deepEqual(ff.mics, [], "one microphone: no choice");

// Microphones.
assert.equal(chooseMic(desk.mics, { deviceId: "m2", label: "Jabra Evolve" }), "m2");
assert.equal(chooseMic(desk.mics, { deviceId: "old", label: "Jabra Evolve" }), "m2");
assert.equal(chooseMic(desk.mics, { deviceId: "gone", label: "Gone" }), "", "unplugged: system default");
assert.equal(chooseMic(desk.mics, null), "");

// Remembered on this device.
assert.deepEqual(readSoundPrefs(null), {});
assert.deepEqual(readSoundPrefs("{oops"), {});
assert.deepEqual(readSoundPrefs(JSON.stringify({ audio: { key: "session:speaker", kind: "speaker", label: "Speaker" }, video: 3, mic: { deviceId: "m2", label: "J" } })),
  { audio: { key: "session:speaker", kind: "speaker", label: "Speaker" }, mic: { deviceId: "m2", label: "J" } });

console.log("ALL OK");
