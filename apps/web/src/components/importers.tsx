"use client";
import { useActionState } from "react";
import { CsvImporter, ResultBox, type CsvField } from "@/components/csv-importer";
import { btnCls, Field, inputCls } from "@/components/ui";
import { createOffer, importOfferRows, importPasted, type ImportResult } from "@/lib/actions/offers";
import { importClicks, importConversions } from "@/lib/actions/reports";

const OFFER_FIELDS: CsvField[] = [
  { key: "affiliate_url", label: "Link de afiliado", required: true, guess: /offer link|link de oferta|link.*afil|short.?link|link curto|^link$/i },
  { key: "title", label: "Título", required: true, guess: /nome|name|t[ií]tulo|title|produto/i },
  { key: "price_from", label: "Preço de", guess: /original|pre[cç]o de|antes|price.?max|list/i },
  { key: "price_to", label: "Preço por", guess: /^pre[cç]o|^price|pre[cç]o por|atual|sale|promo/i },
  { key: "commission_pct", label: "Comissão %", guess: /taxa|comiss[aã]o.*%|commission.?rate|rate/i },
  { key: "external_id", label: "ID do item", guess: /item.?id|id do item|id do produto|product.?id/i },
  { key: "product_url", label: "Link do produto", guess: /product.?link|link do produto|url do produto/i },
  { key: "image_url", label: "Imagem", guess: /imag|image|foto/i },
  { key: "category", label: "Categoria", guess: /categ/i },
];

const CONVERSION_FIELDS: CsvField[] = [
  { key: "order_id", label: "ID do pedido", required: true, guess: /id do pedido|order.?id|pedido|n[uú]mero/i },
  { key: "item_id", label: "ID do item", guess: /item.?id|id do item|id do produto/i },
  { key: "product_title", label: "Produto", guess: /nome do item|item.?name|produto|t[ií]tulo/i },
  { key: "ordered_at", label: "Data do pedido", guess: /hor[aá]rio do pedido|data do pedido|order.?time|purchase.?time|data/i },
  { key: "order_value", label: "Valor do pedido", guess: /pre[cç]o|valor.*(pedido|compra|venda)|purchase.?value|order.?amount/i },
  { key: "commission_value", label: "Comissão (R$)", required: true, guess: /comiss[aã]o.*(l[ií]quida|total|afiliad|ganh)|net.?commission|commission|comiss[aã]o|ganho/i },
  { key: "status", label: "Status", guess: /status|situa/i },
  { key: "sub_id", label: "Sub ID / etiqueta", guess: /sub.?id|etiqueta|tag|canal/i },
];

const CLICK_FIELDS: CsvField[] = [
  { key: "date", label: "Data / horário do clique", required: true, guess: /data|date|hor[aá]rio|time/i },
  { key: "clicks", label: "Cliques (vazio = 1 por linha)", guess: /^cliques$|^clicks$|total/i },
  { key: "channel", label: "Canal / Sub ID", guess: /sub.?id|canal|referr|etiqueta|origem/i },
];

export function OffersCsv({ storeId }: { storeId: string }) {
  return <CsvImporter storeId={storeId} fields={OFFER_FIELDS} onImport={(s, p, rows) => importOfferRows(s, p, rows as never)} />;
}

export function ConversionsCsv({ storeId }: { storeId: string }) {
  return <CsvImporter storeId={storeId} fields={CONVERSION_FIELDS} onImport={importConversions} />;
}

export function ClicksCsv({ storeId }: { storeId: string }) {
  return <CsvImporter storeId={storeId} fields={CLICK_FIELDS} onImport={importClicks} />;
}

export function PasteImporter({ storeId }: { storeId: string }) {
  const [state, action, pending] = useActionState<ImportResult | null, FormData>(importPasted, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="store_id" value={storeId} />
      <Field label="Plataforma">
        <select name="platform" className={inputCls} defaultValue="mercadolivre">
          <option value="mercadolivre">Mercado Livre</option>
          <option value="shopee">Shopee</option>
        </select>
      </Field>
      <Field label="Uma oferta por linha" hint="link | título | preço de | preço por | comissão %   (separe com | ; ou tab — os preços são opcionais)">
        <textarea
          name="lines"
          required
          rows={7}
          className={`${inputCls} font-mono text-xs`}
          placeholder={"https://mercadolivre.com/sec/XXXX | Mop giratório com balde | 129,90 | 79,90 | 8\nhttps://meli.la/YYYY | Kit potes herméticos 10 pçs | 89,90 | 49,90"}
        />
      </Field>
      <button className={btnCls} disabled={pending}>{pending ? "Importando…" : "Importar links"}</button>
      <ResultBox result={state} />
    </form>
  );
}

export function NewOfferForm({ storeId }: { storeId: string }) {
  const [state, action, pending] = useActionState<ImportResult | null, FormData>(createOffer, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="store_id" value={storeId} />
      <Field label="Plataforma">
        <select name="platform" className={inputCls} defaultValue="mercadolivre">
          <option value="mercadolivre">Mercado Livre</option>
          <option value="shopee">Shopee</option>
        </select>
      </Field>
      <Field label="Título"><input name="title" required className={inputCls} /></Field>
      <div className="sm:col-span-2"><Field label="Link de afiliado" hint="Mercado Livre: gere no Gerador de links e cole aqui."><input name="affiliate_url" required type="url" className={inputCls} /></Field></div>
      <Field label="Preço de (R$)"><input name="price_from" inputMode="decimal" className={inputCls} /></Field>
      <Field label="Preço por (R$)"><input name="price_to" inputMode="decimal" className={inputCls} /></Field>
      <Field label="Comissão %"><input name="commission_pct" inputMode="decimal" className={inputCls} /></Field>
      <Field label="Link da imagem (opcional)"><input name="image_url" type="url" className={inputCls} /></Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className={btnCls} disabled={pending}>{pending ? "Salvando…" : "Adicionar oferta"}</button>
        <ResultBox result={state} />
      </div>
    </form>
  );
}
