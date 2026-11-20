export const TZ = "America/Sao_Paulo";

export function brl(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function num(v: number) {
  return v.toLocaleString("pt-BR");
}

export function pct(v: number | null | undefined, digits = 0) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function dayKey(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
}

export function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("pt-BR", {
    timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit",
  });
}

export function hoursSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

/** "R$ 1.234,56" | "1234.56" | "1.234,56" -> 1234.56 */
export function parseMoney(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().replace(/[R$\s%]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** datetime-local (horário de Brasília) -> ISO UTC */
export function localToIso(local: string) {
  return new Date(`${local}:00-03:00`).toISOString();
}

/** "dd/mm/aaaa hh:mm[:ss]" | ISO -> ISO */
export function parseDate(input: unknown): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (br) {
    const [, d, m, y, hh = "12", mm = "00", ss = "00"] = br;
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}-03:00`).toISOString();
  }
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export const nowMs = () => Date.now();
