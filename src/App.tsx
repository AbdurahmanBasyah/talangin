import { PointerEvent, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { compute, settle } from './calc'
import type { Item, Payer } from './calc'

type Person = { id: string; name: string; initials: string; color: string }
type Point = { x: number; y: number }
type State = { people: Person[]; items: Item[]; tax: number; svc: number; disc: number; includeTax: boolean; payers: Payer[] }
type P = { s: State; patch: (p: Partial<State>) => void; next: () => void }

const KEY = 'talangin:v1'
const COLORS = ['var(--person-blue)', 'var(--person-orange)', 'var(--person-violet)', 'var(--person-pink)', 'var(--person-teal)', 'var(--person-gold)', 'var(--person-indigo)', 'var(--person-brown)']
const steps = ['People', 'Receipt', 'Connect', 'Charges', 'Result']
const money = (value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`
const fmt = (n: number) => n.toLocaleString('id-ID')
const num = (v: string) => parseInt(v.replace(/\D/g, '')) || 0
const uid = () => Math.random().toString(36).slice(2, 9)
const empty: State = { people: [], items: [], tax: 0, svc: 0, disc: 0, includeTax: false, payers: [] }
const load = (): State => { try { const x = localStorage.getItem(KEY); if (x) return { ...empty, ...JSON.parse(x) } } catch {} return empty }

async function downscale(file: File) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    moon: <path d="M20 15.2A8 8 0 1 1 8.8 4a6.3 6.3 0 0 0 11.2 11.2Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    arrow: <path d="m9 18 6-6-6-6" />,
    upload: <><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M5 14v5h14v-5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    share: <><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m8 11 8-5m-8 7 8 5" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2-6 6-6s6 2 6 6M16 4a3 3 0 0 1 0 6m1 4c3 .4 4 2.4 4 6" /></>,
    spark: <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function Button({ children, variant = 'primary', icon, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; icon?: string }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{icon && <Icon name={icon} />}{children}</button>
}

function Avatar({ person, small = false }: { person: Person; small?: boolean }) {
  return <span className={`avatar ${small ? 'avatar-small' : ''}`} style={{ '--avatar-color': person.color } as React.CSSProperties}>{person.initials}</span>
}

function Stepper({ step, onStep }: { step: number; onStep: (n: number) => void }) {
  return <nav className="stepper" aria-label="Progress">
    {steps.map((label, index) => <button key={label} onClick={() => onStep(index)} className={`step ${step === index ? 'active' : ''} ${step > index ? 'done' : ''}`} aria-label={`Step ${index + 1}: ${label}`}>
      <span>{step > index ? '✓' : index + 1}</span><small>{label}</small>
    </button>)}
  </nav>
}

function Chip({ ok, good, bad }: { ok: boolean; good: string; bad: string }) {
  return <div className={`match-chip ${ok ? 'success' : 'danger-chip'}`}><Icon name={ok ? 'check' : 'x'} size={14} /> {ok ? good : bad}</div>
}

function PeopleScreen({ s, patch, next }: P) {
  const [name, setName] = useState('')
  const add = () => {
    const n = name.trim()
    if (!n || s.people.some(p => p.name.toLowerCase() === n.toLowerCase())) return
    patch({ people: [...s.people, { id: uid(), name: n, initials: n.slice(0, 2).toUpperCase(), color: COLORS[s.people.length % COLORS.length] }] })
    setName('')
  }
  const remove = (id: string) => patch({ people: s.people.filter(p => p.id !== id), items: s.items.map(i => ({ ...i, links: i.links.filter(l => l !== id) })), payers: s.payers.filter(p => p.personId !== id) })
  return <section className="screen">
    <div className="eyebrow">STEP 1 OF 5</div><div className="title">Who’s splitting?</div>
    <p className="subtitle">Add everyone at the table, including whoever paid. Each person gets a colour.</p>
    <div className="add-row"><input className="text-input grow" placeholder="Name, then Enter" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} /><Button variant="secondary" icon="plus" onClick={add}>Add</Button></div>
    <div className="people-list">
      {s.people.map(person => <div className="person-row" key={person.id}><Avatar person={person} /><div><strong>{person.name}</strong></div><button className="icon-button" aria-label={`Remove ${person.name}`} onClick={() => remove(person.id)}><Icon name="x" /></button></div>)}
    </div>
    {s.people.length < 2 && <p className="hint">Add at least two people to continue.</p>}
    <Button className="wide bottom-action" disabled={s.people.length < 2} onClick={next}>Continue <Icon name="arrow" /></Button>
  </section>
}

function ReceiptScreen({ s, patch, next }: P) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [check, setCheck] = useState<{ sum: number; total: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const setItem = (id: string, v: Partial<Item>) => patch({ items: s.items.map(i => i.id === id ? { ...i, ...v } : i) })
  const read = async (file: File) => {
    setBusy(true); setErr(''); setCheck(null)
    try {
      const res = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: await downscale(file) }) })
      if (res.status === 404) throw new Error('Receipt reading needs the server function (see the README). You can type the items instead.')
      const out = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((out.error || 'Could not read the receipt. You can still type the items.') + (out.detail ? ` (${out.detail})` : ''))
      const raw: string = out.text || ''
      const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
      const found: Item[] = (Array.isArray(j.items) ? j.items : []).filter((i: any) => i && i.name).map((i: any) => ({ id: uid(), name: String(i.name) + (+i.qty > 1 ? ` x${+i.qty}` : ''), price: Math.max(0, Math.round(+i.price || 0)), links: [] }))
      if (!found.length) throw new Error('No items were found in the photo.')
      const keep = s.items.filter(i => i.name || i.price)
      const tax = Math.round(+j.tax || 0), svc = Math.round(+j.service || 0), disc = Math.round(+j.discount || 0)
      patch({ items: [...keep, ...found], tax: (keep.length ? s.tax : 0) + tax, svc: (keep.length ? s.svc : 0) + svc, disc: (keep.length ? s.disc : 0) + disc })
      const sum = found.reduce((a, i) => a + i.price, 0), sub = Math.round(+j.subtotal || 0), tot = Math.round(+j.total || 0)
      setCheck({ sum: sub ? sum - sub : 0, total: tot ? sub + tax + svc - disc - tot : 0 })
    } catch (e: any) {
      setErr(e?.message || e?.error?.message || 'Could not read the receipt. You can still type the items.')
    }
    setBusy(false)
  }
  const sub = s.items.reduce((a, i) => a + i.price, 0)
  return <section className="screen">
    <div className="eyebrow">STEP 2 OF 5</div><div className="title">Add the receipt</div><p className="subtitle">Upload a photo and we’ll read the items, or type them in. Fix anything before splitting.</p>
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = '' }} />
    <button className={`receipt-upload ${busy ? 'scanning' : ''}`} disabled={busy} onClick={() => fileRef.current?.click()}>
      <Icon name={busy ? 'spark' : 'upload'} size={24} />
      <strong>{busy ? 'Scanning receipt…' : 'Upload receipt photo'}</strong>
      <small>{busy ? 'Finding items and totals' : 'Sent to an AI service to read the items'}</small>
      {busy && <span className="scan-line" />}
    </button>
    {err && <p className="hint bad">{err}</p>}
    <div className="receipt-list">
      {s.items.map(i => <div className="edit-row" key={i.id}>
        <input className="text-input grow" placeholder="Item" value={i.name} onChange={e => setItem(i.id, { name: e.target.value })} />
        <input className="text-input price" inputMode="numeric" placeholder="0" value={i.price ? fmt(i.price) : ''} onChange={e => setItem(i.id, { price: num(e.target.value) })} />
        <button className="icon-button" aria-label="Remove item" onClick={() => patch({ items: s.items.filter(x => x.id !== i.id) })}><Icon name="x" /></button>
      </div>)}
      <Button variant="secondary" icon="plus" onClick={() => patch({ items: [...s.items, { id: uid(), name: '', price: 0, links: [] }] })}>Add item</Button>
      {check && <><Chip ok={check.sum === 0} good="Items match subtotal" bad={`Items off by ${money(Math.abs(check.sum))}`} /><Chip ok={check.total === 0} good="Total matches" bad={`Total off by ${money(Math.abs(check.total))}`} /></>}
      {sub > 0 && <div className="match-chip success">Items total · {money(sub)}</div>}
    </div>
    <Button className="wide bottom-action" disabled={sub <= 0} onClick={next}>Looks good <Icon name="arrow" /></Button>
  </section>
}

function ConnectScreen({ s, patch, next }: P) {
  const people = s.people, items = s.items.filter(i => i.price > 0)
  const c = compute(s.items, people.map(p => p.id), s.tax, s.svc, s.disc, s.includeTax)
  const [selected, setSelected] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ itemId: string; from: Point; to: Point } | null>(null)
  const [points, setPoints] = useState<Record<string, Point>>({})
  const [toast, setToast] = useState('')
  const boardRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const personRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const setLinks = (fn: (i: Item) => string[]) => patch({ items: s.items.map(i => ({ ...i, links: fn(i) })) })
  const say = (m: string, ms = 1000) => { setToast(m); setTimeout(() => setToast(''), ms) }

  const measure = () => {
    const board = boardRef.current?.getBoundingClientRect()
    if (!board) return
    const next: Record<string, Point> = {}
    Object.entries(itemRefs.current).forEach(([id, el]) => { if (el) { const r = el.getBoundingClientRect(); next[`i-${id}`] = { x: r.right - board.left, y: r.top + r.height / 2 - board.top } } })
    Object.entries(personRefs.current).forEach(([id, el]) => { if (el) { const r = el.getBoundingClientRect(); next[`p-${id}`] = { x: r.left - board.left, y: r.top + r.height / 2 - board.top } } })
    setPoints(next)
  }
  useLayoutEffect(measure, [s.items, s.people])
  useEffect(() => { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }, [])

  const toggle = (itemId: string, personId: string) => {
    patch({ items: s.items.map(i => i.id === itemId ? { ...i, links: i.links.includes(personId) ? i.links.filter(x => x !== personId) : [...i.links, personId] } : i) })
    say('Connection updated')
  }
  const beginDrag = (event: PointerEvent, item: Item) => {
    event.preventDefault()
    const board = boardRef.current?.getBoundingClientRect()
    if (!board) return
    setSelected(item.id)
    setDrag({ itemId: item.id, from: points[`i-${item.id}`], to: { x: event.clientX - board.left, y: event.clientY - board.top } })
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: PointerEvent) => {
    if (!drag) return
    const board = boardRef.current?.getBoundingClientRect()
    if (board) setDrag({ ...drag, to: { x: event.clientX - board.left, y: event.clientY - board.top } })
  }
  const endDrag = (event: PointerEvent) => {
    if (!drag) return
    const hit = people.find(person => {
      const rect = personRefs.current[person.id]?.getBoundingClientRect()
      return rect && event.clientX >= rect.left - 18 && event.clientX <= rect.right + 18 && event.clientY >= rect.top - 16 && event.clientY <= rect.bottom + 16
    })
    if (hit) toggle(drag.itemId, hit.id); else say('Drag to a person, or tap to connect', 1300)
    setDrag(null)
  }
  const curve = (a: Point, b: Point) => `M ${a.x} ${a.y} C ${a.x + 70} ${a.y}, ${b.x - 70} ${b.y}, ${b.x} ${b.y}`
  const unlinkedCount = c.unlinked.length

  return <section className="connect-screen">
    <div className="connect-head"><div><div className="eyebrow">STEP 3 OF 5</div><div className="title">Who had what?</div><p className="subtitle">Drag a dot to a person, or tap an item then a person. Tap a line to remove it.</p></div><div className="mini-total"><small>Items</small><strong>{money(c.sub)}</strong></div></div>
    <div className="quick-actions"><Button variant="secondary" icon="users" onClick={() => setLinks(() => people.map(p => p.id))}>Everyone</Button><Button variant="ghost" onClick={() => setLinks(() => [])}>Clear</Button></div>
    <div className="board-wrap">
      <div className="board-labels"><span>ITEMS</span><span>PEOPLE</span></div>
      <div className="board" ref={boardRef}>
        <svg className="ribbons" aria-hidden="true">
          {items.flatMap(item => item.links.map((personId, index) => {
            const a = points[`i-${item.id}`], b = points[`p-${personId}`], person = people.find(p => p.id === personId)
            if (!a || !b || !person) return null
            const dim = selected && selected !== item.id
            return <g key={`${item.id}-${personId}`} className={dim ? 'dim' : ''} onClick={() => toggle(item.id, personId)}>
              <path className="ribbon-hit" d={curve(a, b)} />
              <path className="ribbon" d={curve(a, b)} stroke={person.color} strokeWidth={Math.max(3, 8 / item.links.length)} />
              {!dim && <circle className="flow-dot" r="2.5" fill={person.color}><animateMotion dur={`${2 + index * .25}s`} repeatCount="indefinite" path={curve(a, b)} /></circle>}
              <g transform={`translate(${(a.x + b.x) / 2 - 14}, ${(a.y + b.y) / 2 - 10})`} className="share-chip"><rect width="28" height="20" rx="10" /><text x="14" y="14" textAnchor="middle">1/{item.links.length}</text></g>
            </g>
          }))}
          {drag && <path className="drag-line" d={curve(drag.from, drag.to)} />}
        </svg>
        <div className="items-column">
          {items.map(item => <button key={item.id} ref={el => { itemRefs.current[item.id] = el }} className={`item-card ${selected === item.id ? 'selected' : ''} ${!item.links.length ? 'unlinked' : ''}`} onClick={() => setSelected(selected === item.id ? null : item.id)}>
            <span className="item-copy"><strong>{item.name || 'Item'}</strong><small>{money(item.price)}</small>{!item.links.length && <em>Connect someone</em>}</span>
            <span className="linked-avatars">{item.links.slice(0, 3).map(id => { const p = people.find(x => x.id === id); return p ? <Avatar key={id} person={p} small /> : null })}</span>
            <span className="port" onPointerDown={e => beginDrag(e, item)} onPointerMove={moveDrag} onPointerUp={endDrag} aria-label={`Drag ${item.name}`} />
          </button>)}
        </div>
        <div className="people-column">
          {people.map(person => <button key={person.id} ref={el => { personRefs.current[person.id] = el }} style={{ '--person': person.color } as React.CSSProperties} className={`person-pill ${drag ? 'available' : ''} ${selected && items.find(i => i.id === selected)?.links.includes(person.id) ? 'connected' : ''}`} onClick={() => selected && toggle(selected, person.id)}>
            <Avatar person={person} /><span><strong>{person.name}</strong><small>{items.filter(i => i.links.includes(person.id)).length} items</small></span><b>{money(c.base[person.id] || 0)}</b>
          </button>)}
        </div>
      </div>
    </div>
    <div className="board-summary"><span><i /> {unlinkedCount ? `${unlinkedCount} not connected` : 'All connected'}</span><strong>{money(c.sub)}</strong></div>
    <Button className="wide" disabled={unlinkedCount > 0 || !items.length} onClick={next}>Add charges <Icon name="arrow" /></Button>
    {toast && <div className="toast">{toast}</div>}
  </section>
}

function ChargesScreen({ s, patch, next }: P) {
  const c = compute(s.items, s.people.map(p => p.id), s.tax, s.svc, s.disc, s.includeTax)
  const paid = s.payers.reduce((a, p) => a + p.amount, 0)
  const diff = c.grand - paid
  const setPayer = (i: number, v: Partial<Payer>) => patch({ payers: s.payers.map((p, k) => k === i ? { ...p, ...v } : p) })
  const addPayer = () => {
    const used = new Set(s.payers.map(p => p.personId))
    const who = s.people.find(p => !used.has(p.id)) || s.people[0]
    if (who) patch({ payers: [...s.payers, { personId: who.id, amount: Math.max(diff, 0) }] })
  }
  const rows: [string, 'tax' | 'svc' | 'disc'][] = [['Tax', 'tax'], ['Service', 'svc'], ['Discount', 'disc']]
  return <section className="screen">
    <div className="eyebrow">STEP 4 OF 5</div><div className="title">Charges & payment</div><p className="subtitle">Enter the charges as printed, then say who paid the receipt.</p>
    <div className="form-card">
      {rows.map(([label, key]) => <label className="form-row" key={key}><span>{label}</span><input className="money-input" inputMode="numeric" placeholder="0" disabled={s.includeTax && key !== 'disc'} value={s[key] ? fmt(s[key]) : ''} onChange={e => patch({ [key]: num(e.target.value) } as Partial<State>)} /></label>)}
      <button className="switch-row" onClick={() => patch({ includeTax: !s.includeTax })}><span><strong>Prices include tax</strong><small>Don’t add tax and service again</small></span><i className={s.includeTax ? 'on' : ''}><b /></i></button>
    </div>
    <div className="form-total"><span>Receipt total</span><strong>{money(c.grand)}</strong></div>
    <div className="section-label">PAID BY</div>
    <p className="hint tight">Add everyone who paid at the till and how much each put in.</p>
    {s.payers.map((p, i) => <div className="payer-edit" key={i}>
      <select className="text-input grow" value={p.personId} onChange={e => setPayer(i, { personId: e.target.value })}>{s.people.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <input className="text-input price" inputMode="numeric" placeholder="0" value={p.amount ? fmt(p.amount) : ''} onChange={e => setPayer(i, { amount: num(e.target.value) })} />
      <button className="icon-button" aria-label="Remove payer" onClick={() => patch({ payers: s.payers.filter((_, k) => k !== i) })}><Icon name="x" /></button>
    </div>)}
    <Button variant="secondary" icon="plus" onClick={addPayer}>Add payer</Button>
    {!s.payers.length && <div className="chip-row"><span className="hint">Or fill in one tap:</span>{s.people.map(p => <Button key={p.id} variant="secondary" className="chip-btn" onClick={() => patch({ payers: [{ personId: p.id, amount: c.grand }] })}>{p.name} paid it all</Button>)}</div>}
    <div className={`difference ${diff === 0 && c.grand > 0 ? 'success' : 'danger-chip'}`}><Icon name={diff === 0 && c.grand > 0 ? 'check' : 'x'} size={16} /> {!s.payers.length ? 'Choose who paid' : diff === 0 ? 'Payment matches receipt total' : `${diff > 0 ? 'Still missing' : 'Too much by'} ${money(Math.abs(diff))}`}</div>
    <Button className="wide bottom-action" disabled={!c.ok || diff !== 0} onClick={next}>See result <Icon name="arrow" /></Button>
  </section>
}

type Shared = { g: number; p: [string, number][]; x: [string, string, number][] }
const encode = (d: Shared) => btoa(unescape(encodeURIComponent(JSON.stringify(d))))
const decode = (h: string): Shared | null => { try { return JSON.parse(decodeURIComponent(escape(atob(h)))) } catch { return null } }
const readShared = (): Shared | null => location.hash.startsWith('#r=') ? decode(location.hash.slice(3)) : null

function Transfers({ rows, paid, setPaid }: { rows: { id: string; from: Person; to: string; amount: number }[]; paid: string[]; setPaid: (p: string[]) => void }) {
  if (!rows.length) return <p className="hint">Nothing to settle. Everyone is even.</p>
  return <div className="transfers">{rows.map(t => <button key={t.id} className={`transfer ${paid.includes(t.id) ? 'paid' : ''}`} onClick={() => setPaid(paid.includes(t.id) ? paid.filter(x => x !== t.id) : [...paid, t.id])}><Avatar person={t.from} /><span><strong>{t.from.name} pays {money(t.amount)} to {t.to}</strong><small>{paid.includes(t.id) ? 'Marked as paid' : 'Tap to mark paid'}</small></span><i>{paid.includes(t.id) ? '✓' : '→'}</i></button>)}</div>
}

function ResultScreen({ s, restart }: { s: State; restart: () => void }) {
  const c = compute(s.items, s.people.map(p => p.id), s.tax, s.svc, s.disc, s.includeTax)
  const T = c.ok ? settle(c.total, s.payers) : []
  const [paid, setPaid] = useState<string[]>([])
  const [toast, setToast] = useState('')
  const by = (id: string) => s.people.find(p => p.id === id)!
  if (!c.ok) return <section className="screen"><div className="title">Almost there</div><p className="subtitle">Connect every item and check the payments first.</p></section>
  const rows = T.map(t => ({ id: `${t.from}-${t.to}`, from: by(t.from), to: by(t.to).name, amount: t.amount }))
  const summary = `Talangin, total ${money(c.grand)}\n${s.people.map(p => `${p.name}: ${money(c.total[p.id])}`).join('\n')}\n\n${T.length ? T.map(t => `${by(t.from).name} pays ${money(t.amount)} to ${by(t.to).name}`).join('\n') : 'Nothing to settle.'}`
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1500) }
  const copy = async (text: string, ok: string) => { try { await navigator.clipboard.writeText(text); say(ok) } catch { say('Copy is blocked in this browser') } }
  const link = () => `${location.origin}${location.pathname}#r=${encode({ g: c.grand, p: s.people.map(p => [p.name, c.total[p.id]]), x: T.map(t => [by(t.from).name, by(t.to).name, t.amount]) })}`
  return <section className="screen result-screen">
    <div className="result-check"><Icon name="check" size={26} /></div><div className="title centered">All split!</div><p className="subtitle centered">Total {money(c.grand)}. Here’s the simplest way to settle up.</p>
    {s.people.map(p => <div className="payer-card" key={p.id}><Avatar person={p} /><span><strong>{p.name}</strong><small>Item share + charges</small></span><b>{money(c.total[p.id])}</b></div>)}
    <div className="section-label">SETTLE UP</div>
    <Transfers rows={rows} paid={paid} setPaid={setPaid} />
    <div className="share-actions"><Button variant="secondary" icon="copy" onClick={() => copy(summary, 'Summary copied')}>Copy summary</Button><Button icon="share" onClick={() => copy(link(), 'Link copied')}>Share link</Button></div>
    <Button variant="ghost" className="wide" onClick={restart}>Start a new split</Button>
    {toast && <div className="toast">{toast}</div>}
  </section>
}

function SharedScreen({ d }: { d: Shared }) {
  const people: Person[] = d.p.map(([name], i) => ({ id: name, name, initials: name.slice(0, 2).toUpperCase(), color: COLORS[i % COLORS.length] }))
  const [paid, setPaid] = useState<string[]>([])
  const rows = d.x.map(([f, t, amount]) => ({ id: `${f}-${t}`, from: people.find(p => p.id === f) || people[0], to: t, amount }))
  return <section className="screen result-screen">
    <div className="eyebrow centered">SHARED RESULT</div><div className="title centered">Your share</div><p className="subtitle centered">Total {money(d.g)}. This is a read-only snapshot.</p>
    {d.p.map(([name, amount], i) => <div className="payer-card" key={name}><Avatar person={people[i]} /><span><strong>{name}</strong></span><b>{money(amount)}</b></div>)}
    <div className="section-label">SETTLE UP</div>
    <Transfers rows={rows} paid={paid} setPaid={setPaid} />
    <Button variant="ghost" className="wide bottom-action" onClick={() => { history.replaceState(null, '', location.pathname); location.reload() }}>Make your own split</Button>
  </section>
}

function Landing({ hasProgress, onNew, onResume }: { hasProgress: boolean; onNew: () => void; onResume: () => void }) {
  const feats: [string, string, string][] = [
    ['spark', 'Connect, don’t calculate', 'Drag each dish to the people who ate it.'],
    ['users', 'Tax and service, fairly', 'Shared in proportion to what everyone ordered.'],
    ['share', 'Several payers, fewest transfers', 'See exactly who pays whom, then share the result.'],
  ]
  return <section className="landing">
    <div className="eyebrow">FAIR SPLITS, NO ACCOUNT</div>
    <h1 className="title hero-title">Split the bill the fair way.</h1>
    <p className="subtitle">Talangin turns a shared receipt into one clear answer: what each person owes and who pays whom.</p>
    <svg className="hero-art" viewBox="0 0 300 150" role="img" aria-label="Receipt items connected to three people">
      {[[10, 'blue', 'M110 28 C150 28 150 28 190 28'], [55, 'orange', 'M110 73 C150 73 150 28 190 28'], [100, 'violet', 'M110 118 C150 118 150 118 190 118']].map(([y, c, d]) => <g key={String(y)}>
        <path d={d as string} fill="none" stroke={`var(--person-${c})`} strokeWidth="4" strokeLinecap="round" />
        <rect x="10" y={y as number} width="100" height="36" rx="10" fill="var(--surface)" stroke="var(--line)" />
        <rect x="20" y={(y as number) + 12} width="46" height="5" rx="2.5" fill="var(--line)" /><rect x="20" y={(y as number) + 22} width="28" height="4" rx="2" fill="var(--line)" />
      </g>)}
      <path d="M110 73 C150 73 150 73 190 73" fill="none" stroke="var(--person-violet)" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      {[[10, 'blue', 'AN'], [55, 'orange', 'BU'], [100, 'violet', 'CI']].map(([y, c, t]) => <g key={String(t)}>
        <rect x="190" y={y as number} width="100" height="36" rx="18" fill={`color-mix(in srgb, var(--person-${c}) 16%, var(--surface))`} stroke={`var(--person-${c})`} />
        <circle cx="208" cy={(y as number) + 18} r="11" fill={`var(--person-${c})`} /><text x="208" y={(y as number) + 22} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{t}</text>
      </g>)}
    </svg>
    <div className="feature-list">{feats.map(([icon, head, body]) => <div className="feature" key={head}><span><Icon name={icon} /></span><div><strong>{head}</strong><small>{body}</small></div></div>)}</div>
    {hasProgress && <Button className="wide" onClick={onResume}>Continue your last split <Icon name="arrow" /></Button>}
    <Button className="wide" variant={hasProgress ? 'secondary' : 'primary'} onClick={onNew}>{hasProgress ? 'Start a new split' : 'Start splitting'} {!hasProgress && <Icon name="arrow" />}</Button>
    <p className="fine">No sign-up. Your split is saved in this browser. A receipt photo is sent to an AI service only when you upload one.</p>
  </section>
}

export default function App() {
  const [s, setS] = useState<State>(load)
  const [step, setStep] = useState(0)
  const [started, setStarted] = useState(false)
  const [dark, setDark] = useState(false)
  const shared = readShared()
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }, [s])
  const patch = (p: Partial<State>) => setS(c => ({ ...c, ...p }))
  const landing = !shared && !started
  const hasProgress = s.people.length > 0 || s.items.length > 0
  const resume = () => { setStep(s.people.length < 2 ? 0 : !s.items.some(i => i.price > 0) ? 1 : 2); setStarted(true) }
  return <main className={dark ? 'theme-dark' : ''}>
    <div className="app-shell">
      <header><button className="icon-button" aria-label="Go back" style={{ visibility: landing || shared ? 'hidden' : 'visible' }} onClick={() => step === 0 ? setStarted(false) : setStep(step - 1)}><Icon name="back" /></button><button className="brand brand-btn" aria-label="Talangin home" onClick={() => { if (!shared) setStarted(false) }}><span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="6" cy="17" r="2.2" fill="currentColor" /><circle cx="18" cy="7" r="2.2" fill="currentColor" /><path d="M8.2 17C13 17 11 7 15.8 7" /></svg></span> Talangin</button><button className="icon-button" aria-label="Toggle theme" onClick={() => setDark(!dark)}><Icon name={dark ? 'sun' : 'moon'} /></button></header>
      {shared ? <SharedScreen d={shared} /> : landing ? <Landing hasProgress={hasProgress} onNew={() => { setS(empty); setStep(0); setStarted(true) }} onResume={resume} /> : <>
        <Stepper step={step} onStep={setStep} />
        {step === 0 && <PeopleScreen s={s} patch={patch} next={() => setStep(1)} />}
        {step === 1 && <ReceiptScreen s={s} patch={patch} next={() => setStep(2)} />}
        {step === 2 && <ConnectScreen s={s} patch={patch} next={() => setStep(3)} />}
        {step === 3 && <ChargesScreen s={s} patch={patch} next={() => setStep(4)} />}
        {step === 4 && <ResultScreen s={s} restart={() => { setS(empty); setStep(0) }} />}
      </>}
    </div>
  </main>
}
