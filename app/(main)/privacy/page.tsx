import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL_CONTACT, LEGAL_VERSION } from "@/lib/legal";
import { COMPANY_INFO } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="prose mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Version {LEGAL_VERSION}</p>
      <h1>Privacy Policy</h1>
      <h2>What we collect</h2>
      <p>Account details (name, username, email, avatar, bio, social links and, only if you choose to add them, what you do, your role and where you work, which appear on your public profile and which we also count, without names, to understand who our members are), content you publish and comments you write, bookings and payment references, payout bank details for publishers (the account name, bank and last four digits, a payment-provider recipient code and, so that a payout can be sent, the full account number, which we keep encrypted and readable only by our server), and basic technical data needed to run the site. If you apply for an identity-checked gold badge we record only your application, the deposit payment and the outcome of the check (passed, failed or pending) with a reference number — not your ID number, ID photo, selfie or CAC documents. Once Moments and direct messages are available to you, we also hold the moments you share (the picture, video or text, when it was shared and when it expires), who liked, viewed or reshared them, and the direct messages you send and receive (their text, any files attached, who they are between, when they were sent and when they were read), your message settings and, if you turn on notifications on a device, an identifier for that device that lets us send it a notification. In group chats we also hold the group's name, who is in it and who its admins are, and the messages, files, voice notes and stickers sent in it with who wrote each one. If you connect a LinkedIn or X account so that you can share your posts there, we hold the name or handle of that account, the permission the network gives us to post for you (kept encrypted and readable only by our server), when you connected and when it expires, and a record of which of your posts we shared there and when.</p>

      <h2>Why we use it</h2>
      <p>To run your account, deliver bookings and subscriptions, process payments and payouts, send confirmations and reminders, keep the platform safe, and meet legal obligations. Our legal bases are performing our contract with you, our legitimate interests in security and fraud prevention, and your consent where required.</p>

      <h2>Who processes it for us</h2>
      <p>Google Firebase (accounts and database), Cloudflare (media storage, including the private storage used for paid digital downloads, and Cloudflare Stream, which hosts the video lessons of view-only courses). For view-only purchases we also keep a random identifier for each browser you open them on, with its browser and system type and when it was last used, to enforce the two-device limit, Paystack and Paylony (payments, virtual accounts and payouts), Resend (transactional email) and Vercel (hosting). Only if you connect them, LinkedIn and X, which receive the posts you choose to share (you sign in on their own pages, and they handle that under their own privacy policies). Only if you choose an identity-checked gold badge, Dojah also processes the identity details you submit (for individuals a NIN and a live face check; for organisations CAC registration details) to run the check; you enter them on Dojah&apos;s own page, it handles them under its own privacy policy, and #NotesApp does not keep them. Some of these providers process data outside Nigeria under appropriate safeguards.</p>

      <h2>How long we keep it</h2>
      <p>While your account is active, and afterwards only what we must keep for financial, tax and dispute records: when you delete your account, payment, payout and order records are kept without your name, email, address or phone number. Error records (technical details of failures, with personal data removed) are deleted automatically after 30 days.</p>

      <h2>Moments and direct messages</h2>
      <p>A moment is visible to you and to the members who follow you (or to everyone, if you choose that: see “Who can see your moments, and how to control it” below), and is deleted automatically when the 24, 48 or 72 hours you chose end, or sooner if you delete it. Its picture or video is stored with Cloudflare at a web address that is not published, and is deleted with the moment. If someone replies to a moment, the reply goes to your inbox as a direct message and stays there, marked as a reply to a moment that has expired once it has; the moment itself can no longer be opened. A voice-over you add is stored and deleted the same way. A direct message can be read only by the two members in the conversation. Pictures, videos, voice notes and documents you attach to a message are kept in private storage, are opened only through short-lived links given to the two members in the conversation, and are deleted with your account along with the messages you wrote. We also record when each message was sent and, for messages you receive, when you opened them, so the sender can see the double tick and the time. A sticker you send is stored only as the name of the sticker (they are our own #NotesApp icons). When you use Messages or Moments on a device we ask whether to turn notifications on for it; if you allow it they stay on until you turn them off in Messages, and you can also switch them off in your browser or phone settings. We do not read messages as a matter of routine; we may look at a message or moment only to investigate a report, to keep the platform safe, or where the law requires. If you report a moment or a conversation, we keep a copy of what was reported (for a moment, its picture, video and voice-over; for a conversation, its last 20 messages) until we have reviewed the report, then delete the copy. You can also block a member, which stops them messaging you and seeing your moments. When you get a new message we tell you by a bell, by a notification on your device if you turned that on and, on the Business and Enterprise plans, by an email if you switched it on (at most one an hour); none of them contains what was written. The owner of a moment can see which members viewed it. Messages are kept until you delete your account, when the messages you wrote are deleted (the other member keeps what they wrote to you). You can ask us for a copy of the messages you sent in your data download.</p>

      <h3>Who can see your moments, and how to control it</h3>
      <p>
        By default only the members who follow your journal can see your moments, and only while they are up. You can change this at any time in
        {" "}<Link href="/profile/edit" className="underline">Edit profile</Link>, under <strong>Moments privacy</strong>: choose <strong>Followers only</strong> (the default)
        or <strong>Everyone</strong>. With Everyone, any signed-in member who opens your profile can see your moments and like, reply to and re-share them, even if they don&apos;t follow you;
        they do not appear in the Moments row on other people&apos;s Journals page unless those people follow you. Switching back to Followers only takes effect straight away, including for moments already up.
        Whatever you choose, you can delete a moment at any time, you can block a member (they can no longer see your moments or message you), you can see who viewed each of your moments, and anyone can report a moment.
        A moment is never shown to people who are not signed in.
      </p>

      <h2>Group chats</h2>
      <p>
        A group is a conversation between several members. Everyone in a group can see everyone else in it and everything sent in it, including the messages sent before they were added, so only add people to a group, or stay in one, if you are comfortable with that. A member can start a group and add only people they follow or who follow them and who have not blocked them; no one can be added by a stranger. Anyone can leave a group at any time, and then can no longer see it; what they wrote there stays for the others until the author deletes their account. A group&apos;s admins (whoever started it, and anyone they make admin) can rename it and add or remove members. People in a group can copy or screenshot what is said, as anywhere, so be careful what you share.
        Pictures, videos, voice notes and documents sent in a group are kept in private storage and opened only through short-lived links given to its members.
        When there is a new message in a group we tell the members by a bell and, if they turned notifications on for a device, by a notification on it, naming the group and who wrote but never what was written; we do not send an email for group messages.
        We do not read groups as a matter of routine. If a member reports a message, we keep a copy of the last 20 messages in the group (with the group&apos;s name, and a note of which one was reported) until we have reviewed the report, then delete the copy; we may then warn, suspend or remove the member, or remove the group.
        If you delete your account you leave every group you are in and the messages you wrote in them are deleted; a group you were the last member of is deleted. A group stays until its last member leaves.
        Our own team uses private rooms in the same chat for staff and meetings; they are not open to members and are not about members.
      </p>

      <h2>Sharing your posts to LinkedIn or X</h2>
      <p>
        This is optional and off until you switch it on. If you connect your LinkedIn or X account, we send you to that network&apos;s own sign-in page, where you allow us to post for you (and, on LinkedIn, to read your name). We ask for no other permission: we do not read your feed, followers, messages or contacts. We post only when you press Post on one of your own posts, and only the words you have seen and been able to change: an excerpt and a link back to the post here (for LinkedIn also the post&apos;s title, description and picture, shown as a link card).
        The permission is kept encrypted on our server and used only for those posts; it expires on its own (LinkedIn about 60 days after you connect, after which you connect again; X renews while you keep using it).
        You can disconnect at any time from the same place, and we delete the saved permission straight away; you can also remove #NotesApp in your LinkedIn or X settings. A post you shared is a copy that lives on that network under its own terms and privacy policy: deleting the post here, or your account, does not delete it there, so remove it there yourself if you wish. If you delete your account we delete the saved permission and our record of what we shared. Your download of your data lists the accounts you connected and the posts we shared, never the saved permission.
      </p>

      <h2>Your rights</h2>
      <p>You may access, correct, export or delete your data, object to processing, and withdraw consent. Most of this you can do yourself under <a href="/profile/account">Account</a> → Your data: download a copy of your data, or delete your account (it is refused while money, orders, sessions or paid plans are still open, so nobody is left out of pocket). For anything else, contact us at {LEGAL_CONTACT}. You may also complain to the Nigeria Data Protection Commission.</p>

      <h2>Cookies and storage</h2>
      <p>We use only what is needed to keep you signed in and remember basic preferences.</p>

      <h2>Contact</h2>
      <p>{COMPANY_INFO.legalName} (RC {COMPANY_INFO.rcNumber}) · {LEGAL_CONTACT}</p>
    </article>
  );
}
