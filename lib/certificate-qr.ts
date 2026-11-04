import QRCode from "qrcode";

// The QR code on a certificate or a receipt, as SVG: in the certificate's crimson, error correction high so the "na" mark in the middle
// doesn't stop it scanning. Used on the server (verification, receipt and print pages) and in the browser (previews).
//
// The dark modules are drawn as filled rectangles (one per run of dark modules in a row), not as the 1-unit-wide lines the qrcode
// package draws: phone print engines (Save as PDF on Android) and phone PDF viewers can draw those lines too thin, so a printed code
// came out as faint pink stripes that wouldn't scan while the same code looked fine on screen.
export const QR_DARK = "#7A0328";

export function qrSvgSync(url: string, dark = QR_DARK): string {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = modules.size, m = 1, size = n + 2 * m;
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; ) {
      if (!modules.get(y, x)) { x++; continue; }
      let w = 1;
      while (x + w < n && modules.get(y, x + w)) w++;
      d += `M${x + m} ${y + m}h${w}v1h-${w}z`;
      x += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" shape-rendering="crispEdges" style="print-color-adjust:exact;-webkit-print-color-adjust:exact"><path fill="#ffffff" d="M0 0h${size}v${size}H0z"/><path fill="${dark}" d="${d}"/></svg>`;
}

export const qrSvg = async (url: string) => qrSvgSync(url);
