//--- /api/create-store-domain.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { slug } = req.body;
        if (!slug) return res.status(400).json({ error: 'Slug required' });

        const token = process.env.CLOUDFLARE_API_TOKEN;
        const zoneId = process.env.CLOUDFLARE_ZONE_ID;

        // Give a highly specific error to the user/developer
        if (!token || !zoneId) {
            return res.status(500).json({ 
                error: 'Please go to your Vercel Dashboard -> Settings -> Environment Variables, and add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID.' 
            });
        }

        const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type: 'CNAME',
                name: safeSlug,
                content: 'fumatechnologies.vercel.app', 
                ttl: 1,
                proxied: true
            })
        });

        const data = await response.json();
        
        // Ignore "Record already exists" error (code 81053)
        if (!data.success && data.errors[0]?.code !== 81053) {
            throw new Error(data.errors[0]?.message);
        }

        return res.status(200).json({ success: true, domain: `${safeSlug}.fumatechnologies.app` }); // Change fumatechnologies.app to your actual base domain if needed
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
