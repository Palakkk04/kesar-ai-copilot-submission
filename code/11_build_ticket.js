// Node: Build Ticket
// Dedupe: if the Tickets tab already has a non-Closed ticket for this order, UPDATE it
// (append the email ID + a note) instead of creating a new one.
// Output keys = exact Tickets columns, so "Upsert Ticket" (append or update, matched on ticket_id) can auto-map.
const s = $('Needs Ticket?').first(0).json;
const rows = $input.all().map((i) => i.json).filter((r) => r && r.ticket_id);
const c = s.classification;
const now = s.email.received_at;

const ISSUE_LABEL = {
  damaged: 'Damaged item', leaking: 'Leaking item', wrong_item: 'Wrong item delivered', missing_item: 'Missing item',
  change_of_mind: 'Return (change of mind)', not_suited_or_no_results: 'Refund request (product opened/used)',
  delivery_delay: 'Delivery delay', other: 'Other issue', none: '',
};
const RANK = { Low: 1, Medium: 2, High: 3 };
const higher = (a, b) => ((RANK[a] || 0) >= (RANK[b] || 0) ? a : b);

const label = ISSUE_LABEL[c.issue_type] || (c.intent === 'complaint' ? 'Complaint' : 'Return/refund request');
const decision = s.eligibility && s.eligibility.status !== 'not_applicable' ? `${s.eligibility.status}: ${s.eligibility.reason}` : 'no eligibility decision';
const flagText = s.needs_human ? ` NEEDS HUMAN: ${(s.needs_human_reasons || []).join('; ')}.` : '';
const note = `[${now}] ${s.email.id}: ${c.summary} | Decision: ${decision}.${flagText}`;

const open = s.order_id
  ? rows.find((r) => String(r.order_id).trim() === s.order_id && String(r.status || '').trim().toLowerCase() !== 'closed')
  : rows.find((r) => !String(r.order_id || '').trim() && String(r.customer_email).toLowerCase() === s.sender_email && String(r.status || '').trim().toLowerCase() !== 'closed');

let ticket;
if (open) {
  const ids = String(open.email_ids || '').split(/[,;\s]+/).filter(Boolean);
  if (!ids.includes(s.email.id)) ids.push(s.email.id);
  ticket = {
    ticket_id: open.ticket_id,
    created_at: open.created_at,
    updated_at: now,
    order_id: open.order_id,
    customer_email: open.customer_email,
    email_ids: ids.join(', '),
    intent: open.intent,
    priority: higher(open.priority, s.priority),
    status: open.status || 'Open',
    summary: `${label} - ${open.order_id || 'no order ID'} - ${s.eligibility ? s.eligibility.status : 'n/a'} (updated by ${s.email.id})`,
    notes: open.notes ? `${open.notes}\n${note}` : note,
    llm_summary: open.llm_summary ? `${open.llm_summary}\n${s.email.id}: ${c.summary}` : c.summary,
  };
} else {
  const maxN = rows.reduce((m, r) => { const n = parseInt(String(r.ticket_id).replace(/\D/g, ''), 10); return isNaN(n) ? m : Math.max(m, n); }, 0);
  ticket = {
    ticket_id: 'TKT-' + String(maxN + 1).padStart(3, '0'),
    created_at: now,
    updated_at: now,
    order_id: s.order_id || '',
    customer_email: s.email.from.email,
    email_ids: s.email.id,
    intent: c.intent,
    priority: s.priority,
    status: 'Open',
    summary: `${label} - ${s.order_id || 'no order ID'} - ${s.eligibility ? s.eligibility.status : 'n/a'}`,
    notes: note,
    llm_summary: c.summary,
  };
}
return [{ json: ticket }];
