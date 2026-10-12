"use client";

import { memo, useEffect, useId, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTheme } from "next-themes";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function headingId(text: string) {
  return (
    "h-" +
    text
      .toLowerCase()
      .replace(/[*_`~[\]()]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
  );
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

export function outline(md: string) {
  const items: { level: number; text: string; id: string }[] = [];
  let inCode = false;
  for (const line of md.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inCode = !inCode;
    if (inCode) continue;
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*$/);
    if (m) {
      const text = m[2].replace(/[*_`]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
      items.push({ level: m[1].length, text, id: headingId(text) });
    }
  }
  return items;
}

function Mermaid({ code, streaming }: { code: string; streaming?: boolean }) {
  const { resolvedTheme } = useTheme();
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (streaming) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: resolvedTheme === "dark" ? "dark" : "default", securityLevel: "strict", suppressErrorRendering: true });
        const { svg } = await mermaid.render(`m${id}${Date.now()}`, code);
        if (!cancelled) {
          setSvg(svg);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, resolvedTheme, id, streaming]);
  if (streaming || (!svg && !error)) return <div className="my-4 rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">Rendering diagram…</div>;
  if (error)
    return (
      <pre className="my-4 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
        <code>{code}</code>
      </pre>
    );
  return <div className="not-prose my-4 flex justify-center overflow-x-auto rounded-lg border bg-card p-4" dangerouslySetInnerHTML={{ __html: svg! }} />;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="not-prose group relative my-4">
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 bg-muted px-3 py-1 text-[11px] text-muted-foreground">
        <span className="font-mono">{lang || "text"}</span>
        <button
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Disalin" : "Salin"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-b-lg border bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const H = (Tag: "h1" | "h2" | "h3") =>
  function Heading({ children }: { children?: ReactNode }) {
    return <Tag id={headingId(textOf(children))}>{children}</Tag>;
  };
const H1 = H("h1");
const H2 = H("h2");
const H3 = H("h3");

export const Markdown = memo(function Markdown({ content, streaming, className }: { content: string; streaming?: boolean; className?: string }) {
  return (
    <div className={cn("prose-prd", streaming && "caret", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: H1,
          h2: H2,
          h3: H3,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const lang = /language-(\w+)/.exec(className ?? "")?.[1];
            const code = String(children).replace(/\n$/, "");
            if (!lang && !code.includes("\n")) return <code className={className}>{children}</code>;
            if (lang === "mermaid") return <Mermaid code={code} streaming={streaming} />;
            return <CodeBlock code={code} lang={lang ?? ""} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
