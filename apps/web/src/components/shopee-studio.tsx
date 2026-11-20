"use client";
import { useActionState, useState, useTransition } from "react";
import { ResultBox } from "@/components/csv-importer";
import { btnCls, btnSmCls, Card, CardTitle, Field, inputCls } from "@/components/ui";
import type { ImportResult } from "@/lib/actions/offers";
import { fillPagesFromShopee, importShopee, refreshShopeePrices, searchShopee, testShopee, type FillResult, type SearchState } from "@/lib/actions/shopee";

const brl = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export function ShopeeStudio({ storeId, storeSlug, pages, configured }: { storeId: string; storeSlug: string; pages: { id: string; title: string }[]; configured: boolean }) {
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, startTest] = useTransition();
  const [fill, fillAction, filling] = useActionState<FillResult | null, FormData>(fillPagesFromShopee, null);
  const [refresh, refreshAction, refreshing] = useActionState<{ ok?: number; errors?: string[] } | null, FormData>(refreshShopeePrices, null);
  const [search, searchAction, searching] = useActionState<SearchState, FormData>(searchShopee, {});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pageId, setPageId] = useState("");
  const [imp, setImp] = useState<ImportResult | null>(null);
  const [importing, startImport] = useTransition();

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle right={configured ? "chaves encontradas na Vercel" : "chaves não configuradas"}>Conexão</CardTitle>
        {!configured ? (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Cadastre <code>SHOPEE_APP_ID</code> e <code>SHOPEE_APP_SECRET</code> na Vercel (Settings → Environment Variables) e faça um novo deploy.</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btnSmCls} disabled={testing} onClick={() => startTest(async () => setTest(await testShopee()))}>{testing ? "Testando…" : "Testar conexão"}</button>
          {test ? <span role="status" className={`text-sm font-semibold ${test.ok ? "text-green-800" : "text-red-700"}`}>{test.message}</span> : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle right="air fryer, robô, cafeteira, panela, aspirador">Preencher páginas automaticamente</CardTitle>
          <p className="mb-3 text-sm text-muted">Busca os mais vendidos de cada página, filtra por nota e faixa de preço, ranqueia por comissão × vendas × desconto e adiciona os melhores com link de afiliado.</p>
          <form action={fillAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="store_id" value={storeId} />
            <input type="hidden" name="store_slug" value={storeSlug} />
            <Field label="Produtos por página"><input name="per_page" type="number" min={1} max={6} defaultValue={3} className={`${inputCls} w-24`} /></Field>
            <button className={btnCls} disabled={filling}>{filling ? "Buscando na Shopee…" : "Preencher as páginas"}</button>
          </form>
          {fill ? (
            <div role="status" className="mt-3 rounded-xl bg-ground p-3 text-sm">
              {fill.error ? <p className="font-semibold text-red-700">{fill.error}</p> : null}
              <ul className="space-y-1">{fill.pages.map((p) => <li key={p.slug}><strong>{p.slug}</strong>: {p.added} produto(s){p.note ? ` · ${p.note}` : ""}</li>)}</ul>
            </div>
          ) : null}
        </Card>
        <Card>
          <CardTitle>Atualizar preços</CardTitle>
          <p className="mb-3 text-sm text-muted">Consulta a API e atualiza preço, desconto e comissão de todas as ofertas Shopee ativas. Faça antes de anunciar.</p>
          <form action={refreshAction}>
            <input type="hidden" name="store_id" value={storeId} />
            <button className={btnCls} disabled={refreshing}>{refreshing ? "Atualizando…" : "Atualizar preços Shopee"}</button>
          </form>
          {refresh ? <p role="status" className="mt-3 text-sm">{refresh.ok} oferta(s) atualizada(s).{refresh.errors?.length ? ` Erros: ${refresh.errors.join("; ")}` : ""}</p> : null}
        </Card>
      </div>

      <Card>
        <CardTitle>Buscar ofertas</CardTitle>
        <form action={searchAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2"><Field label="Palavra-chave"><input name="keyword" required defaultValue={search.keyword} placeholder="organizador de cozinha" className={inputCls} /></Field></div>
          <Field label="Ordenar">
            <select name="sort" className={inputCls} defaultValue="vendidos">
              <option value="vendidos">Mais vendidos</option>
              <option value="comissao">Maior comissão</option>
              <option value="relevancia">Relevância</option>
              <option value="menor_preco">Menor preço</option>
            </select>
          </Field>
          <Field label="Preço mín."><input name="min_price" inputMode="decimal" className={inputCls} /></Field>
          <Field label="Preço máx."><input name="max_price" inputMode="decimal" className={inputCls} /></Field>
          <Field label="Nota mín."><input name="min_rating" inputMode="decimal" defaultValue="4.5" className={inputCls} /></Field>
          <div><button className={btnCls} disabled={searching}>{searching ? "Buscando…" : "Buscar"}</button></div>
        </form>
        {search.error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{search.error}</p> : null}
        {search.items ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">{search.items.length} resultados · ranqueados por comissão × vendas × desconto</span>
              <select value={pageId} onChange={(e) => setPageId(e.target.value)} aria-label="Adicionar à página" className={`${inputCls} ml-auto max-w-xs`}>
                <option value="">Só importar para o catálogo</option>
                {pages.map((p) => <option key={p.id} value={p.id}>Adicionar à página: {p.title}</option>)}
              </select>
              <button type="button" className={btnCls} disabled={!sel.size || importing}
                onClick={() => startImport(async () => {
                  setImp(await importShopee(storeId, storeSlug, search.items!.filter((p) => sel.has(p.itemId)), pageId || null));
                  setSel(new Set());
                })}>
                {importing ? "Importando…" : `Importar ${sel.size}`}
              </button>
            </div>
            <ResultBox result={imp} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="text-left text-[11px] tracking-wider text-muted">
                  <tr>{["", "PRODUTO", "PREÇO", "DESC.", "COMISSÃO", "NOTA", "VENDAS"].map((h) => <th key={h} scope="col" className="p-2">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {search.items.map((p) => (
                    <tr key={p.itemId} className="border-t border-line">
                      <td className="p-2"><input type="checkbox" aria-label={`Selecionar ${p.name}`} checked={sel.has(p.itemId)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(p.itemId); else n.delete(p.itemId); setSel(n); }} /></td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" /> : null}
                          <a href={p.productLink} target="_blank" rel="noreferrer" className="line-clamp-2 max-w-[360px] underline">{p.name}</a>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">{p.priceFrom ? <span className="text-xs text-muted line-through">{brl(p.priceFrom)} </span> : null}<strong>{brl(p.price)}</strong></td>
                      <td className="p-2">{p.discountPct ? `-${p.discountPct}%` : "—"}</td>
                      <td className="p-2 whitespace-nowrap">{p.commissionPct}% · <strong>{brl(p.commissionValue)}</strong></td>
                      <td className="p-2">{p.rating?.toFixed(1) ?? "—"}</td>
                      <td className="p-2 tabular-nums">{p.sales.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
