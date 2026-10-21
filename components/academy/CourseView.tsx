"use client";

import AdSlot from "@/components/AdSlot";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AcademyIcon } from "@/components/shell/icons";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { hashtag } from "@/lib/topics";
import { subtopicHashtag } from "@/lib/subtopics";
import { countCourseView, useCourse, useCourseLinks, useCoursePurchase } from "@/lib/courses-client";
import { startCheckout } from "@/lib/checkout";
import AcademyFaq from "./AcademyFaq";
import { useBottomTabs } from "@/components/shell/BottomTabs";
import ShareRow from "./ShareRow";
import ReviewsPanel, { Stars } from "@/components/ReviewsPanel";
import { useCourseSocial, useSavedCourses } from "@/lib/course-social-client";
import {
  COURSE_REFUND_DAYS, RATING_SHOWN_FROM, durationLabel, formatLabel, groupByModule, includesOf, isPaid, lessonHref, lessonKindLabel, levelLabel, plural, priceLabel,
  progressOf, showsRating, type Course, type CourseModule, type Enrolment, type Lesson,
} from "@/lib/courses";

// /academy/<slug>: a course's page. The top: where it's filed, its level, format and language, the title, its tutors and stars. Then
// tabs (Overview, Curriculum, Tutors, Reviews) beside a card with the price, what the course includes, Share and the details. A free
// course: "Enrol — free". A paid course: "Buy the course" and its free previews; once bought, progress, Continue, the class and
// community links, and a refund while it's allowed. On phones the price and the main button stay at the bottom of the screen.
// The tutors see their own draft here as a preview. On a member's own site (`site`: app/(site)/s/[username]/courses/[slug]) the same page
// sits inside their site, without adverts, and only for a course they teach; its lessons and certificate stay on #NotesApp.
type Tab = "overview" | "curriculum" | "tutors" | "reviews";
const TABS: Tab[] = ["overview", "curriculum", "tutors", "reviews"];

export default function CourseView({ slug, site }: { slug: string; site?: { base: string; uid: string } }) {
  const c = useCourse(slug);
  const { course, lessons, enrolment, user, preview } = c;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const counted = useRef(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  // Review (the bar under the title) and the stars open their tab and bring it into view: on a phone it's below the price card.
  const openTab = (t: Tab) => { setTab(t); requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const { social, like } = useCourseSocial(course && !preview ? course.id : undefined);
  const { saved, toggle: toggleSave } = useSavedCourses();
  const [note, setNote] = useState("");
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(""), 2200); };
  const paid = isPaid(course);
  const tabBar = useBottomTabs() && !site; // the phone's tab bar, when there is one (never on a member's site): the price bar sits just above it
  const mine = !!user && !!course && (user.uid === course.ownerUid || (course.tutorUids ?? []).includes(user.uid));
  const bought = !!enrolment?.purchaseRef;
  const links = useCourseLinks(course?.id, (!!enrolment && (!paid || bought)) || mine);
  const { purchase, refund, reload } = useCoursePurchase(course?.id, paid && bought);

  useEffect(() => {
    if (!course || preview || user === undefined || counted.current) return;
    counted.current = true;
    countCourseView(course.id, user);
  }, [course, preview, user]);
  // ?tab=reviews (and #reviews) open that tab.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") ?? window.location.hash.slice(1);
    if (TABS.includes(t as Tab)) setTab(t as Tab);
  }, []);

  async function enrol() {
    setBusy(true);
    setError("");
    try { await c.enrol(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't enrol you."); } finally { setBusy(false); }
  }
  async function buy() {
    if (!user || !course) return;
    setBusy(true);
    setError("");
    try { await startCheckout(user, { kind: "course", courseId: course.id }, { amountKobo: course.priceKobo }); }
    catch (e) { if (e instanceof Error && e.message) setError(e.message); setBusy(false); }
  }
  async function askRefund() {
    if (!course || !window.confirm(`Refund this course? The ${priceLabel(course)} goes back the way you paid, and the course closes for you.`)) return;
    setBusy(true);
    setError("");
    try { await refund(); await c.refresh(); reload(); flash("Refunded. It can take a few days to reach your card."); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't refund the course."); } finally { setBusy(false); }
  }
  // Back from signing in with ?enrol=1 (free) or ?buy=1 (paid): finish what they started.
  const { enrol: doEnrol } = c;
  useEffect(() => {
    if (!user || enrolment === undefined || !course) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("enrol") !== "1" && q.get("buy") !== "1") return;
    window.history.replaceState(null, "", window.location.pathname);
    if (enrolment) return; // already in
    if (isPaid(course)) { if (q.get("buy") === "1") void buy(); return; }
    setBusy(true);
    doEnrol().catch((e) => setError(e instanceof Error ? e.message : "Couldn't enrol you.")).finally(() => setBusy(false));
  }, [user, enrolment, course, doEnrol]); // eslint-disable-line react-hooks/exhaustive-deps

  if (c.status === "loading") return <p className="px-4 py-24 text-center text-sm text-slate">Loading the course…</p>;
  const theirs = !site || (!!course && (course.ownerUid === site.uid || (course.tutorUids ?? []).includes(site.uid)));
  if (c.status === "missing" || !course || !theirs) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-display text-3xl text-ink">Course not found</p>
        <p className="mt-2 text-sm text-slate">It may have been unpublished or moved.</p>
        <Link href={site ? `${site.base}/courses` : "/academy"} className="btn-primary mt-6 inline-block !px-6 !py-2 text-sm">{site ? "See all courses" : "Browse Notes Academy"}</Link>
      </div>
    );
  }

  const tutors = [{ uid: course.ownerUid, username: course.ownerUsername, name: course.ownerName, avatar: course.ownerAvatar }, ...(course.tutors ?? [])];
  const open = (!!enrolment && (!paid || bought)) || mine;
  const reviewCount = social?.rating.count ?? course.ratingCount ?? 0;
  const firstPara = course.summary.split(/\n\s*\n/)[0] ?? "";
  const here = site ? `${site.base}/courses/${slug}` : `/academy/${slug}`;
  const shareUrl = typeof window === "undefined" ? here : window.location.href.split(/[?#]/)[0];
  const signInHref = (flag: string) => `/login?next=${encodeURIComponent(`${here}?${flag}=1`)}`;
  const firstPreview = lessons.find((l, i) => (paid ? l.preview : i === 0));
  const sub = course.subtopics?.find((x) => x.parent === course.topics[0]);
  const mainAction = open || enrolment === undefined && !!user ? null : paid
    ? (user ? <button onClick={buy} disabled={busy} className="btn-primary w-full !py-3 disabled:opacity-50">{busy ? "Opening payment…" : "Buy the course"}</button> : <Link href={signInHref("buy")} className="btn-primary w-full !py-3">Buy the course</Link>)
    : (user ? <button onClick={enrol} disabled={busy || lessons.length === 0} className="btn-primary w-full !py-3 disabled:opacity-50">{busy ? "Enrolling…" : "Enrol — free"}</button> : <Link href={signInHref("enrol")} className="btn-primary w-full !py-3">Enrol — free</Link>);

  return (
    <>
      {preview && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Preview: this course is a draft, so only its tutors can see it. <Link href={`/academy/teach/${course.id}`} className="font-semibold underline">Back to the editor</Link>
        </div>
      )}
      <section className="bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright text-paper">
        <div className={`mx-auto grid max-w-6xl gap-8 px-5 py-9 sm:px-8 sm:py-11 ${course.cover ? "lg:grid-cols-[1fr_400px] lg:items-center" : ""}`}>
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-eyebrow text-paper/80">
              {site ? <Link href={`${site.base}/courses`} className="hover:text-paper">Courses</Link> : <Link href="/academy" className="hover:text-paper">Notes Academy</Link>}
              {course.topics[0] && <> › <Link href={`/academy?topic=${course.topics[0]}`} className="hover:text-paper">{hashtag(course.topics[0])}</Link></>}
              {sub && <> › {subtopicHashtag(sub.label)}</>}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge>{paid ? "Paid course" : "Free course"}</Badge>
              {course.level && <Badge>{levelLabel(course.level)}</Badge>}
              <Badge>{formatLabel(course.format)}</Badge>
              {course.language && course.language !== "English" && <Badge>{course.language}</Badge>}
            </div>
            <h1 className="mt-3 font-display text-[2.4rem] leading-[1.1] sm:text-5xl">{course.title}</h1>
            {firstPara && <p className="mt-3 line-clamp-3 max-w-3xl text-[17px] leading-relaxed text-paper/85">{firstPara}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href={`/u/${course.ownerUsername}`} className="flex w-fit items-center gap-3">
                <span className="flex -space-x-2.5">{tutors.slice(0, 3).map((t) => <Avatar key={t.uid} src={t.avatar} alt={t.name} size={42} className="ring-2 ring-white/50" />)}</span>
                <span className="min-w-0">
                  <span className="flex items-center font-ui text-base font-semibold"><span className="truncate">{tutors.length === 1 ? course.ownerName : tutors.length === 2 ? `${tutors[0].name} and ${tutors[1].name}` : `${tutors[0].name} and ${tutors.length - 1} more`}</span>{tutors.length === 1 && <NameBadgeIcons username={course.ownerUsername} size={15} onDark />}</span>
                  <span className="block font-mono text-xs text-paper/75">{tutors.length === 1 ? `@${course.ownerUsername} · ${course.isOrg ? "Organisation" : "Teacher"}` : `${course.isOrg ? course.ownerName : "Co-taught"} · ${plural(tutors.length, "tutor")}`}</span>
                </span>
              </Link>
              {social && showsRating(social.rating) && (
                <button type="button" onClick={() => openTab("reviews")} className="flex w-fit items-center gap-2 text-sm">
                  <Stars value={social.rating.average} size="text-base !text-amber-300" /><strong>{social.rating.average.toFixed(1)}</strong>
                  <span className="text-paper/80">· {plural(social.rating.count, "review")}{course.enrolCount ? ` · ${plural(course.enrolCount, "learner")}` : ""}</span>
                </button>
              )}
            </div>
          </div>
          {course.cover
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={course.cover} alt="" className="aspect-video w-full rounded-2xl object-cover shadow-lg" />
            : null}
        </div>
      </section>
      {!preview && (
        <div className="border-b border-rule bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-around gap-2 px-4 py-1.5 font-ui text-sm font-semibold text-ink sm:justify-start sm:gap-6 sm:px-8">
            <button type="button" onClick={async () => { const e = await like(); if (e) flash(e); }} aria-pressed={!!social?.liked} aria-label={social?.liked ? "Unlike this course" : "Like this course"}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-paper ${social?.liked ? "text-crimson" : ""}`}>
              <HeartIcon on={!!social?.liked} />{social ? social.likeCount.toLocaleString("en-GB") : "Like"}
            </button>
            <button type="button" onClick={async () => { const r = await toggleSave(course.id); if (r.error) flash(r.error); else flash(saved.has(course.id) ? "Removed from Saved" : "Saved: find it in Saved → Courses"); }} aria-pressed={saved.has(course.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-paper ${saved.has(course.id) ? "text-crimson" : ""}`}>
              <BookmarkIcon on={saved.has(course.id)} />{saved.has(course.id) ? "Saved" : "Save"}
            </button>
            <button type="button" onClick={() => openTab("reviews")} className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-paper"><span aria-hidden className="text-amber-500">★</span>Review</button>
            <button type="button" onClick={async () => { try { if (navigator.share) await navigator.share({ title: course.title, url: shareUrl }); else { await navigator.clipboard.writeText(shareUrl); flash("Link copied"); } } catch {} }}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-paper"><span aria-hidden>↗</span>Share</button>
          </div>
          {note && <p role="status" className="pb-2 text-center text-xs font-semibold text-crimson">{note}</p>}
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 pb-28 sm:px-8 lg:grid-cols-[1fr_350px] lg:pb-10">
        <aside className="lg:col-start-2 lg:row-start-1">
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="card p-5">
              <p className={`font-ui text-3xl font-extrabold ${paid ? "text-ink" : "text-emerald-700"}`}>{priceLabel(course)}</p>
              {open ? (
                <Progress course={course} lessons={lessons} enrolment={enrolment} slug={slug} mine={mine} links={links} />
              ) : enrolment === undefined && user ? (
                <p className="mt-4 text-sm text-slate">Checking your progress…</p>
              ) : (
                <>
                  <div className="mt-4">{mainAction}</div>
                  {firstPreview && <Link href={lessonHref(slug, firstPreview.id)} className="btn-ghost mt-2 w-full !py-2.5">{paid ? "Watch the free preview" : "Watch the first lesson"}</Link>}
                  <p className="mt-3 text-center text-xs text-slate">{paid ? `Card, bank transfer or wallet · Refund within ${COURSE_REFUND_DAYS} days if you haven't started` : user ? "Your progress is saved as you go." : "Sign in (or join free) and you'll come straight back here."}</p>
                </>
              )}
              {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
              <p className="mt-5 font-ui text-sm font-bold text-ink">This course includes</p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink">{includesOf(course, lessons).map((x) => <li key={x} className="flex gap-2.5"><span aria-hidden className="w-4 text-center text-crimson">✓</span>{x}</li>)}</ul>
              {purchase?.refundable && (
                <p className="mt-4 border-t border-rule pt-3 text-xs text-slate">Changed your mind? You haven&apos;t started yet, so you can <button type="button" onClick={askRefund} disabled={busy} className="font-semibold text-crimson underline">get a refund</button> until {new Date(purchase.refundUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.</p>
              )}
            </div>
            {!paid && !preview && !site && <div className="hidden empty:hidden lg:block"><AdSlot placement="course" stacked className="!my-0" /></div>}
            {!preview && (
              <div className="card p-5">
                <p className="font-ui text-sm font-bold text-ink">Share this course</p>
                <div className="mt-3"><ShareRow url={shareUrl} title={course.title} /></div>
              </div>
            )}
            <div className="card p-5 text-sm">
              <p className="font-ui font-bold text-ink">Course details</p>
              <dl className="mt-2 divide-y divide-rule">
                {course.level && <Row k="Level" v={levelLabel(course.level)} />}
                {(course.runsFor || course.minutes > 0) && <Row k="Duration" v={[course.runsFor, course.minutes ? durationLabel(course.minutes) : ""].filter(Boolean).join(" · ")} />}
                <Row k="Lessons" v={`${lessons.length}${(course.modules ?? []).length ? ` in ${plural(course.modules!.length, "module")}` : ""}`} />
                <Row k="Format" v={formatLabel(course.format)} />
                <Row k="Language" v={course.language || "English"} />
                <Row k="Certificate" v={<span className="text-emerald-700">{paid && course.certificateIncluded ? "Included, verifiable" : "Yes, verifiable"}</span>} />
              </dl>
            </div>
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div ref={tabsRef} role="tablist" aria-label="About this course" className="scroll-mt-20 no-scrollbar -mx-4 flex gap-6 overflow-x-auto border-b border-rule px-4 sm:mx-0 sm:px-0">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`shrink-0 border-b-[3px] py-3 font-ui text-[15px] font-bold transition-colors ${tab === t ? "border-crimson text-crimson" : "border-transparent text-slate hover:text-ink"}`}>
                {t === "overview" ? "Overview" : t === "curriculum" ? `Curriculum · ${lessons.length}` : t === "tutors" ? `Tutors · ${tutors.length}` : `Reviews${reviewCount ? ` · ${reviewCount}` : ""}`}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div role="tabpanel">
              {(course.outcomes ?? []).length > 0 && (
                <>
                  <h2 className="mt-7 font-display text-3xl text-ink">What you&apos;ll learn</h2>
                  <ul className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">{course.outcomes!.map((o) => <li key={o} className="flex gap-2.5 text-[15px] text-ink"><span aria-hidden className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-extrabold text-emerald-700">✓</span>{o}</li>)}</ul>
                </>
              )}
              {course.summary && (
                <>
                  <h2 className="mt-8 font-display text-3xl text-ink">About this course</h2>
                  <p className="mt-2 whitespace-pre-line text-[17px] leading-relaxed text-ink sm:text-base">{course.summary}</p>
                </>
              )}
              {(course.format === "live" || course.runsFor || course.schedule) && (
                <>
                  <h2 className="mt-8 font-display text-3xl text-ink">How it works</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {course.runsFor && <Fact k="Duration" v={course.runsFor} />}
                    {course.schedule && <Fact k={course.format === "live" ? "Live classes" : "Schedule"} v={course.schedule} />}
                    {course.format === "live" ? <Fact k="Missed one?" v="Every class is recorded" /> : <Fact k="Pace" v="Start any time, learn at your own pace" />}
                  </div>
                </>
              )}
              {(course.hasCommunityLink || course.hasClassLink) && (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3.5 text-sm text-emerald-900">
                  {links && (links.classUrl || links.communityUrl) ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-1">You&apos;re in.</span>
                      {links.classUrl && <a href={links.classUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald-700 px-4 py-1.5 font-ui text-xs font-bold text-white">Join the live class</a>}
                      {links.communityUrl && <a href={links.communityUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#1f9d55] px-4 py-1.5 font-ui text-xs font-bold text-white">Join the {course.communityKind || "learners'"} group</a>}
                    </div>
                  ) : (
                    <>{course.hasClassLink && course.hasCommunityLink ? "The live class link and the course's group are" : course.hasClassLink ? "The live class link is" : `The course's ${course.communityKind ? `${course.communityKind} ` : ""}group is`} shared with learners once they {paid ? "buy" : "enrol"}: support, questions and networking with fellow learners.</>
                  )}
                </div>
              )}
              {(course.requirements ?? []).length > 0 && (
                <>
                  <h2 className="mt-8 font-display text-3xl text-ink">Requirements</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink">{course.requirements!.map((r) => <li key={r}>{r}</li>)}</ul>
                </>
              )}
              {course.topics.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {course.topics.map((t) => <Link key={t} href={`/academy?topic=${t}`} className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-crimson ring-1 ring-rule hover:ring-crimson">{hashtag(t)}</Link>)}
                  {(course.subtopics ?? []).map((x) => <Link key={`${x.parent}/${x.slug}`} href={`/academy?topic=${x.parent}`} className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-slate ring-1 ring-rule hover:ring-crimson">{hashtag(x.parent)} › {subtopicHashtag(x.label)}</Link>)}
                </div>
              )}
              <button type="button" onClick={() => openTab("curriculum")} className="mt-6 text-sm font-semibold text-crimson">See all {plural(lessons.length, "lesson")} →</button>
              <AcademyFaq />
            </div>
          )}

          {tab === "curriculum" && (
            <div role="tabpanel" className="mt-5">
              <p className="text-xs text-slate">{(course.modules ?? []).length ? `${plural(course.modules!.length, "module")} · ` : ""}{plural(lessons.length, "lesson")}{course.minutes ? ` · ${durationLabel(course.minutes)}` : ""}{open ? "" : paid ? " · free previews are marked" : " · the first lesson is a free preview"}</p>
              <LessonList slug={slug} lessons={lessons} enrolment={enrolment} open={open} modules={course.modules} paid={paid} />
              {/* Free courses carry an advert (phones here, computers in the side card); paid ones never do. */}
              {!paid && !preview && !site && <div className="empty:hidden lg:hidden"><AdSlot placement="course" stacked /></div>}
            </div>
          )}

          {tab === "tutors" && (
            <div role="tabpanel" className="mt-5 grid gap-3 sm:grid-cols-2">
              {tutors.map((t, i) => (
                <Link key={t.uid} href={`/u/${t.username}`} className="card flex items-center gap-3 p-4 hover:border-crimson">
                  <Avatar src={t.avatar} alt={t.name} size={52} />
                  <span className="min-w-0">
                    <span className="flex items-center font-ui font-bold text-ink"><span className="truncate">{t.name}</span><NameBadgeIcons username={t.username} size={14} /></span>
                    <span className="block font-mono text-xs text-slate">@{t.username} · {i === 0 ? (course.isOrg ? "Publisher" : "Lead tutor") : "Co-tutor"}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          {tab === "reviews" && !preview && <ReviewsPanel courseId={course.id} user={user} title="What learners say" minShown={RATING_SHOWN_FROM} />}
          {tab === "reviews" && preview && <p className="mt-6 text-sm text-slate">Reviews appear here once the course is published.</p>}
        </div>
      </div>

      {/* Phones: the price and the main button stay in reach, above the tab bar. */}
      {mainAction && !preview && (
        <div className={`fixed inset-x-0 ${tabBar ? "bottom-[calc(env(safe-area-inset-bottom)+4.5rem)]" : "bottom-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"} z-30 flex items-center justify-between gap-4 border-t border-rule bg-card px-4 py-3 shadow-[0_-6px_20px_rgba(0,0,0,0.06)] lg:hidden`}>
          <span className={`font-ui text-xl font-extrabold ${paid ? "text-ink" : "text-emerald-700"}`}>{priceLabel(course)}</span>
          <div className="w-44">{mainAction}</div>
        </div>
      )}
    </>
  );
}

const Badge = ({ children }: { children: React.ReactNode }) => <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-ui text-xs font-bold text-paper ring-1 ring-white/30">{children}</span>;
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4 py-2"><dt className="text-slate">{k}</dt><dd className="text-right font-semibold text-ink">{v}</dd></div>;
const Fact = ({ k, v }: { k: string; v: string }) => <div className="rounded-xl border border-rule bg-card p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-slate">{k}</p><p className="mt-1 font-ui text-sm font-bold text-ink">{v}</p></div>;

function Progress({ course, lessons, enrolment, slug, mine, links }: { course: Course; lessons: Lesson[]; enrolment: Enrolment | null | undefined; slug: string; mine: boolean; links: { classUrl: string; communityUrl: string } | null }) {
  const p = progressOf(lessons.map((l) => l.id), enrolment);
  return (
    <>
      {enrolment ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-rule"><div className="h-full rounded-full bg-crimson transition-all" style={{ width: `${p.pct}%` }} /></div>
          <p className="mt-1.5 text-xs text-slate">{p.complete ? "You've finished every lesson. Well done!" : `${p.done} of ${p.total} lessons done · ${p.pct}%`}</p>
        </div>
      ) : null}
      {p.next && <Link href={lessonHref(slug, p.next)} className="btn-primary mt-4 w-full !py-3">{!enrolment ? "Open the lessons" : p.complete ? "Watch again" : p.done ? "Continue" : "Start"}</Link>}
      {links?.classUrl && <a href={links.classUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-2 w-full !py-2.5">Join the live class</a>}
      {links?.communityUrl && <a href={links.communityUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-2 w-full !py-2.5">Join the {course.communityKind || "learners'"} group</a>}
      {mine && <Link href={`/academy/teach/${course.id}`} className="mt-4 block text-center text-sm font-semibold text-crimson">You teach this course · Edit it</Link>}
      {mine ? (
        <Link href="/academy/teach/setup" className="mt-4 block border-t border-rule pt-3 text-center text-sm font-semibold text-crimson"><AcademyIcon className="mr-1.5 inline-block h-[1.2em] w-[1.2em] align-[-0.25em]" />Set up your certificates</Link>
      ) : enrolment?.certificateId ? (
        <Link href={`/certificates/${enrolment.certificateId}`} className="mt-4 block border-t border-rule pt-3 text-center text-sm font-semibold text-crimson"><AcademyIcon className="mr-1.5 inline-block h-[1.2em] w-[1.2em] align-[-0.25em]" />See your certificate</Link>
      ) : enrolment && p.complete ? (
        <Link href={`/academy/${slug}/certificate`} className="btn-primary mt-4 w-full !py-3"><AcademyIcon className="mr-1.5 inline-block h-[1.2em] w-[1.2em] align-[-0.25em]" />Get your certificate</Link>
      ) : (
        <p className="mt-4 border-t border-rule pt-3 text-xs text-slate">Finish every lesson and get a certificate anyone can check, with your name, the hours and a QR code{isPaid(course) && course.certificateIncluded ? ", included in the price" : ""}.</p>
      )}
    </>
  );
}

// The lessons, grouped by module. Locked (with "Enrol" or "Buy") unless the visitor is in, or it's a free preview.
export function LessonList({ slug, lessons, enrolment, open, current, modules = [], paid = false }: {
  slug: string; lessons: Lesson[]; enrolment: Enrolment | null | undefined; open: boolean; current?: string; modules?: CourseModule[]; paid?: boolean;
}) {
  const groups = groupByModule(lessons, modules);
  const index = new Map(lessons.map((l, i) => [l.id, i]));
  const row = (l: Lesson) => {
    const i = index.get(l.id)!;
    const done = !!enrolment?.done?.[l.id];
    const free = paid ? !!l.preview : i === 0;
    const locked = !open && !free;
    return (
      <li key={l.id}>
        <Link href={lessonHref(slug, l.id)} aria-current={current === l.id ? "page" : undefined}
          className={`flex items-center gap-3 px-4 py-3.5 hover:bg-paper ${current === l.id ? "bg-crimson/[0.06]" : ""}`}>
          <span aria-label={done ? "Done" : locked ? "Locked" : undefined} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-ui text-xs font-bold ${done ? "bg-emerald-600 text-white" : locked ? "bg-paper text-slate" : "bg-crimson/[0.08] text-crimson"}`}>{done ? "✓" : locked ? <LockIcon /> : i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className={`block font-ui text-[15px] font-semibold leading-snug sm:text-sm ${current === l.id ? "text-crimson" : locked ? "text-slate" : "text-ink"}`}>{l.title}</span>
            <span className="block text-xs text-slate">{lessonKindLabel(l.kind)}{l.minutes ? ` · ${durationLabel(l.minutes)}` : ""}</span>
          </span>
          {!open && free && <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-emerald-700">Free</span>}
          {locked && <span className="shrink-0 font-mono text-[10px] uppercase tracking-eyebrow text-slate">{paid ? "Buy" : "Enrol"}</span>}
        </Link>
      </li>
    );
  };
  if (!groups.some((g) => g.module)) return <ol className="mt-4 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">{lessons.map(row)}</ol>;
  return (
    <div className="mt-4 space-y-3">
      {groups.map((g, gi) => {
        const mins = g.items.reduce((n, l) => n + (l.minutes ?? 0), 0);
        const here = !!current && g.items.some((l) => l.id === current);
        return (
          <details key={g.module?.id ?? "loose"} open={here || (!current && gi === 0)} className="group overflow-hidden rounded-2xl border border-rule bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <b className="font-ui text-sm text-ink">{g.module ? `${modules.findIndex((m) => m.id === g.module!.id) + 1} · ${g.module.title}` : "Getting started"}</b>
              <span className="shrink-0 text-xs text-slate">{plural(g.items.length, "lesson")}{mins ? ` · ${durationLabel(mins)}` : ""} <span aria-hidden className="inline-block transition-transform group-open:rotate-180">▾</span></span>
            </summary>
            <ol className="divide-y divide-rule border-t border-rule">{g.items.map(row)}</ol>
          </details>
        );
      })}
    </div>
  );
}

const LockIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const HeartIcon = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>
);
export const BookmarkIcon = ({ on, className = "h-5 w-5" }: { on: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z" /></svg>
);
