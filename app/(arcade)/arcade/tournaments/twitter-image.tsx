// The same card as ./opengraph-image.tsx, for X (summary_large_image). Next reads these settings from each file, so they're repeated here.
import Image from "./opengraph-image";
import { CARD_SIZE } from "@/lib/arcade/tournament-card";

export const runtime = "nodejs";
export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "Notes Arcade tournaments: same deal for everyone, best player wins";
export default Image;
