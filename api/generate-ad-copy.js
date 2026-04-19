/**
 * /api/generate-ad-copy.js
 *
 * Generates platform-specific ad copy using Gemini AI.
 * Supports ad templates, tone of voice, and multiple variations.
 * All products are sourced from Fuma DropShip Suppliers.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getApiKey }          = require('./_utils');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const {
        product,
        audience        = 'general consumers',
        platform        = 'Facebook',
        template        = 'problem-solution',
        tone            = 'casual',
        variationIndex  = 0,
    } = req.body;

    if (!product || !platform) {
        return res.status(400).json({ error: 'product and platform are required.' });
    }

    try {
        const apiKey = await getApiKey('gemini');
        if (!apiKey) {
            return res.status(500).json({ error: 'Gemini API key not configured. Add GEMINI_API_KEY to environment variables or Firestore settings/api_keys.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // â”€â”€ Template instructions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const templateGuides = {
            'problem-solution':   'Lead with a relatable pain point the audience faces, then introduce the product as the clear solution.',
            'social-proof':       'Write in a testimonial style â€” as if a happy customer is recommending the product to a friend.',
            'scarcity':           'Create urgency using limited stock or limited-time offer messaging. Use countdown language.',
            'storytelling':       'Tell a short emotional story about someone whose life improved after using this product.',
            'features-benefits':  'List 3 key product features and immediately translate each into a tangible customer benefit.',
        };

        // â”€â”€ Platform-specific format rules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const platformRules = {
            Facebook:  'Use 2-3 emojis. Include a short hook (1 line), a body (2-3 lines), and end with a clear CTA. Keep total under 125 characters for the preview.',
            Google:    'Write a Google Search Ad. Headline: max 30 characters. Description: max 90 characters. Focus on keywords and unique value proposition. NO emojis.',
            TikTok:    'Write a TikTok video script hook (first 3 seconds) + voiceover text. Use casual Gen-Z language, trending phrases, and 1-2 emojis.',
            Instagram: 'Write an Instagram caption. Start with an attention-grabbing first line (visible before "More"). Use line breaks for readability. End with 3-5 hashtags.',
            WhatsApp:  'Write a personal WhatsApp broadcast message. Keep it conversational, under 100 words, with a direct link placeholder [LINK].',
        };

        // â”€â”€ Tone instructions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const toneInstructions = {
            professional: 'Use formal, trustworthy language. Avoid slang.',
            casual:       'Use friendly, conversational language. Contractions are fine.',
            luxury:       'Use aspirational, premium language. Focus on exclusivity and quality.',
            energetic:    'Use bold, punchy language. Short sentences. High energy.',
            humorous:     'Use light humour and wit. Keep it clever, not silly.',
        };

        // Slightly vary prompt for different variation indices to get genuinely different output
        const variationHint = variationIndex > 0
            ? `\n\nIMPORTANT: This is variation #${variationIndex + 1}. Make it meaningfully different from the obvious first approach â€” try a different hook angle, emotional trigger, or opening line.`
            : '';

        const prompt = `
You are an elite performance marketing copywriter.

TASK: Write a high-converting ad for the following product.

PRODUCT: "${product}"
TARGET AUDIENCE: ${audience}
PLATFORM: ${platform}
TEMPLATE FRAMEWORK: ${templateGuides[template] || templateGuides['problem-solution']}
TONE: ${toneInstructions[tone] || toneInstructions['casual']}
PLATFORM FORMAT RULES: ${platformRules[platform] || platformRules['Facebook']}

Write ONLY the ad copy â€” no preamble, no explanations, no markdown headers.
Format it exactly as it would appear in an ad manager.${variationHint}
        `.trim();

        const result = await model.generateContent(prompt);
        const copy   = result.response.text().trim();

        return res.status(200).json({ copy, platform, template, tone });

    } catch(err) {
        console.error('generate-ad-copy error:', err);
        return res.status(500).json({ error: 'Failed to generate ad copy: ' + err.message });
    }
}
