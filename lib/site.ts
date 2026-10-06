// Company-level identity — distinct from the two founders' personal
// social links in lib/admin.ts. Central place so the domain/handles
// only need updating in one spot.

// The legal entity behind #NotesApp, from the CAC certified extract (2 Sep 2026) and the
// Nigeria Revenue Service tax ID letter (3 Sep 2026). The registered address is on the CAC
// register but is also the director's residence, so it is deliberately not shown on the site.
// `smedanId` stays null until the SMEDAN registration exists; set it and it appears in the
// footer and on /security.
export const COMPANY_INFO = {
  legalName: "NOTESAPP TECHNOLOGIES LTD",
  rcNumber: "9825642",
  registeredOn: "2026-09-02",
  tin: "2623750527563",
  smedanId: null as string | null,
};

// The first reference customers' logos (their profile pictures), shown as small rounded squares beside their names.
export const PARTNER_ICONS = {
  precheks: "https://media.notesapp.name.ng/avatars/Cmz7aPEa6RdkTF8VTZtm44aiUo92/1791174100104-favicon-icon.png",
  apexglitz: "https://media.notesapp.name.ng/avatars/26Ss0mx0scTK00KdErkqov5dKo72/1791215458894-apexjpeg.jpeg",
};

export const SITE = {
  url: "https://www.notesapp.name.ng",
  email: "hello@notesapp.name.ng",
  linkedin: "https://www.linkedin.com/company/na-notesapp",
  facebook: "https://web.facebook.com/na-notesapp",
};
