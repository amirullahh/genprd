"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles, Wand2 } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { errMsg, streamText } from "@/lib/client";

const NO_FINDINGS = "Tidak ada temuan signifikan.";

export function ReviewPanel({
  reviewUrl,
  polishUrl,
  onApplied,
}: {
  reviewUrl: string;
  polishUrl: string;
  onApplied: () => Promise<void>;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [findings, setFindings] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  async function review() {
    setReviewing(true);
    setFindings("");
    try {
      await streamText(reviewUrl, {}, setFindings);
    } catch (e) {
      toast.error(errMsg(e));
      setFindings(null);
    } finally {
      setReviewing(false);
    }
  }

  async function apply() {
    if (!findings) return;
    setApplying(true);
    try {
      await streamText(polishUrl, { findings }, () => {});
      toast.success("Perbaikan diterapkan sebagai versi baru");
      setFindings(null);
      await onApplied();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setApplying(false);
    }
  }

  const noIssues = findings?.trim() === NO_FINDINGS;

  return (
    <div className="no-print mx-4 mt-3">
      <Button size="sm" variant="outline" onClick={review} loading={reviewing}>
        <Sparkles className="h-3.5 w-3.5" /> Cek kualitas
      </Button>
      {findings !== null && (
        <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Hasil review kualitas</span>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setFindings(null)}>
              Tutup
            </button>
          </div>
          {reviewing && !findings ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="text-primary" /> Memeriksa…
            </div>
          ) : (
            <Markdown content={findings} className="prose-sm" streaming={reviewing} />
          )}
          {!reviewing && !noIssues && findings && (
            <Button size="sm" className="mt-3" onClick={apply} loading={applying}>
              <Wand2 className="h-3.5 w-3.5" /> Terapkan perbaikan
            </Button>
          )}
          {!reviewing && noIssues && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
              <Check className="h-3.5 w-3.5" /> Tidak ada temuan signifikan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
