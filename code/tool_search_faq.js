// AI Agent tool: search_faq   (input variable: query)
// The FAQ is small (9 sections), so a keyword + alias scorer over its sections is enough,
// and returning whole sections keeps the agent grounded in the exact policy wording.
const faq = $('Load Data').first().json.faq;
const q = String(query || '').toLowerCase();

const parts = faq.split(/\n(?=## )/);
const intro = parts[0].split('\n').filter((l) => /ship|india|d2c/i.test(l)).join('\n');
const sections = parts.slice(1).map((t) => {
  const title = t.split('\n')[0].replace(/^##\s*/, '').trim();
  return { title, num: parseInt(title, 10), text: t.replace(/\n---\s*$/, '').trim() };
});

const ALIASES = {
  1: ['ship', 'deliver', 'dispatch', 'courier', 'tracking', 'days', 'how long', 'metro', 'north-east', 'north east', 'guwahati', 'assam', 'address', 'abroad', 'international'],
  2: ['cod', 'cash on delivery', 'cash'],
  3: ['cancel'],
  4: ['return', 'send back', 'unopened', 'sealed', 'seal', 'change of mind', 'changed my mind', 'pickup', 'kit', 'combo'],
  5: ['damaged', 'damage', 'broken', 'cracked', 'leak', 'wrong item', 'missing', 'photo', 'replacement'],
  6: ['refund', 'money back', 'upi', 'bank', 'otp'],
  7: ['serum', 'oil', 'ubtan', 'toner', 'lotion', 'gel', 'kit', 'vegan', 'oily', 'dry skin', 'skin type', 'ingredient', 'price', 'shelf life', 'paraben', 'cruelty', 'product'],
  8: ['eczema', 'psoriasis', 'acne', 'allerg', 'pregnan', 'doctor', 'dermatologist', 'patch test', 'reaction', 'cure', 'treat', 'medical', 'safe'],
  9: ['contact', 'hours', 'partnership', 'influencer', 'collab', 'wholesale', 'press', 'email address'],
};
const STOP = new Set(['what', 'when', 'where', 'which', 'with', 'that', 'this', 'your', 'have', 'from', 'about', 'policy', 'does', 'will', 'there', 'they', 'their', 'into', 'order']);
const words = q.split(/[^a-z0-9-]+/).filter((w) => w.length > 3 && !STOP.has(w));

const scored = sections.map((sec) => {
  let score = 0;
  for (const a of (ALIASES[sec.num] || [])) if (q.includes(a)) score += 3;
  const low = sec.text.toLowerCase();
  for (const w of words) if (low.includes(w)) score += 1;
  return { ...sec, score };
}).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

if (!scored.length) {
  return `No FAQ section matches "${query}". Available sections: ${sections.map((x) => x.title).join('; ')}. ` +
    'If the customer question is not covered by the FAQ, do not answer it: start your reply with [NEEDS_HUMAN: not covered by FAQ].';
}
return [intro, ...scored.map((x) => x.text)].filter(Boolean).join('\n\n---\n\n');
