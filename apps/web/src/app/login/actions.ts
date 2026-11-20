"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string; unconfirmed?: boolean };

export async function authAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const mode = String(form.getAll("mode").at(-1) ?? "signin");
  const supabase = await createClient();

  if (mode === "resend") {
    const origin = (await headers()).get("origin") ?? "";
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin}/auth/confirm` } });
    if (error) return { error: error.message };
    return { info: "E-mail de confirmação reenviado. Veja a caixa de entrada e o spam." };
  }

  if (mode === "signup") {
    const allowed = (process.env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.includes(email)) return { error: "Cadastro fechado para este e-mail." };
    const origin = (await headers()).get("origin") ?? "";
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/confirm` } });
    if (error) return { error: error.message };
    if (!data.session) return { info: "Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error?.code === "email_not_confirmed") {
      return { error: "Seu e-mail ainda não foi confirmado. Abra o link que o Supabase enviou (veja o spam) ou reenvie abaixo.", unconfirmed: true };
    }
    if (error) return { error: "E-mail ou senha inválidos." };
  }
  redirect("/");
}
