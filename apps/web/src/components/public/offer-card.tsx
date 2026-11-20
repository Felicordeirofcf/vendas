import { OfferCta } from "@/components/public/offer-cta";
import { brl, dateTime } from "@/lib/format";
import type { PublicOffer } from "@/lib/public";
import { PLATFORM_LABEL } from "@/lib/types";

function lines(s?: string | null) {
  return (s ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export function OfferCard({ offer, href, rank, detailed = false }: { offer: PublicOffer; href: string; rank?: number; detailed?: boolean }) {
  const pros = lines(offer.pros);
  const cons = lines(offer.cons);
  const off = offer.discount_pct ? Math.round(Number(offer.discount_pct)) : 0;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <div className="relative aspect-square bg-ground">
        {offer.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.image_url} alt={offer.title} loading="lazy" className="h-full w-full object-contain p-3" />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-muted">{offer.title}</div>
        )}
        {off ? <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-xs font-extrabold text-white">-{off}%</span> : null}
        {rank ? <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-extrabold">{rank}</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        {offer.headline ? <p className="text-xs font-bold uppercase tracking-wider text-muted">{offer.headline}</p> : null}
        <h3 className="text-base font-bold leading-snug">{offer.title}</h3>
        {detailed && offer.blurb ? <p className="text-sm leading-relaxed text-[#4a4843]">{offer.blurb}</p> : null}
        {detailed && (pros.length || cons.length) ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {pros.length ? <div><p className="mb-1 font-bold text-green-800">Vantagens</p><ul className="space-y-1">{pros.map((p, i) => <li key={i}>✓ {p}</li>)}</ul></div> : null}
            {cons.length ? <div><p className="mb-1 font-bold text-orange-800">Atenção</p><ul className="space-y-1">{cons.map((p, i) => <li key={i}>• {p}</li>)}</ul></div> : null}
          </div>
        ) : null}
        <div className="mt-auto">
          {offer.stale ? (
            <p className="text-sm font-semibold text-muted">Confira o preço atual na loja</p>
          ) : (
            <p>
              {offer.price_from && offer.price_to && Number(offer.price_from) > Number(offer.price_to) ? <span className="mr-2 text-sm text-muted line-through">{brl(offer.price_from)}</span> : null}
              <span className="text-2xl font-extrabold">{brl(offer.price_to)}</span>
            </p>
          )}
          <p className="text-[11px] text-muted">
            {PLATFORM_LABEL[offer.platform]}{offer.stale ? "" : ` · preço visto em ${dateTime(offer.price_checked_at)}, pode mudar`}
          </p>
        </div>
        <OfferCta href={href} offerId={offer.id} title={offer.title} price={offer.price_to} label={`Ver no ${PLATFORM_LABEL[offer.platform]}`} />
      </div>
    </article>
  );
}
