// Sessions in person or online (lib/booking-time.ts sessionModes / sessionPlace / sessionPlaceText). Pure.
import assert from "node:assert/strict";
import { sessionModes, sessionPlace, sessionPlaceText } from "../../lib/booking-time";
import type { Where } from "../../lib/event-kit";

const inPerson: Where = { format: "in_person", place: "12 Allen Avenue", city: "Ikeja", state: "Lagos", online: "", link: "" };
const onlineCall: Where = { format: "online", place: "", city: "", state: "", online: "notesapp", link: "" };
const onlineLink: Where = { format: "online", place: "", city: "", state: "", online: "link", link: "https://zoom.us/j/9" };
const either: Where = { ...inPerson, format: "hybrid", online: "link", link: "https://meet.google.com/x" };

assert.deepEqual(sessionModes(undefined), []);
assert.deepEqual(sessionModes(inPerson), ["in_person"]);
assert.deepEqual(sessionModes(onlineCall), ["online"]);
assert.deepEqual(sessionModes(either), ["in_person", "online"]);

assert.equal(sessionPlace(undefined, "online"), undefined, "a publisher who hasn't said: nothing on the booking");
assert.deepEqual(sessionPlace(inPerson, undefined), { mode: "in_person", place: "12 Allen Avenue", city: "Ikeja", state: "Lagos" });
assert.deepEqual(sessionPlace(inPerson, "online"), { mode: "in_person", place: "12 Allen Avenue", city: "Ikeja", state: "Lagos" }, "one mode: the client's pick doesn't matter");
assert.deepEqual(sessionPlace(onlineCall, undefined), { mode: "online", online: "notesapp" });
assert.deepEqual(sessionPlace(onlineLink, undefined), { mode: "online", online: "link", link: "https://zoom.us/j/9" });
assert.equal(sessionPlace(either, undefined), null, "both offered: the client must choose");
assert.equal(sessionPlace(either, "nonsense"), null);
assert.deepEqual(sessionPlace(either, "online"), { mode: "online", online: "link", link: "https://meet.google.com/x" });
assert.equal(sessionPlace(either, "in_person")!.mode, "in_person");

assert.equal(sessionPlaceText(sessionPlace(inPerson, undefined)!), "In person: 12 Allen Avenue, Ikeja, Lagos");
assert.match(sessionPlaceText(sessionPlace(onlineCall, undefined)!), /call on #NotesApp/);
assert.equal(sessionPlaceText(sessionPlace(onlineLink, undefined)!), "Online: https://zoom.us/j/9");
assert.equal(sessionPlaceText(undefined), "");
console.log("ALL OK");
