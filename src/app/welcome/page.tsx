import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarHeart,
  ChevronRight,
  Lock,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { Logo, LogoMark } from "@/components/logo";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: CalendarHeart,
    title: "A calendar that anticipates",
    body: "Predicted periods, ovulation and your fertile window — always labelled as estimates.",
  },
  {
    icon: Sparkles,
    title: "Daily check-ins that add up",
    body: "Log symptoms, mood, sleep and energy in seconds, then watch the patterns emerge.",
  },
  {
    icon: TrendingUp,
    title: "Insights in plain language",
    body: "Cycle trends and mood patterns explained without jargon or diagnosis.",
  },
] as const;

export default async function Welcome() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Decorative wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 gradient-warm"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-lavender-soft/45 blur-3xl animate-pulse-soft"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 -left-28 size-72 rounded-full bg-pink-soft/55 blur-3xl animate-pulse-soft"
        style={{ animationDelay: "1.2s" }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-8 pb-10">
        <header className="animate-fade-in">
          <Logo />
        </header>

        <div className="flex flex-1 flex-col justify-center py-8 text-center">
          <div
            className="mx-auto mb-7 animate-scale-in"
            style={{ animationDelay: "80ms" }}
          >
            <div className="relative mx-auto grid size-40 place-items-center">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full bg-white/70 shadow-ring blur-[1px]"
              />
              <LogoMark size={148} className="relative animate-spin-slow" />
              <div
                aria-hidden
                className="absolute -bottom-1 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-plum shadow-soft"
              >
                your rhythm
              </div>
            </div>
          </div>

          <h1
            className="font-display text-[34px] leading-[1.12] font-semibold tracking-[-0.02em] text-ink animate-fade-up"
            style={{ animationDelay: "160ms" }}
          >
            Know your cycle,
            <br />
            <span className="text-gradient-brand">on your terms.</span>
          </h1>

          <p
            className="mx-auto mt-4 max-w-[34ch] text-[15px] leading-relaxed text-ink-soft animate-fade-up"
            style={{ animationDelay: "240ms" }}
          >
            Lunara turns your daily check-ins into a calm, private picture of your
            body — periods, mood, symptoms and more.
          </p>
        </div>

        <ul className="space-y-3.5">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className="flex items-start gap-3.5 animate-fade-up"
              style={{ animationDelay: `${320 + i * 90}ms` }}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-lavender-deep shadow-soft">
                <f.icon className="size-[18px]" aria-hidden />
              </span>
              <span className="pt-0.5">
                <span className="block text-[14.5px] font-semibold text-ink">
                  {f.title}
                </span>
                <span className="block text-[13px] leading-relaxed text-ink-soft">
                  {f.body}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div
          className="mt-8 space-y-3 animate-fade-up"
          style={{ animationDelay: "600ms" }}
        >
          <Link href="/register" className="block">
            <Button size="lg" block>
              Get started
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </Link>
          <Link href="/login" className="block">
            <Button size="lg" variant="secondary" block>
              I already have an account
            </Button>
          </Link>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[12px] text-ink-faint animate-fade-in">
          <Lock className="size-3.5" aria-hidden />
          Private by default. Your health data is yours alone.
        </p>
      </div>
    </main>
  );
}
