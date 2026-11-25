// Node: Load Data
// Fetches the order "API", FAQ, brand voice and the 25 test emails once per run.
const cfg = $('Config').first().json;
const helpers = this.helpers;

const fetchText = async (file) => {
  const r = await helpers.httpRequest({ method: 'GET', url: cfg.data_base_url + file, json: false });
  return typeof r === 'string' ? r : JSON.stringify(r);
};

const ordersDoc = JSON.parse(await fetchText('orders.json'));
const emailsDoc = JSON.parse(await fetchText('test_emails.json'));
const faq = await fetchText('faq.md');
const brandVoice = await fetchText('brand_voice.md');

const orders = Array.isArray(ordersDoc) ? ordersDoc : (ordersDoc.orders || []);
const emails = Array.isArray(emailsDoc) ? emailsDoc : (emailsDoc.emails || []);

if (!orders.length || !emails.length) throw new Error('Could not load orders or emails');

return [{ json: { orders, emails, faq, brand_voice: brandVoice, loaded_at: new Date().toISOString() } }];
