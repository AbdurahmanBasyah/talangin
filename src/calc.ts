export type Item = { id: string; name: string; price: number; links: string[] }
export type Payer = { personId: string; amount: number }
export type Transfer = { from: string; to: string; amount: number }

/** All amounts are whole rupiah. Shares are rounded with the largest remainder method so they add up exactly. */
export function compute(items: Item[], ids: string[], tax: number, svc: number, disc: number, includeTax: boolean) {
  const sub = items.reduce((a, i) => a + i.price, 0)
  const extra = includeTax ? -disc : tax + svc - disc
  const grand = sub + extra
  const unlinked = items.filter(i => i.price > 0 && !i.links.some(l => ids.includes(l)))
  const base: Record<string, number> = {}
  ids.forEach(p => { base[p] = 0 })
  items.forEach(i => {
    const l = i.links.filter(x => x in base)
    l.forEach(p => { base[p] += i.price / l.length })
  })
  const linked = Object.values(base).reduce((a, b) => a + b, 0)
  const ok = ids.length > 0 && sub > 0 && unlinked.length === 0 && grand > 0
  const raw: Record<string, number> = {}
  const total: Record<string, number> = {}
  let floors = 0
  ids.forEach(p => {
    raw[p] = linked ? base[p] + (extra * base[p]) / linked : 0
    total[p] = Math.floor(raw[p] + 1e-9)
    floors += total[p]
  })
  let left = grand - floors
  const order = [...ids].sort((a, b) => raw[b] - total[b] - (raw[a] - total[a]))
  for (let k = 0; ok && left > 0 && k < order.length * 3; k++, left--) total[order[k % order.length]]++
  return { sub, extra, grand, unlinked, base, total, ok }
}

/** Greedy settlement: the biggest debtor pays the biggest creditor until everyone is even. */
export function settle(total: Record<string, number>, payers: Payer[]): Transfer[] {
  const paid: Record<string, number> = {}
  payers.forEach(p => { paid[p.personId] = (paid[p.personId] || 0) + p.amount })
  const debtors: [string, number][] = []
  const creditors: [string, number][] = []
  Object.keys(total).forEach(id => {
    const net = total[id] - (paid[id] || 0)
    if (net > 0) debtors.push([id, net])
    else if (net < 0) creditors.push([id, -net])
  })
  debtors.sort((a, b) => b[1] - a[1])
  creditors.sort((a, b) => b[1] - a[1])
  const out: Transfer[] = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const m = Math.min(debtors[i][1], creditors[j][1])
    out.push({ from: debtors[i][0], to: creditors[j][0], amount: m })
    debtors[i][1] -= m
    creditors[j][1] -= m
    if (!debtors[i][1]) i++
    if (!creditors[j][1]) j++
  }
  return out
}
