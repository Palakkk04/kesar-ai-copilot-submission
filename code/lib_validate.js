// ---- shared: classification validator (injected by tools/build_workflow.py) ----
// Validates the model output against schemas/llm_output.schema.json.
// "errors" = cannot be trusted -> repair/fallback. "fixes" = small safe coercions.
const V_INTENTS = ['order_status', 'product_query', 'return_refund', 'complaint', 'other'];
const V_SENTIMENTS = ['positive', 'neutral', 'negative', 'angry'];
const V_LANGS = ['en', 'hi', 'hinglish'];
const V_ISSUES = ['none', 'change_of_mind', 'damaged', 'leaking', 'wrong_item', 'missing_item', 'not_suited_or_no_results', 'delivery_delay', 'other'];
const V_RESOLUTIONS = ['refund', 'replacement', 'information', 'none', 'other'];

// Works for OpenAI-compatible responses (Groq) and, as a fallback, Gemini responses.
function llmText(res) {
  if (res && res.choices && res.choices[0]) return String((res.choices[0].message && res.choices[0].message.content) || '').trim();
  const parts = (res && res.candidates && res.candidates[0] && res.candidates[0].content && res.candidates[0].content.parts) || [];
  return parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
}
function llmUsage(res) {
  if (res && res.usage) return { input: res.usage.prompt_tokens || 0, output: res.usage.completion_tokens || 0 };
  const u = (res && res.usageMetadata) || {};
  return { input: u.promptTokenCount || 0, output: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) };
}
function llmApiError(res) {
  if (!res || typeof res !== 'object') return 'empty response';
  if (res.error) return typeof res.error === 'string' ? res.error : (res.error.message || JSON.stringify(res.error));
  if (!(res.choices && res.choices.length) && !(res.candidates && res.candidates.length)) return 'no choices in response';
  return null;
}
const isNullish = (v) => v === null || v === undefined || v === '' || v === 'null' || v === 'none' || v === 'None';

function validateClassification(res) {
  const errors = []; const fixes = [];
  const usage = llmUsage(res);
  const apiError = llmApiError(res);
  if (apiError) return { valid: false, firstTry: false, data: null, errors: ['API error: ' + apiError], fixes, text: '', usage, apiError };

  const text = llmText(res);
  let obj = null; let cleaned = false;
  try { obj = JSON.parse(text); } catch (e) {
    const a = text.indexOf('{'); const b = text.lastIndexOf('}');
    if (a >= 0 && b > a) { try { obj = JSON.parse(text.slice(a, b + 1)); cleaned = true; } catch (e2) { /* ignore */ } }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, firstTry: false, data: null, errors: ['Output is not a JSON object'], fixes, text, usage, apiError: null };
  }
  if (cleaned) fixes.push('stripped text/markdown around JSON');

  const d = { ...obj };
  // intent
  if (typeof d.intent === 'string') d.intent = d.intent.trim().toLowerCase();
  if (!V_INTENTS.includes(d.intent)) errors.push(`intent invalid: ${JSON.stringify(obj.intent)}`);
  // secondary_intent
  if (!('secondary_intent' in d)) fixes.push('secondary_intent missing -> null');
  if (isNullish(d.secondary_intent)) d.secondary_intent = null;
  else if (typeof d.secondary_intent === 'string') d.secondary_intent = d.secondary_intent.trim().toLowerCase();
  if (d.secondary_intent !== null && !V_INTENTS.includes(d.secondary_intent)) errors.push(`secondary_intent invalid: ${JSON.stringify(obj.secondary_intent)}`);
  if (d.secondary_intent && d.secondary_intent === d.intent) { d.secondary_intent = null; fixes.push('secondary_intent equal to intent -> null'); }
  // order_id
  if (!('order_id' in d)) fixes.push('order_id missing -> null');
  if (isNullish(d.order_id)) d.order_id = null;
  else {
    const m = String(d.order_id).match(/KC-?\s?(\d{4})/i);
    const norm = m ? 'KC-' + m[1] : null;
    if (norm !== d.order_id) fixes.push(`order_id ${JSON.stringify(d.order_id)} -> ${norm}`);
    d.order_id = norm;
  }
  // sentiment
  if (typeof d.sentiment === 'string') d.sentiment = d.sentiment.trim().toLowerCase();
  if (!V_SENTIMENTS.includes(d.sentiment)) errors.push(`sentiment invalid: ${JSON.stringify(obj.sentiment)}`);
  // language
  const LMAP = { english: 'en', hindi: 'hi', 'hi-latn': 'hinglish' };
  if (typeof d.language === 'string') { const l = d.language.trim().toLowerCase(); d.language = LMAP[l] || l; }
  if (!V_LANGS.includes(d.language)) errors.push(`language invalid: ${JSON.stringify(obj.language)}`);
  // confidence
  let conf = typeof d.confidence === 'string' ? parseFloat(d.confidence) : d.confidence;
  if (typeof conf === 'number' && conf > 1 && conf <= 100) { conf = conf / 100; fixes.push('confidence given as percentage'); }
  if (typeof conf !== 'number' || isNaN(conf) || conf < 0 || conf > 1) errors.push(`confidence invalid: ${JSON.stringify(obj.confidence)}`);
  else d.confidence = conf;
  // summary
  if (typeof d.summary !== 'string' || !d.summary.trim()) errors.push('summary missing');
  else if (d.summary.length > 200) { d.summary = d.summary.slice(0, 197) + '...'; fixes.push('summary truncated to 200 chars'); }

  // extra fields (not in the required schema): default silently
  if (!V_ISSUES.includes(d.issue_type)) d.issue_type = 'none';
  if (typeof d.product_opened !== 'boolean') d.product_opened = null;
  if (!V_RESOLUTIONS.includes(d.requested_resolution)) d.requested_resolution = 'none';
  d.is_spam = d.is_spam === true;
  d.injection_attempt = d.injection_attempt === true;
  d.medical_question = d.medical_question === true;

  const valid = errors.length === 0;
  return { valid, firstTry: valid && fixes.length === 0, data: valid ? d : null, errors, fixes, text, usage, apiError: null };
}
// ---- end shared ----
