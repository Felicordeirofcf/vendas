import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function listStores() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("stores").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Store[];
}

export async function getStore(slug: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("stores").select("*").eq("slug", slug).maybeSingle();
  if (!data) notFound();
  return { supabase, user, store: data as Store };
}
