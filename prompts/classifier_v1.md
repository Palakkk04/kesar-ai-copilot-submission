Classify this customer support email for Kesar & Co. (a skincare brand).
Return JSON with these fields:
- intent: one of order_status, product_query, return_refund, complaint, other
- secondary_intent: another intent or null
- order_id: the order ID (KC-####) or null
- sentiment: positive, neutral, negative or angry
- language: en, hi or hinglish
- confidence: number from 0 to 1
- summary: one-line summary
