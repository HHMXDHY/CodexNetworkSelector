const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const NODE_TYPES = new Set(['Vmess', 'Trojan', 'Shadowsocks', 'Hysteria2', 'AnyTLS', 'VLESS', 'TUIC', 'WireGuard', 'Snell', 'Socks5', 'Http']);

function request(endpoint, method, requestPath, body = null, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const options = endpoint.socketPath
      ? { socketPath: endpoint.socketPath, path: requestPath, method }
      : { host: endpoint.host, port: endpoint.port, path: requestPath, method };
    options.headers = { 'Content-Type': 'application/json' };
    if (endpoint.secret) options.headers.Authorization = `Bearer ${endpoint.secret}`;
    if (data) options.headers['Content-Length'] = data.length;
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`Clash API ${res.statusCode}: ${text.slice(0, 180)}`));
        try { resolve(text ? JSON.parse(text) : {}); } catch { resolve({}); }
      });
    });
    req.setTimeout(timeout, () => req.destroy(new Error('Clash API timeout')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function windowsPipes() {
  if (process.platform !== 'win32') return [];
  try {
    return fs.readdirSync('\\\\.\\pipe\\')
      .filter((name) => name.startsWith('verge-mihomo-') || name.startsWith('mihomo'))
      .map((name) => ({ label: `Clash Verge · ${name}`, socketPath: `\\\\.\\pipe\\${name}` }));
  } catch { return []; }
}

function unixSockets() {
  if (process.platform === 'win32') return [];
  const home = process.env.HOME || '';
  const candidates = [
    '/tmp/verge-mihomo.sock', '/tmp/mihomo.sock',
    path.join(home, '.config', 'clash-verge', 'mihomo.sock'),
    path.join(home, 'Library', 'Application Support', 'io.github.clash-verge-rev.clash-verge-rev', 'mihomo.sock'),
  ];
  return candidates.filter((p) => { try { return fs.statSync(p).isSocket(); } catch { return false; } })
    .map((socketPath) => ({ label: `Mihomo Socket · ${socketPath}`, socketPath }));
}

async function discover(secret = '') {
  const candidates = [
    ...windowsPipes(), ...unixSockets(),
    { label: '本地控制器 127.0.0.1:9090', host: '127.0.0.1', port: 9090, secret },
    { label: '本地控制器 127.0.0.1:9097', host: '127.0.0.1', port: 9097, secret },
  ];
  for (const endpoint of candidates) {
    try {
      const version = await request(endpoint, 'GET', '/version', null, 1200);
      return { ...endpoint, version };
    } catch { /* try next */ }
  }
  throw new Error('没有发现可用的 Clash/Mihomo 控制端。请先启动 Clash，并允许外部控制。');
}

async function getInventory(endpoint, groupName) {
  const proxies = (await request(endpoint, 'GET', '/proxies')).proxies || {};
  const group = proxies[groupName];
  if (!group || !Array.isArray(group.all)) throw new Error(`没有找到代理组“${groupName}”`);
  const nodes = group.all.filter((name) => NODE_TYPES.has(proxies[name]?.type));
  return { proxies, group, nodes };
}

async function delay(endpoint, node, url, timeoutMs) {
  const route = `/proxies/${encodeURIComponent(node)}/delay?timeout=${timeoutMs}&url=${encodeURIComponent(url)}`;
  try {
    const result = await request(endpoint, 'GET', route, null, timeoutMs + 1500);
    return Number(result.delay) > 0 ? Number(result.delay) : 99999;
  } catch { return 99999; }
}

async function select(endpoint, groupName, node) {
  return request(endpoint, 'PUT', `/proxies/${encodeURIComponent(groupName)}`, { name: node });
}

async function getConfig(endpoint) { return request(endpoint, 'GET', '/configs'); }

module.exports = { discover, getInventory, delay, select, getConfig, NODE_TYPES };
