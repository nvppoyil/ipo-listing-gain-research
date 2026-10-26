export const maxDuration = 120;

const httpErr = (m, s) => Object.assign(new Error(m), { status: s });

const TAIL = `Reply with JSON only, no other text, in exactly this shape:
{"ipos":[{"name":"","group":"open or wait or pipe","state":"short text, e.g. Opens 27 Oct","open":"27 Oct","close":"29 Oct","band":"₹313 to ₹330","price":330,"lot":"45 shares (₹14,850)","size":"₹668 crore","list":"3 Nov","gmp":[{"d":"YYYY-MM-DD","v":31}],"sub":{"total":null,"qib":null,"nii":null,"retail":null},"fund":{"g":null,"pe":null,"de":null},"asof":"date and time of the freshest reading","srcs":"sites used","note":"one short line","warn":"one short line if sources disagree or data is old, else empty"}]}
"price" is the upper price band as a number. "g" is yearly profit growth in percent, "pe" is the P/E divided by the peer P/E, "de" is debt-to-equity. Each gmp "d" must be the real date of that reading.`;

function buildPrompt(known, material) {
  const today = new Date().toISOString().slice(0, 10);
  const groups = `(1) IPOs open for bidding now, (2) IPOs opening in the next 10 days, (3) IPOs that closed in the last 10 days and have not listed yet, (4) announced IPOs with no dates yet`;
  if (material) {
    return `Today is ${today}. Below are web search results. Using ONLY these results (never guess, never use memory), extract data on Indian mainboard IPOs: ${groups}. Also fill in these already tracked IPOs when the results mention them: ${known.join(', ')}.
Give the latest grey market premium (GMP) readings with their dates and the live or final subscription numbers (total, QIB, NII, retail). If a reading has no date, use the date of its page, and skip it if that is unknown. Use null when a value is not in the results.

SEARCH RESULTS:
${material}

${TAIL}`;
  }
  return `Today is ${today}. Use web search to find current data on Indian mainboard IPOs (NSE and BSE). Find: ${groups}. Also refresh these already tracked IPOs: ${known.join(', ')}.
For each IPO give the latest grey market premium (GMP) readings with their dates, and live or final subscription numbers (total, QIB, NII, retail) once bidding has started. Never guess. Use null when a value is not found.
${TAIL}`;
}

async function firstWorking(models, call, getText) {
  const log = [];
  let quota = '';
  for (const m of models) {
    let r;
    try {
      r = await call(m);
    } catch {
      throw httpErr('The server could not reach the AI service.', 502);
    }
    const j = await r.json().catch(() => ({}));
    const msg = String((j.error && (j.error.message || j.error)) || '');
    if (r.ok) return getText(j);
    log.push(`${m}=${r.status}`);
    if ([400, 401, 403].includes(r.status) && !/model|decommission|not supported/i.test(msg)) {
      throw httpErr(msg || 'HTTP ' + r.status, r.status);
    }
    if (r.status === 429 && !quota) quota = msg;
  }
  if (quota) throw httpErr(`${quota} | tried: ${log.join(', ')}`, 429);
  throw httpErr(`model: tried ${log.join(', ')}`, 404);
}

const uniq = (a) => a.filter((m, k) => m && a.indexOf(m) === k);
const post = (url, headers, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

// ---- readers and searchers ----
const geminiText = (j) => {
  const cd = (j.candidates || [])[0] || {};
  return {
    txt: ((cd.content || {}).parts || []).map((x) => x.text || '').join(''),
    gs: ((cd.groundingMetadata || {}).groundingChunks || []).length,
  };
};
const openaiText = (j) => {
  const parts = (j.output || []).filter((x) => x.type === 'message').flatMap((x) => x.content || []).filter((c) => c.type === 'output_text');
  const urls = new Set(parts.flatMap((c) => c.annotations || []).filter((a) => a.type === 'url_citation').map((a) => a.url));
  return { txt: parts.map((c) => c.text || '').join(''), gs: urls.size };
};
const groqText = (j) => ({ txt: (((j.choices || [])[0] || {}).message || {}).content || '', gs: 0 });

async function geminiModels(key) {
  const out = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
    const j = await r.json();
    out.push(
      ...(j.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /flash/.test(m.name) && !/image|tts|live|audio|embed|thinking|robotics|computer/.test(m.name))
        .map((m) => m.name.replace('models/', ''))
        .sort()
        .reverse()
        .slice(0, 4)
    );
  } catch {}
  return uniq(out);
}
const askGemini = async (key, prompt, search) =>
  firstWorking(
    await geminiModels(key),
    (m) =>
      post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { 'x-goog-api-key': key }, {
        contents: [{ parts: [{ text: prompt }] }],
        ...(search ? { tools: [{ google_search: {} }] } : { generationConfig: { responseMimeType: 'application/json' } }),
      }),
    geminiText
  );
const askOpenAI = (key, prompt, search) =>
  firstWorking(
    uniq([process.env.OPENAI_MODEL, 'gpt-5-mini', 'gpt-4.1-mini', 'gpt-5']),
    (m) => post('https://api.openai.com/v1/responses', { Authorization: 'Bearer ' + key }, { model: m, input: prompt, ...(search ? { tools: [{ type: 'web_search' }] } : {}) }),
    openaiText
  );
const askGroq = (key, prompt) =>
  firstWorking(
    uniq([process.env.GROQ_MODEL, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant']),
    (m) =>
      post('https://api.groq.com/openai/v1/chat/completions', { Authorization: 'Bearer ' + key }, {
        model: m,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You extract IPO data from search results and reply with JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    groqText
  );

// ---- Tavily search ----
async function tavily(key, q) {
  const r = await post('https://api.tavily.com/search', { Authorization: 'Bearer ' + key }, { query: q, search_depth: 'basic', max_results: 4, time_range: 'week' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = j.detail && (j.detail.error || j.detail);
    throw httpErr('Search service: ' + String(d || 'HTTP ' + r.status), [432, 433].includes(r.status) ? 429 : r.status);
  }
  return j.results || [];
}
async function gather(key, known) {
  const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const queries = [
    `upcoming IPO India this week price band lot size ${month}`,
    'IPO GMP today grey market premium India',
    'IPO subscription status today QIB NII retail India',
    ...known.slice(0, 3).map((n) => `${n} IPO GMP subscription price band`),
  ];
  const res = await Promise.allSettled(queries.map((q) => tavily(key, q)));
  const ok = res.filter((x) => x.status === 'fulfilled').flatMap((x) => x.value);
  if (!ok.length) throw res.find((x) => x.status === 'rejected').reason;
  const seen = new Set();
  const items = ok.filter((x) => x.url && !seen.has(x.url) && seen.add(x.url));
  let material = '';
  items.forEach((x, i) => {
    const t = `[${i + 1}] ${x.title || ''} (${x.url})\n${String(x.content || '').slice(0, 500)}\n\n`;
    if (material.length + t.length < 14000) material += t;
  });
  return { material, n: items.length };
}

// ---- No AI: read NSE's public JSON directly ----
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NSE_H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};
function pd(s) {
  const m = String(s || '').match(/(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*[-\s](\d{4})/);
  if (m) {
    const k = MON.indexOf(m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase());
    if (k >= 0) return Date.UTC(+m[3], k, +m[1]);
  }
  const n = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return n ? Date.UTC(+n[1], +n[2] - 1, +n[3]) : null;
}
const fd = (t) => (t == null ? '' : `${new Date(t).getUTCDate()} ${MON[new Date(t).getUTCMonth()]}`);
async function nseGet(path, cookie) {
  const r = await fetch('https://www.nseindia.com' + path, {
    headers: { ...NSE_H, Cookie: cookie, Referer: 'https://www.nseindia.com/market-data/all-upcoming-issues-ipo' },
  });
  if (!r.ok) throw httpErr(`NSE refused the request (HTTP ${r.status}). NSE often blocks servers. Try again later, or run the app on your own computer.`, 502);
  try {
    return await r.json();
  } catch {
    throw httpErr('NSE did not send data. It may be blocking this request. Try again later.', 502);
  }
}
async function askNSE() {
  let cookie = '';
  try {
    const home = await fetch('https://www.nseindia.com/', { headers: NSE_H });
    cookie = (home.headers.getSetCookie ? home.headers.getSetCookie() : []).map((c) => c.split(';')[0]).join('; ');
  } catch {
    throw httpErr('The server could not reach NSE.', 502);
  }
  const res = await Promise.allSettled([nseGet('/api/ipo-current-issue', cookie), nseGet('/api/all-upcoming-issues?category=ipo', cookie)]);
  if (res.every((x) => x.status === 'rejected')) throw res[0].reason;
  const rows = res.flatMap((x) => (x.status === 'fulfilled' ? (Array.isArray(x.value) ? x.value : x.value.data || []) : []));
  const now = new Date();
  const t0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ipos = [];
  for (const r of rows) {
    const name = r && (r.companyName || r.symbol);
    if (!name || /^(SM|SME)/i.test(String(r.series || ''))) continue;
    const st = pd(r.issueStartDate || r.biddingStartDate), en = pd(r.issueEndDate || r.biddingEndDate);
    let group = 'pipe', state = 'No dates yet';
    if (en != null && en < t0) { group = 'wait'; state = 'Closed ' + fd(en); }
    else if (st != null && st > t0) { group = (st - t0) / 864e5 <= 10 ? 'open' : 'pipe'; state = 'Opens ' + fd(st); }
    else if (st != null) { group = 'open'; state = 'Open, closes ' + fd(en); }
    const nums = String(r.issuePrice || r.priceBand || '').match(/[\d,]+(\.\d+)?/g) || [];
    const price = nums.length ? Number(nums[nums.length - 1].replace(/,/g, '')) : null;
    const band = nums.length > 1 ? `₹${nums[0]} to ₹${nums[nums.length - 1]}` : nums.length ? `₹${nums[0]}` : null;
    const iz = Number(String(r.issueSize || '').replace(/,/g, ''));
    const tot = Number(r.noOfTime);
    ipos.push({
      name: String(name), group, state, open: fd(st) || null, close: fd(en) || null, band, price,
      size: iz > 1e7 ? `₹${Math.round(iz / 1e7).toLocaleString('en-IN')} crore` : null,
      sub: { total: tot > 0 ? tot : null }, asof: now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC', srcs: 'NSE', warn: '',
    });
  }
  if (!ipos.length) throw httpErr('NSE returned no mainboard IPOs right now.', 502);
  return { txt: JSON.stringify({ ipos }), gs: 0, src: 'NSE direct' };
}

export async function POST(req) {
  const env = process.env;
  let known = [];
  try {
    const b = await req.json();
    known = (Array.isArray(b.known) ? b.known : []).filter((x) => typeof x === 'string').slice(0, 40).map((x) => x.slice(0, 60));
  } catch {}
  const direct = env.UPDATE_MODE !== 'ai'; // default: read NSE directly, no AI
  const nokey = () => Response.json({ error: 'nokey' }, { status: 500 });
  try {
    if (direct) return Response.json(await askNSE());
    if (env.TAVILY_API_KEY) {
      if (!(env.GROQ_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY)) return nokey();
      const { material, n } = await gather(env.TAVILY_API_KEY, known);
      const prompt = buildPrompt(known, material);
      const out = env.GROQ_API_KEY
        ? await askGroq(env.GROQ_API_KEY, prompt)
        : env.GEMINI_API_KEY
        ? await askGemini(env.GEMINI_API_KEY, prompt, false)
        : await askOpenAI(env.OPENAI_API_KEY, prompt, false);
      return Response.json({ txt: out.txt, gs: n });
    }
    const prompt = buildPrompt(known);
    if (env.OPENAI_API_KEY) return Response.json(await askOpenAI(env.OPENAI_API_KEY, prompt, true));
    if (env.GEMINI_API_KEY) return Response.json(await askGemini(env.GEMINI_API_KEY, prompt, true));
    return nokey();
  } catch (e) {
    return Response.json({ error: e.message, status: e.status }, { status: 502 });
  }
}
