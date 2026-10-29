const strip = (value) => String(value || '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&(?:#x([\da-f]+)|#(\d+));/gi, (_, hex, dec) => String.fromCodePoint(parseInt(hex || dec, hex ? 16 : 10)))
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ').trim();

const normalize = (value) => strip(value).toLowerCase().replace(/\b(limited|ltd|ipo)\b/g, '').replace(/[^a-z0-9]/g, '');

function money(value) {
  const text = strip(value).replace(/,/g, '').replace(/₹|rs\.?/gi, '').replace(/\s/g, '');
  if (!text || /^(?:-|—|n\/?a|not available)$/i.test(text)) return null;
  const match = text.match(/^-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function parseGmpTable(html, companyName) {
  const wanted = normalize(companyName);
  if (wanted.length < 3) return null;
  const tables = String(html || '').match(/<table\b[\s\S]*?<\/table>/gi) || [];
  for (const table of tables) {
    const rows = table.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    let gmpCol = -1;
    for (const row of rows) {
      const cells = [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => strip(m[1]));
      if (!cells.length) continue;
      const headerCol = cells.findIndex((cell) => /\bgmp\b|grey market premium/i.test(cell));
      if (headerCol >= 0) { gmpCol = headerCol; continue; }
      if (gmpCol < 0) continue;
      const companyCol = cells.findIndex((cell) => {
        const rowName = normalize(cell);
        return rowName && (rowName === wanted || (rowName.length >= 5 && wanted.length >= 5 && (rowName.includes(wanted) || wanted.includes(rowName))));
      });
      if (companyCol < 0 || gmpCol >= cells.length) continue;
      return { company: cells[companyCol], gmp: money(cells[gmpCol]) };
    }
  }
  return null;
}

export { normalize };
