"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Store } from "@/lib/types";

const ICONS: Record<string, string> = {
  inicio: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  catalogo: "M20 7l-8-4-8 4 8 4 8-4zM4 7v10l8 4 8-4V7M12 11v10",
  importar: "M12 3v12M7 10l5 5 5-5M4 21h16",
  conteudo: "M4 4h16v12H4zM8 20h8M10 8l5 3-5 3z",
  calendario: "M3 5h18v16H3zM16 3v4M8 3v4M3 10h18",
  whatsapp: "M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z",
  telegram: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  anuncios: "M3 11v2l12 5V6L3 11zM15 9a3 3 0 0 1 0 6M6 13v5h3",
  relatorios: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h7M9 17h7",
  config: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.5-1.5M5.5 18.5L7 17M17 17l1.5 1.5M5.5 5.5L7 7",
};

function Icon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Sidebar({ store, stores, badges }: { store: Store; stores: Store[]; badges: Record<string, number> }) {
  const path = usePathname();
  const router = useRouter();
  const base = `/s/${store.slug}`;
  const groups: { title?: string; items: { href: string; label: string; icon: string; badge?: number }[] }[] = [
    {
      items: [
        { href: base, label: "Início", icon: "inicio" },
        { href: `${base}/catalogo`, label: "Catálogo", icon: "catalogo", badge: badges.stale },
        { href: `${base}/importar`, label: "Importar", icon: "importar" },
        { href: `${base}/conteudo`, label: "Conteúdo", icon: "conteudo" },
        { href: `${base}/calendario`, label: "Calendário", icon: "calendario" },
      ],
    },
    {
      title: "DISTRIBUIÇÃO",
      items: [
        { href: `${base}/fila-whatsapp`, label: "Fila do WhatsApp", icon: "whatsapp", badge: badges.whatsapp },
        { href: `${base}/anuncios`, label: "Anúncios", icon: "anuncios" },
        { href: `${base}/relatorios`, label: "Relatórios", icon: "relatorios" },
      ],
    },
  ];

  return (
    <nav aria-label="Menu principal" className="flex w-full flex-col gap-5 border-b border-line bg-white p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
      <div className="flex items-center gap-3 rounded-xl border border-line p-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-lg" aria-hidden="true">
          {store.brand.emoji || "🏠"}
        </span>
        <label className="flex min-w-0 flex-1 flex-col">
          <span className="sr-only">Loja</span>
          <select
            className="w-full cursor-pointer truncate bg-transparent text-sm font-bold outline-none"
            value={store.slug}
            onChange={(e) => router.push(e.target.value === "__nova" ? "/lojas/nova" : `/s/${e.target.value}`)}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.slug}>{s.name}</option>
            ))}
            <option value="__nova">+ Nova loja</option>
          </select>
          <span className="truncate text-xs text-muted">{store.niche || "sem nicho"}</span>
        </label>
      </div>

      {groups.map((g, i) => (
        <div key={i} className="flex flex-col gap-1">
          {g.title ? <span className="px-3 pb-1 text-[11px] font-bold tracking-wider text-muted">{g.title}</span> : null}
          {g.items.map((it) => {
            const active = it.href === base ? path === base : path.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${active ? "tint font-bold" : "font-medium text-[#4a4843] hover:bg-ground"}`}
              >
                <Icon name={it.icon} />
                <span className="flex-1">{it.label}</span>
                {it.badge ? <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">{it.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
        <Link href={`${base}/config`} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${path.startsWith(`${base}/config`) ? "tint font-bold" : "font-medium text-[#4a4843] hover:bg-ground"}`}>
          <Icon name="config" />
          Configurar loja
        </Link>
        <form action="/auth/signout" method="post">
          <button className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#4a4843] hover:bg-ground">
            Sair
          </button>
        </form>
      </div>
    </nav>
  );
}
