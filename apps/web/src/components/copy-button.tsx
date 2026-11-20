"use client";
import { useState } from "react";

export function CopyButton({ text, label = "Copiar", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className ?? "inline-flex min-h-9 items-center rounded-lg border border-ink bg-white px-3 text-xs font-bold cursor-pointer"}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? "Copiado ✓" : label}
    </button>
  );
}
