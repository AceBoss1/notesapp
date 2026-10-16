import { describeUntil } from "./suspension-length";

// The words of the bells moderation sends (app/api/admin/notify builds them on the server from what is stored).
export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  staff: "Staff (in-house writer)",
  volunteer: "Volunteer (contributing writer)",
  reader: "Reader",
};
export const moderationMessage = {
  suspended: (reason: string, until?: string) => `Your account was suspended ${describeUntil(until)}: ${reason}`,
  unsuspended: (viaAppeal: boolean) => (viaAppeal ? "Your appeal was upheld — your account is active again." : "Your account is active again."),
  appealRejected: () => "Your appeal wasn't upheld — your account remains suspended.",
  roleChanged: (role: string) => `Your role was changed to ${ROLE_LABEL[role] ?? role}.`,
  tierDecision: (approved: boolean) =>
    approved
      ? "Your Free Basic application was approved — you can now publish. Set your rates and payouts under Rates & payouts."
      : "Your Free Basic application wasn't approved this time. You can reapply, or choose Pro or Business.",
};
