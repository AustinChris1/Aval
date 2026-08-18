import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { ArrowLeft, ArrowRight, BookText } from "lucide-react";
import { docsIndex } from "@/lib/generated/docs";
import { Panel } from "@/components/ui";
import { DrawRule, Reveal, SplitHeadline } from "@/components/motion";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ slug: [] as string[] }, ...docsIndex.map((d) => ({ slug: [d.slug] }))];
}

/**
 * The documents are copied into web/content by scripts/export-abis.ts rather than
 * read across the repository boundary: Vercel builds this project with `web` as
 * its root directory, so anything above it does not exist at build time.
 */
async function loadDoc(slug: string) {
  const file = path.join(process.cwd(), "content", `${slug}.md`);
  const raw = await readFile(file, "utf8");
  // Cross-references in the source markdown point at repository paths. Rewrite
  // the ones that have a page here so they work as site navigation.
  const rewritten = raw
    .replace(/\]\(docs\/RESEARCH\.md\)/g, "](/docs/research)")
    .replace(/\]\(docs\/SUBMISSION\.md\)/g, "](/docs/submission)")
    .replace(/\]\(\.\.\/README\.md\)/g, "](/docs/overview)");
  return marked.parse(rewritten, { async: false, gfm: true }) as string;
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const current = slug?.[0];

  if (!current) {
    return (
      <>
        <section className="pt-16 pb-12">
          <div className="mb-5 font-mono text-[11px] tracking-[0.18em] text-brass/70 uppercase">
            documentation
          </div>
          <h1 className="max-w-[20ch] font-display text-[44px] leading-[1.05] tracking-[-0.015em] text-ink sm:text-[64px]">
            <SplitHeadline text="Everything, written down." />
          </h1>
          <Reveal delay={0.3} className="mt-7 max-w-[64ch]">
            <p className="text-[16.5px] leading-relaxed text-ink-soft">
              The same documents that ship in the repository, rendered here — including the research
              file, which contains three corrections to widely-repeated claims about BOT Chain, each
              verified against the live RPC rather than taken from documentation.
            </p>
          </Reveal>
        </section>

        <DrawRule />

        <section className="py-14">
          <div className="grid gap-4 md:grid-cols-3">
            {docsIndex.map((doc, i) => (
              <Reveal key={doc.slug} delay={i * 0.08}>
                <Link href={`/docs/${doc.slug}`} className="group block h-full">
                  <Panel className="flex h-full flex-col p-6 group-hover:border-brass-deep">
                    <BookText className="size-5 text-brass" />
                    <h2 className="mt-4 font-display text-[24px] leading-tight text-ink">
                      {doc.title}
                    </h2>
                    <p className="mt-2.5 flex-1 text-[13.5px] leading-relaxed text-ink-soft">
                      {doc.blurb}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-verd">
                      Read
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Panel>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      </>
    );
  }

  const doc = docsIndex.find((d) => d.slug === current);
  if (!doc) notFound();

  let html: string;
  try {
    html = await loadDoc(current);
  } catch {
    notFound();
  }

  const others = docsIndex.filter((d) => d.slug !== current);

  return (
    <>
      <section className="pt-14 pb-9">
        <Link
          href="/docs"
          className="group inline-flex items-center gap-1.5 text-[13px] text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          all documents
        </Link>
      </section>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_230px]">
        <Reveal>
          <article
            className="prose-letter max-w-[76ch]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Reveal>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="mb-3 font-mono text-[11px] tracking-[0.18em] text-brass/70 uppercase">
            also in the pack
          </div>
          <div className="space-y-3">
            {others.map((d) => (
              <Link key={d.slug} href={`/docs/${d.slug}`} className="group block">
                <Panel className="p-4 group-hover:border-brass-deep">
                  <div className="text-[13.5px] font-semibold text-ink">{d.title}</div>
                  <div className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">{d.blurb}</div>
                </Panel>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
