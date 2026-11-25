// Node: Check Reply Guardrails
// Post-checks the agent's draft in code. Anything suspicious -> needs_human (draft is never auto-sent).
const s = $('Apply Business Rules').first().json;
const out = $input.first().json;
const { orders, faq } = $('Load Data').first().json;
const AGENT_SYSTEM_CHARS = __AGENT_SYSTEM_CHARS__;

let reply = typeof out.output === 'string' ? out.output.trim() : '';
const agent_error = out.error ? (typeof out.error === 'string' ? out.error : (out.error.message || JSON.stringify(out.error))) : null;
const reasons = [...(s.needs_human_reasons || [])];
const guard = [];

// Which tools did the agent call?
const steps = Array.isArray(out.intermediateSteps) ? out.intermediateSteps : [];
const tools_used = steps.map((st) => {
  const a = st.action || {};
  const inp = typeof a.toolInput === 'object' ? (a.toolInput.input || a.toolInput.query || JSON.stringify(a.toolInput)) : (a.toolInput || '');
  return `${a.tool}(${String(inp).slice(0, 60)})`;
}).join('; ');

// Agent asked for a human?
const tag = reply.match(/\[NEEDS_HUMAN:?\s*([^\]]*)\]/i);
if (tag) { reasons.push('agent: ' + (tag[1].trim() || 'not covered by FAQ')); reply = reply.replace(tag[0], '').trim(); }
if (!reply) reasons.push(agent_error ? 'agent error' : 'empty reply');

const authorized = s.authorized_order_id ? orders.find((o) => o.order_id === s.authorized_order_id) : null;
const emailText = `${s.email.subject || ''}\n${s.email.body || ''}`;

// 1) Order IDs: only the customer's own order or IDs the customer wrote themselves
const idsInEmail = (emailText.match(/KC-?\s?\d{4}/gi) || []).map((x) => 'KC-' + x.replace(/\D/g, ''));
const idsInReply = [...new Set((reply.match(/KC-?\s?\d{4}/gi) || []).map((x) => 'KC-' + x.replace(/\D/g, '')))];
const badIds = idsInReply.filter((id) => id !== s.authorized_order_id && !idsInEmail.includes(id));
if (badIds.length) guard.push(`reply mentions unrelated order ID(s) ${badIds.join(', ')}`);

// 2) Amounts: every ₹/Rs/INR amount must exist in the FAQ or in the customer's order
const allowed = new Set();
const add = (n) => { const v = Number(n); if (!isNaN(v)) allowed.add(v); };
(faq.match(/₹\s?[\d,]+/g) || []).forEach((m) => add(m.replace(/[^\d]/g, '')));
if (authorized) {
  ['subtotal', 'shipping_fee', 'cod_fee', 'total'].forEach((k) => add(authorized[k]));
  (authorized.items || []).forEach((i) => { add(i.unit_price); add(i.unit_price * i.qty); });
  (String(authorized.refund_status || '').match(/\d[\d,]*/g) || []).forEach((m) => add(m.replace(/,/g, '')));
}
const amounts = [...reply.matchAll(/(?:₹|Rs\.?|INR|रु\.?)\s?([\d,]+(?:\.\d+)?)/gi)].map((m) => Number(m[1].replace(/,/g, '')));
const badAmounts = amounts.filter((a) => !allowed.has(a));
if (badAmounts.length) guard.push(`reply contains unverified amount(s): ${badAmounts.join(', ')}`);

// 3) Links: only the customer's own tracking link or our own domain
const urls = (reply.match(/https?:\/\/[^\s)>\]]+/gi) || []).map((u) => u.replace(/[.,;]+$/, ''));
const badUrls = urls.filter((u) => !(authorized && authorized.tracking_url && u === authorized.tracking_url) && !/kesarandco\.example/i.test(u));
if (badUrls.length) guard.push(`reply contains unverified link(s): ${badUrls.join(', ')}`);

// 4) Privacy: if the sender doesn't own the order, no tracking link / address may appear
if (s.order_found && !s.email_matches) {
  const o = orders.find((x) => x.order_id === s.order_id);
  if (o && ((o.tracking_url && reply.includes(o.tracking_url)) || (o.shipping_address && reply.includes(o.shipping_address.line1)))) guard.push('PRIVACY: reply leaks order details to a non-owner');
}

// 5) Medical claims (sentence-level, so "we cannot claim it cures eczema" is not flagged)
const sentences = reply.split(/(?<=[.!?])\s+/);
const CLAIM_RE = /\b(will|can|should|may|might)\s+(help\s+)?(cure|treat|heal|soothe|clear)\b|\bcures?\s+(your|eczema|acne|psoriasis)/i;
if (sentences.some((x) => CLAIM_RE.test(x) && !/\b(not|cannot|can't|no|never)\b/i.test(x))) guard.push('reply may contain a medical claim');

// 6) Promising a refund/replacement the policy engine did not approve
//    (allowed when the order data itself says a refund was initiated, e.g. a cancelled order)
if (s.eligibility && s.eligibility.status !== 'eligible' && !(authorized && authorized.refund_status) &&
    /\b(has been|is|been) (approved|processed|initiated)\b|\bwill be (credited|refunded)\b|\brefund (is )?approved\b/i.test(reply)) {
  guard.push(`reply promises a refund/approval but policy decision is ${s.eligibility.status}`);
}

// 6b) COD refunds: UPI/bank details may only be requested AFTER pickup is completed (FAQ 6)
if (authorized && authorized.payment_method === 'cod' &&
    /\b(share|send|provide)\b[^.]{0,80}\b(upi|ifsc|account number|bank (account|details))\b/i.test(reply) &&
    !/after (the )?pickup (is |has been )?(completed|done)/i.test(reply)) {
  guard.push('reply asks for COD refund bank/UPI details before pickup is completed');
}

// 7) Sensitive data requests
if (/\b(share|send|provide)\b[^.]{0,40}\b(otp|cvv|pin|password)\b/i.test(reply)) guard.push('reply asks for OTP/CVV/PIN/password');

if (guard.length) reasons.push(...guard.map((g) => 'guardrail: ' + g));

// Sign-off per brand voice
if (reply && !/Warm regards,?\s*\n\s*Team Kesar\s*$/i.test(reply)) reply = reply.replace(/\s+$/, '') + '\n\nWarm regards,\nTeam Kesar';

// Rough agent token estimate (the n8n Agent node doesn't expose usage): ~4 chars per token
const obsChars = steps.reduce((n, st) => n + String(st.observation || '').length, 0);
const calls = steps.length + 1;
const agent_tokens_est = {
  input: Math.ceil(((AGENT_SYSTEM_CHARS + s.agent_prompt.length) * calls + obsChars * steps.length) / 4),
  output: Math.ceil(reply.length / 4) + 40 * steps.length,
};

const { agent_prompt, ...rest } = s;
return [{
  json: {
    ...rest,
    reply_draft: reply,
    needs_human: reasons.length > 0,
    needs_human_reasons: reasons,
    tools_used: tools_used || (reply ? 'none' : ''),
    agent_error,
    guardrail_flags: guard,
    agent_tokens_est,
  },
}];
