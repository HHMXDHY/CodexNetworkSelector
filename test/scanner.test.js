const test = require('node:test');
const assert = require('node:assert/strict');
const { metrics, allowed } = require('../src/scanner');

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
