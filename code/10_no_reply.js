// Node: No Reply (log only)
// intent "other", spam, or failed classification: no customer reply is drafted.
const { agent_prompt, ...s } = $input.first().json;
return [{ json: { ...s, reply_draft: '', tools_used: '', agent_error: null, guardrail_flags: [], agent_tokens_est: { input: 0, output: 0 } } }];
