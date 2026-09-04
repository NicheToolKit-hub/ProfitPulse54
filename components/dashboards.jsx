'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { money, pct } from '@/lib/format';
import {
  TrendingUp, TrendingDown, Wallet, DollarSign, ShoppingCart, HardHat,
  Palette, Server, Camera, Mic, Check, X, Store, Percent, Target, Users, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts';

const C1 = 'hsl(189 94% 43%)'; // cyan
const C2 = 'hsl(160 84% 39%)'; // green
const C3 = 'hsl(217 91% 60%)';
const C4 = 'hsl(43 96% 56%)';
const C5 = 'hsl(271 81% 66%)';
const PIE = [C1, C2, C3, C4, C5];

function StatCard({ label, value, sub, positive, icon: Icon, accent = 'primary' }) {
  const accentText = accent === 'green' ? 'text-accent' : accent === 'red' ? 'text-destructive' : 'text-primary';
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          {Icon && <Icon className={`h-4 w-4 ${accentText}`} />}
        </div>
        <div className={`mt-2 text-2xl font-bold ${positive === true ? 'text-accent' : positive === false ? 'text-destructive' : 'text-foreground'}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-foreground">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-foreground">{money(p.value, { compact: true })}</span>
        </div>
      ))}
    </div>
  );
}

function CashflowChart({ monthly }) {
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Cash Flow Pulse — 6 months</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthly} margin={{ left: -10, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C2} stopOpacity={0.5} /><stop offset="100%" stopColor={C2} stopOpacity={0} /></linearGradient>
              <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C1} stopOpacity={0.35} /><stop offset="100%" stopColor={C1} stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 22%)" vertical={false} />
            <XAxis dataKey="label" stroke="hsl(215 20% 55%)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 100000)}k`} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" name="Income" dataKey="income" stroke={C2} strokeWidth={2} fill="url(#inc)" />
            <Area type="monotone" name="Expense" dataKey="expense" stroke={C1} strokeWidth={2} fill="url(#exp)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function CommonHeader({ common }) {
  return (
    <>
      <StatCard label="Revenue" value={money(common.revenue, { compact: true })} sub="All income accounts" icon={DollarSign} />
      <StatCard label="Expenses" value={money(common.expenses, { compact: true })} sub="All expense accounts" icon={TrendingDown} accent="red" />
      <StatCard label="Net Profit" value={money(common.netProfit, { compact: true })} sub={`${pct(common.margin)} margin`} positive={common.netProfit >= 0} icon={TrendingUp} accent="green" />
      <StatCard label="Cash Position" value={money(common.cash, { compact: true })} sub={`${common.txCount} ledger entries`} icon={Wallet} />
    </>
  );
}

// ------------------------------- E-COMMERCE -------------------------------
function Ecommerce({ common, niche }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <CommonHeader common={common} />
      <CashflowChart monthly={common.monthly} />
      <Card className="md:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /> SKU Net-Profit Margins</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {niche.skuMargins?.map((s) => (
            <div key={s.sku} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.sku} · {s.units} units · {s.marketplace}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${s.netProfit >= 0 ? 'text-accent' : 'text-destructive'}`}>{money(s.netProfit, { compact: true })}</div>
                  <Badge variant="outline" className={s.margin >= 0.4 ? 'border-accent text-accent' : 'border-border text-muted-foreground'}>{pct(s.margin)} margin</Badge>
                </div>
              </div>
              <Progress value={Math.max(0, Math.min(100, s.margin * 100))} className="mt-2 h-1.5" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4 md:col-span-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4 text-primary" /> Marketplace Fee Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={niche.marketplaceFees} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {niche.marketplaceFees?.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-3">
              {niche.marketplaceFees?.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: PIE[i % PIE.length] }} />{e.name}: {money(e.value, { compact: true })}</div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Ad Spend" value={money(niche.adSpend, { compact: true })} sub="Across channels" icon={Target} accent="red" />
          <StatCard label="Ad ROI" value={`${(niche.adRoi || 0).toFixed(1)}×`} sub="Revenue / ad spend" positive icon={Percent} accent="green" />
        </div>
      </div>
    </div>
  );
}

// ------------------------------- FIELD TRADES -------------------------------
function FieldTrades({ common, niche, onQuickCapture }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <CommonHeader common={common} />
      <Card className="md:col-span-3 order-2 md:order-none">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><HardHat className="h-4 w-4 text-primary" /> Active Job Sites — Budget vs. Spend</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {niche.jobs?.map((j) => (
            <div key={j.jobId} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{j.site}</div>
                  <div className="text-xs text-muted-foreground">{j.jobId} · Milestone {j.milestonesDone}/{j.milestones}</div>
                </div>
                <Badge variant="outline" className={j.profit >= 0 ? 'border-accent text-accent' : 'border-destructive text-destructive'}>{money(j.profit, { compact: true })} profit</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{money(j.spent, { compact: true })} spent</span><span>Budget {money(j.budget, { compact: true })}</span>
              </div>
              <Progress value={Math.min(100, j.budgetUsed * 100)} className="mt-1.5 h-2" />
              <div className="mt-2 flex gap-1">
                {Array.from({ length: j.milestones }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < j.milestonesDone ? 'bg-accent' : 'bg-muted'}`} />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card className="pp-glow">
          <CardHeader className="pb-2"><CardTitle className="text-base">Quick Capture</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Snap a receipt or record a voice memo right from the field.</p>
            <Button className="w-full" onClick={() => onQuickCapture('photo')}><Camera className="mr-2 h-4 w-4" /> Photo Receipt</Button>
            <Button variant="secondary" className="w-full" onClick={() => onQuickCapture('voice')}><Mic className="mr-2 h-4 w-4" /> Voice Memo</Button>
            <div className="pt-1 text-center text-xs text-muted-foreground">{niche.receiptsCount} receipts captured</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------- FREELANCER -------------------------------
function Freelancer({ common, niche, onClassify }) {
  const feed = niche.unsortedFeed || [];
  const top = feed[0];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <CommonHeader common={common} />
      <Card className="md:col-span-2 pp-glow order-2 md:order-none">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Swipe to Sort — Business or Personal?</CardTitle></CardHeader>
        <CardContent>
          {feed.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-muted-foreground"><Check className="mb-2 h-8 w-8 text-accent" />All caught up! Every expense is sorted.</div>
          ) : (
            <div>
              <div className="mb-3 text-xs text-muted-foreground">{feed.length} expenses waiting to be sorted</div>
              <div className="rounded-xl border-2 border-border bg-secondary/40 p-6 text-center">
                <div className="text-3xl font-bold">{money(top.amount)}</div>
                <div className="mt-1 text-sm text-muted-foreground">{top.merchant || top.description}</div>
                <div className="text-xs text-muted-foreground">{new Date(top.date).toLocaleDateString()}</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-14 border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => onClassify(top.id, 'personal')}><X className="mr-2 h-5 w-5" /> Personal</Button>
                <Button className="h-14 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => onClassify(top.id, 'business')}><Check className="mr-2 h-5 w-5" /> Business</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="space-y-4 md:col-span-2">
        <Card className="border-accent/40">
          <CardHeader className="pb-2"><CardTitle className="text-base">Estimated Quarterly Tax</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{money(niche.estQuarterlyTax)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Set aside ~25% of net profit for self-employment + income tax.</p>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Business Exp." value={money(niche.businessExpenses, { compact: true })} sub="Deductible" icon={Check} accent="green" />
          <StatCard label="Personal Exp." value={money(niche.personalExpenses, { compact: true })} sub="Non-deductible" icon={X} accent="red" />
        </div>
      </div>
    </div>
  );
}

// ------------------------------- SAAS -------------------------------
function SaaS({ common, niche }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <CommonHeader common={common} />
      <Card className="md:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> MRR Growth</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={niche.mrrSeries} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 22%)" vertical={false} />
              <XAxis dataKey="label" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 100000)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" name="MRR" dataKey="mrr" stroke={C2} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <StatCard label="MRR" value={money(niche.mrr, { compact: true })} sub="Monthly recurring" positive icon={TrendingUp} accent="green" />
        <StatCard label="Subscribers" value={niche.subscribers} sub={`${money(niche.arpu)} ARPU`} icon={Users} />
      </div>
      <div className="md:col-span-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Churn Rate" value={pct(niche.churn)} sub="Monthly" icon={TrendingDown} accent="red" />
        <StatCard label="Gateway Fees" value={money(niche.gatewayFees, { compact: true })} sub="Payment processing" icon={Percent} accent="red" />
        <StatCard label="Net Margin" value={pct(common.margin)} sub="Profit / revenue" positive={common.netProfit >= 0} icon={Percent} accent="green" />
        <StatCard label="Cash Runway" value={money(common.cash, { compact: true })} sub="Available" icon={Wallet} />
      </div>
    </div>
  );
}

export function NicheDashboard({ data, onClassify, onQuickCapture }) {
  if (!data) return null;
  const { common, niche, tenant } = data;
  if (tenant.niche === 'ecommerce') return <Ecommerce common={common} niche={niche} />;
  if (tenant.niche === 'field_trades') return <FieldTrades common={common} niche={niche} onQuickCapture={onQuickCapture} />;
  if (tenant.niche === 'freelancer') return <Freelancer common={common} niche={niche} onClassify={onClassify} />;
  if (tenant.niche === 'saas') return <SaaS common={common} niche={niche} />;
  return null;
}

export default NicheDashboard;
