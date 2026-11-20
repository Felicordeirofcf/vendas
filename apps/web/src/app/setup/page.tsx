import { redirect } from "next/navigation";
import { isConfigured } from "@/lib/env";

export default function Setup() {
  if (isConfigured()) redirect("/");
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-extrabold">Falta conectar o banco</h1>
      <p className="mt-2 text-muted">O app está no ar, mas ainda sem as variáveis do Supabase.</p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm">
        <li>Crie um projeto no Supabase e rode <code>supabase/migrations/0001_init.sql</code> no SQL Editor.</li>
        <li>Na Vercel, em Settings → Environment Variables, adicione <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.</li>
        <li>Faça um novo deploy.</li>
      </ol>
    </main>
  );
}
