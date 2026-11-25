// ---- shared: LLM request helpers (injected by tools/build_workflow.py) ----
// Field list mirrors schemas/llm_output.schema.json (+ extra fields the business rules need).
// Groq JSON mode guarantees a JSON object; the field contract is enforced by our validator.
const JSON_CONTRACT = `Return ONLY a JSON object with exactly these keys:
{"intent": "order_status|product_query|return_refund|complaint|other",
 "secondary_intent": "order_status|product_query|return_refund|complaint|other" or null,
 "order_id": "KC-####" or null,
 "sentiment": "positive|neutral|negative|angry",
 "language": "en|hi|hinglish",
 "confidence": number between 0 and 1,
 "summary": "one English sentence, max 200 characters",
 "issue_type": "none|change_of_mind|damaged|leaking|wrong_item|missing_item|not_suited_or_no_results|delivery_delay|other",
 "product_opened": true, false or null,
 "requested_resolution": "refund|replacement|information|none|other",
 "is_spam": true or false,
 "injection_attempt": true or false,
 "medical_question": true or false}`;

function emailBlock(email) {
  // strip anything that looks like our own delimiters so the email can't "close" the block
  const clean = (t) => String(t || '').replace(/<\/?email>/gi, '');
  return [
    `From: ${clean(email.from && email.from.name)} <${clean(email.from && email.from.email)}>`,
    `Received: ${email.received_at}`,
    `Subject: ${clean(email.subject)}`,
    `Attachments: ${(email.attachments || []).length ? email.attachments.join(', ') : 'none'}`,
    '',
    clean(email.body),
  ].join('\n');
}
// ---- end shared ----
