const { request: httpRequest, ProxyAgent } = require('undici');
const { getInventory, delay, select, getConfig, currentSelection, selectorStates } = require('./clash-client');

const UNSUPPORTED = ['香港', 'HK-', 'HKT-', '俄罗斯', 'RU-'];
const META = ['剩余流量', '套餐到期', '官网', '更新订阅'];

function percentile(values, p) {
  if (!values.length) return 99999;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
}

function metrics(samples, expected) {
  const good = samples.filter((v) => v > 0 && v < 99999);
  if (!good.length) return { successRate: 0, medianMs: 99999, p90Ms: 99999, jitterMs: 99999 };
  const mean = good.reduce((a, b) => a + b, 0) / good.length;
  const variance = good.reduce((sum, v) => sum + ((v - mean) ** 2), 0) / good.length;
  return { successRate: good.length / expected, medianMs: Math.round(percentile(good, .5)), p90Ms: Math.round(percentile(good, .9)), jitterMs: Math.round(Math.sqrt(variance)) };
}

function allowed(name) { return !UNSUPPORTED.some((x) => name.includes(x)) && !META.some((x) => name.includes(x)); }

async function mapLimit(items, limit, fn) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; await fn(items[index], index); }
  });
  await Promise.all(workers);
}

async function actualProbe(url, dispatcher, websocket, timeoutMs) {
  try {
    const headers = websocket ? {
      Connection: 'Upgrade', Upgrade: 'websocket',
      'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
    } : {};
    const result = await httpRequest(url, { dispatcher, headers, headersTimeout: timeoutMs, bodyTimeout: timeoutMs, maxRedirections: 0 });
    await result.body.dump();
    return result.statusCode !== 403 && result.statusCode !== 429;
  } catch { return false; }
}

async function applyRoute(endpoint, route) {
  for (const step of [...route].reverse()) await select(endpoint, step.group, step.selected);
}

async function restoreSelectors(endpoint, states) {
  for (const [group, selected] of Object.entries(states).reverse()) await select(endpoint, group, selected);
}

async function verifyCandidate(endpoint, settings, candidate) {
  await applyRoute(endpoint, candidate.route);
  await new Promise((resolve) => setTimeout(resolve, 700));
  const config = await getConfig(endpoint);
  const port = Number(config['mixed-port'] || config.port || settings.proxyPort || 7897);
  const dispatcher = new ProxyAgent(`http://127.0.0.1:${port}`);
  try {
    for (let i = 0; i < settings.verificationRounds; i++) {
      const [api, ws] = await Promise.all([
        actualProbe(settings.apiUrl, dispatcher, false, settings.actualTimeoutMs),
        actualProbe(settings.wsUrl, dispatcher, true, settings.actualTimeoutMs),
      ]);
      if (!api || !ws) return false;
    }
    return true;
  } finally { await dispatcher.close(); }
}

async function scan(endpoint, settings, onUpdate = () => {}) {
  const inventory = await getInventory(endpoint, settings.groupName);
  const excluded = inventory.candidates.filter((candidate) => !allowed(candidate.node)).map((candidate) => candidate.node);
  const candidates = inventory.candidates.filter((candidate) => allowed(candidate.node));
  const rows = Object.fromEntries(candidates.map(({ node }) => [node, { node, api: [], websocket: [], completed: 0, expected: settings.rounds * 2 }]));
  const jobs = [];
  for (const { node } of candidates) for (const [kind, url] of [['api', settings.apiUrl], ['websocket', settings.wsUrl]]) for (let i = 0; i < settings.rounds; i++) jobs.push({ node, kind, url });
  let completed = 0;
  const started = Date.now();
  onUpdate({ phase: 'probing', candidates: candidates.length, excluded, completed, total: jobs.length, rows: Object.values(rows) });
  await mapLimit(jobs, settings.parallelism, async (job) => {
    const value = await delay(endpoint, job.node, job.url, settings.timeoutMs);
    const row = rows[job.node]; row[job.kind].push(value); row.completed++; completed++;
    const elapsed = Date.now() - started;
    onUpdate({ phase: 'probing', candidates: candidates.length, excluded, completed, total: jobs.length, etaSeconds: completed ? Math.ceil((elapsed / completed * (jobs.length - completed)) / 1000) : 0, rows: Object.values(rows) });
  });
  const reports = Object.values(rows).map((row) => {
    const api = metrics(row.api, settings.rounds), websocket = metrics(row.websocket, settings.rounds);
    const eligible = Math.min(api.successRate, websocket.successRate) >= settings.minimumSuccessRate && api.p90Ms <= settings.maximumP90Ms && websocket.p90Ms <= settings.maximumP90Ms;
    const score = Math.round((2 - api.successRate - websocket.successRate) * 100000 + api.p90Ms + websocket.p90Ms * 1.5 + (api.jitterMs + websocket.jitterMs) * 2);
    return { ...row, api: undefined, websocket: undefined, apiSuccess: Math.round(api.successRate * settings.rounds), wsSuccess: Math.round(websocket.successRate * settings.rounds), apiMedianMs: api.medianMs, apiP90Ms: api.p90Ms, wsMedianMs: websocket.medianMs, wsP90Ms: websocket.p90Ms, jitterMs: api.jitterMs + websocket.jitterMs, eligible, score };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.score - b.score);
  const eligible = reports.filter((r) => r.eligible);
  const best = eligible[0];
  const previous = currentSelection(inventory.proxies, settings.groupName);
  const originalStates = selectorStates(inventory.proxies, inventory.candidates);
  let selected = previous, decision = 'keep', reason = best ? '当前节点已是最佳节点。' : '没有节点通过稳定门槛，保持当前节点。';
  if (best && best.node !== previous && settings.autoSwitch) {
    for (const report of eligible) {
      const candidate = candidates.find((item) => item.node === report.node);
      onUpdate({ phase: 'verifying', message: `真实验收 ${candidate.node}`, completed: jobs.length, total: jobs.length, candidates: candidates.length, excluded, rows: reports });
      if (await verifyCandidate(endpoint, settings, candidate)) {
        selected = candidate.node; decision = 'switch'; reason = '候选节点通过 API 与 WebSocket 真实验收，已完成切换。';
        break;
      }
    }
    if (decision !== 'switch') {
      await restoreSelectors(endpoint, originalStates);
      reason = '候选节点未通过真实传输验收，已恢复原节点。';
    }
  }
  const result = { phase: 'complete', completed: jobs.length, total: jobs.length, candidates: candidates.length, excluded, rows: reports, previous, selected, decision, reason, generatedAt: new Date().toISOString() };
  onUpdate(result); return result;
}

module.exports = { scan, metrics, allowed, applyRoute, restoreSelectors };
