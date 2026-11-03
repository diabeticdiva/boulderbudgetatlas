// Server side of the Ask tab. Runs on Netlify; holds the Claude API key so visitors never need one.
import { ATLAS, NOTES } from '../lib/knowledge.mjs';


const MODEL = process.env.ATLAS_MODEL || 'claude-sonnet-5-5';
const MAX_TURNS = 12;          // most recent messages kept
const MAX_CHARS = 2000;        // per visitor message
const LIMIT = 20;              // questions per visitor...
const WINDOW_MS = 10 * 60e3;   // ...per 10 minutes (best effort, per server instance)
const hits = new Map();

const RULES = `You are the assistant inside Boulder Budget Atlas, a public website that maps where homelessness-related budgets in Boulder and Boulder County cannibalize each other or duplicate spending. Visitors are residents, journalists, advocates and staff of the organizations listed.

How to answer:
- Use only the ATLAS data and SOURCE NOTES below. If they don't cover a question, say what's missing instead of guessing, and suggest where the answer would likely be found (a budget book, a meeting record).
- Dollar figures are real. Whenever you cite one, give its year and basis (for example, "2027 recommended" or "FY2024 Form 990") and name the source. Never add up figures from different years or documents. If a line has no published figure, say so instead of estimating.
- Never present an issue marked "potential" or "reported" as established fact. Describe it as a pattern to verify.
- Be even-handed. Issues are coordination problems, not accusations. When asked about oversight or corruption, name the responsible bodies and the documented concerns in the data, and say plainly when no documented concern exists. Never allege corruption, misconduct or waste beyond what a cited record documents, and never treat board overlaps as evidence of wrongdoing.
- Be plain, specific and brief: under 200 words unless asked for more. Short paragraphs or simple "- " bullets. No headings.
- Stay on Boulder-area budgets, homelessness, housing, mental health, treatment and justice. Politely decline unrelated requests.`;

const SYSTEM = [
  { type: 'text', text: RULES },
  { type: 'text', text: 'ATLAS DATA (JSON):\n' + JSON.stringify(ATLAS) + '\n\nSOURCE NOTES:\n' + NOTES, cache_control: { type: 'ephemeral' } }
];

const json = (status, body) => ({ statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > LIMIT;
}

function clean(messages) {
  if (!Array.isArray(messages)) return null;
  const out = [];
  for (const m of messages.slice(-MAX_TURNS)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null;
    const text = m.content.trim().slice(0, m.role === 'user' ? MAX_CHARS : 6000);
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + text; else out.push({ role: m.role, content: text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { code: 'method' });
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { code: 'not_configured' });
  const hdr = event.headers || {};
  const ip = hdr['x-nf-client-connection-ip'] || hdr['client-ip'] || 'unknown';
  if (limited(ip)) return json(429, { code: 'busy' });

  let body;
  try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '')); } catch { return json(400, { code: 'bad_request' }); }
  const raw = Array.isArray(body?.messages) ? body.messages : null;
  if (raw && raw.some(m => m && m.role === 'user' && typeof m.content === 'string' && m.content.length > MAX_CHARS * 1.5)) return json(400, { code: 'too_long' });
  const messages = clean(raw);
  if (!messages) return json(400, { code: 'bad_request' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system: SYSTEM, messages })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('Claude API error', r.status, JSON.stringify(data).slice(0, 500));
      return json(r.status === 429 || r.status === 529 ? 429 : 502, { code: r.status === 429 || r.status === 529 ? 'busy' : 'upstream_error' });
    }
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!text) return json(502, { code: 'upstream_error' });
    return json(200, { text });
  } catch (e) {
    console.error('Ask failed', e);
    return json(502, { code: 'upstream_error' });
  }
};
