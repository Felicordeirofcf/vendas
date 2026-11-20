/** Custo por clique máximo para empatar: preço × comissão% × conversão% */
export function maxCpc(price: number | string | null, commissionPct: number | string | null, convPct: number) {
  const p = Number(price), c = Number(commissionPct);
  if (!p || !c || !convPct) return null;
  return p * (c / 100) * (convPct / 100);
}

/** ROAS mínimo (comissão / gasto) = 1 → empate. Alerta de corte: gastou ≥ 2× a comissão média de uma venda sem vender. */
export function shouldCut(spend: number, sales: number, avgCommission: number | null) {
  if (sales > 0 || !avgCommission) return false;
  return spend >= 2 * avgCommission;
}
