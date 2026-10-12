"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Globe, RefreshCw } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import { api, copyText, errMsg } from "@/lib/client";
import { timeAgo } from "@/lib/utils";
import { usePlan } from "./context";

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, setData } = usePlan();
  const { plan } = data;
  const [loading, setLoading] = useState<"share" | "unshare" | null>(null);
  const url = plan.shareSlug && typeof window !== "undefined" ? `${window.location.origin}/s/${plan.shareSlug}` : "";
  const outdated = plan.sharedAt && new Date(plan.updatedAt).getTime() > new Date(plan.sharedAt).getTime() + 2000;

  async function share() {
    setLoading("share");
    try {
      const { slug } = await api<{ slug: string }>(`/api/plans/${plan.id}/share`, { method: "POST" });
      const now = new Date().toISOString();
      setData((d) => ({ ...d, plan: { ...d.plan, shareSlug: slug, sharedAt: now, updatedAt: now, hasSnapshot: true } }));
      toast.success(plan.shareSlug ? "Versi dibagikan diperbarui" : "Plan dibagikan");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(null);
    }
  }

  async function unshare() {
    setLoading("unshare");
    try {
      await api(`/api/plans/${plan.id}/share`, { method: "DELETE" });
      setData((d) => ({ ...d, plan: { ...d.plan, shareSlug: null, sharedAt: null, hasSnapshot: false } }));
      toast.success("Plan tidak lagi dibagikan");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bagikan plan"
      description="Siapa pun dengan tautan bisa MELIHAT (read-only) versi beku plan ini. Untuk mengubah, mereka harus fork ke akun sendiri."
    >
      {plan.shareSlug ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => copyText(url, "Link disalin")} aria-label="Salin link">
              <Copy className="h-4 w-4" />
            </Button>
            <a href={url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Buka">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Dibagikan {plan.sharedAt ? timeAgo(plan.sharedAt) : ""}.{" "}
            {outdated && <span className="text-warning">Ada perubahan yang belum dipublikasikan ke versi dibagikan.</span>}
          </p>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" className="text-danger" onClick={unshare} loading={loading === "unshare"}>
              Berhenti bagikan
            </Button>
            <Button onClick={share} loading={loading === "share"}>
              <RefreshCw className="h-4 w-4" /> Perbarui versi dibagikan
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            PRD, fitur, dan task di plan ini akan ikut terlihat publik. API key dan chat kamu tidak ikut dibagikan.
          </div>
          <Button className="w-full" onClick={share} loading={loading === "share"}>
            <Globe className="h-4 w-4" /> Bagikan (publik)
          </Button>
        </div>
      )}
    </Modal>
  );
}
