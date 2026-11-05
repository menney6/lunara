"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/content";
import type { Article, ArticleCategory } from "@/lib/types";
import { Button, EmptyState, SectionHeading } from "@/components/ui";

/* ------------------------------------------------------------- artwork */

/**
 * The `art` column stores a gradient token. Keep this map in sync with the
 * copy used by the article page hero (`[slug]/page.tsx`) — the two live in
 * different render trees, so the literal classes are declared in each.
 */
const ART_GRADIENTS: Record<string, string> = {
  pink: "from-pink-soft to-pink",
  lavender: "from-lavender-soft to-lavender",
  plum: "from-plum to-lavender-deep",
  honey: "from-[#f7d9a8] to-[#f2c078]",
  sage: "from-[#cfe8dc] to-[#74b795]",
  rose: "from-pink to-[#d18498]",
  sky: "from-[#cfe3f5] to-[#8fb8dd]",
};

function artGradient(art: string): string {
  return ART_GRADIENTS[art] ?? "from-lavender-soft to-lavender";
}

function categoryLabel(id: ArticleCategory): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Article";
}

/** Curated on-ramp for the "Start here" strip. */
const FEATURED_SLUGS = [
  "what-happens-during-a-period",
  "understanding-ovulation",
  "the-fertile-window",
  "mood-and-the-cycle",
];

/* ------------------------------------------------------------ hub view */

export function LearnClient({ articles, total }: { articles: Article[]; total: number }) {
  const [category, setCategory] = useState<ArticleCategory | "all">("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const map = new Map<ArticleCategory, number>();
    for (const article of articles) {
      map.set(article.category, (map.get(article.category) ?? 0) + 1);
    }
    return map;
  }, [articles]);

  const featured = useMemo(() => {
    const bySlug = new Map(articles.map((a) => [a.slug, a]));
    const picks = FEATURED_SLUGS.map((slug) => bySlug.get(slug)).filter(
      (a): a is Article => Boolean(a),
    );
    return (picks.length >= 3 ? picks : articles).slice(0, 4);
  }, [articles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (category !== "all" && article.category !== category) return false;
      if (!q) return true;
      return (
        article.title.toLowerCase().includes(q) ||
        article.summary.toLowerCase().includes(q) ||
        categoryLabel(article.category).toLowerCase().includes(q) ||
        article.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [articles, category, query]);

  const activeCategory =
    category === "all" ? null : (CATEGORIES.find((c) => c.id === category) ?? null);
  const isFiltering = activeCategory !== null || query.trim().length > 0;

  const resetFilters = () => {
    setCategory("all");
    setQuery("");
  };

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------- start here */}
      {featured.length > 0 && (
        <section aria-label="Recommended articles" className="animate-fade-up">
          <SectionHeading
            title="Start here"
            action={
              <span className="text-[12px] font-medium text-ink-faint">Editor&rsquo;s picks</span>
            }
          />
          {/* scroll-padding must match px-4 sm:px-6, otherwise scroll-snap-align
              start pushes the row to scrollLeft = padding and misaligns it
              against the section headings above. */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar scroll-pl-4 sm:-mx-6 sm:px-6 sm:scroll-pl-6">
            {featured.map((article, i) => (
              <FeaturedCard key={article.slug} article={article} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------ browse by topic */}
      <section aria-label="Browse by topic" className="animate-fade-up" style={stagger(60)}>
        <SectionHeading
          title="Browse by topic"
          action={
            <span className="text-[12px] font-medium text-ink-faint">
              {CATEGORIES.length} topics
            </span>
          }
        />
        <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 no-scrollbar scroll-pl-4 sm:-mx-6 sm:px-6 sm:scroll-pl-6">
          <CategoryTile
            label="All topics"
            blurb="Everything in the library"
            count={total}
            art="lavender"
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          {CATEGORIES.map((cat) => (
            <CategoryTile
              key={cat.id}
              label={cat.label}
              blurb={cat.blurb}
              count={counts.get(cat.id) ?? 0}
              art={cat.art}
              active={category === cat.id}
              onClick={() => setCategory(cat.id)}
            />
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- search */}
      <section aria-label="Search articles" className="animate-fade-up" style={stagger(120)}>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, topics or tags"
            aria-label="Search articles"
            className="h-12 w-full rounded-2xl border border-line-strong bg-card pl-10 pr-11 text-[14.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-lavender focus:ring-4 focus:ring-lavender-mist"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-faint transition-colors hover:bg-lavender-mist hover:text-plum"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        <div className="mt-4">
          <SectionHeading
            title={activeCategory ? activeCategory.label : "All articles"}
            action={
              <span className="text-[12.5px] text-ink-faint">
                {isFiltering ? `${filtered.length} of ${total}` : `${total} articles`}
              </span>
            }
          />
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {filtered.map((article, i) => (
              <ArticleCard key={article.slug} article={article} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Search className="size-5" aria-hidden />}
            title="Nothing matches that"
            description="Try a different word, or clear the filters to browse the whole Learn library."
            action={
              <Button size="sm" variant="secondary" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}

function stagger(ms: number) {
  return { animationDelay: `${ms}ms` } as const;
}

/* -------------------------------------------------------------- cards */

export function ArticleCard({ article, index = 0 }: { article: Article; index?: number }) {
  return (
    <div className="h-full animate-fade-up" style={stagger(Math.min(index, 8) * 55)}>
      <Link
        href={`/learn/${article.slug}`}
        className="group surface flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-lavender-soft hover:shadow-card"
      >
        <ArtBlock art={article.art} className="h-24">
          <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-plum backdrop-blur-sm">
            {categoryLabel(article.category)}
          </span>
        </ArtBlock>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-display text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-plum">
            {article.title}
          </h3>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
            {article.summary}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-faint">
              <BookOpen className="size-3.5" aria-hidden />
              {article.reading_minutes} min read
            </span>
            {article.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-cream-deep px-2 py-0.5 text-[11px] font-medium text-ink-soft"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </div>
  );
}

function FeaturedCard({ article, index }: { article: Article; index: number }) {
  return (
    <div className="w-[238px] shrink-0 snap-start animate-fade-up" style={stagger(index * 70)}>
      <Link
        href={`/learn/${article.slug}`}
        className="group surface flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-lavender-soft hover:shadow-card"
      >
        <ArtBlock art={article.art} className="h-28">
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-plum backdrop-blur-sm">
            <Sparkles className="size-3" aria-hidden />
            Featured
          </span>
        </ArtBlock>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h3 className="font-display text-[15.5px] font-semibold leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-plum">
            {article.title}
          </h3>
          <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft">
            {article.summary}
          </p>
          <span className="mt-auto inline-flex items-center gap-1.5 pt-1.5 text-[12px] font-medium text-ink-faint">
            <BookOpen className="size-3.5" aria-hidden />
            {article.reading_minutes} min read
          </span>
        </div>
      </Link>
    </div>
  );
}

/** Gradient artwork strip shared by every card, with soft decorative orbs. */
function ArtBlock({
  art,
  className,
  children,
}: {
  art: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-gradient-to-br",
        artGradient(art),
        className,
      )}
    >
      <span
        className="absolute -right-7 -top-9 size-28 rounded-full bg-white/30"
        aria-hidden
      />
      <span
        className="absolute -bottom-9 left-4 size-20 rounded-full bg-white/20"
        aria-hidden
      />
      {children}
    </div>
  );
}

/* ------------------------------------------------------ category tiles */

function CategoryTile({
  label,
  blurb,
  count,
  art,
  active,
  onClick,
}: {
  label: string;
  blurb: string;
  count: number;
  art: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "w-[172px] shrink-0 snap-start rounded-2xl border p-3 text-left transition-all duration-200",
        active
          ? "border-lavender bg-lavender-mist shadow-soft"
          : "border-line bg-card hover:border-lavender-soft hover:shadow-soft",
      )}
    >
      <span
        className={cn("mb-2.5 block h-2 w-9 rounded-full bg-gradient-to-br", artGradient(art))}
        aria-hidden
      />
      <span className="block text-[13.5px] font-semibold leading-tight text-ink">{label}</span>
      <span className="mt-1 block line-clamp-2 text-[11.5px] leading-snug text-ink-faint">
        {blurb}
      </span>
      <span
        className={cn(
          "mt-2 block text-[11px] font-medium",
          active ? "text-plum" : "text-lavender-deep",
        )}
      >
        {count} {count === 1 ? "article" : "articles"}
      </span>
    </button>
  );
}
