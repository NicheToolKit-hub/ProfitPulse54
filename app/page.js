'use client';

import { useEffect, useState, useCallback } from 'react';
import { Logo, PulseMark } from '@/components/Logo';
import { NicheDashboard } from '@/components/dashboards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { money, toCents } from '@/lib/format';
import {
  ShoppingCart, HardHat, Palette, Server, ArrowRight, Check, Plus, Download,
  FileText, LayoutDashboard, Receipt, ScrollText, Building2, Sparkles, CreditCard, RefreshCw,
} from 'lucide-react';

const HERO = 'https://images.unsplash.com/photo-1660020619062-70b16c44bf0f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHw0fHxmaW5hbmNlJTIwYW5hbHl0aWNzJTIwZGFzaGJvYXJkfGVufDB8fHxibHVlfDE3ODg1MDYxMzV8MA&ixlib=rb-4.1.0&q=85';

const NICHES = [
  { id: 'ecommerce', label: 'E-Commerce', tagline: 'SKU net-profit margins, marketplace fees & ad-spend ROI', icon: ShoppingCart, img: 'https://images.unsplash.com/photo-1592839930500-3445eb72b8ad?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxlY29tbWVyY2UlMjBwYWNrYWdlc3xlbnwwfHx8Ymx1ZXwxNzg4NTA2MTM1fDA&ixlib=rb-4.1.0&q=85' },
  { id: 'field_trades', label: 'Field Trades', tagline: 'Job-site budgets, milestone tracking & photo/voice receipts', icon: HardHat, img: 'https://images.unsplash.com/photo-1603239564387-c5b5ea6f635e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwyfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDB8fHxibHVlfDE3ODg1MDYxMzR8MA&ixlib=rb-4.1.0&q=85' },
  { id: 'freelancer', label: 'Creators & Freelancers', tagline: '1-swipe expense sorting & estimated quarterly tax', icon: Palette, img: 'https://images.unsplash.com/photo-1596784326488-23581279e33d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwxfHxmcmVlbGFuY2VyJTIwbGFwdG9wfGVufDB8fHxibHVlfDE3ODg1MDYxMzR8MA&ixlib=rb-4.1.0&q=85' },
  { id: 'saas', label: 'Micro-SaaS', tagline: 'Cash flow merged with MRR, churn & payment gateway fees', icon: Server, img: 'https://images.unsplash.com/photo-1580982324076-d95230549339?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwzfHxzdGFydHVwJTIwdGVhbXxlbnwwfHx8Ymx1ZXwxNzg4NTA2MTM0fDA&ixlib=rb-4.1.0&q=85' },
];
const nicheOf = (id) => NICHES.find((n) => n.id === id) || NICHES[0];
const INCOME_METHODS = [
  { id: 'stripe', label: 'Stripe / card payments' },
  { id: 'invoice', label: 'Manual invoicing' },
  { id: 'marketplace', label: 'Marketplace payouts (Amazon, Etsy…)' },
  { id: 'bank', label: 'Direct bank deposits' },
];

const api = {
  get: (p) => fetch(`/api${p}`).then((r) => r.json()),
  post: (p, b) => fetch(`/api${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json()),
  patch: (p, b) => fetch(`/api${p}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json()),
};

const StatusBadge = ({ status }) => {
  const map = {
    reconciled: 'border-accent/50 text-accent bg-accent/10',
    flagged: 'border-destructive/50 text-destructive bg-destructive/10',
    pending: 'border-primary/50 text-primary bg-primary/10',
  };
  return <Badge variant="outline" className={map[status] || ''}>{status}</Badge>;
};

// =========================================================================
export default function App() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('landing');
  const [tenants, setTenants] = useState([]);
  const [active, setActive] = useState(null);

  const refreshTenants = useCallback(async () => {
    const t = await api.get('/tenants');
    setTenants(Array.isArray(t) ? t : []);
    return t;
  }, []);

  useEffect(() => { (async () => { await refreshTenants(); setLoading(false); })(); }, [refreshTenants]);

  const enterApp = (tenant) => { setActive(tenant); setView('app'); };

  const loadDemo = async () => {
    toast.loading('Spinning up demo workspaces…', { id: 'demo' });
    const res = await api.post('/demo/seed', {});
    toast.dismiss('demo');
    const list = res.tenants || (await refreshTenants());
    setTenants(list);
    enterApp(list[0]);
    toast.success('4 adaptive workspaces ready — switch niches from the top bar!');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><PulseMark size={48} className="animate-pulse" /></div>;
  if (view === 'landing') return <Landing tenants={tenants} onDemo={loadDemo} onStart={() => setView('onboarding')} onEnter={enterApp} />;
  if (view === 'onboarding') return <Onboarding onCancel={() => setView(tenants.length ? 'app' : 'landing')} onDone={async (t) => { await refreshTenants(); enterApp(t); }} />;
  return <Workspace active={active} tenants={tenants} setActive={setActive} onNew={() => setView('onboarding')} refreshTenants={refreshTenants} />;
}

// ------------------------------- LANDING -------------------------------
function Landing({ onDemo, onStart, tenants, onEnter }) {
  return (
    <div className="min-h-screen pp-gradient">
      <header className="container flex items-center justify-between py-5">
        <Logo />
        <div className="flex items-center gap-2">
          {tenants.length > 0 && <Button variant="ghost" onClick={() => onEnter(tenants[0])}>Open Workspace</Button>}
          <Button variant="secondary" onClick={onStart}>Set up my business</Button>
        </div>
      </header>
      <section className="container grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
        <div>
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary"><Sparkles className="mr-1 h-3 w-3" /> Adaptive bookkeeping</Badge>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Pulse-check your <span className="text-accent">true profit</span> in real time.</h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">Bookkeeping that adapts to your business—not the other way around. ProfitPulse reshapes its dashboard, chart of accounts, and workflows around <em>your</em> niche.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={onDemo} className="pp-glow"><Sparkles className="mr-2 h-4 w-4" /> Load demo workspaces</Button>
            <Button size="lg" variant="outline" onClick={onStart}>Start 3-step setup <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Immutable double-entry ledger · GAAP chart of accounts · CPA-ready exports</p>
        </div>
        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-border pp-glow"><img src={HERO} alt="Financial analytics" className="h-72 w-full object-cover md:h-96" /></div>
        </div>
      </section>
      <section className="container pb-24">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">One ledger — four adaptive experiences</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {NICHES.map((n) => (
            <Card key={n.id} className="group overflow-hidden transition hover:border-primary/50">
              <div className="h-28 overflow-hidden"><img src={n.img} alt={n.label} className="h-full w-full object-cover transition group-hover:scale-105" /></div>
              <CardContent className="p-4">
                <div className="flex items-center gap-2"><n.icon className="h-4 w-4 text-primary" /><span className="font-semibold">{n.label}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">{n.tagline}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

// ------------------------------- ONBOARDING -------------------------------
function Onboarding({ onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [income, setIncome] = useState('stripe');
  const [busy, setBusy] = useState(false);
  const next = () => setStep((s) => s + 1);
  const back = () => (step === 1 ? onCancel() : setStep((s) => s - 1));
  const finish = async () => {
    setBusy(true);
    const t = await api.post('/onboarding', { name, niche, incomeMethod: income, seed: true });
    setBusy(false);
    if (t?.id) { toast.success(`${t.name} is ready with a tailored chart of accounts!`); onDone(t); } else toast.error('Something went wrong. Try again.');
  };
  return (
    <div className="min-h-screen pp-gradient">
      <header className="container flex items-center justify-between py-5"><Logo /><Button variant="ghost" onClick={onCancel}>Cancel</Button></header>
      <div className="container max-w-2xl py-6">
        <div className="mb-8 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{step > s ? <Check className="h-4 w-4" /> : s}</div>
              {s < 3 && <div className={`h-0.5 flex-1 rounded ${step > s ? 'bg-primary' : 'bg-secondary'}`} />}
            </div>
          ))}
        </div>
        <Card className="pp-glow">
          <CardContent className="p-8">
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold">What's your business called?</h2>
                <p className="mt-1 text-sm text-muted-foreground">We'll set up an isolated, multi-tenant workspace for it.</p>
                <div className="mt-6 space-y-2"><Label>Business name</Label><Input autoFocus placeholder="e.g. Nimbus Goods Co." value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name && next()} /></div>
              </div>
            )}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold">Which best describes your niche?</h2>
                <p className="mt-1 text-sm text-muted-foreground">This reshapes your dashboard, accounts, and captured data.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {NICHES.map((n) => (
                    <button key={n.id} onClick={() => setNiche(n.id)} className={`rounded-xl border p-4 text-left transition ${niche === n.id ? 'border-primary bg-primary/10 pp-glow' : 'border-border hover:border-primary/40'}`}>
                      <n.icon className={`h-5 w-5 ${niche === n.id ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="mt-2 font-semibold">{n.label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{n.tagline}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold">How do you collect income?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Helps us pre-configure your payment reconciliation.</p>
                <div className="mt-6 space-y-2">
                  {INCOME_METHODS.map((m) => (
                    <button key={m.id} onClick={() => setIncome(m.id)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${income === m.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>
                      <span className="font-medium">{m.label}</span>{income === m.id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={back}>{step === 1 ? 'Cancel' : 'Back'}</Button>
              {step < 3 ? (
                <Button onClick={next} disabled={(step === 1 && !name) || (step === 2 && !niche)}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
              ) : (
                <Button onClick={finish} disabled={busy}>{busy ? 'Building your books…' : 'Create workspace'} <Sparkles className="ml-2 h-4 w-4" /></Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------- WORKSPACE -------------------------------
function Workspace({ active, tenants, setActive, onNew, refreshTenants }) {
  const [tab, setTab] = useState('dashboard');
  const [dash, setDash] = useState(null);
  const [txns, setTxns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [reports, setReports] = useState(null);

  const load = useCallback(async () => {
    if (!active) return;
    const [d, t, a, inv, r] = await Promise.all([
      api.get(`/dashboard?tenantId=${active.id}`),
      api.get(`/transactions?tenantId=${active.id}`),
      api.get(`/accounts?tenantId=${active.id}`),
      api.get(`/invoices?tenantId=${active.id}`),
      api.get(`/reports?tenantId=${active.id}`),
    ]);
    setDash(d); setTxns(Array.isArray(t) ? t : []); setAccounts(Array.isArray(a) ? a : []); setInvoices(Array.isArray(inv) ? inv : []); setReports(r);
  }, [active]);

  useEffect(() => { load(); }, [load]);
  const n = nicheOf(active?.niche);

  const setStatus = async (id, status) => { await api.patch('/transactions/status', { id, status }); toast.success(`Marked ${status}`); load(); };
  const classify = async (id, classification) => { await api.patch('/transactions/classify', { id, classification }); toast.success(`Sorted as ${classification}`); load(); };
  const quickCapture = async (kind) => {
    const desc = kind === 'photo' ? 'Field receipt (photo)' : 'Field expense (voice memo)';
    await api.post('/transactions', { tenantId: active.id, type: 'expense', category: 'Materials & Supplies', amount: toCents(75 + Math.round(Math.random() * 200)), description: desc, status: 'flagged', metadata: { hasReceipt: true, capture: kind } });
    toast.success('Receipt captured & logged to the ledger');
    load();
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'reports', label: 'Reports', icon: ScrollText },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Logo size={28} />
            <Separator orientation="vertical" className="hidden h-6 md:block" />
            <Select value={active?.id} onValueChange={(id) => setActive(tenants.find((t) => t.id === id))}>
              <SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tenants.map((t) => { const tn = nicheOf(t.niche); return <SelectItem key={t.id} value={t.id}><span className="flex items-center gap-2"><tn.icon className="h-3.5 w-3.5 text-primary" />{t.name}</span></SelectItem>; })}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="hidden border-primary/40 text-primary md:inline-flex"><n.icon className="mr-1 h-3 w-3" />{n.label}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={load} title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
            <Button variant="secondary" onClick={onNew}><Plus className="mr-2 h-4 w-4" /> New business</Button>
          </div>
        </div>
        <div className="container flex gap-1 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><t.icon className="h-4 w-4" /> {t.label}</button>
          ))}
        </div>
      </header>
      <main className="container py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-5 w-5 text-muted-foreground" />{active?.name}</h1>
          <p className="text-sm text-muted-foreground">{n.tagline}</p>
        </div>
        {tab === 'dashboard' && <NicheDashboard data={dash} onClassify={classify} onQuickCapture={quickCapture} />}
        {tab === 'transactions' && <Transactions txns={txns} accounts={accounts} tenant={active} onReload={load} onStatus={setStatus} />}
        {tab === 'invoices' && <Invoices invoices={invoices} tenant={active} onReload={load} />}
        {tab === 'reports' && <Reports reports={reports} tenant={active} />}
      </main>
    </div>
  );
}

// ------------------------------- TRANSACTIONS -------------------------------
function Transactions({ txns, accounts, tenant, onReload, onStatus }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'expense', category: '', amount: '', description: '', status: 'pending' });
  const cats = accounts.filter((a) => (form.type === 'income' ? a.type === 'income' : a.type === 'expense'));
  const submit = async () => {
    if (!form.category || !form.amount) return toast.error('Category and amount are required');
    const res = await api.post('/transactions', { tenantId: tenant.id, type: form.type, category: form.category, amount: toCents(form.amount), description: form.description, status: form.status });
    if (res?.id) { toast.success('Balanced journal entry posted (debits = credits)'); setOpen(false); setForm({ type: 'expense', category: '', amount: '', description: '', status: 'pending' }); onReload(); } else toast.error(res?.error || 'Failed');
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="text-base">Bank Feed & Transaction Triage</CardTitle><p className="text-xs text-muted-foreground">Immutable double-entry ledger · reconcile or flag each item</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add transaction</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New transaction</DialogTitle><DialogDescription>Posted as a balanced double-entry journal against Cash & Bank.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, category: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Amount (USD)</Label><Input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Account / Category</Label><Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{cats.map((a) => <SelectItem key={a.code} value={a.name}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Description</Label><Input placeholder="Optional note" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="reconciled">Reconciled</SelectItem><SelectItem value="flagged">Flagged</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button onClick={submit}>Post entry</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString()}</TableCell>
                  <TableCell className="max-w-[240px] truncate">{t.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.category}</TableCell>
                  <TableCell className={`text-right font-medium ${t.type === 'income' ? 'text-accent' : 'text-foreground'}`}>{t.type === 'income' ? '+' : '-'}{money(t.amount, { compact: true })}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-right">
                    {t.status !== 'reconciled' && <Button size="sm" variant="ghost" className="h-7 text-accent" onClick={() => onStatus(t.id, 'reconciled')}>Reconcile</Button>}
                    {t.status !== 'flagged' && <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => onStatus(t.id, 'flagged')}>Flag</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {txns.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No transactions yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------- INVOICES -------------------------------
function Invoices({ invoices, tenant, onReload }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('itemized');
  const [client, setClient] = useState('');
  const [lines, setLines] = useState([{ description: '', quantity: 1, unitAmount: '' }]);
  const addLine = () => setLines([...lines, { description: '', quantity: 1, unitAmount: '' }]);
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * toCents(l.unitAmount), 0);
  const create = async () => {
    if (!client || !lines[0].description) return toast.error('Client and at least one line required');
    const payload = { tenantId: tenant.id, kind, clientName: client, lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity) || 1, unitAmount: toCents(l.unitAmount) })) };
    const res = await api.post('/invoices', payload);
    if (res?.id) { toast.success(`${res.number} created`); setOpen(false); setClient(''); setLines([{ description: '', quantity: 1, unitAmount: '' }]); onReload(); } else toast.error('Failed');
  };
  const pay = async (inv) => {
    toast.loading('Creating secure checkout…', { id: 'pay' });
    const res = await api.post('/payments/checkout', { invoiceId: inv.id });
    toast.dismiss('pay');
    if (res?.url) window.location.assign(res.url);
    else if (res?.code === 'NO_STRIPE') toast.error('Add your Stripe keys to enable live card payments.');
    else toast.error(res?.error || 'Unable to start payment');
  };
  const KINDS = [{ id: 'flat', label: 'Flat fee' }, { id: 'hourly_milestone', label: 'Hourly / milestone' }, { id: 'itemized', label: 'Itemized products' }];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="text-base">Invoicing & Payments</CardTitle><p className="text-xs text-muted-foreground">Flat fee · hourly milestone · itemized — pay via pluggable providers (Stripe live)</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> New invoice</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create invoice</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Client</Label><Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" /></div>
                <div className="space-y-1.5"><Label>Billing type</Label><Select value={kind} onValueChange={setKind}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="space-y-2">
                <Label>Line items</Label>
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-6" placeholder="Description" value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} />
                    <Input className="col-span-2" type="number" placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} />
                    <Input className="col-span-4" type="number" placeholder="Unit $" value={l.unitAmount} onChange={(e) => setLine(i, 'unitAmount', e.target.value)} />
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addLine}><Plus className="mr-1 h-3 w-3" /> Add line</Button>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/40 p-3"><span className="text-sm text-muted-foreground">Total</span><span className="text-lg font-bold">{money(total)}</span></div>
            </div>
            <DialogFooter><Button onClick={create}>Create invoice</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Client</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.number}</TableCell>
                  <TableCell>{inv.clientName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{inv.kind.replace('_', ' ')}</TableCell>
                  <TableCell className="text-right font-medium">{money(inv.total)}</TableCell>
                  <TableCell><Badge variant="outline" className={inv.status === 'paid' ? 'border-accent/50 text-accent bg-accent/10' : 'border-primary/50 text-primary bg-primary/10'}>{inv.status}</Badge></TableCell>
                  <TableCell className="text-right">{inv.status === 'open' ? <Button size="sm" onClick={() => pay(inv)}><CreditCard className="mr-2 h-4 w-4" /> Pay</Button> : <Check className="ml-auto h-4 w-4 text-accent" />}</TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No invoices yet — create your first.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------- REPORTS -------------------------------
function Reports({ reports, tenant }) {
  if (!reports) return null;
  const { pnl, balanceSheet: bs } = reports;
  const Row = ({ name, amount, bold }) => (
    <div className={`flex items-center justify-between py-1.5 text-sm ${bold ? 'font-bold border-t border-border mt-1 pt-2' : ''}`}><span className={bold ? '' : 'text-muted-foreground'}>{name}</span><span>{money(amount)}</span></div>
  );
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => window.open(`/api/reports/csv?tenantId=${tenant.id}`, '_blank')}><Download className="mr-2 h-4 w-4" /> Export CSV for CPA</Button></div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Profit & Loss Statement</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Income</div>
            {pnl.income.map((r) => <Row key={r.name} name={r.name} amount={r.amount} />)}
            <Row name="Total income" amount={pnl.totalIncome} bold />
            <div className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expenses</div>
            {pnl.expense.map((r) => <Row key={r.name} name={r.name} amount={r.amount} />)}
            <Row name="Total expenses" amount={pnl.totalExpense} bold />
            <div className="mt-3 flex items-center justify-between rounded-lg bg-accent/10 p-3"><span className="font-semibold">Net Income</span><span className={`text-lg font-bold ${pnl.netIncome >= 0 ? 'text-accent' : 'text-destructive'}`}>{money(pnl.netIncome)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Balance Sheet</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assets</div>
            {bs.assets.map((r) => <Row key={r.name} name={r.name} amount={r.amount} />)}
            <Row name="Total assets" amount={bs.totalAssets} bold />
            <div className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Liabilities</div>
            {bs.liabilities.map((r) => <Row key={r.name} name={r.name} amount={r.amount} />)}
            <Row name="Total liabilities" amount={bs.totalLiabilities} bold />
            <div className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Equity</div>
            {bs.equity.map((r) => <Row key={r.name} name={r.name} amount={r.amount} />)}
            <Row name="Retained earnings (net income)" amount={bs.retainedEarnings} />
            <Row name="Total equity" amount={bs.totalEquity} bold />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
