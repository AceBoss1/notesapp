// A stable id for this browser (view-only purchases work on 2 devices). Kept in localStorage; if storage is blocked we fall
// back to a per-tab id, which just means that tab counts as a new device each visit.
const KEY = "na_device_id";
let memory = "";

export function getDeviceId(): string {
  try {
    const s = localStorage.getItem(KEY);
    if (s && /^[A-Za-z0-9-]{16,64}$/.test(s)) return s;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return (memory ||= crypto.randomUUID());
  }
}

export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}
