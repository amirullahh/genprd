"use client";

import { useEffect } from "react";

/** Opens the print dialog (Save as PDF) once diagrams have had time to render. */
export function PrintOnLoad() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    const t = setTimeout(() => window.print(), 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print mb-6 rounded-lg border bg-neutral-50 p-3 text-sm text-neutral-600">
      Pilih <b>Save as PDF</b> di dialog print untuk menyimpan PRD sebagai PDF.{" "}
      <button className="font-medium text-indigo-600 underline" onClick={() => window.print()}>
        Buka dialog print
      </button>
    </div>
  );
}
