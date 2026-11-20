"use client";
import { useActionState } from "react";
import { saveStore, type StoreState } from "@/lib/actions/stores";
import { btnCls, Card, CardTitle, Field, inputCls } from "@/components/ui";
import type { Store } from "@/lib/types";

type Channel = { type: string; handle: string | null; url: string | null; account_type: string | null };
type Account = { platform: string; label: string };

const CH = [
  { type: "instagram", label: "Instagram", ph: "@achei.pracasa.oficial" },
  { type: "tiktok", label: "TikTok", ph: "@achei.pracasa.oficial" },
  { type: "whatsapp_channel", label: "Canal do WhatsApp", ph: "Achei pra Casa" },
  { type: "telegram", label: "Telegram", ph: "@canal" },
];

export function StoreForm({ store, channels = [], accounts = [] }: { store?: Store; channels?: Channel[]; accounts?: Account[] }) {
  const [state, action, pending] = useActionState<StoreState, FormData>(saveStore, {});
  const ch = (t: string) => channels.find((c) => c.type === t);
  const acc = (p: string) => accounts.find((a) => a.platform === p)?.label ?? "";
  const b = store?.brand ?? {};
  return (
    <form action={action} className="grid gap-4 lg:grid-cols-2">
      {store ? <><input type="hidden" name="id" value={store.id} /><input type="hidden" name="current_slug" value={store.slug} /></> : null}
      <Card>
        <CardTitle>Loja</CardTitle>
        <div className="grid gap-3">
          <Field label="Nome"><input className={inputCls} name="name" required defaultValue={store?.name} placeholder="Achei pra Casa" /></Field>
          <Field label="Endereço (slug)" hint="Usado na URL. Deixe vazio para gerar do nome."><input className={inputCls} name="slug" defaultValue={store?.slug} placeholder="achei-pra-casa" /></Field>
          <Field label="Nicho"><input className={inputCls} name="niche" defaultValue={store?.niche ?? ""} placeholder="casa e cozinha" /></Field>
        </div>
      </Card>
      <Card>
        <CardTitle>Identidade visual</CardTitle>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Primária"><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-line" name="primary" defaultValue={b.primary ?? "#FF6B35"} /></Field>
          <Field label="Secundária"><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-line" name="secondary" defaultValue={b.secondary ?? "#FFD23F"} /></Field>
          <Field label="Escura"><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-line" name="dark" defaultValue={b.dark ?? "#2B2B2B"} /></Field>
        </div>
        <div className="mt-3 grid gap-3">
          <Field label="Emoji / ícone"><input className={inputCls} name="emoji" defaultValue={b.emoji ?? "🏠"} maxLength={4} /></Field>
          <Field label="Hashtags padrão" hint="#publi é sempre incluída automaticamente."><input className={inputCls} name="hashtags" defaultValue={(b.hashtags ?? []).map((t) => `#${t}`).join(" ")} placeholder="#achadinhos #casa #cozinha #acheipracasa" /></Field>
          <Field label="Chamada para o link (Instagram)"><input className={inputCls} name="bio_cta" defaultValue={b.bio_cta ?? ""} placeholder="Link no canal do WhatsApp (link na bio) 👆" /></Field>
        </div>
      </Card>
      <Card>
        <CardTitle>Redes e canais</CardTitle>
        <div className="grid gap-4">
          {CH.map((c) => (
            <fieldset key={c.type} className="grid gap-2 sm:grid-cols-3">
              <legend className="mb-1 text-sm font-semibold">{c.label}</legend>
              <input aria-label={`${c.label}: perfil`} className={inputCls} name={`${c.type}_handle`} defaultValue={ch(c.type)?.handle ?? ""} placeholder={c.ph} />
              <input aria-label={`${c.label}: link`} className={inputCls} name={`${c.type}_url`} defaultValue={ch(c.type)?.url ?? ""} placeholder="https://…" />
              <input aria-label={`${c.label}: tipo de conta`} className={inputCls} name={`${c.type}_account`} defaultValue={ch(c.type)?.account_type ?? ""} placeholder="criador / pessoal" />
            </fieldset>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle>Contas de afiliado</CardTitle>
        <div className="grid gap-3">
          <Field label="Mercado Livre · apelido / etiqueta"><input className={inputCls} name="mercadolivre_label" defaultValue={acc("mercadolivre")} placeholder="acheipracasa" /></Field>
          <Field label="Shopee · identificação" hint="As chaves da API ficam só em variáveis de ambiente, nunca aqui."><input className={inputCls} name="shopee_label" defaultValue={acc("shopee")} placeholder="conta principal" /></Field>
        </div>
      </Card>
      <Card>
        <CardTitle>Vitrine e anúncios</CardTitle>
        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_public" defaultChecked={store?.is_public ?? true} /> Vitrine pública ativa (/v/{store?.slug ?? "sua-loja"})</label>
          <Field label="ID do Pixel da Meta" hint="Só o número (Gerenciador de Eventos). Não é segredo."><input className={inputCls} name="meta_pixel_id" defaultValue={store?.tracking?.meta_pixel_id ?? ""} inputMode="numeric" /></Field>
          <Field label="ID do Pixel do TikTok"><input className={inputCls} name="tiktok_pixel_id" defaultValue={store?.tracking?.tiktok_pixel_id ?? ""} /></Field>
          <Field label="Conversão estimada clique → compra (%)" hint="Usada na calculadora de CPC máximo. Ajuste com os seus dados reais."><input className={inputCls} name="conv_estimate_pct" inputMode="decimal" defaultValue={store?.tracking?.conv_estimate_pct ?? 2} /></Field>
          <Field label="Domínio próprio (opcional)" hint="Ex.: acheipracasa.com.br — eu ligo na Vercel quando você registrar."><input className={inputCls} name="custom_domain" defaultValue={store?.tracking?.custom_domain ?? ""} /></Field>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button className={btnCls} disabled={pending}>{pending ? "Salvando…" : store ? "Salvar alterações" : "Criar loja"}</button>
          {state.error ? <span className="text-sm font-semibold text-red-700" role="alert">{state.error}</span> : null}
          {state.ok ? <span className="text-sm font-semibold text-green-800" role="status">Salvo ✓</span> : null}
        </div>
      </Card>
    </form>
  );
}
