/**
 * /api/generate-product-description.js
 *
 * generate-supplier-shop.js has been merged into this file to stay within
 * Vercel's 12-function limit. No new file needed.
 *
 * Modes:
 *   'store_full'       â€” dropshipper store identity from niche
 *   'product_full'     â€” enhance a dropshipper's imported product listing
 *   'supplier_product' â€” full supplier catalog listing generation
 *   'supplier_shop'    â€” supplier shop profile + policies  (was generate-supplier-shop.js)
 *   'policies_only'    â€” regenerate return + quality policies only
 *
 * Callers:
 *   shop.js (supplier)    â†’ mode: 'supplier_shop'    or  mode: 'policies_only'
 *   catalog.js (supplier) â†’ mode: 'supplier_product'
 *   FumaDropShip ads.js     â†’ mode: 'store_full'
 *   FumaDropShip products   â†’ mode: 'product_full'
 *
 * âœ… FUMA Invoice â€” not affected (invoice never calls this endpoint)
 * âœ… Fuma Business â€” not affected (business never calls this endpoint)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getApiKey }          = require('./_utils');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Support both calling conventions:
    //   { mode, data }               â† FumaDropShip / catalog.js
    //   { niche, supplierName, mode } â† shop.js (was generate-supplier-shop.js)
    const { mode, data, niche, supplierName = '' } = req.body;
    const effectiveMode = mode || 'product_full';

    try {
        const apiKey = await getApiKey('gemini');
        if (!apiKey) {
            return res.status(500).json({
                error: 'Gemini API key not configured. Add GEMINI_API_KEY to Vercel environment variables.'
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        let prompt  = '';

        // â”€â”€ MODE 1: DROPSHIPPER STORE IDENTITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (effectiveMode === 'store_full') {
            const d = data || {};
            prompt = `
Act as an expert e-commerce brand strategist. The user wants to build a dropshipping store in this niche: "${d.niche || niche}".
Generate a complete brand identity.

Return ONLY valid JSON (no markdown, no backticks):
{
  "name":        "Catchy brand name (2-3 words)",
  "slug":        "url-friendly-slug",
  "headline":    "Hero headline for the storefront (max 8 words, compelling)",
  "description": "2-sentence brand description for the homepage",
  "themeColor":  "#HexColor that matches the niche mood",
  "seoTitle":    "SEO meta title (max 60 chars)",
  "seoDesc":     "SEO meta description (max 160 chars)"
}`.trim();
        }

        // â”€â”€ MODE 2: DROPSHIPPER PRODUCT ENHANCER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        else if (effectiveMode === 'product_full') {
            const d = data || {};
            prompt = `
Act as an elite e-commerce copywriter. The raw product title is: "${d.title}". Supplier cost: â‚¹${d.cost || 0}.

1. Clean the title to be professional and SEO-friendly.
2. Write a compelling short description (1-2 sentences).
3. Write a persuasive detailed description in HTML format (use <b>, <ul>, <li>). Include key features, benefits, and use cases.
4. Suggest the most appropriate category, material, size, weight (number in grams), and finish.
5. Recommend a retail price multiplier (e.g. 2.5 for 2.5Ã— cost).

Return ONLY valid JSON (no markdown, no backticks):
{
  "title":      "Clean SEO title",
  "short":      "Short description (1-2 sentences)",
  "detailed":   "HTML description with features and benefits",
  "category":   "Best matching category",
  "material":   "Main material",
  "size":       "Standard dimensions",
  "weight":     500,
  "finish":     "Surface finish",
  "multiplier": 2.5
}`.trim();
        }

        // â”€â”€ MODE 3: SUPPLIER CATALOG PRODUCT LISTING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        else if (effectiveMode === 'supplier_product') {
            const d    = data || {};
            const cost = d.cost || 0;
            prompt = `
You are an expert Indian e-commerce product specialist writing a B2B supplier listing for the Fuma DropShip marketplace.
Dropshippers will import this product to sell in their stores.

Product: "${d.title || ''}"
Supplier cost: â‚¹${cost}

Return ONLY valid JSON (no markdown, no backticks):
{
  "title":           "Professional SEO-optimised product name",
  "short":           "One compelling sentence for product cards",
  "detailed":        "Full HTML description with <p><b><ul><li>. Include: overview, 5-6 key features, use cases, what's in the box. Min 120 words.",
  "category":        "One of: Electronics, Fashion, Home & Decor, Beauty & Skincare, Health & Fitness, Toys & Hobbies, Automotive, Sports & Outdoors, Jewellery & Accessories, Office & Stationery, Pet Supplies, Baby Products, Food & Beverage, Furniture, Tools & Hardware, Books, Other",
  "sku":             "Category prefix + 4 digit number e.g. ELEC-0042",
  "material":        "Primary material(s)",
  "size":            "Dimensions or size specification",
  "weight":          450,
  "finish":          "Surface finish or colour",
  "shippingTime":    "e.g. 3â€“5 days",
  "keywords":        "10-15 comma-separated search keywords",
  "handling":        "e.g. Fragile - Handle with Care",
  "minSellingPrice": ${cost ? Math.ceil(parseFloat(cost) * 2.5 / 10) * 10 : 999}
}`.trim();
        }

        // â”€â”€ MODE 4: SUPPLIER SHOP PROFILE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Previously in generate-supplier-shop.js â€” merged here to save a function slot
        // Called by shop.js in the Supplier Portal
        else if (effectiveMode === 'supplier_shop') {
            const shopNiche = niche || data?.niche || '';
            if (!shopNiche) {
                return res.status(400).json({ error: 'niche is required for supplier_shop mode.' });
            }
            prompt = `
You are an expert Indian e-commerce brand strategist and B2B supplier consultant.
The user is setting up a supplier shop on Fuma DropShip, India's verified supplier marketplace.

Supplier niche: "${shopNiche}"
${supplierName ? `Business name: "${supplierName}"` : ''}

Return ONLY valid JSON (no markdown, no backticks):
{
  "shopName":       "Compelling brand name (2-4 words, memorable, professional)",
  "tagline":        "Short punchy tagline (max 8 words)",
  "category":       "One of: Electronics, Fashion, Home & Decor, Beauty & Skincare, Health & Fitness, Toys & Hobbies, Automotive, Sports & Outdoors, Jewellery & Accessories, Office & Stationery, Pet Supplies, Baby Products, Food & Beverage, Furniture, Tools & Hardware, Books, Other",
  "description":    "3-4 sentence professional About section. Mention niche, quality standards, sourcing, experience.",
  "usp":            "2-3 sentence unique selling proposition. Focus on quality, reliability, fast dispatch.",
  "processingTime": "e.g. 24â€“48 hours",
  "shippingTime":   "e.g. 3â€“7 business days",
  "couriers":       "e.g. Delhivery, BlueDart, FedEx, DTDC",
  "shipsFrom":      "City, State e.g. Delhi, NCR",
  "returnPolicy":   "Professional return and refund policy (3-4 sentences). Include timeframe, conditions, process.",
  "qualityPolicy":  "Quality assurance statement (2-3 sentences). Mention checks, certifications, guarantee.",
  "brandColor":     "#HexCode matching this niche personality",
  "seoTitle":       "Marketplace headline max 55 chars: Shop Name | Niche Supplier",
  "seoDesc":        "Marketplace search description max 155 chars. Highlight niche, quality, dispatch speed."
}`.trim();
        }

        // â”€â”€ MODE 5: POLICIES ONLY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Previously in generate-supplier-shop.js â€” merged here
        else if (effectiveMode === 'policies_only') {
            const policyNiche = niche || data?.niche || 'general goods';
            prompt = `
You are a professional B2B supplier business writer in India.
Generate two policy statements for a supplier in the niche: "${policyNiche}".

Return ONLY valid JSON, no markdown, no backticks:
{
  "returnPolicy":  "Detailed return and refund policy (2-3 sentences, professional tone, specific to this product type)",
  "qualityPolicy": "Quality guarantee statement (1-2 sentences, builds buyer confidence)"
}`.trim();
        }

        // â”€â”€ MODE 6: STORE CONTENT CUSTOMIZER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Called by FumaDropShip customize.js AI Fill button.
        // Each section generates a different shape of JSON.
        else if (effectiveMode === 'store_content') {
            const d       = data || {};
            const name    = d.storeName   || 'Our Store';
            const niche_  = d.niche       || name;
            const sym     = d.currency === 'USD' ? '$' : 'â‚¹';
            const section = d.section     || 'general';

            if (section === 'general') {
                prompt = `
You are an e-commerce copywriter. Store name: "${name}", niche: "${niche_}", currency symbol: "${sym}".
Write a short, catchy announcement bar message for the store header. Max 80 characters. Include an emoji.

Return ONLY valid JSON (no markdown):
{ "announcement": "your message here" }`.trim();

            } else if (section === 'hero') {
                prompt = `
You are an elite e-commerce copywriter. Store: "${name}", niche: "${niche_}", currency: "${sym}".
Write compelling hero section copy for the homepage.

Return ONLY valid JSON (no markdown, no backticks):
{
  "eyebrow":    "2-3 word label above headline (e.g. 'New Arrivals', 'Summer Collection')",
  "headline":   "Punchy hero headline, max 7 words, no punctuation",
  "subtext":    "1-2 sentence hook that excites the customer and mentions the niche",
  "btn1":       "Primary CTA label (e.g. 'Shop Now', 'Explore Collection')",
  "btn2":       "Secondary CTA label (e.g. 'Our Story', 'Learn More')",
  "badge":      "2-3 word badge (e.g. 'Free Shipping', 'Fast Delivery')",
  "badgeSub":   "Badge subtext (e.g. 'On orders over ${sym}999')",
  "stat1Label": "First stat label (e.g. 'Happy Customers')",
  "stat1Val":   "First stat value (e.g. '10K+')",
  "stat2Label": "Second stat label (e.g. 'Average Rating')",
  "stat2Val":   "Second stat value (e.g. '4.9â˜…')"
}`.trim();

            } else if (section === 'features') {
                prompt = `
You are a brand strategist. Store: "${name}", niche: "${niche_}".
Write 4 "Why Shop With Us" feature cards tailored to this niche.

Available Font Awesome icons to pick from (use exact strings):
fa-shield-halved, fa-truck-fast, fa-rotate-left, fa-headset, fa-star, fa-heart, fa-bolt, fa-leaf,
fa-award, fa-lock, fa-gem, fa-tag, fa-check-circle, fa-box-open, fa-hand-holding-heart, fa-certificate

Return ONLY valid JSON (no markdown):
{
  "features": [
    { "icon": "fa-shield-halved", "title": "Feature title (3-4 words)", "desc": "1-2 sentence description relevant to ${niche_}." },
    { "icon": "fa-truck-fast",    "title": "Feature title (3-4 words)", "desc": "1-2 sentence description." },
    { "icon": "fa-rotate-left",   "title": "Feature title (3-4 words)", "desc": "1-2 sentence description." },
    { "icon": "fa-headset",       "title": "Feature title (3-4 words)", "desc": "1-2 sentence description." }
  ]
}`.trim();

            } else if (section === 'testimonials') {
                prompt = `
You are a UX copywriter. Store: "${name}", niche: "${niche_}".
Write 3 realistic, authentic-sounding customer testimonials for this niche. Use Indian names and cities.

Return ONLY valid JSON (no markdown):
{
  "testimonials": [
    { "name": "Name Surname Initial", "location": "City", "rating": 5, "text": "Authentic review 1-2 sentences, specific to product type." },
    { "name": "Name Surname Initial", "location": "City", "rating": 5, "text": "Authentic review 1-2 sentences." },
    { "name": "Name Surname Initial", "location": "City", "rating": 4, "text": "Authentic review with a minor positive note." }
  ]
}`.trim();

            } else if (section === 'faq') {
                prompt = `
You are a customer support specialist. Store: "${name}", niche: "${niche_}", currency: "${sym}".
Write 5 FAQs that real customers of a ${niche_} store would ask. Mix shipping, returns, product, payment questions.

Return ONLY valid JSON (no markdown):
{
  "faqs": [
    { "q": "Question 1?", "a": "Clear, helpful answer." },
    { "q": "Question 2?", "a": "Clear, helpful answer." },
    { "q": "Question 3?", "a": "Clear, helpful answer." },
    { "q": "Question 4?", "a": "Clear, helpful answer." },
    { "q": "Question 5?", "a": "Clear, helpful answer." }
  ]
}`.trim();

            } else if (section === 'social') {
                prompt = `
You are a social media consultant. Store: "${name}", niche: "${niche_}".
Generate realistic placeholder social media profile URLs for this store. Use the store name as the handle.

Return ONLY valid JSON (no markdown):
{
  "instagram": "https://instagram.com/storename",
  "facebook":  "https://facebook.com/storename",
  "twitter":   "https://twitter.com/storename",
  "whatsapp":  "https://wa.me/919876543210"
}`.trim();

            } else if (section === 'page-about') {
                prompt = `
You are a brand storyteller. Store: "${name}", niche: "${niche_}".
Write compelling About Us page content for this dropshipping store.

Return ONLY valid JSON (no markdown):
{
  "lead":    "1-2 sentence page intro that hooks the reader",
  "story":   "2-3 paragraph brand story. How the store started, its values, what makes it different. Written in first person plural.",
  "mission": "1-2 sentence mission statement focused on customer value and niche expertise"
}`.trim();

            } else if (section === 'page-shipping') {
                prompt = `
You are a logistics copywriter. Store: "${name}", niche: "${niche_}", currency: "${sym}".
Write the shipping policy page content.

Return ONLY valid JSON (no markdown):
{
  "lead":       "1 sentence page intro",
  "processing": "Processing time statement (include: 1-2 business days)",
  "standard":   "Standard shipping time and free threshold (include: ${sym}999 free shipping)",
  "express":    "Express shipping option description",
  "policy":     "Any additional shipping notes specific to ${niche_} products (e.g. fragile handling, special packaging)"
}`.trim();

            } else if (section === 'page-returns') {
                prompt = `
You are a policy writer. Store: "${name}", niche: "${niche_}".
Write returns and refunds page content for this niche.

Return ONLY valid JSON (no markdown):
{
  "lead":    "1 sentence page intro",
  "window":  "Return window (e.g. '30 days')",
  "process": "Step-by-step return process in plain text (3-4 steps, separated by newlines)",
  "refund":  "Refund timeline statement"
}`.trim();

            } else if (section === 'page-privacy') {
                prompt = `
You are a legal copywriter. Store: "${name}", niche: "${niche_}".
Write a concise, professional privacy policy for a small Indian e-commerce store.
Cover: data collection, usage, sharing, security, cookies, user rights, contact.

Return ONLY valid JSON (no markdown):
{
  "lead": "1 sentence intro",
  "body": "Full privacy policy text in plain paragraphs separated by \\n\\n. Each section has a heading in ALL CAPS followed by colon. Min 250 words."
}`.trim();

            } else if (section === 'page-terms') {
                prompt = `
You are a legal copywriter. Store: "${name}", niche: "${niche_}".
Write concise Terms & Conditions for a small Indian e-commerce store.
Cover: acceptance, products, pricing, orders, IP, liability, governing law.

Return ONLY valid JSON (no markdown):
{
  "lead": "1 sentence intro",
  "body": "Full terms text in plain paragraphs separated by \\n\\n. Each section has a heading in ALL CAPS followed by colon. Min 200 words."
}`.trim();

            } else if (section === 'page-contact') {
                prompt = `
You are a copywriter. Store: "${name}", niche: "${niche_}".
Write the contact page intro lead text.

Return ONLY valid JSON (no markdown):
{
  "lead": "1-2 warm, welcoming sentences inviting customers to reach out. Mention response time."
}`.trim();

            } else {
                return res.status(400).json({
                    error: `Unknown store_content section: "${section}". Valid sections: general, hero, features, testimonials, faq, social, page-about, page-shipping, page-returns, page-privacy, page-terms, page-contact`
                });
            }
        }

        else {
            return res.status(400).json({
                error: `Unknown mode: "${effectiveMode}". Valid: store_full, product_full, supplier_product, supplier_shop, policies_only, store_content`
            });
        }

        const result = await model.generateContent(prompt);
        let text     = result.response.text()
            .replace(/```json/gi, '').replace(/```html/gi, '').replace(/```/g, '').trim();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) text = jsonMatch[0];

        try {
            return res.status(200).json(JSON.parse(text));
        } catch(parseErr) {
            console.error('JSON parse failed. Raw:', text.slice(0, 300));
            return res.status(500).json({ error: 'AI response was not valid JSON.', raw: text.slice(0, 300) });
        }

    } catch(err) {
        console.error('generate-product-description error:', err.message);
        return res.status(500).json({ error: 'AI API Error: ' + err.message });
    }
}

