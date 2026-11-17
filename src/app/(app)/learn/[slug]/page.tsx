import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { getSessionUser } from "@/lib/auth";
import { getArticle, listArticles } from "@/lib/queries";
import { CATEGORIES } from "@/lib/content";
import { Badge, Callout, SectionHeading } from "@/components/ui";
import { ArticleCard } from "../learn-client";
import { ArticleBody } from "./article-body";

export const dynamic = "force-dynamic";

/**
 * Gradient tokens for the `art` field. Mirrors the map in `../learn-client.tsx`
 * — client modules cannot export plain values to the server render, so the
 * literal classes are declared here as well (both must stay in sync).
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

/** Single long-form article, rendered straight from the seeded `articles` row. */
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const category = CATEGORIES.find((c) => c.id === article.category);
  const related = (await listArticles(article.category))
    .filter((a) => a.slug !== article.slug)
    .slice(0, 2);

  return (
    <article className="space-y-6 animate-fade-up">
      {/* ------------------------------------------------------ back link */}
      <Link
        href="/learn"
        className="group -ml-1.5 inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-[13.5px] font-medium text-ink-soft transition-colors hover:text-plum"
      >
        <ArrowLeft
          className="size-4 transition-transform group-hover:-translate-x-0.5"
          aria-hidden
        />
        Back to Learn
      </Link>

      {/* ---------------------------------------------------------- hero */}
      <header className="space-y-4">
        <div
          className={cn(
            "relative h-40 overflow-hidden rounded-[28px] bg-gradient-to-br shadow-card sm:h-48",
            artGradient(article.art),
          )}
        >
          <span
            className="absolute -right-12 -top-16 size-48 rounded-full bg-white/25"
            aria-hidden
          />
          <span
            className="absolute -bottom-16 left-10 size-36 rounded-full bg-white/20"
            aria-hidden
          />
          <span
            className="absolute inset-0 bg-gradient-to-t from-plum-deep/30 via-transparent to-transparent"
            aria-hidden
          />
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-[11.5px] font-semibold text-plum backdrop-blur-sm">
            <Sparkles className="size-3.5" aria-hidden />
            Learn
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone="lavender">{category?.label ?? "Article"}</Badge>
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-faint">
              <BookOpen className="size-3.5" aria-hidden />
              {article.reading_minutes} min read
            </span>
            <span className="text-[12.5px] text-ink-faint">
              Reviewed by the Lunara editorial team
            </span>
          </div>

          <h1 className="font-display text-[27px] font-semibold leading-[1.18] tracking-[-0.02em] text-ink sm:text-[30px]">
            {article.title}
          </h1>

          <p className="text-[15px] leading-[1.7] text-ink-soft">{article.summary}</p>

          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Badge key={tag} tone="pink">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* --------------------------------------------------------- body */}
      <div className="surface p-5 sm:p-6">
        <ArticleBody blocks={article.body} />
      </div>

      {/* --------------------------------------------------- disclaimer */}
      <Callout kind="info">
        Lunara&rsquo;s Learn library is general health education — it describes what is
        typically true for many people, and is <strong>not medical advice</strong>. Nothing
        here replaces a consultation with a qualified clinician who knows your history.
      </Callout>

      {/* ------------------------------------------------------- related */}
      {related.length > 0 && (
        <section aria-label="Related articles" className="space-y-3">
          <SectionHeading
            title="Keep reading"
            action={
              <Link
                href="/learn"
                className="inline-flex items-center gap-0.5 text-[12.5px] font-medium text-lavender-deep transition-colors hover:text-plum"
              >
                All articles
                <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {related.map((a, i) => (
              <ArticleCard key={a.slug} article={a} index={i} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
