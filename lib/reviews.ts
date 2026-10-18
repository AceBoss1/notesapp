// Store and course reviews, and profile recommendations, in plain rules. Pure: no database here (see lib/reviews-server.ts).
export class ReviewError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const REVIEW_MAX = 600;
export const REPLY_MAX = 400;
export const RECOMMENDATION_MAX = 800;
export const MIN_TEXT = 10;

// A review of a store item, or of a course (lib/course-social-server.ts: itemId is then the course's id and ownerUid its teacher).
export type Review = {
  id: string;
  itemId: string;
  itemTitle: string;
  ownerUid: string;
  uid: string;
  name: string;
  username: string;
  avatar: string;
  rating: number; // 1 to 5
  text: string;
  createdAt: string;
  updatedAt?: string;
  reply?: { text: string; at: string };
  verified?: boolean; // shown with the panel's badge ("Bought it", "Finished the course"); every store review is a verified purchase
};
export type RatingSummary = { count: number; average: number }; // average to one decimal, 0 when there are none

export const summarise = (sum: number, count: number): RatingSummary => ({ count, average: count > 0 ? Math.round((sum / count) * 10) / 10 : 0 });
// How many gave 1, 2, 3, 4 and 5 stars (index 0 is one star).
export function breakdownOf(ratings: number[]): number[] {
  const b = [0, 0, 0, 0, 0];
  for (const r of ratings) { const n = Math.round(r); if (n >= 1 && n <= 5) b[n - 1]++; }
  return b;
}
export const summaryOf = (ratings: number[]): RatingSummary => summarise(ratings.reduce((s, r) => s + r, 0), ratings.length);

const clip = (v: unknown, max: number) => String(v ?? "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

// A rating from 1 to 5 and a few words (or none: a rating alone is fine).
export function cleanReview(input: { rating?: unknown; text?: unknown }): { rating: number; text: string } {
  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new ReviewError("Choose 1 to 5 stars.");
  const text = clip(input.text, REVIEW_MAX);
  if (text && text.length < MIN_TEXT) throw new ReviewError(`Say a little more, at least ${MIN_TEXT} characters, or leave the comment empty.`);
  return { rating, text };
}
export function cleanReply(text: unknown): string {
  const t = clip(text, REPLY_MAX);
  if (t.length < 2) throw new ReviewError("Write your reply.");
  return t;
}

export type RecommendationStatus = "pending" | "approved" | "hidden";
export const RELATIONSHIPS = ["Worked with them", "Bought from them", "Learned from them", "Booked a session", "Read their journal", "Know them personally"] as const;
export type Recommendation = {
  id: string;
  authorUid: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  authorIsOrg: boolean;
  subjectUid: string;
  relationship: string;
  rating?: number; // 1 to 5; recommendations written before stars have none
  text: string;
  status: RecommendationStatus;
  createdAt: string;
  updatedAt?: string;
};
export function cleanRecommendation(input: { relationship?: unknown; rating?: unknown; text?: unknown }): { relationship: string; rating: number; text: string } {
  const relationship = RELATIONSHIPS.find((r) => r === input.relationship) ?? "";
  if (!relationship) throw new ReviewError("Say how you know them.");
  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new ReviewError("Give them 1 to 5 stars.");
  const text = clip(input.text, RECOMMENDATION_MAX);
  if (text.length < 20) throw new ReviewError("Write at least a couple of sentences (20 characters).");
  return { relationship, rating, text };
}
// The stars over a profile's approved recommendations (those written before stars count in the number, not the average).
export const recommendationSummary = (approved: { rating?: number }[]): RatingSummary & { total: number } =>
  ({ ...summaryOf(approved.map((r) => Number(r.rating)).filter((n) => n >= 1 && n <= 5)), total: approved.length });
export const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
