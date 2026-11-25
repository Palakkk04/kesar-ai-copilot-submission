// Node: Split Emails
// One item per email (optionally filtered by Config.only_ids).
const cfg = $('Config').first().json;
const { emails } = $('Load Data').first().json;
const only = (cfg.only_ids || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
const selected = only.length ? emails.filter((e) => only.includes(e.id)) : emails;
return selected.map((e) => ({ json: { email: e } }));
