/* Creates the "Nexora Pro" product and ₹400/month price in Stripe (use TEST keys) and prints the price id. */
import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

const main = async () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Set STRIPE_SECRET_KEY first');
  if (key.startsWith('sk_live') && process.env.ALLOW_LIVE_STRIPE_SETUP !== 'yes') {
    throw new Error('Refusing to run against a LIVE key. Use sk_test_… or set ALLOW_LIVE_STRIPE_SETUP=yes deliberately.');
  }
  const stripe = new Stripe(key);
  const existing = await stripe.products.search({ query: "name:'Nexora Pro' AND active:'true'" });
  const product = existing.data[0] || (await stripe.products.create({ name: 'Nexora Pro', description: 'All 13 Nexora AI tools with monthly Pro credits.' }));
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  const price = prices.data.find((p) => p.currency === 'inr' && p.unit_amount === 40000 && p.recurring?.interval === 'month')
    || (await stripe.prices.create({ product: product.id, currency: 'inr', unit_amount: 40000, recurring: { interval: 'month' }, nickname: 'Nexora Pro monthly' }));
  console.log(`\nProduct: ${product.id}\nSTRIPE_PRO_PRICE_ID=${price.id}\n`);
};
main().catch((e) => { console.error(e.message); process.exit(1); });
