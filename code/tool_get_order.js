// AI Agent tool: get_order   (input variable: query)
// Behaves like an order API, but enforces privacy: it only returns orders owned by the sender.
const ctx = $('Apply Business Rules').first().json;
const { orders } = $('Load Data').first().json;
const sender = ctx.sender_email;
const q = String(query || '').trim();

let order = null;
const m = q.toUpperCase().match(/KC-?\s?(\d{4})/);
if (m) {
  order = orders.find((o) => o.order_id === 'KC-' + m[1]) || null;
} else if (q.includes('@')) {
  order = orders
    .filter((o) => String(o.customer_email).toLowerCase() === q.toLowerCase())
    .sort((a, b) => String(b.order_date).localeCompare(String(a.order_date)))[0] || null;
} else if (ctx.authorized_order_id) {
  order = orders.find((o) => o.order_id === ctx.authorized_order_id) || null;
}

if (!order) {
  return JSON.stringify({ found: false, message: 'No order found for this reference. Do not guess any order details; ask the customer to confirm the order ID.' });
}
if (String(order.customer_email).toLowerCase() !== sender) {
  return JSON.stringify({ found: false, access: 'denied', message: 'This order does not belong to the person who sent the email. Do not share any details about it.' });
}
return JSON.stringify({
  found: true,
  order,
  days_since_delivery: ctx.authorized_order_id === order.order_id ? ctx.days_since_delivery : null,
  note: 'All dates are YYYY-MM-DD. Use only these facts.',
});
