"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string };

export async function authAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const mode = String(form.get("mode") ?? "signin");
  const supabase = await createClient();

  if (mode === "signup") {
    const allowed = (process.env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.includes(email)) return { error: "Cadastro fechado para este e-mail." };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.session) return { info: "Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "E-mail ou senha inválidos." };
  }
  redirect("/");
}
