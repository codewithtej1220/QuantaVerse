"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  DashboardShell,
  type DashboardModel,
} from "@/components/dashboard/dashboard-shell";
import { ApiError } from "@/lib/api";
import { fetchDashboard, type DashboardResponse } from "@/lib/auth";
import {
  BADGES,
  COHERENCE_LOG,
  LEARNER,
  MODULES,
  SKILLS,
  TRACK_LABEL,
  type GateTone,
} from "@/lib/data";

const DAY_MS = 86_400_000;
const MASTERY_LEVELS = 6;
const TOTAL_LESSONS = MODULES.reduce((sum, module) => sum + module.lessons, 0);
const TONE_BY_BADGE = new Map<string, GateTone>(
  BADGES.map((badge) => [badge.id, badge.tone]),
);
const TONE_CYCLE: GateTone[] = ["photon", "phase", "collapse"];

function activityStart(weeks: number) {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekday = (new Date(midnight).getUTCDay() + 6) % 7;
  return midnight - weekday * DAY_MS - (weeks - 1) * 7 * DAY_MS;
}

function stamp(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function demoModel(banner: React.ReactNode): DashboardModel {
  const active = MODULES.find((module) => module.state === "active") ?? MODULES[0];
  const weakest = [...SKILLS].sort((a, b) => a.value - b.value)[0];

  return {
    name: LEARNER.name,
    handle: LEARNER.handle,
    institution: LEARNER.institution,
    cohort: LEARNER.cohort,
    streakDays: LEARNER.streakDays,
    completion: Math.round((LEARNER.lessonsDone / TOTAL_LESSONS) * 100),
    mastery: {
      level: LEARNER.masteryLevel,
      title: LEARNER.masteryTitle,
      progress: LEARNER.masteryProgress,
      nextTitle: LEARNER.nextTitle,
      levels: 5,
    },
    tiles: [
      {
        label: "Circuits run",
        value: LEARNER.circuitsRun.toLocaleString("en-IN"),
        detail: "simulated in your browser",
      },
      {
        label: "Shots",
        value: LEARNER.shotsSimulated.toLocaleString("en-IN"),
        detail: "measurements sampled",
      },
      {
        label: "Time on task",
        value: `${LEARNER.hoursLogged}h`,
        detail: "editor and sandbox only",
      },
      {
        label: "Lessons",
        value: `${LEARNER.lessonsDone}/${TOTAL_LESSONS}`,
        detail: `across ${MODULES.length} modules`,
      },
    ],
    upNext: {
      slug: active.slug,
      ket: active.ket,
      title: active.title,
      detail: `${active.progress}% through ${TRACK_LABEL[active.track].toLowerCase()} · ${active.lessons} lessons · finishing it earns ${active.badge}. Your thinnest axis right now is ${weakest.label.toLowerCase()}.`,
    },
    skills: SKILLS,
    badges: BADGES,
    log: COHERENCE_LOG,
    logStart: Date.UTC(2026, 5, 1),
    intro:
      "These are sample figures, for a learner who does not exist, so the page has something to show you. Sign in and every number here is replaced by one counted from your own work.",
    footnote:
      "Nothing on this page is yours yet. Create an account and the lessons you finish and the circuits you submit are stored on the API and counted here.",
    banner,
  };
}

function liveModel(data: DashboardResponse): DashboardModel {
  const weeks = data.activity_weeks || Math.round(data.activity.length / 7);
  const passRate = data.stats.attempts
    ? `${Math.round(data.stats.success_rate * 100)}%`
    : "—";

  return {
    name: data.profile.display_name,
    handle: data.profile.handle,
    institution: data.profile.institution,
    cohort: data.profile.cohort,
    streakDays: data.stats.streak_days,
    completion: data.stats.percent_complete,
    mastery: {
      level: data.mastery.level,
      title: data.mastery.title,
      progress: data.mastery.percent,
      nextTitle: data.mastery.next_title,
      levels: MASTERY_LEVELS,
    },
    tiles: [
      {
        label: "Lessons",
        value: `${data.stats.lessons_completed}/${data.stats.lessons_total}`,
        detail: `across ${data.stats.modules_total} modules`,
      },
      {
        label: "Circuit labs",
        value: `${data.stats.challenges_passed}/${data.stats.challenges_total}`,
        detail: "graded circuits passed",
      },
      {
        label: "Success rate",
        value: passRate,
        detail: `${data.stats.attempts_passed} of ${data.stats.attempts} submissions`,
      },
      {
        label: "Time on task",
        value: `${(data.stats.minutes_logged / 60).toFixed(1)}h`,
        detail: "logged against lessons",
      },
    ],
    upNext: data.up_next
      ? {
          slug: data.up_next.module_slug,
          ket: data.up_next.ket,
          title: data.up_next.title,
          detail: `${data.up_next.percent}% complete · ${data.up_next.reason}${
            data.up_next.weakest_skill
              ? `. Your thinnest axis right now is ${data.up_next.weakest_skill.toLowerCase()}.`
              : "."
          }`,
        }
      : null,
    skills: data.skills.map((skill) => ({
      label: skill.label,
      short: skill.short,
      value: skill.value,
      cohort: skill.cohort,
    })),
    badges: data.badges.map((badge, index) => ({
      id: badge.id,
      name: badge.name,
      detail: badge.detail,
      ket: badge.ket,
      earned: badge.earned,
      earnedOn: stamp(badge.earned_at),
      tone: TONE_BY_BADGE.get(badge.id) ?? TONE_CYCLE[index % TONE_CYCLE.length],
    })),
    log: data.activity,
    logStart: activityStart(weeks),
    intro:
      "Everything here is derived from circuits that ran and checks that passed. Nothing counts a video watched or a page scrolled, because neither one teaches you to build a Bell pair.",
    footnote:
      "Every number above is counted on the server from lessons you marked complete and circuits the grader checked.",
  };
}

const SIGNED_OUT_BANNER = (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-photon bg-photon/[0.06] px-5 py-4">
    <p className="flex items-center gap-2.5 text-[13.5px] text-frost">
      <Sparkles className="size-4 shrink-0 text-photon" />
      You are looking at a sample record. Sign in to track your own lessons, scores and badges.
    </p>
    <span className="flex items-center gap-2">
      <Link
        href="/login"
        className="inline-flex h-9 items-center px-4 text-[13px] text-frost transition-colors hover:bg-strata hover:text-paper"
      >
        Sign in
      </Link>
      <Link
        href="/register"
        className="inline-flex h-9 items-center bg-photon px-4 text-[13px] font-medium text-[#000000] transition-colors hover:bg-[#8af2ff]"
      >
        Create account
      </Link>
    </span>
  </div>
);

interface Loaded {
  userId: number;
  data: DashboardResponse | null;
  error: string | null;
}

export function DashboardView() {
  const { user, ready } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const mine = user && loaded?.userId === user.id ? loaded : null;
  const data = mine?.data ?? null;
  const error = mine?.error ?? null;
  const loading = Boolean(user) && !data && !error;

  useEffect(() => {
    if (!ready || !user) return;
    let live = true;
    const id = user.id;
    fetchDashboard()
      .then((payload) => {
        if (live) setLoaded({ userId: id, data: payload, error: null });
      })
      .catch((caught: unknown) => {
        if (live) {
          setLoaded({
            userId: id,
            data: null,
            error:
              caught instanceof ApiError ? caught.message : "the dashboard could not load",
          });
        }
      });
    return () => {
      live = false;
    };
  }, [ready, user]);

  if (!ready || (user && loading)) {
    return (
      <div className="grid min-h-screen place-items-center pt-32 pb-24">
        <p className="flex items-center gap-3 font-mono text-[12px] tracking-[0.14em] text-frost uppercase">
          <Loader2 className="size-4 animate-spin text-photon" />
          loading your record
        </p>
      </div>
    );
  }

  if (user && error) {
    return (
      <div className="min-h-screen pt-32 pb-24">
        <div className="mx-auto max-w-[720px] px-5">
          <div className="panel rounded-2xl p-6">
            <p className="flex items-center gap-2.5 text-[15px] font-medium text-paper">
              <AlertTriangle className="size-4 text-collapse" />
              Your record could not be loaded
            </p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-frost">{error}</p>
            <p className="mt-4 font-mono text-[11.5px] leading-relaxed text-frost">
              The API needs to be running for the dashboard to count anything. Start it with
              uvicorn and reload this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (user && data) return <DashboardShell model={liveModel(data)} />;

  return <DashboardShell model={demoModel(SIGNED_OUT_BANNER)} />;
}
