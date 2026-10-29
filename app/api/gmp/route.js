import { parseGmpTable } from '../../../lib/gmp.js';

export const maxDuration = 20;
export const dynamic = 'force-dynamic';

const SOURCES = [
  { name: 'IPO Watch', url: 'https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/' },
  { name: 'IPOtick', url: 'https://ipotick.in/gmp' },
];

async function readSource(source, company) {
  try {
    const response = await fetch(source.url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IPOVerdictResearch/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return { source: source.name, url: source.url, error: `Source returned HTTP ${response.status}.` };
    const html = await response.text();
    const row = parseGmpTable(html, company);
    if (!row) return { source: source.name, url: source.url, error: 'No matching IPO row was available in the public GMP table.' };
    if (row.gmp === null) return { source: source.name, url: source.url, company: row.company, error: 'The source did not publish a numeric GMP quote for this IPO.' };
    return { source: source.name, url: source.url, company: row.company, gmp: row.gmp };
  } catch (error) {
    const timedOut = error && error.name === 'TimeoutError';
    return { source: source.name, url: source.url, error: timedOut ? 'The source timed out.' : 'The source could not be accessed from the app server.' };
  }
}

export async function POST(request) {
  let name = '';
  try {
    const body = await request.json();
    name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  } catch {}
  if (name.length < 2) return Response.json({ error: 'Enter an IPO name.' }, { status: 400 });

  const retrievedAt = new Date().toISOString();
  const sources = await Promise.all(SOURCES.map((source) => readSource(source, name)));
  const quotes = sources.filter((source) => Number.isFinite(source.gmp));
  const agrees = quotes.length > 1 && quotes.every((quote) => quote.gmp === quotes[0].gmp);
  return Response.json({ name, retrievedAt, sources, quotes, agrees }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
