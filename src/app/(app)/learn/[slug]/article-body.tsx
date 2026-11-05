"use client";

import { Callout } from "@/components/ui";
import type { ArticleBlock } from "@/lib/types";

/**
 * Renders the stored article blocks. Each variant is narrowed with a switch on
 * `block.t`, so every branch gets its own typed fields and styling: a comfortable
 * ~65ch measure, generous line-height, lavender bullet markers and callouts that
 * reuse the shared `<Callout>` primitive.
 */
export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  if (blocks.length === 0) return null;

  return (
    <div>
      {blocks.map((block, i) => {
        const delay = `${Math.min(i, 10) * 45}ms`;

        switch (block.t) {
          case "p":
            return (
              <p
                key={i}
                style={{ animationDelay: delay }}
                className="mt-4 max-w-[65ch] animate-fade-up text-[15.5px] leading-[1.75] text-ink first:mt-0"
              >
                {block.text}
              </p>
            );

          case "h":
            return (
              <h2
                key={i}
                style={{ animationDelay: delay }}
                className="mt-9 max-w-[65ch] animate-fade-up border-t border-line pt-4 font-display text-[20px] font-semibold leading-snug tracking-[-0.01em] text-ink first:mt-0 first:border-t-0 first:pt-0"
              >
                {block.text}
              </h2>
            );

          case "list":
            return (
              <ul
                key={i}
                style={{ animationDelay: delay }}
                className="mt-4 max-w-[65ch] animate-fade-up space-y-2.5 first:mt-0"
              >
                {block.items.map((item, j) => (
                  <li
                    key={j}
                    className="relative pl-5 text-[15px] leading-[1.7] text-ink"
                  >
                    <span
                      className="absolute left-0 top-[0.65em] size-1.5 rounded-full bg-lavender"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            );

          case "callout":
            return (
              <div
                key={i}
                style={{ animationDelay: delay }}
                className="mt-5 max-w-[65ch] animate-fade-up first:mt-0"
              >
                <Callout kind={block.kind ?? "info"}>{block.text}</Callout>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
