"use client";
import { useActionState, useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { btnCls, btnSmCls, Card, inputCls } from "@/components/ui";
import { saveContent, type SaveState } from "@/lib/actions/schedule";
import { GENERATORS, HOOK_COUNT, type ContentInput } from "@/lib/content";
import { KIND_LABEL, type ContentKind } from "@/lib/types";

type Kind = Exclude<ContentKind, "reel">;
const ORDER: Kind[] = ["whatsapp", "telegram", "caption_instagram", "caption_tiktok"];

const HINT: Record<Kind, string> = {
  whatsapp: "*negrito*  ~riscado~  _itálico_ — cole no canal manualmente",
  telegram: "pode ir para o bot automático (fase 4)",
  caption_instagram: "poste manualmente · marque “conteúdo de marca”",
  caption_tiktok: "poste manualmente · ative “conteúdo de marca”",
};

function Block({ kind, initial, storeId, offerId }: { kind: Kind; initial: string; storeId: string; offerId: string }) {
  const [text, setText] = useState(initial);
  const [state, action, pending] = useActionState<SaveState, FormData>(saveContent, {});
  const [prev, setPrev] = useState(initial);
  if (initial !== prev) { setPrev(initial); setText(initial); }
  return (
    <Card>
      <form action={action} className="flex h-full flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-bold">{KIND_LABEL[kind]}</h3>
          <span className="text-right text-xs text-muted">{HINT[kind]}</span>
        </div>
        <input type="hidden" name="store_id" value={storeId} />
        <input type="hidden" name="offer_id" value={offerId} />
        <input type="hidden" name="kind" value={kind} />
        <textarea name="body" aria-label={`Texto ${KIND_LABEL[kind]}`} value={text} onChange={(e) => setText(e.target.value)} rows={12} className={`${inputCls} flex-1 font-mono text-xs leading-relaxed`} />
        <div className="flex flex-wrap items-end gap-2">
          <CopyButton text={text} />
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold">Agendar (Brasília)</span>
            <input type="datetime-local" name="scheduled_at" className="rounded-lg border border-line px-2 py-1.5 text-xs" />
          </label>
          {kind === "telegram" ? (
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="auto" defaultChecked /> automático</label>
          ) : null}
          <button className={btnSmCls} disabled={pending}>{pending ? "…" : "Salvar / agendar"}</button>
          {state.ok ? <span role="status" className="text-xs font-bold text-green-800">{state.ok}</span> : null}
          {state.error ? <span role="alert" className="text-xs font-bold text-red-700">{state.error}</span> : null}
        </div>
      </form>
    </Card>
  );
}

export function ContentStudio({ input, storeId, offerId }: { input: ContentInput; storeId: string; offerId: string }) {
  const [variant, setVariant] = useState(0);
  const texts = useMemo(
    () => Object.fromEntries(ORDER.map((k) => [k, GENERATORS[k]({ ...input, variant })])) as Record<Kind, string>,
    [input, variant],
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" className={btnCls} onClick={() => setVariant((v) => (v + 1) % HOOK_COUNT)}>Trocar gancho ↻</button>
        <span className="text-sm text-muted">Variação {variant + 1} de {HOOK_COUNT}. Edite livremente antes de salvar.</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {ORDER.map((k) => <Block key={k} kind={k} initial={texts[k]} storeId={storeId} offerId={offerId} />)}
      </div>
    </div>
  );
}
