"use client";
import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { btnCls, inputCls } from "@/components/ui";
import type { ImportResult } from "@/lib/actions/offers";
import type { Platform } from "@/lib/types";

export type CsvField = { key: string; label: string; required?: boolean; guess: RegExp };

type Props = {
  storeId: string;
  fields: CsvField[];
  platforms?: Platform[];
  submitLabel?: string;
  onImport: (storeId: string, platform: Platform, rows: Record<string, string | undefined>[], filename: string) => Promise<ImportResult>;
};

const PLATFORM_LABEL: Record<Platform, string> = { shopee: "Shopee", mercadolivre: "Mercado Livre" };

export function CsvImporter({ storeId, fields, platforms = ["shopee", "mercadolivre"], submitLabel = "Importar", onImport }: Props) {
  const [platform, setPlatform] = useState<Platform>(platforms[0]);
  const [file, setFile] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  function onFile(f: File) {
    setResult(null);
    setFile(f.name);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        const hs = (r.meta.fields ?? []).filter(Boolean);
        setHeaders(hs);
        setData(r.data);
        const m: Record<string, string> = {};
        for (const fd of fields) {
          const h = hs.find((x) => fd.guess.test(x));
          if (h) m[fd.key] = h;
        }
        setMap(m);
      },
    });
  }

  const rows = useMemo(
    () => data.map((d) => Object.fromEntries(fields.map((f) => [f.key, map[f.key] ? d[map[f.key]] : undefined]))),
    [data, map, fields],
  );
  const missing = fields.filter((f) => f.required && !map[f.key]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {platforms.length > 1 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Plataforma</span>
            <select className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
              {platforms.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Arquivo CSV</span>
          <input type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </div>

      {headers.length ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">{f.label}{f.required ? " *" : ""}</span>
                <select className={inputCls} value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value })}>
                  <option value="">— não usar —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[600px] text-xs">
              <thead className="bg-ground text-left">
                <tr>{fields.map((f) => <th key={f.key} scope="col" className="p-2">{f.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-line">{fields.map((f) => <td key={f.key} className="max-w-[220px] truncate p-2">{r[f.key] ?? "—"}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={btnCls}
              disabled={pending || missing.length > 0}
              onClick={() => start(async () => setResult(await onImport(storeId, platform, rows, file)))}
            >
              {pending ? "Importando…" : `${submitLabel} ${rows.length} linhas`}
            </button>
            {missing.length ? <span className="text-sm text-red-700">Mapeie: {missing.map((m) => m.label).join(", ")}</span> : null}
          </div>
        </>
      ) : null}
      <ResultBox result={result} />
    </div>
  );
}

export function ResultBox({ result }: { result: ImportResult | null }) {
  if (!result) return null;
  return (
    <div role="status" className="rounded-xl border border-line bg-ground p-3 text-sm">
      <strong>{result.ok} importadas</strong>{result.updated ? `, ${result.updated} atualizadas` : ""}
      {result.errors.length ? `, ${result.errors.length} com erro` : ""}.
      {result.errors.length ? (
        <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-red-800">
          {result.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
