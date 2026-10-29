import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/gmp/route.js';
import { parseGmpTable } from '../lib/gmp.js';

test('GMP parser returns the requested IPO quote and accepts a real zero', () => {
  const html = '<table><tr><th>Company</th><th>GMP*</th><th>Trend</th></tr><tr><td>BLS Polymers Ltd.</td><td>₹51</td><td>Up</td></tr><tr><td>Example Ltd</td><td>₹0</td><td>Flat</td></tr></table>';
  assert.deepEqual(parseGmpTable(html, 'BLS Polymers'), { company: 'BLS Polymers Ltd.', gmp: 51 });
  assert.deepEqual(parseGmpTable(html, 'Example'), { company: 'Example Ltd', gmp: 0 });
  assert.equal(parseGmpTable(html, 'Missing IPO'), null);
});

test('GMP endpoint returns source links and marks disagreeing quotes without averaging', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => new Response(
    url.includes('ipowatch.in')
      ? '<table><tr><th>Company</th><th>GMP</th></tr><tr><td>BLS Polymers</td><td>₹51</td></tr></table>'
      : '<table><tr><th>Company</th><th>GMP</th></tr><tr><td>BLS Polymers Ltd.</td><td>₹44</td></tr></table>',
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
  const response = await POST(new Request('http://localhost/api/gmp', { method: 'POST', body: JSON.stringify({ name: 'BLS Polymers' }) }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(payload.quotes.length, 2);
  assert.equal(payload.agrees, false);
  assert.deepEqual(payload.quotes.map((quote) => quote.gmp), [51, 44]);
  assert.equal(payload.average, undefined);
  assert.ok(payload.sources.every((source) => source.url));
});

test('GMP endpoint validates that a company name was supplied', async () => {
  const response = await POST(new Request('http://localhost/api/gmp', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /IPO name/i);
});
