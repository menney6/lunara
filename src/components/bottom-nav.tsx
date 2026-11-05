"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, LineChart, User, BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/92 backdrop-blur-xl
                 pb-[env(safe-area-inset-bottom)]"
    >
      {/* Mirrors the content column in (app)/layout.tsx so tabs line up with
          the page above them on wide screens. */}
      <ul className="mx-auto flex w-full max-w-xl items-stretch px-4 sm:px-6">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 transition-colors duration-200",
                  active ? "text-plum" : "text-ink-faint hover:text-lavender-deep",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-all duration-300",
                    active && "bg-lavender-mist",
                  )}
                >
                  <item.icon
                    className={cn("size-[19px] transition-transform", active && "scale-105")}
                    strokeWidth={active ? 2.3 : 1.9}
                    aria-hidden
                  />
                </span>
                <span
                  className={cn(
                    "text-[10.5px] leading-none transition-font-weight",
                    active && "font-semibold",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
