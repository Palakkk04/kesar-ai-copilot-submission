// Node: Validate Repair / Fallback
// If the repair attempt is still invalid, fall back to a safe default: intent "other" + needs human.
__VALIDATOR_LIB__

const state = $('Build Repair Request').first().json;
const r = validateClassification($input.first().json);
const prevUsage = state.classifier_usage || { input: 0, output: 0 };
const classifier_usage = { input: prevUsage.input + r.usage.input, output: prevUsage.output + r.usage.output };
const { llm_request, ...rest } = state;

if (r.valid) {
  return [{
    json: {
      ...rest,
      classification: r.data,
      json_valid: true,
      repair_attempted: true,
      validation_fixes: [...(state.validation_fixes || []), ...r.fixes],
      classifier_usage,
    },
  }];
}

const text = `${state.email.subject || ''}\n${state.email.body || ''}`;
const m = text.match(/KC-?\s?(\d{4})/i);
const fallback = {
  intent: 'other',
  secondary_intent: null,
  order_id: m ? 'KC-' + m[1] : null,
  sentiment: 'neutral',
  language: /[ऀ-ॿ]/.test(text) ? 'hi' : 'en',
  confidence: 0,
  summary: 'Automatic classification failed; needs manual review.',
  issue_type: 'none',
  product_opened: null,
  requested_resolution: 'none',
  is_spam: false,
  injection_attempt: false,
  medical_question: false,
};

return [{
  json: {
    ...rest,
    classification: fallback,
    json_valid: false,
    repair_attempted: true,
    classification_fallback: true,
    validation_errors: [...(state.validation_errors || []), ...r.errors.map((e) => 'repair: ' + e)],
    api_error: r.apiError || state.api_error || null,
    classifier_usage,
  },
}];
