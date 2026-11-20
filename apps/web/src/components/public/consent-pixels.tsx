"use client";
import Script from "next/script";
import { useEffect, useState } from "react";

const KEY = "vendas_cookie_consent";
const SAFE_ID = /^[A-Za-z0-9_-]{5,40}$/;

declare global {
  interface Window { fbq?: (...a: unknown[]) => void; ttq?: { track: (e: string, d?: object) => void; page: () => void } }
}

export function trackEvent(name: "ViewContent" | "ClickOffer", data: Record<string, unknown> = {}) {
  try {
    if (name === "ClickOffer") {
      window.fbq?.("trackCustom", "ClickOffer", data);
      window.fbq?.("track", "Lead", data);
      window.ttq?.track("ClickButton", data);
    } else {
      window.fbq?.("track", "ViewContent", data);
      window.ttq?.track("ViewContent", data);
    }
  } catch { /* pixel bloqueado */ }
}

export function ConsentPixels({ metaPixelId, tiktokPixelId, privacyHref }: { metaPixelId?: string | null; tiktokPixelId?: string | null; privacyHref: string }) {
  const [consent, setConsent] = useState<"yes" | "no" | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const v = localStorage.getItem(KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(v === "yes" || v === "no" ? v : null);
    setReady(true);
  }, []);

  const meta = metaPixelId && SAFE_ID.test(metaPixelId) ? metaPixelId : null;
  const tiktok = tiktokPixelId && SAFE_ID.test(tiktokPixelId) ? tiktokPixelId : null;
  const hasPixels = Boolean(meta || tiktok);
  const choose = (v: "yes" | "no") => { localStorage.setItem(KEY, v); setConsent(v); };

  return (
    <>
      {consent === "yes" && meta ? (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta}');fbq('track','PageView');`}</Script>
      ) : null}
      {consent === "yes" && tiktok ? (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktok}');ttq.page();}(window,document,'ttq');`}</Script>
      ) : null}
      {ready && hasPixels && consent === null ? (
        <div role="dialog" aria-label="Aviso de cookies" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm shadow-lg">
          <p className="flex-[1_1_240px]">Usamos cookies de medição de anúncios (Meta/TikTok) para saber quais ofertas interessam. <a href={privacyHref} className="underline">Privacidade</a></p>
          <div className="flex gap-2">
            <button type="button" onClick={() => choose("no")} className="min-h-10 cursor-pointer rounded-xl border border-line px-4 font-semibold">Recusar</button>
            <button type="button" onClick={() => choose("yes")} className="min-h-10 cursor-pointer rounded-xl bg-ink px-4 font-semibold text-white">Aceitar</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
