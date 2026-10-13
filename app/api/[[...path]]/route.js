import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { EmergentStripeProvider } from '@/lib/payments/emergentStripe'

// ---------------------------------------------------------------------------
// Mongo connection (reused across invocations)
// ---------------------------------------------------------------------------
let client
let db
async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME || 'profitpulse')
    await ensureIndexes(db)
  }
  return db
}
async function ensureIndexes(d) {
  try {
    await d.collection('payments').createIndex({ providerEventId: 1 }, { unique: true, sparse: true })
    await d.collection('tenants').createIndex({ id: 1 }, { unique: true })
    await d.collection('journal_entries').createIndex({ tenantId: 1, date: -1 })
    await d.collection('journal_lines').createIndex({ tenantId: 1, entryId: 1 })
  } catch (e) { /* index race — ignore */ }
}

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return res
}
export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

const stripe = new EmergentStripeProvider()
const clean = (docs) => docs.map(({ _id, ...rest }) => rest)
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d }

// ---------------------------------------------------------------------------
// Adaptive Chart of Accounts templates (GAAP structure, niche-aware)
// ---------------------------------------------------------------------------
const BASE_COA = [
  { code: '1000', name: 'Cash & Bank', type: 'asset' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset' },
  { code: '2000', name: 'Accounts Payable', type: 'liability' },
  { code: '2100', name: 'Sales Tax Payable', type: 'liability' },
  { code: '3000', name: "Owner's Equity", type: 'equity' },
  { code: '6000', name: 'Payment Processing Fees', type: 'expense' },
]
const NICHE_COA = {
  ecommerce: [
    { code: '1200', name: 'Inventory', type: 'asset' },
    { code: '4100', name: 'Product Sales', type: 'income' },
    { code: '5100', name: 'Cost of Goods Sold', type: 'expense' },
    { code: '5200', name: 'Marketplace Fees', type: 'expense' },
    { code: '5300', name: 'Advertising & Ad Spend', type: 'expense' },
    { code: '5400', name: 'Shipping & Fulfillment', type: 'expense' },
  ],
  field_trades: [
    { code: '4100', name: 'Job Revenue', type: 'income' },
    { code: '5100', name: 'Materials & Supplies', type: 'expense' },
    { code: '5200', name: 'Subcontractors', type: 'expense' },
    { code: '5300', name: 'Equipment & Fuel', type: 'expense' },
    { code: '5400', name: 'Labor', type: 'expense' },
  ],
  freelancer: [
    { code: '4100', name: 'Client Services', type: 'income' },
    { code: '4200', name: 'Retainer Income', type: 'income' },
    { code: '5100', name: 'Software & Subscriptions', type: 'expense' },
    { code: '5200', name: 'Home Office', type: 'expense' },
    { code: '5300', name: 'Travel & Meals', type: 'expense' },
    { code: '5900', name: 'Personal (Non-deductible)', type: 'expense' },
  ],
  saas: [
    { code: '4100', name: 'Subscription Revenue', type: 'income' },
    { code: '5100', name: 'Hosting & Infrastructure', type: 'expense' },
    { code: '5200', name: 'Payment Gateway Fees', type: 'expense' },
    { code: '5300', name: 'Marketing', type: 'expense' },
    { code: '5400', name: 'Contractors', type: 'expense' },
  ],
}
function buildCOA(niche) {
  const list = [...BASE_COA, ...(NICHE_COA[niche] || [])]
  const map = {}
  list.forEach((a) => { map[a.name] = a })
  return { list, map }
}

// ---------------------------------------------------------------------------
// Double-entry posting with strict net-zero validation
// ---------------------------------------------------------------------------
async function postEntry(d, tenantId, coaMap, spec) {
  const lines = spec.lines
  const debit = lines.reduce((s, l) => s + (l.debit || 0), 0)
  const credit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  if (lines.length < 2) throw new Error('A journal entry needs at least two lines')
  if (debit !== credit) throw new Error(`Unbalanced entry: debits ${debit} != credits ${credit}`)
  if (debit === 0) throw new Error('Entry amount must be greater than zero')

  const entryId = uuidv4()
  const entry = {
    id: entryId, tenantId,
    date: spec.date || new Date(),
    description: spec.description || '',
    category: spec.category || '',
    type: spec.type || 'expense',
    amount: debit,
    status: spec.status || 'pending',
    metadata: spec.metadata || {},
    createdAt: new Date(),
  }
  const lineDocs = lines.map((l) => ({
    id: uuidv4(), tenantId, entryId,
    accountCode: coaMap[l.account]?.code || '9999',
    accountName: l.account,
    accountType: coaMap[l.account]?.type || 'expense',
    debit: l.debit || 0, credit: l.credit || 0,
  }))
  await d.collection('journal_entries').insertOne(entry)
  await d.collection('journal_lines').insertMany(lineDocs)
  return entry
}

const incomeLines = (account, amt, cashAccount = 'Cash & Bank') => [
  { account: cashAccount, debit: amt, credit: 0 },
  { account, debit: 0, credit: amt },
]
const expenseLines = (account, amt, cashAccount = 'Cash & Bank') => [
  { account, debit: amt, credit: 0 },
  { account: cashAccount, debit: 0, credit: amt },
]
const c = (dollars) => Math.round(dollars * 100)

// ---------------------------------------------------------------------------
// Demo seed generators per niche
// ---------------------------------------------------------------------------
function seedSpecs(niche) {
  const specs = []
  const S = ['reconciled', 'reconciled', 'reconciled', 'flagged', 'pending']
  const rnd = (i) => S[i % S.length]

  if (niche === 'ecommerce') {
    const skus = [
      { sku: 'MUG-BLK-11', name: 'Matte Black Mug', price: 24.0, cogs: 6.5, market: 'Shopify', feeRate: 0.029 },
      { sku: 'TEE-ORG-M', name: 'Organic Tee (M)', price: 32.0, cogs: 9.0, market: 'Amazon', feeRate: 0.15 },
      { sku: 'BTL-STL-32', name: 'Steel Bottle 32oz', price: 45.0, cogs: 14.0, market: 'Etsy', feeRate: 0.065 },
      { sku: 'CND-SOY-8', name: 'Soy Candle 8oz', price: 28.0, cogs: 7.5, market: 'Shopify', feeRate: 0.029 },
    ]
    let day = 110
    for (let i = 0; i < 22; i++) {
      const s = skus[i % skus.length]
      const units = 3 + ((i * 7) % 20)
      const revenue = c(s.price * units)
      const cogs = c(s.cogs * units)
      const fees = Math.round(revenue * s.feeRate)
      const net = revenue - fees
      specs.push({
        date: daysAgo(day), type: 'income', category: 'Product Sales', status: rnd(i),
        description: `${units}× ${s.name} sold on ${s.market}`,
        metadata: { sku: s.sku, skuName: s.name, marketplace: s.market, units, revenue, cogs, fees },
        lines: [
          { account: 'Cash & Bank', debit: net, credit: 0 },
          { account: 'Marketplace Fees', debit: fees, credit: 0 },
          { account: 'Product Sales', debit: 0, credit: revenue },
        ],
      })
      specs.push({
        date: daysAgo(day), type: 'expense', category: 'Cost of Goods Sold', status: 'reconciled',
        description: `COGS — ${s.name}`, metadata: { sku: s.sku },
        lines: [ { account: 'Cost of Goods Sold', debit: cogs, credit: 0 }, { account: 'Inventory', debit: 0, credit: cogs } ],
      })
      day -= 5
    }
    ;[['Shopify', 380], ['Amazon', 640], ['Etsy', 150]].forEach(([mk, amt], i) => {
      specs.push({ date: daysAgo(30 - i * 8), type: 'expense', category: 'Advertising & Ad Spend', status: 'reconciled',
        description: `${mk} Ads — monthly`, metadata: { marketplace: mk, adSpend: c(amt) }, lines: expenseLines('Advertising & Ad Spend', c(amt)) })
    })
    specs.push({ date: daysAgo(12), type: 'expense', category: 'Shipping & Fulfillment', status: 'flagged',
      description: 'ShipStation postage batch', metadata: {}, lines: expenseLines('Shipping & Fulfillment', c(212.4)) })
  }

  if (niche === 'field_trades') {
    const jobs = [
      { site: 'Maple St Kitchen Remodel', jobId: 'JOB-1042', budget: 42000, milestones: 4, done: 3 },
      { site: 'Riverside Deck Build', jobId: 'JOB-1043', budget: 18500, milestones: 3, done: 1 },
      { site: 'Oakwood Roof Replace', jobId: 'JOB-1044', budget: 27500, milestones: 3, done: 2 },
    ]
    let day = 95
    jobs.forEach((j, ji) => {
      for (let m = 0; m < j.done; m++) {
        const amt = c((j.budget / j.milestones) * 0.9)
        specs.push({ date: daysAgo(day), type: 'income', category: 'Job Revenue', status: ji === 1 ? 'pending' : 'reconciled',
          description: `${j.site} — Milestone ${m + 1} payment`,
          metadata: { jobId: j.jobId, jobSite: j.site, budget: c(j.budget), milestones: j.milestones, milestonesDone: j.done, milestone: m + 1 },
          lines: incomeLines('Job Revenue', amt) })
        day -= 6
      }
      const costs = [ ['Materials & Supplies', j.budget * 0.28], ['Subcontractors', j.budget * 0.18], ['Labor', j.budget * 0.15], ['Equipment & Fuel', j.budget * 0.05] ]
      costs.forEach(([acc, amt], ci) => {
        specs.push({ date: daysAgo(day), type: 'expense', category: acc, status: ci === 0 ? 'flagged' : 'reconciled',
          description: `${j.site} — ${acc}`, metadata: { jobId: j.jobId, jobSite: j.site, budget: c(j.budget), hasReceipt: ci % 2 === 0 },
          lines: expenseLines(acc, c(amt)) })
        day -= 4
      })
    })
  }

  if (niche === 'freelancer') {
    const clients = [ ['Northwind Co', 'RET-01'], ['Bloom Studio', 'RET-02'], ['Cadence Media', null] ]
    let day = 100
    clients.forEach(([name, ret], i) => {
      const amt = c([3500, 2200, 4800][i])
      specs.push({ date: daysAgo(day), type: 'income', category: ret ? 'Retainer Income' : 'Client Services', status: 'reconciled',
        description: `${name} — ${ret ? 'monthly retainer' : 'project invoice'}`,
        metadata: { clientId: name, retainerId: ret }, lines: incomeLines(ret ? 'Retainer Income' : 'Client Services', amt) })
      day -= 9
    })
    const be = [ ['Software & Subscriptions', 79, 'Adobe CC'], ['Software & Subscriptions', 20, 'Figma'], ['Home Office', 240, 'Standing desk'], ['Travel & Meals', 86, 'Client lunch'] ]
    be.forEach(([acc, amt, desc], i) => {
      specs.push({ date: daysAgo(60 - i * 7), type: 'expense', category: acc, status: 'reconciled',
        description: desc, metadata: { classification: 'business' }, lines: expenseLines(acc, c(amt)) })
    })
    const unsorted = [ ['Amazon', 64.2], ['Starbucks', 12.75], ['Uber', 28.4], ['Notion', 10.0], ['Whole Foods', 96.3], ['B&H Photo', 349.99] ]
    unsorted.forEach(([desc, amt], i) => {
      specs.push({ date: daysAgo(20 - i * 2), type: 'expense', category: 'Home Office', status: 'flagged',
        description: desc, metadata: { classification: 'unsorted', merchant: desc }, lines: expenseLines('Home Office', c(amt)) })
    })
  }

  if (niche === 'saas') {
    let mrr = 4200
    for (let w = 12; w >= 0; w--) {
      mrr = Math.round(mrr * (1 + (0.04 - (w % 3 === 0 ? 0.015 : 0))))
      const rev = c(mrr)
      const fee = Math.round(rev * 0.029)
      specs.push({ date: daysAgo(w * 7), type: 'income', category: 'Subscription Revenue', status: w > 1 ? 'reconciled' : 'pending',
        description: `Weekly subscription settlement`,
        metadata: { mrr: c(mrr), gateway: 'Stripe', gatewayFee: fee, churn: 0.02 + (w % 4) * 0.004, subscribers: 60 + (12 - w) * 4 },
        lines: [ { account: 'Cash & Bank', debit: rev - fee, credit: 0 }, { account: 'Payment Gateway Fees', debit: fee, credit: 0 }, { account: 'Subscription Revenue', debit: 0, credit: rev } ] })
    }
    ;[['Hosting & Infrastructure', 640, 'AWS'], ['Marketing', 1200, 'Google Ads'], ['Contractors', 2400, 'Dev contractor']].forEach(([acc, amt, desc], i) => {
      specs.push({ date: daysAgo(25 - i * 8), type: 'expense', category: acc, status: i === 1 ? 'flagged' : 'reconciled',
        description: desc, metadata: {}, lines: expenseLines(acc, c(amt)) })
    })
  }
  return specs
}

async function createTenant(d, { name, niche, incomeMethod, seed }) {
  const { list, map } = buildCOA(niche)
  const tenant = { id: uuidv4(), name, niche, incomeMethod: incomeMethod || 'stripe', onboardingComplete: true, createdAt: new Date() }
  await d.collection('tenants').insertOne(tenant)
  await d.collection('accounts').insertMany(list.map((a) => ({ id: uuidv4(), tenantId: tenant.id, ...a })))
  if (seed) { const specs = seedSpecs(niche); for (const s of specs) { await postEntry(d, tenant.id, map, s) } }
  return tenant
}

// ---------------------------------------------------------------------------
// Dashboard analytics
// ---------------------------------------------------------------------------
async function computeDashboard(d, tenantId) {
  const tenant = await d.collection('tenants').findOne({ id: tenantId })
  if (!tenant) return null
  const entries = await d.collection('journal_entries').find({ tenantId }).toArray()
  const lines = await d.collection('journal_lines').find({ tenantId }).toArray()

  let revenue = 0, expenses = 0, cash = 0
  for (const l of lines) {
    if (l.accountType === 'income') revenue += l.credit - l.debit
    if (l.accountType === 'expense') expenses += l.debit - l.credit
    if (l.accountCode === '1000') cash += l.debit - l.credit
  }
  const netProfit = revenue - expenses

  const series = {}
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
    series[`${dt.getFullYear()}-${dt.getMonth()}`] = { label: dt.toLocaleString('en-US', { month: 'short' }), income: 0, expense: 0, profit: 0 }
  }
  const lineByEntry = {}
  lines.forEach((l) => { (lineByEntry[l.entryId] = lineByEntry[l.entryId] || []).push(l) })
  entries.forEach((e) => {
    const dt = new Date(e.date)
    const key = `${dt.getFullYear()}-${dt.getMonth()}`
    if (!series[key]) return
    for (const l of lineByEntry[e.id] || []) {
      if (l.accountType === 'income') series[key].income += l.credit - l.debit
      if (l.accountType === 'expense') series[key].expense += l.debit - l.credit
    }
  })
  Object.values(series).forEach((s) => { s.profit = s.income - s.expense })
  const monthly = Object.values(series)

  const triage = {
    reconciled: entries.filter((e) => e.status === 'reconciled').length,
    flagged: entries.filter((e) => e.status === 'flagged').length,
    pending: entries.filter((e) => e.status === 'pending').length,
  }
  const common = { revenue, expenses, netProfit, cash, margin: revenue ? netProfit / revenue : 0, monthly, triage, txCount: entries.length }

  let niche = {}
  if (tenant.niche === 'ecommerce') {
    const bySku = {}; let totalAd = 0; const fees = {}
    entries.forEach((e) => {
      const m = e.metadata || {}
      if (m.sku && m.revenue) {
        const k = m.sku
        bySku[k] = bySku[k] || { sku: k, name: m.skuName, marketplace: m.marketplace, revenue: 0, cogs: 0, fees: 0, units: 0 }
        bySku[k].revenue += m.revenue; bySku[k].cogs += m.cogs || 0; bySku[k].fees += m.fees || 0; bySku[k].units += m.units || 0
        fees[m.marketplace] = (fees[m.marketplace] || 0) + (m.fees || 0)
      }
      if (m.adSpend) totalAd += m.adSpend
    })
    const skuMargins = Object.values(bySku).map((s) => { const net = s.revenue - s.cogs - s.fees; return { ...s, netProfit: net, margin: s.revenue ? net / s.revenue : 0 } }).sort((a, b) => b.netProfit - a.netProfit)
    niche = { skuMargins, marketplaceFees: Object.entries(fees).map(([k, v]) => ({ name: k, value: v })), adSpend: totalAd, adRoi: totalAd ? revenue / totalAd : 0 }
  }
  if (tenant.niche === 'field_trades') {
    const jobs = {}; let receipts = 0
    entries.forEach((e) => {
      const m = e.metadata || {}
      if (m.jobId) {
        jobs[m.jobId] = jobs[m.jobId] || { jobId: m.jobId, site: m.jobSite, budget: m.budget || 0, revenue: 0, spent: 0, milestones: m.milestones || 0, milestonesDone: m.milestonesDone || 0 }
        if (m.budget) jobs[m.jobId].budget = Math.max(jobs[m.jobId].budget, m.budget)
        if (m.milestones) jobs[m.jobId].milestones = m.milestones
        if (m.milestonesDone) jobs[m.jobId].milestonesDone = Math.max(jobs[m.jobId].milestonesDone, m.milestonesDone)
        if (e.type === 'income') jobs[m.jobId].revenue += e.amount
        if (e.type === 'expense') jobs[m.jobId].spent += e.amount
        if (m.hasReceipt) receipts++
      }
    })
    const jobList = Object.values(jobs).map((j) => ({ ...j, budgetUsed: j.budget ? j.spent / j.budget : 0, profit: j.revenue - j.spent }))
    niche = { jobs: jobList, receiptsCount: receipts }
  }
  if (tenant.niche === 'freelancer') {
    let business = 0, personal = 0; const unsorted = []
    entries.forEach((e) => {
      const m = e.metadata || {}
      if (e.type === 'expense') {
        if (m.classification === 'business') business += e.amount
        else if (m.classification === 'personal') personal += e.amount
        else if (m.classification === 'unsorted') unsorted.push({ id: e.id, description: e.description, amount: e.amount, date: e.date, merchant: m.merchant })
      }
    })
    niche = { businessExpenses: business, personalExpenses: personal, unsortedFeed: unsorted, estQuarterlyTax: Math.max(0, Math.round(netProfit * 0.25)) }
  }
  if (tenant.niche === 'saas') {
    const subs = entries.filter((e) => (e.metadata || {}).mrr).sort((a, b) => new Date(a.date) - new Date(b.date))
    const latest = subs[subs.length - 1]?.metadata || {}
    const gatewayFees = entries.reduce((s, e) => s + ((e.metadata || {}).gatewayFee || 0), 0)
    const mrrSeries = subs.map((e) => ({ label: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), mrr: e.metadata.mrr }))
    niche = { mrr: latest.mrr || 0, subscribers: latest.subscribers || 0, churn: latest.churn || 0, arpu: latest.subscribers ? Math.round((latest.mrr || 0) / latest.subscribers) : 0, gatewayFees, mrrSeries }
  }
  return { tenant: (({ _id, ...r }) => r)(tenant), common, niche }
}

async function computeReports(d, tenantId) {
  const lines = await d.collection('journal_lines').find({ tenantId }).toArray()
  const byAccount = {}
  lines.forEach((l) => {
    byAccount[l.accountName] = byAccount[l.accountName] || { name: l.accountName, type: l.accountType, debit: 0, credit: 0 }
    byAccount[l.accountName].debit += l.debit; byAccount[l.accountName].credit += l.credit
  })
  const rows = Object.values(byAccount)
  const income = rows.filter((r) => r.type === 'income').map((r) => ({ name: r.name, amount: r.credit - r.debit }))
  const expense = rows.filter((r) => r.type === 'expense').map((r) => ({ name: r.name, amount: r.debit - r.credit }))
  const totalIncome = income.reduce((s, r) => s + r.amount, 0)
  const totalExpense = expense.reduce((s, r) => s + r.amount, 0)
  const assets = rows.filter((r) => r.type === 'asset').map((r) => ({ name: r.name, amount: r.debit - r.credit }))
  const liabilities = rows.filter((r) => r.type === 'liability').map((r) => ({ name: r.name, amount: r.credit - r.debit }))
  const equity = rows.filter((r) => r.type === 'equity').map((r) => ({ name: r.name, amount: r.credit - r.debit }))
  const netIncome = totalIncome - totalExpense
  return {
    pnl: { income, expense, totalIncome, totalExpense, netIncome },
    balanceSheet: { assets, liabilities, equity, totalAssets: assets.reduce((s, r) => s + r.amount, 0), totalLiabilities: liabilities.reduce((s, r) => s + r.amount, 0), totalEquity: equity.reduce((s, r) => s + r.amount, 0) + netIncome, retainedEarnings: netIncome },
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method
  try {
    const d = await connectToMongo()
    const url = new URL(request.url)
    const q = (k) => url.searchParams.get(k)

    if (route === '/root' || route === '/') return cors(NextResponse.json({ app: 'ProfitPulse', ok: true }))

    if (route === '/tenants' && method === 'GET') {
      const tenants = await d.collection('tenants').find({}).sort({ createdAt: 1 }).toArray()
      return cors(NextResponse.json(clean(tenants)))
    }
    if (route === '/tenant' && method === 'GET') {
      const t = await d.collection('tenants').findOne({ id: q('id') })
      if (!t) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      const { _id, ...rest } = t
      return cors(NextResponse.json(rest))
    }
    if (route === '/onboarding' && method === 'POST') {
      const b = await request.json()
      if (!b.name || !b.niche) return cors(NextResponse.json({ error: 'name and niche required' }, { status: 400 }))
      const t = await createTenant(d, { name: b.name, niche: b.niche, incomeMethod: b.incomeMethod, seed: b.seed !== false })
      const { _id, ...rest } = t
      return cors(NextResponse.json(rest))
    }
    if (route === '/demo/seed' && method === 'POST') {
      const existing = await d.collection('tenants').countDocuments({})
      if (existing > 0) {
        const tenants = await d.collection('tenants').find({}).sort({ createdAt: 1 }).toArray()
        return cors(NextResponse.json({ created: false, tenants: clean(tenants) }))
      }
      const defs = [
        { name: 'Nimbus Goods Co.', niche: 'ecommerce', incomeMethod: 'stripe' },
        { name: 'Ironclad Contracting', niche: 'field_trades', incomeMethod: 'invoice' },
        { name: 'Studio Vera', niche: 'freelancer', incomeMethod: 'stripe' },
        { name: 'FlowMetric SaaS', niche: 'saas', incomeMethod: 'stripe' },
      ]
      const out = []
      for (const def of defs) { out.push(await createTenant(d, { ...def, seed: true })) }
      return cors(NextResponse.json({ created: true, tenants: out.map(({ _id, ...r }) => r) }))
    }
    if (route === '/reset' && method === 'POST') {
      for (const col of ['tenants', 'accounts', 'journal_entries', 'journal_lines', 'invoices', 'payments']) { await d.collection(col).deleteMany({}) }
      return cors(NextResponse.json({ ok: true }))
    }
    if (route === '/accounts' && method === 'GET') {
      const accounts = await d.collection('accounts').find({ tenantId: q('tenantId') }).toArray()
      return cors(NextResponse.json(clean(accounts)))
    }
    if (route === '/transactions' && method === 'GET') {
      const entries = await d.collection('journal_entries').find({ tenantId: q('tenantId') }).sort({ date: -1 }).limit(500).toArray()
      const ids = entries.map((e) => e.id)
      const lines = await d.collection('journal_lines').find({ entryId: { $in: ids } }).toArray()
      const byEntry = {}
      lines.forEach((l) => { const { _id, ...r } = l; (byEntry[l.entryId] = byEntry[l.entryId] || []).push(r) })
      const out = entries.map(({ _id, ...e }) => ({ ...e, lines: byEntry[e.id] || [] }))
      return cors(NextResponse.json(out))
    }
    if (route === '/transactions' && method === 'POST') {
      const b = await request.json()
      const tenant = await d.collection('tenants').findOne({ id: b.tenantId })
      if (!tenant) return cors(NextResponse.json({ error: 'tenant required' }, { status: 400 }))
      const { map } = buildCOA(tenant.niche)
      let lines = b.lines
      if (!lines || !lines.length) { const amt = b.amount; lines = b.type === 'income' ? incomeLines(b.category, amt) : expenseLines(b.category, amt) }
      try {
        const entry = await postEntry(d, b.tenantId, map, { date: b.date ? new Date(b.date) : new Date(), description: b.description, category: b.category, type: b.type, status: b.status || 'pending', metadata: b.metadata || {}, lines })
        const { _id, ...rest } = entry
        return cors(NextResponse.json(rest))
      } catch (err) { return cors(NextResponse.json({ error: err.message }, { status: 400 })) }
    }
    if (route === '/transactions/status' && method === 'PATCH') {
      const b = await request.json()
      await d.collection('journal_entries').updateOne({ id: b.id }, { $set: { status: b.status } })
      return cors(NextResponse.json({ ok: true }))
    }
    if (route === '/transactions/classify' && method === 'PATCH') {
      const b = await request.json()
      const set = { 'metadata.classification': b.classification, status: 'reconciled' }
      if (b.classification === 'personal') set.category = 'Personal (Non-deductible)'
      await d.collection('journal_entries').updateOne({ id: b.id }, { $set: set })
      return cors(NextResponse.json({ ok: true }))
    }
    if (route === '/dashboard' && method === 'GET') {
      const data = await computeDashboard(d, q('tenantId'))
      if (!data) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
      return cors(NextResponse.json(data))
    }
    if (route === '/reports' && method === 'GET') {
      const r = await computeReports(d, q('tenantId'))
      return cors(NextResponse.json(r))
    }
    if (route === '/reports/csv' && method === 'GET') {
      const tenantId = q('tenantId')
      const entries = await d.collection('journal_entries').find({ tenantId }).sort({ date: -1 }).toArray()
      const header = 'Date,Description,Category,Type,Status,Amount(USD)\n'
      const body = entries.map((e) => { const dt = new Date(e.date).toISOString().slice(0, 10); const desc = `"${(e.description || '').replace(/"/g, '""')}"`; return `${dt},${desc},${e.category},${e.type},${e.status},${(e.amount / 100).toFixed(2)}` }).join('\n')
      return cors(new NextResponse(header + body, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="profitpulse-export.csv"' } }))
    }
    if (route === '/invoices' && method === 'GET') {
      const invoices = await d.collection('invoices').find({ tenantId: q('tenantId') }).sort({ createdAt: -1 }).toArray()
      return cors(NextResponse.json(clean(invoices)))
    }
    if (route === '/invoices' && method === 'POST') {
      const b = await request.json()
      const lines = (b.lines || []).map((l) => ({ description: l.description, quantity: Number(l.quantity) || 1, unitAmount: Number(l.unitAmount) || 0, amount: (Number(l.quantity) || 1) * (Number(l.unitAmount) || 0) }))
      const total = lines.reduce((s, l) => s + l.amount, 0)
      const count = await d.collection('invoices').countDocuments({ tenantId: b.tenantId })
      const inv = { id: uuidv4(), tenantId: b.tenantId, number: `INV-${String(count + 1).padStart(4, '0')}`, kind: b.kind || 'itemized', clientName: b.clientName || 'Client', currency: 'usd', lines, total, status: 'open', paidAmount: 0, createdAt: new Date() }
      await d.collection('invoices').insertOne(inv)
      const { _id, ...rest } = inv
      return cors(NextResponse.json(rest))
    }
    if (route === '/payments/providers' && method === 'GET') {
      return cors(NextResponse.json({ providers: [{ id: 'stripe', name: 'Stripe (Emergent managed sandbox)', configured: stripe.isConfigured() }] }))
    }
    if (route === '/payments/checkout' && method === 'POST') {
      const b = await request.json()
      const inv = await d.collection('invoices').findOne({ id: b.invoiceId, status: 'open' })
      if (!inv) return cors(NextResponse.json({ error: 'Invoice not payable' }, { status: 404 }))
      if (!stripe.isConfigured()) return cors(NextResponse.json({ error: 'Payments are not configured.', code: 'NO_STRIPE' }, { status: 400 }))
      try {
        const txId = uuidv4()
        const checkout = await stripe.createCheckout(
          { ...inv, id: inv.id },
          { base: process.env.NEXT_PUBLIC_BASE_URL, metadata: { invoiceId: inv.id, tenantId: inv.tenantId, txId } }
        )
        // Immutable payment_transactions audit record (Emergent-managed Stripe)
        await d.collection('payment_transactions').insertOne({
          id: txId, provider: 'stripe', tenantId: inv.tenantId, invoiceId: inv.id,
          sessionId: checkout.sessionId, amount: inv.total, currency: inv.currency || 'usd',
          status: 'open', paymentStatus: 'unpaid', metadata: { invoiceNumber: inv.number },
          createdAt: new Date(), updatedAt: new Date(),
        })
        await d.collection('invoices').updateOne({ id: inv.id }, { $set: { stripeSessionId: checkout.sessionId, checkoutProvider: 'stripe' } })
        return cors(NextResponse.json({ url: checkout.url, sessionId: checkout.sessionId, txId }))
      } catch (err) { return cors(NextResponse.json({ error: err.message }, { status: 400 })) }
    }
    // Polling-based fulfillment: proxy holds real Stripe keys, so status is authoritative.
    if (route === '/payments/status' && method === 'GET') {
      const sessionId = q('session_id')
      if (!sessionId) return cors(NextResponse.json({ error: 'session_id required' }, { status: 400 }))
      const tx = await d.collection('payment_transactions').findOne({ sessionId })
      if (!tx) return cors(NextResponse.json({ error: 'Payment not found' }, { status: 404 }))
      let live
      try { live = await stripe.getStatus(sessionId) } catch (err) {
        console.error('Stripe getStatus error:', err.message, err)
        return cors(NextResponse.json({ status: tx.status, paymentStatus: tx.paymentStatus, invoiceId: tx.invoiceId, tenantId: tx.tenantId }))
      }
      if (live.paymentStatus === 'paid') {
        // Guarded transition — only the first observer posts the ledger entry.
        const claim = await d.collection('payment_transactions').updateOne(
          { sessionId, status: { $ne: 'paid' } },
          { $set: { status: 'paid', paymentStatus: 'paid', paidAt: new Date(), updatedAt: new Date() } }
        )
        if (claim.modifiedCount === 1) {
          const inv = await d.collection('invoices').findOne({ id: tx.invoiceId })
          await d.collection('invoices').updateOne({ id: tx.invoiceId }, { $set: { status: 'paid', paymentStatus: 'succeeded' }, $inc: { paidAmount: live.amountTotal } })
          const tenant = await d.collection('tenants').findOne({ id: tx.tenantId })
          if (tenant) {
            const { map } = buildCOA(tenant.niche)
            const revAcct = map['Product Sales'] ? 'Product Sales' : (map['Client Services'] ? 'Client Services' : (map['Subscription Revenue'] ? 'Subscription Revenue' : 'Job Revenue'))
            await postEntry(d, tx.tenantId, map, { date: new Date(), description: `Payment received — ${inv?.number || tx.invoiceId}`, category: revAcct, type: 'income', status: 'reconciled', metadata: { invoiceId: tx.invoiceId, provider: 'stripe', sessionId } , lines: incomeLines(revAcct, live.amountTotal) })
          }
        }
        return cors(NextResponse.json({ status: 'paid', paymentStatus: 'paid', invoiceId: tx.invoiceId, tenantId: tx.tenantId, amount: live.amountTotal }))
      }
      if (live.status === 'expired') {
        await d.collection('payment_transactions').updateOne({ sessionId, status: { $ne: 'paid' } }, { $set: { status: 'expired', updatedAt: new Date() } })
      }
      return cors(NextResponse.json({ status: live.status, paymentStatus: live.paymentStatus, invoiceId: tx.invoiceId, tenantId: tx.tenantId }))
    }

    return cors(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error)
    return cors(NextResponse.json({ error: 'Internal server error', detail: String(error?.message || error) }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
