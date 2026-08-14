// @notesapp has no real Firestore notes — it's a synthetic profile
// (see lib/journals-directory.ts). These 5 posts are its "journal":
// hardcoded here, rendered by the UI, not stored in the `notes`
// collection. Each corresponds to one of the pitch-deck explainer
// images in public/images/pitch/.

export type NotesAppPost = {
  slug: string;
  title: string;
  category: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  excerpt: string;
  body: string[];
};

export const NOTESAPP_POSTS: NotesAppPost[] = [
  {
    slug: "summary",
    title: "One Professional. One Workspace. Endless Possibilities.",
    category: "Overview",
    image: "/images/pitch/01-summary.webp",
    imageWidth: 1536,
    imageHeight: 1024,
    excerpt:
      "The all-in-one platform for coaches, consultants, therapists, and knowledge professionals to create content, build an audience, book clients, get paid, and grow.",
    body: [
      "#NotesApp exists because no platform today is purpose-built for African coaches, consultants, therapists, and knowledge professionals who publish content, take bookings, collect payment in Naira, and manage client relationships — all in one place.",
      "One workspace, one continuous loop: publish, get discovered, get booked, get paid, serve the client, capture the insight, refine it into new content, publish again. Everything below breaks down a different piece of that loop.",
    ],
  },
  {
    slug: "value-loop",
    title: "The #NotesApp Value Loop",
    category: "Product",
    image: "/images/pitch/02-value-loop.webp",
    imageWidth: 1693,
    imageHeight: 929,
    excerpt:
      "Content generates bookings. Bookings generate revenue. Revenue funds more content. A continuous cycle that turns expertise into impact and income.",
    body: [
      "Nine steps, one loop: Create → Publish → Discover → Book → Pay → Serve → Capture → Refine → Publish Again.",
      "Every step compounds into the next. A published note builds authority and reach. Discovery grows the audience. A booking converts interest into a real session. Payment collects securely in Naira. Serving the client delivers actual value. Capturing session notes while they're fresh becomes raw material. Refining that material — with AI tools, eventually — turns it into new content. And publishing again starts the loop over, with more reach than the last time.",
    ],
  },
  {
    slug: "how-notesapp-works",
    title: "How #NotesApp Works",
    category: "Product",
    image: "/images/pitch/03-how-notesapp-works.webp",
    imageWidth: 1536,
    imageHeight: 1024,
    excerpt:
      "Everything a knowledge professional needs to create, engage, book, serve, and grow — in one seamless workspace.",
    body: [
      "One workspace covers the whole job: a dashboard for overview and activity, notes/journals across public, private, and draft, engagement (likes, comments, shares), a calendar and booking system, client and session management, payments and earnings, a brand store, and settings to customize it all.",
      "Six things tie it together: create content, build an audience, engage with readers, monetize expertise, manage clients, and refine raw session insight into new content — mobile-first, secure, AI-powered, and always in sync across devices.",
    ],
  },
  {
    slug: "connects-to-your-business",
    title: "How #NotesApp Connects to Your Business",
    category: "Product",
    image: "/images/pitch/04-connects-to-your-business.webp",
    imageWidth: 1536,
    imageHeight: 1024,
    excerpt:
      "Your website is your home. #NotesApp is the engine that powers your content, bookings, and client relationships behind it.",
    body: [
      "An audience arrives from social media, search engines, email, referrals, and returning readers. #NotesApp is the all-in-one workspace behind the scenes — notes/journals, a native booking calendar, Naira-native payments, client and session management, engagement, a brand store, analytics — synced in real time via API integration to a professional's own website.",
      "The result: more visibility, more bookings, more revenue, more impact — without stitching five separate tools together to get there.",
    ],
  },
  {
    slug: "life-without-notesapp",
    title: "How Professionals Are Functioning Currently Without #NotesApp",
    category: "Problem",
    image: "/images/pitch/05-life-without-notesapp.webp",
    imageWidth: 1536,
    imageHeight: 1024,
    excerpt:
      "Too many tools. Disconnected workflows. Lost time. Lost opportunities. Professionals are forced to piece together multiple tools just to run their business.",
    body: [
      "Today, a professional's workflow is scattered across Notion or Google Docs for content, WordPress or Substack to publish, WhatsApp and Instagram DMs to manage inquiries, Calendly to schedule, Paystack or bank transfer to collect payment, Zoom to hold the session, Notion or pen and paper to take notes, and email or WhatsApp to follow up.",
      "The result is measurable: 10–15+ hours wasted weekly, lower conversion and bookings from slow, inconsistent follow-up, revenue leakage from missed payments and manual errors, mental overload from managing too many disconnected things, and a business that can't scale on a fragmented system. Professionals deserve better — that's why #NotesApp exists.",
    ],
  },
];
