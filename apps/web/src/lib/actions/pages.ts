"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { slugify } from "@/lib/format";

export async function createPage(form: FormData) {
  const { supabase } = await requireUser();
  const storeSlug = String(form.get("store_slug"));
  const title = String(form.get("title") ?? "").trim();
  if (!title) return;
  const { data, error } = await supabase.from("landing_pages").insert({
    store_id: String(form.get("store_id")),
    title,
    slug: slugify(String(form.get("slug") || title)).slice(0, 60),
  }).select("id").single();
  if (error) throw new Error(error.code === "23505" ? "Já existe uma página com esse endereço." : error.message);
  redirect(`/s/${storeSlug}/paginas/${data.id}`);
}

export async function savePage(form: FormData) {
  const { supabase } = await requireUser();
  const id = String(form.get("id"));
  await supabase.from("landing_pages").update({
    title: String(form.get("title") ?? "").trim(),
    slug: slugify(String(form.get("slug") ?? "")).slice(0, 60),
    intro: String(form.get("intro") ?? "") || null,
    outro: String(form.get("outro") ?? "") || null,
    published: form.get("published") === "on",
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  const itemIds = form.getAll("item_id").map(String);
  for (const [i, itemId] of itemIds.entries()) {
    await supabase.from("landing_page_items").update({
      position: Number(form.get(`position_${itemId}`) ?? i),
      headline: String(form.get(`headline_${itemId}`) ?? "") || null,
      blurb: String(form.get(`blurb_${itemId}`) ?? "") || null,
      pros: String(form.get(`pros_${itemId}`) ?? "") || null,
      cons: String(form.get(`cons_${itemId}`) ?? "") || null,
    }).eq("id", itemId);
  }
  revalidatePath("/", "layout");
}

export async function addPageItem(form: FormData) {
  const { supabase } = await requireUser();
  const pageId = String(form.get("page_id"));
  const { count } = await supabase.from("landing_page_items").select("id", { count: "exact", head: true }).eq("page_id", pageId);
  await supabase.from("landing_page_items").insert({
    store_id: String(form.get("store_id")), page_id: pageId, offer_id: String(form.get("offer_id")), position: (count ?? 0) + 1,
  });
  revalidatePath("/", "layout");
}

export async function removePageItem(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("landing_page_items").delete().eq("id", String(form.get("remove_id")));
  revalidatePath("/", "layout");
}

export async function deletePage(form: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("landing_pages").delete().eq("id", String(form.get("id")));
  redirect(`/s/${String(form.get("store_slug"))}/paginas`);
}
