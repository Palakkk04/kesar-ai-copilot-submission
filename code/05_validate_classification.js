// Node: Validate Classification
__VALIDATOR_LIB__

const state = $('Build Classifier Request').first().json;
const r = validateClassification($input.first().json);

return [{
  json: {
    email: state.email,
    prompt_version: state.prompt_version,
    classification: r.data,
    json_valid: r.valid,
    json_valid_first_try: r.firstTry,
    validation_errors: r.errors,
    validation_fixes: r.fixes,
    raw_model_text: String(r.text || '').slice(0, 2000),
    classifier_usage: r.usage,
    api_error: r.apiError || null,
    repair_attempted: false,
    classification_fallback: false,
  },
}];
