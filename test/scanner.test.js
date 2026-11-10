const test = require('node:test');
const assert = require('node:assert/strict');
const { metrics, allowed } = require('../src/scanner');
const { expandCandidates, currentSelection, selectorStates } = require('../src/clash-client');

test('metrics penalize lost long connections', () => {
  const value = metrics([100, 120, 99999, 130], 4);
  assert.equal(value.successRate, 0.75);
  assert.equal(value.p90Ms, 130);
});

test('unsupported and metadata nodes are excluded', () => {
  assert.equal(allowed('香港HK-HY2'), false);
  assert.equal(allowed('俄罗斯RU-A'), false);
  assert.equal(allowed('剩余流量：100 GB'), false);
  assert.equal(allowed('日本JP-HY2'), true);
});

test('nested selector nodes are expanded, deduplicated, and keep a selectable route', () => {
  const proxies = {
    ChatGPT: { type: 'Selector', now: '节点选择', all: ['Direct-GPT', '节点选择'] },
    '节点选择': { type: 'Selector', now: '日本JP-HY2', all: ['Direct-GPT', '日本JP-HY2'] },
    'Direct-GPT': { type: 'Vmess' },
    '日本JP-HY2': { type: 'Hysteria2' },
  };
  const candidates = expandCandidates(proxies, 'ChatGPT');
  assert.deepEqual(candidates.map((item) => item.node), ['Direct-GPT', '日本JP-HY2']);
  assert.deepEqual(candidates[0].route, [{ group: 'ChatGPT', selected: 'Direct-GPT' }]);
  assert.deepEqual(candidates[1].route, [
    { group: 'ChatGPT', selected: '节点选择' },
    { group: '节点选择', selected: '日本JP-HY2' },
  ]);
  assert.equal(currentSelection(proxies, 'ChatGPT'), '日本JP-HY2');
  assert.deepEqual(selectorStates(proxies, candidates), { ChatGPT: '节点选择', '节点选择': '日本JP-HY2' });
});
