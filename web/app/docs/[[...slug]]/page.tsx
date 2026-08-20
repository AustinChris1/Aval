import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound, redirect } from "next/navigation";
import { marked } from "marked";
import { docsIndex } from "@/lib/generated/docs";
import { DocsNav } from "@/components/docs-nav";
import { Reveal } from "@/components/motion";
import { DocArticle } from "@/components/doc-article";

// Dynamic so the nav's chain switcher (a cookie read in the layout) stays live here too.
export const dynamic = "force-dynamic";

// Docs are copied into web/content by scripts/export-abis.ts; Vercel builds with web/ as root, so files above it do not exist at build time.
async function loadDoc(slug: string) {
  const file = path.join(process.cwd(), "content", `${slug}.md`);
  const raw = await readFile(file, "utf8");
  // Repository-path cross-references are rewritten to site routes where a page exists.
  const rewritten = raw
    .replace(/\]\(docs\/RESEARCH\.md\)/g, "](/docs/research)")
    .replace(/\]\(docs\/HOW-IT-WORKS\.md\)/g, "](/docs/how-it-works)")
    .replace(/\]\(docs\/GUIDE\.md\)/g, "](/docs/guide)")
    .replace(/\]\(docs\/OVERVIEW\.md\)/g, "](/docs/overview)")
    .replace(/\]\(\.\.\/README\.md\)/g, "](/docs/overview)");
  return marked.parse(rewritten, { async: false, gfm: true }) as string;
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const current = slug?.[0];

  // The sidebar is the index; /docs itself opens on the first document.
  if (!current) redirect(`/docs/${docsIndex[0]!.slug}`);

  const doc = docsIndex.find((d) => d.slug === current);
  if (!doc) notFound();

  let html: string;
  try {
    html = await loadDoc(current);
  } catch {
    notFound();
  }

  return (
    <div className="grid gap-12 pt-12 pb-8 lg:grid-cols-[230px_minmax(0,1fr)]">
      <DocsNav docs={docsIndex} current={current} />
      <Reveal key={current} className="min-w-0">
        <DocArticle html={html} />
      </Reveal>
    </div>
  );
}
