const $ = (id) => document.getElementById(id);
let settings;
const fields = ['groupName', 'rounds', 'timeoutMs', 'parallelism', 'maximumP90Ms', 'secret'];

function num(value) { return value == null || value >= 99999 ? '—' : `${Math.round(value)} ms`; }
function render(state) {
  const rows = state.rows || [];
  const pct = state.total ? Math.round((state.completed || 0) / state.total * 100) : 0;
  $('fill').style.width = `${pct}%`; $('progress').textContent = `${state.completed || 0} / ${state.total || 0} · ${pct}%`;
  $('phase').textContent = state.message || ({ probing: '稳定性检测中', verifying: '真实传输验收中', complete: '检测完成' }[state.phase] || '准备中');
  $('endpoint').textContent = state.endpoint || $('endpoint').textContent; $('pool').textContent = state.candidates ?? rows.length;
  $('eligible').textContent = rows.filter((r) => r.eligible).length; $('eta').textContent = state.phase === 'complete' ? '已完成' : state.etaSeconds ? `${state.etaSeconds} 秒` : '计算中';
  if (state.reason) $('decision').textContent = state.reason;
  $('rows').replaceChildren(...rows.map((r, i) => {
    const tr = document.createElement('tr');
    const finished = r.completed >= r.expected || state.phase === 'complete' || state.phase === 'verifying';
    const status = finished ? (r.eligible ? ['合格', 'good'] : ['淘汰', 'bad']) : ['测试中', 'testing'];
    const values = [`${i + 1}|${r.node}`, status, `${r.apiSuccess || 0}/${settings.rounds}`, num(r.apiP90Ms), `${r.wsSuccess || 0}/${settings.rounds}`, num(r.wsP90Ms), num(r.jitterMs), r.score == null ? '—' : Math.round(r.score)];
    values.forEach((value, col) => { const td = document.createElement('td'); if (col === 0) { td.className = 'node'; const [rank, name] = value.split('|'); const span = document.createElement('span'); span.className = 'rank'; span.textContent = rank; td.append(span, document.createTextNode(name)); } else if (col === 1) { const span = document.createElement('span'); span.className = `badge ${value[1]}`; span.textContent = value[0]; td.append(span); } else td.textContent = value; tr.append(td); });
    return tr;
  }));
}

async function init() {
  $('version').textContent = `v${await window.codexNet.version()}`; settings = await window.codexNet.getSettings();
  window.codexNet.onUpdate(render);
  $('settingsBtn').onclick = () => { fields.forEach((f) => $(f).value = settings[f]); $('autoSwitch').checked = settings.autoSwitch; $('settings').showModal(); };
  $('saveBtn').onclick = async (event) => { event.preventDefault(); const next = { ...settings }; fields.forEach((f) => next[f] = ['groupName', 'secret'].includes(f) ? $(f).value : Number($(f).value)); next.autoSwitch = $('autoSwitch').checked; settings = await window.codexNet.saveSettings(next); $('settings').close(); };
  $('runBtn').onclick = async () => { $('runBtn').disabled = true; $('decision').className = 'decision'; $('decision').textContent = '正在自动发现 Clash/Mihomo……'; try { const result = await window.codexNet.start(settings); render(result); } catch (error) { $('decision').textContent = error.message || String(error); $('decision').className = 'decision error'; } finally { $('runBtn').disabled = false; } };
}
init();
