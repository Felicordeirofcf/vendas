"use client";
import { useEffect } from "react";
import { trackEvent } from "@/components/public/consent-pixels";

export function OfferCta({ href, offerId, title, price, label }: { href: string; offerId: string; title: string; price: number | null; label: string }) {
  return (
    <a
      href={href}
      rel="sponsored nofollow noopener"
      onClick={() => trackEvent("ClickOffer", { content_ids: [offerId], content_name: title, value: price ?? undefined, currency: "BRL" })}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-base font-extrabold text-ink hover:brightness-95"
    >
      {label}
    </a>
  );
}

export function ViewTracker({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    const t = setTimeout(() => trackEvent("ViewContent", { content_ids: key.split(",") }), 1500);
    return () => clearTimeout(t);
  }, [key]);
  return null;
}
