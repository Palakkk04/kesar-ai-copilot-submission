// Node: Build Audit Row
// One row per email. Keys = Audit Log columns (template columns + a few extra ones at the end).
const s = $input.first().json;
const cfg = $('Config').first().json;
const c = s.classification || {};
const cu = s.classifier_usage || { input: 0, output: 0 };
const ae = s.agent_tokens_est || { input: 0, output: 0 };
const cost = ((cu.input + ae.input) * cfg.price_per_m_input_usd + (cu.output + ae.output) * cfg.price_per_m_output_usd) / 1e6;

let action = s.reply_draft ? 'draft_reply' : 'log_only';
if (s.ticket_id) action += ` + ticket ${s.ticket_id} (${s.ticket_action})`;
if (s.needs_human) action += ' + needs_human';

const errors = [
  s.api_error ? 'classifier API: ' + s.api_error : null,
  s.agent_error ? 'agent: ' + s.agent_error : null,
  s.classification_fallback ? 'classification fallback used' : null,
  ...(s.classification_fallback ? (s.validation_errors || []).map((e) => 'validation: ' + e) : []),
].filter(Boolean).join(' | ');

const notes = [
  c.summary,
  s.eligibility && s.eligibility.status !== 'not_applicable' ? `Eligibility: ${s.eligibility.status} (${s.eligibility.reason})` : null,
  s.repair_attempted ? (s.classification_fallback ? 'JSON repair failed' : `JSON repaired on 2nd attempt (1st: ${(s.validation_errors || []).join(', ')})`) : null,
  (s.validation_fixes || []).length ? 'fixes: ' + s.validation_fixes.join(', ') : null,
  ...(s.rule_notes || []),
].filter(Boolean).join(' | ');

return [{
  json: {
    email_id: s.email.id,
    received_at: s.email.received_at,
    from_email: s.email.from.email,
    intent: c.intent || '',
    secondary_intent: c.secondary_intent || '',
    order_id: s.order_id || '',
    language: c.language || '',
    sentiment: c.sentiment || '',
    confidence: typeof c.confidence === 'number' ? c.confidence : '',
    order_found: !!s.order_found,
    action_taken: action,
    needs_human: !!s.needs_human,
    ticket_id: s.ticket_id || '',
    reply_draft: s.reply_draft || '',
    prompt_version: s.prompt_version,
    processed_at: new Date().toISOString(),
    error: errors,
    notes,
    // extra columns
    needs_human_reason: (s.needs_human_reasons || []).join('; '),
    priority: s.ticket_id ? s.priority : '',
    tools_used: s.tools_used || '',
    json_valid_first_try: !!s.json_valid_first_try,
    classifier_tokens: cu.input + cu.output,
    agent_tokens_est: ae.input + ae.output,
    est_cost_usd: Number(cost.toFixed(6)),
  },
}];
