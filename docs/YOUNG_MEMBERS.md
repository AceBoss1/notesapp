# Young members: teen mode, kids mode and turning 18

Decided by the founder on 22 October 2026, after Naija Exam Prep (v0.79.0). The aim is to keep students by being useful to them,
and to become their account for adult life at 18 by asking them, never by default. Nothing collected while they're young is
reused for an adult purpose without their own consent. The team hub items are in `lib/team-seed.ts` (`PREP_YOUNG_BACKLOG`),
seeded once when a super admin opens the hub.

## What the law expects

- **NDPA 2023, section 31.** A child's data needs a parent's or guardian's consent and a reasonable check of age. The Act
  doesn't fix the age; the GAID guidance treats under-18s as children. For under-13s (kids mode) consent comes **before** use.
- **Purpose limitation and minimisation.** Data kept to help a child practise isn't reused for marketing or profiling an adult
  without fresh consent. The account can carry on; its contents aren't silently repurposed.
- **Elsewhere.** If we reach the US, under-13s need verified parental consent (COPPA). The UK and EU expect age-appropriate
  design: private by default, no nudging, no profiling. We build to that bar now.
- **Contracts with minors.** A minor can usually walk away from a contract, so paid things stay small, refundable and visible
  to the parent (the pack: ₦1,000, 7-day refund).

Legal checks these points (team hub, Legal & compliance): the Terms clause, the Privacy Policy section, a DPO contact, a
"How we treat young members" page and a data agreement for schools.

## The three modes

| | Kids mode (under 13) | Teen mode (13 to 17) | Adult (18+) |
|---|---|---|---|
| Who opens the account | A parent, who owns it | The student; a parent confirms by email | The member |
| People search and directory | Hidden | Hidden | Their choice |
| Messages and group invites | None | Only from people they follow | Anyone (their settings) |
| Comments and moments | Off | Replies only from people they follow (to build) | Their settings |
| Board and public name | Nickname only | Nickname only | Their choice |
| Ads, offers, newsletters | Never | Never to the student; anything goes to the parent | Opt in |
| Paying | The parent | Allowed, refundable, parent told | Normal |

Teen mode is built (v0.79.0: `users.teen`, `prepTeens`, `serverPublicUsers`, `sendMessage`, `checkAddable`). Kids mode and
teen mode on Moments are next.

## Turning 18 (the graduation flow, to build)

1. The birth year (or date) is kept on the server at sign-up in kids or teen mode, never shown.
2. On the 18th birthday, a one-time **"You're 18 now"** screen. The student switches on what they want: appearing in search,
   open messages, a public profile, their real name on the board, NotesApp newsletters and offers. Everything stays off until
   they tick it.
3. They give **their own consent** to the Terms and Privacy Policy: the basis for any adult use from then on, separate from the
   parent's.
4. A **fresh start** if they want one: export or delete their childhood data, keeping progress and certificates.
5. The parent is told the account is now the student's, and is unlinked.
6. Then the case on merit: exam history carried over, a free Pro trial, Academy courses for university and a first job, a
   portfolio site, the CardTap wallet.

## While they're young

- No targeted ads, no data sales, no growth emails to the child; anything promotional goes to the parent.
- No streaks or patterns built to hook them. The effort board counts practice, capped at 300 a day.
- Schools sign a data agreement before access codes and class boards (next Exam Prep release).
- A short public page, "How we treat young members", with the DPO contact.
