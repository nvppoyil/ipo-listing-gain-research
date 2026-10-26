export const maxDuration = 60;

function buildPrompt(known) {
  const today = new Date().toISOString().slice(0, 10);
  return `Today is ${today}. Use Google Search to find current data on Indian mainboard IPOs (NSE and BSE). Find: (1) IPOs open for bidding now, (2) IPOs opening in the next 10 days, (3) IPOs that closed in the last 10 days and have not listed yet, (4) announced IPOs with no dates yet. Also refresh these already tracked IPOs: ${known.join(', ')}.
For each IPO give the latest grey market premium (GMP) readings with their dates, and live or final subscription numbers (total, QIB, NII, retail) once bidding has started. Never guess. Use null when a value is not found.
Reply with JSON only, no other text, in exactly this shape:
{"ipos":[{"name":"","group":"open or wait or pipe","state":"short text, e.g. Opens 27 Oct","open":"27 Oct","close":"29 Oct","band":"₹313 to ₹330","price":330,"lot":"45 shares (₹14,850)","size":"₹668 crore","list":"3 Nov","gmp":[{"d":"YYYY-MM-DD","v":31}],"sub":{"total":null,"qib":null,"nii":null,"retail":null},"fund":{"g":null,"pe":null,"de":null},"asof":"date and time of the freshest reading","srcs":"sites used","note":"one short line","warn":"one short line if sources disagree or data is old, else empty"}]}
"price" is the upper price band as a number. "g" is yearly profit growth in percent, "pe" is the P/E divided by the peer P/E, "de" is debt-to-equity. Each gmp "d" must be the real date of that reading.`;
}

async function pickModels(key) {
  const out = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      headers: { 'x-goog-api-key': key },
    });
    const j = await r.json();
    const names = (j.models || [])
      .filter(
        (m) =>
          (m.supportedGenerationMethods || []).includes('generateContent') &&
          /flash/.test(m.name) &&
          !/image|tts|live|audio|embed|thinking|robotics|computer/.test(m.name)
      )
      .map((m) => m.name.replace('models/', ''))
      .sort()
      .reverse();
    out.push(...names.slice(0, 4));
  } catch {}
  return out.filter((m, k, a) => m && a.indexOf(m) === k);
}

export async function POST(req) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'nokey' }, { status: 500 });

  let known = [];
  try {
    const b = await req.json();
    known = (Array.isArray(b.known) ? b.known : [])
      .filter((x) => typeof x === 'string')
      .slice(0, 40)
      .map((x) => x.slice(0, 60));
  } catch {}

  const models = await pickModels(key);
  const log = [];
  let quotaMsg = '';

  for (const m of models) {
    let r;
    try {
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(known) }] }],
            tools: [{ google_search: {} }],
          }),
        }
      );
    } catch {
      return Response.json({ error: 'The server could not reach Google.' }, { status: 502 });
    }
    const j = await r.json().catch(() => ({}));
    const msg = (j.error && j.error.message) || '';
    if (r.ok) {
      const cd = (j.candidates || [])[0] || {};
      return Response.json({
        txt: ((cd.content || {}).parts || []).map((x) => x.text || '').join(''),
        gs: ((cd.groundingMetadata || {}).groundingChunks || []).length,
      });
    }
    log.push(`${m}=${r.status}`);
    if (r.status === 400 || r.status === 401 || r.status === 403) {
      return Response.json({ error: msg || 'HTTP ' + r.status, status: r.status }, { status: 502 });
    }
    if (r.status === 429 && !quotaMsg) quotaMsg = msg;
  }
  if (quotaMsg) {
    return Response.json({ error: `${quotaMsg} | tried: ${log.join(', ')}`, status: 429 }, { status: 502 });
  }
  return Response.json({ error: `model: tried ${log.join(', ')}`, status: 404 }, { status: 502 });
}
