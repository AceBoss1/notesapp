import QRCode from "qrcode";

// The QR code on a certificate, as SVG: in the certificate's crimson, error correction high so the "na" mark in the middle doesn't
// stop it scanning. Used on the server (verification and print pages) and in the browser (previews).
export const qrSvg = (url: string) => QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H", margin: 1, color: { dark: "#7A0328", light: "#ffffff" } });
