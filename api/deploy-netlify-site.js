//--- /api/deploy-netify-site.js
const crypto = require('crypto');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { storeName, customToken } = req.body;
        const netlifyToken = customToken || process.env.NETLIFY_ACCESS_TOKEN;

        if (!netlifyToken) return res.status(401).json({ error: 'Netlify token missing.' });

        // Generate a clean subdomain name
        const safeName = storeName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 10000);

        // The iframe proxy template
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${storeName} | Store</title>
    <style>body,html{margin:0;padding:0;height:100%;overflow:hidden;}</style>
</head>
<body>
    <iframe src="https://fumatechnologies.vercel.app/store/${storeName}" width="100%" height="100%" frameborder="0"></iframe>
</body>
</html>`;

        const sha1 = crypto.createHash('sha1').update(htmlContent).digest('hex');

        const siteRes = await fetch('https://api.netlify.com/api/v1/sites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${netlifyToken}` },
            body: JSON.stringify({ name: safeName })
        });
        const siteData = await siteRes.json();
        if (!siteRes.ok) throw new Error(siteData.message || "Failed to create site on Netlify");

        const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteData.id}/deploys`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${netlifyToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: { "/index.html": sha1 } })
        });
        const deployData = await deployRes.json();
        if (!deployRes.ok) throw new Error("Failed to initialize deploy on Netlify");

        if (deployData.required && deployData.required.length > 0) {
            const uploadRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deployData.id}/files/index.html`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${netlifyToken}`, 'Content-Type': 'application/octet-stream' },
                body: htmlContent
            });
            if (!uploadRes.ok) throw new Error(`Netlify rejected the file upload.`);
        }

        return res.status(200).json({ success: true, siteUrl: siteData.ssl_url || siteData.url });
    } catch (error) {
        console.error("Deploy Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
