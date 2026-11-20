import { dayKey } from "@/lib/format";

export const PERIODS = { hoje: "Hoje", ontem: "Ontem", "7d": "7 dias", mes: "Mês atual", "30d": "30 dias" } as const;
export type PeriodKey = keyof typeof PERIODS;

/** meia-noite de Brasília (UTC-3) do dia `key` */
function spMidnight(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 3));
}

export function periodRange(p: PeriodKey) {
  const today = spMidnight(dayKey(new Date()));
  const day = 864e5;
  let start: Date, end: Date;
  switch (p) {
    case "hoje": start = today; end = new Date(today.getTime() + day); break;
    case "ontem": start = new Date(today.getTime() - day); end = today; break;
    case "7d": start = new Date(today.getTime() - 6 * day); end = new Date(today.getTime() + day); break;
    case "30d": start = new Date(today.getTime() - 29 * day); end = new Date(today.getTime() + day); break;
    default: {
      const [y, m] = dayKey(new Date()).split("-");
      start = spMidnight(`${y}-${m}-01`);
      end = new Date(today.getTime() + day);
    }
  }
  const len = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - len);
  const days: string[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += day) days.push(dayKey(new Date(t + 12 * 36e5)));
  return { start, end, prevStart, prevEnd: start, days };
}
