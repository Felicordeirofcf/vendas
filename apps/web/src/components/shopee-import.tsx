"use client";
import { useActionState } from "react";
import { btnSmCls } from "@/components/ui";
import { importShopee, type ImportResult } from "@/lib/actions/offers";
import type { ShopeeItem } from "@/lib/types";

export function ShopeeImportButton({ storeId, item, imported }: { storeId: string; item: ShopeeItem; imported: boolean }) {
  const [state, action, pending] = useActionState<ImportResult | null, FormData>(importShopee, null);
  const done = state && !state.errors.length;
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="store_id" value={storeId} />
      <input type="hidden" name="item" value={JSON.stringify(item)} />
      <button className={btnSmCls} disabled={pending} aria-label={`${imported ? "Atualizar" : "Importar"} ${item.title}`}>
        {pending ? "Importando…" : imported || done ? "Atualizar" : "Importar"}
      </button>
      {state?.errors.length ? <span role="alert" className="max-w-48 text-right text-xs text-red-700">{state.errors[0]}</span> : null}
      {done ? <span role="status" className="text-xs font-semibold text-green-800">{state.ok ? "Importado ✓" : "Atualizado ✓"}</span> : null}
    </form>
  );
}
