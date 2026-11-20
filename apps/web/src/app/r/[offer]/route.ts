import { NextResponse, type NextRequest } from "next/server";
import { anonClient } from "@/lib/public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, ctx: RouteContext<"/r/[offer]">) {
  const { offer } = await ctx.params;
  const q = request.nextUrl.searchParams;
  if (!UUID.test(offer)) return new NextResponse("Oferta não encontrada", { status: 404 });

  const ref = request.headers.get("referer");
  const { data: url } = await anonClient().rpc("track_click", {
    p_offer: offer,
    p_campaign: q.get("c"),
    p_channel: q.get("ch") ?? (q.get("fb") ? "meta" : q.get("tt") ? "tiktok" : null),
    p_page: q.get("p"),
    p_utm_source: q.get("utm_source"),
    p_utm_medium: q.get("utm_medium"),
    p_utm_campaign: q.get("utm_campaign"),
    p_fbclid: q.has("fb") || q.has("fbclid"),
    p_ttclid: q.has("tt") || q.has("ttclid"),
    p_referrer: ref ? new URL(ref).host : null,
  });

  if (typeof url !== "string" || !/^https:\/\//.test(url)) {
    return new NextResponse("Esta oferta não está mais disponível.", { status: 410, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer-when-downgrade" } });
}
