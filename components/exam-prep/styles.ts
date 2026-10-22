// Naija Exam Prep's look (a plain module, so server pages can use these strings too): navy, warm white, green for right and go, gold for the pack. Big tap targets, plain words.
export const C = { navy: "#0F2747", paper: "#FBF8F2", green: "#1E8E5A", gold: "#C9A227", red: "#B3261E" };
export const card = "rounded-2xl border border-[#0F2747]/10 bg-white p-4 shadow-sm";
export const btn = "inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-[15px] font-semibold transition disabled:opacity-50";
export const btnGo = `${btn} bg-[#1E8E5A] text-white hover:bg-[#187a4d]`;
export const btnNavy = `${btn} bg-[#0F2747] text-white hover:bg-[#0b1d36]`;
export const btnLine = `${btn} border border-[#0F2747]/20 bg-white text-[#0F2747] hover:bg-[#0F2747]/5`;
export const btnGold = `${btn} bg-[#C9A227] text-[#0F2747] hover:bg-[#b8931f]`;
export const input = "min-h-[44px] w-full rounded-xl border border-[#0F2747]/20 bg-white px-3 text-[15px] text-[#0F2747] outline-none focus:border-[#1E8E5A]";

// With no connection, a link loads the page in full instead of through Next's router, so the service worker can answer with the
// copy saved with the pack (public/sw.js); the router's own fetch would just fail.
