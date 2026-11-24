// The same card as ./opengraph-image.tsx, for X (summary_large_image). Next reads these settings from each file, so they're repeated here.
import Image from "./opengraph-image";
import { CARD_SIZE } from "@/lib/arcade/tournament-card";

export const runtime = "nodejs";
export const revalidate = 300;
export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "A Notes Arcade tournament";
export default Image;
