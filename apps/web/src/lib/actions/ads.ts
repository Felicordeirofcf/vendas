"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { parseMoney } from "@/lib/format";

export async function createCampaign(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("ad_campaigns").insert({
    store_id: String(form.get("store_id")),
    platform: String(form.get("platform") || "tiktok_promote"),
    name: String(form.get("name") || "Campanha"),
    offer_id: String(form.get("offer_id") || "") || null,
    started_at: String(form.get("started_at") || "") || null,
    ended_at: String(form.get("ended_at") || "") || null,
  });
  revalidatePath(`/s`, "layout");
}

export async function addSpend(form: FormData) {
  const { supabase } = await requireUser();
  const amount = parseMoney(form.get("amount"));
  if (amount === null) return;
  await supabase.from("ad_spend").upsert({
    store_id: String(form.get("store_id")),
    campaign_id: String(form.get("campaign_id")),
    date: String(form.get("date")),
    amount,
    impressions: Number(form.get("impressions") || 0) || null,
    clicks: Number(form.get("clicks") || 0) || null,
  }, { onConflict: "campaign_id,date" });
  revalidatePath(`/s`, "layout");
}

export async function deleteCampaign(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("ad_campaigns").delete().eq("id", String(form.get("id")));
  revalidatePath(`/s`, "layout");
}
