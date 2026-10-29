import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/update/route.js';

test('direct refresh returns validated, timestamped structured NSE data without caching', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalMode = process.env.UPDATE_MODE;
  delete process.env.UPDATE_MODE;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalMode === undefined) delete process.env.UPDATE_MODE;
    else process.env.UPDATE_MODE = originalMode;
  });
  globalThis.fetch = async (url) => {
    if (url === 'https://www.nseindia.com/') return new Response('', { status: 200 });
    if (url.endsWith('/api/ipo-current-issue')) return Response.json([{
      companyName: 'Example Limited', series: 'EQ', issueStartDate: '27-Oct-2026',
      issueEndDate: '29-Oct-2026', issuePrice: '₹142 - ₹150', issueSize: '2550000000', noOfTime: '2.5',
    }]);
    if (url.includes('/api/all-upcoming-issues')) return Response.json([]);
    throw new Error(`Unexpected request ${url}`);
  };
  const response = await POST(new Request('http://localhost/api/update', { method: 'POST', body: '{}' }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(payload.src, 'NSE');
  assert.ok(Number.isFinite(Date.parse(payload.asof)));
  assert.equal(payload.ipos[0].name, 'Example Limited');
  assert.equal(payload.ipos[0].price, 150);
  assert.equal(payload.ipos[0].sub.total, 2.5);
  assert.equal(payload.ipos[0].gmp, undefined);
  assert.match(payload.ipos[0].warn, /unavailable/i);
  assert.equal(payload.txt, undefined);
});

test('refresh returns a clear HTTP error when source data is unavailable', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalMode = process.env.UPDATE_MODE;
  delete process.env.UPDATE_MODE;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalMode === undefined) delete process.env.UPDATE_MODE;
    else process.env.UPDATE_MODE = originalMode;
  });
  globalThis.fetch = async (url) => {
    if (url === 'https://www.nseindia.com/') return new Response('', { status: 200 });
    return new Response('blocked', { status: 403 });
  };
  const response = await POST(new Request('http://localhost/api/update', { method: 'POST', body: '{}' }));
  const payload = await response.json();
  assert.equal(response.status, 502);
  assert.match(payload.error, /NSE refused/i);
});
