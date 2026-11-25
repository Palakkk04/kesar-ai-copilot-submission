# Test Report — Kesar & Co. Support Copilot

**Candidate name:** Palak
**Platform used:** n8n (n8n Cloud 2.49.5)
**LLM(s) used:** Groq — `openai/gpt-oss-120b` for both classification (temperature 0, JSON mode) and the reply-drafting AI Agent (temperature 0.3). *(Gemini 3.8 Flash was tried first; see section 5.)*

---

## 1. How I decided what "correct" means

I wrote the expected outcome for every email **before** looking at the results, using only `data/faq.md` and `data/orders.json`, with each email's `received_at` (20 Nov 2026) as "today". Judgment calls:

- **Faulty item vs. return:** damaged, leaking, wrong or missing items are `complaint` (with `return_refund` as secondary when money is asked for). "Changed my mind / didn't suit / no results" is `return_refund`. Both get a ticket.
- **48-hour rule:** damage claims are "eligible" only with photos (FAQ §5). Without photos, the correct action is to ask for them, not to approve or reject.
- **needs_human:** every complaint, every rejected return, privacy, medical, injection, unknown order and low confidence (< 0.75) go to a human. Simple status questions, FAQ product questions and eligible change-of-mind returns don't.
- **"other"** means no reply is drafted (brief: log only). A non-spam "other" that needs action (GST invoice) is also flagged needs_human.
- An action counts as ✅ only if intent, ticket behaviour, needs_human **and** the facts in the draft are all right.

## 2. Results per email

| Email | Expected intent | Expected action | v1 intent | v1 action | v1 ✅/❌ | v2 intent | v2 action | v2 ✅/❌ | Notes |
|---|---|---|---|---|---|---|---|---|---|
| E01 | order_status | Draft: shipped 17 Nov via SwiftShip, ETA 21 Nov, tracking link | order_status | Draft: shipped 17 Nov, ETA 21 Nov, tracking link | ✅ | order_status | Draft: shipped, SwiftShip, ETA 21 Nov, tracking link | ✅ |  |
| E02 | product_query | Draft from FAQ: suitable for oily skin, vegan | — | — | — | product_query | Draft from FAQ: OK for oily skin, vegan | ✅ | Adds "brighten the complexion" (not in FAQ) |
| E03 | return_refund | Ticket (Low) + draft: eligible (4 days, sealed), free pickup, prepaid refund 5–7 days | return_refund | TKT-001 but needs_info + needs_human (did not detect "sealed") | ❌ | return_refund | TKT-001 (Low), eligible: pickup 2-3 days, prepaid refund 5-7 days | ✅ | Fixed vs v1 |
| E04 | complaint | Ticket (High) + draft asking for photos (within 48h) + needs human | — | — | — | complaint | TKT-002 (High), asks for photos, needs human | ✅ |  |
| E05 | order_status | Draft in Hinglish with shipped status + ETA for KC-1043 | order_status | Draft with correct facts, but in English (customer wrote Hinglish) | ✅ | order_status | Hinglish draft: shipped, ETA 23 Nov, tracking link | ✅ | Fixed vs v1 (language) |
| E06 | other | Log only (spam) | — | — | — | other | Log only (spam) | ✅ |  |
| E07 | order_status | Privacy: no order details, ask Meera to write in + needs human | order_status | Privacy refusal, asks Meera to write in + needs human | ✅ | order_status | Privacy refusal, needs human | ✅ |  |
| E08 | complaint | Ticket (High) + calm draft asking for photos (leak within 48h) + needs human (angry) | return_refund | TKT-002 judged under 7-day return rule, not 48h damage rule; draft invents a "reverse pickup" | ❌ | complaint | TKT-003 (High), 48h rule, asks for photos, needs human | ✅ | Fixed vs v1 |
| E09 | product_query | Hindi draft: dispatch 1–2 days + 6–8 business days to North-East; COD available (₹3,499 ≤ ₹5,000, ₹49 fee) | — | — | — | product_query | Hindi draft: 6-8 days North-East, COD up to Rs 5,000 + Rs 49 fee | ✅ |  |
| E10 | order_status | Order found via sender email (KC-1044) → status draft | order_status | Order found via sender email (KC-1044), status draft | ✅ | order_status | Found via sender email (KC-1044), status + tracking | ✅ |  |
| E11 | return_refund | Ticket + draft: eligible (5 days, sealed), kit returned as complete set | — | — | — | return_refund | TKT-004 (Low), eligible | ✅ |  |
| E12 | return_refund | Ignore injection; ticket (not Low, not "approved"); not eligible (used, 8 days) + needs human | return_refund | JSON invalid on 1st try → repaired; injection ignored; TKT-003 not eligible + needs human | ✅ | return_refund | Injection ignored, TKT-005 Medium, not eligible, needs human | ✅ |  |
| E13 | other | Log only + needs human (GST invoice not covered by FAQ) | — | — | — | other | Log only + needs human | ✅ |  |
| E14 | complaint | Ticket (High) + draft: wrong item, ask for photos, correct item sent after pickup | — | — | — | complaint | TKT-006 (High), asks for photos, needs human | ✅ |  |
| E15 | order_status | Draft: out for delivery; COD total, keep exact change | — | — | — | order_status | Out for delivery, keep exact cash Rs 1,897 | ✅ |  |
| E16 | return_refund | Ticket + not eligible (opened, 15 days since delivery) + needs human | return_refund | TKT-004 not eligible (15 days) + needs human | ✅ | return_refund | TKT-007, not eligible, needs human | ✅ |  |
| E17 | other | Log only (partnership request → partnerships@ email) | — | — | — | other | Log only + needs human | ✅ | Human forwards to partnerships |
| E18 | order_status | No order ID, no order for sender → ask for order ID + needs human | — | — | — | order_status | Asks for order ID, needs human | ✅ |  |
| E19 | return_refund | Ticket + eligible (3 days, unopened); COD refund via UPI/bank **after** pickup, ₹49 COD fee not refunded | — | — | — | return_refund | TKT-008 eligible, but asks for UPI/bank details before pickup; needs_human FALSE | ❌ | See section 5 |
| E20 | product_query | No medical claims: cosmetics not medicine, patch test, see dermatologist + needs human | product_query | Draft said the oil "may help soothe the skin"; caught by guardrail → needs human | ❌ | product_query | No medical claims, patch test, dermatologist, needs human | ✅ |  |
| E21 | complaint | **Update** existing KC-1052 ticket (no duplicate); eligible with photos → replacement after verification | — | — | — | complaint | TKT-002 updated (no duplicate), eligible with photos | ✅ |  |
| E22 | order_status | KC-1099 not found → ask to check the ID, invent nothing + needs human | order_status | Not found, asks to check ID, nothing invented + needs human | ✅ | order_status | Not found, nothing invented, needs human | ✅ |  |
| E23 | complaint | Ticket (High) + missing item: ask for photos / verify, refund of the aloe gel value | — | — | — | complaint | TKT-009 (High), asks for photos, needs human | ✅ |  |
| E24 | order_status | Draft: cancelled 16 Nov (out of stock), refund of ₹828 initiated to original payment method | — | — | — | order_status | Correct draft, but wrongly flagged needs human (guardrail false positive) | ❌ | See section 5 |
| E25 | other | Log only (thank-you note) | — | — | — | other | Log only | ✅ |  |

## 3. Summary

| Metric | Prompt v1 | Prompt v2 |
|---|---|---|
| Emails run (*n*) | 10 | 25 |
| Intent accuracy (x / *n*) | 9 / 10 | 25 / 25 |
| Correct action (x / *n*) | 7 / 10 | 23 / 25 |
| Valid JSON on first try (x / *n*) | 9 / 10 | 25 / 25 |
| Emails sent to "needs human" | 7 / 10 | 14 / 25 |
| Avg. tokens per email (if tracked) | ~3,580 (657 classifier + ~2,925 agent est.) | ~4,900 (1,650 classifier + ~3,250 agent est.) |
| Est. cost per email (₹ or $) | ~$0.0007 (≈ ₹0.06) | ~$0.0009 (≈ ₹0.08) |

## 4. What I changed from v1 to v2, and why

- **Change 1: structured classifier prompt + JSON mode.** v1 was a short prompt with no JSON mode at default temperature; E12 came back as non-JSON and needed the repair step. v2 uses a system prompt with intent definitions and examples, a JSON contract, JSON mode and temperature 0, with the email fenced as untrusted data. Valid JSON on first try went from 9/10 to 25/25.
- **Change 2: extra fields + keyword safety nets for the facts the policy depends on.** v1 only extracted the 7 required fields, so E03 (sealed toner) could not be approved and E08 (leaking lotion) was judged under the 7-day return rule instead of the 48-hour damage rule. v2 also extracts issue_type, product_opened, injection_attempt and medical_question, and code backs them up with keyword checks ("leaked", "sealed", "ignore previous instructions", "eczema"). E03 and E08 are now correct.
- **Change 3: clearer agent instructions.** The reply language is stated explicitly (E05 was answered in English in v1, in Hinglish in v2), the agent may not add process steps the FAQ doesn't mention (v1 invented a "reverse pickup" for a leak), and replies must be 3-6 sentences. Correct action went from 7/10 to 23/25.

## 5. Failures I could not fix (be honest)

| Email | What goes wrong | Why I think it happens | What I would try next |
|---|---|---|---|
| E19 | The COD return draft asks for UPI/bank details "once the return is scheduled", but FAQ section 6 says these are requested only after the pickup is completed. needs_human was FALSE, so this draft could have gone out automatically. | The prompt mentioned the rule, but the model merged the customer's "how will I get my money back" question into one helpful paragraph, and no code check covered this rule. | Fix written and unit-tested, not yet re-run end to end: the agent is told not to ask for bank details in this reply, and a new guardrail flags any COD draft that asks for UPI/bank details without "after the pickup is completed". |
| E24 | The reply is correct (order cancelled, Rs 828 refund already initiated) but was flagged needs_human. | The "promises a refund" guardrail didn't know the refund wording came from the order's own refund_status. Over-escalation, not a wrong answer. | Fix written and unit-tested: skip that check when the order data itself contains a refund status. |
| E20 (minor) | The guardrail flagged "we cannot claim they cure eczema" as a medical claim. The outcome was still right (needs human). | The pattern matched "cure eczema" without seeing the negation. | Fixed: the check now works per sentence and ignores sentences containing not / cannot / never. |
| E02, E05 (minor) | Small details not in the FAQ ("brighten the complexion", "contact the courier directly"). | The model paraphrases helpfully; the guardrails only check amounts, links, order IDs, privacy and medical claims. | Add a check that compares every claim in the draft with the FAQ sections the agent retrieved. |
| All | Agent token counts are estimates (about 4 characters per token). | The n8n AI Agent node doesn't expose token usage. | Read real usage from the provider's dashboard or API. |

**Platform note:** the first LLM choice was Gemini 3.8 Flash on the AI Studio free tier. All 53 API requests failed (429 "too many requests" / 503 "service unavailable", 0 output tokens), even with retries and a 20-second delay. The workflow's fallback correctly logged every email as `other` + needs human instead of crashing, but no real classification was possible, so I switched to Groq (also listed in the brief's setup guide). Groq had also retired `llama-3.3-70b-versatile`, so I picked `openai/gpt-oss-120b` from the models available on my key.
