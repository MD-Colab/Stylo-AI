// api/portfolio.js — Fuma Technologies Portfolio Engine v3
// Vercel Serverless Function | Full HD Cloudinary + Custom Elements + Scroll Animations

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore }                 = require('firebase-admin/firestore');
const { marked }                       = require('marked');

// ───SECURITY ────────────────────────────────────────────────────────────────
const esc = (str) => {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

// ───HELPERS ────────────────────────────────────────────────────────────────
const parseJSON  = (str)   => { try { return JSON.parse(str || '[]'); } catch { return []; } };
const safeMd     = (str)   => str ? marked.parse(str) : '';
const stars      = (n)     => '★'.repeat(Math.min(5, +n || 0)) + '☆'.repeat(5 - Math.min(5, +n || 0));
const initials   = (name)  => { const p = (name || '?').split(' '); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase(); };
const ago        = (ms)    => { const s = Math.floor((Date.now() - ms) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s/60)}m ago` : s < 86400 ? `${Math.floor(s/3600)}h ago` : `${Math.floor(s/86400)}d ago`; };

// ───CLOUDINARY TRANSFORM ───────────────────────────────────────────────────
// Ensures images are served in best quality from Cloudinary URLs
const cldTransform = (url, opts = '') => {
    if (!url || !url.includes('cloudinary.com')) return url;
    return url.replace('/upload/', `/upload/${opts || 'q_auto:best,f_auto'}/`);
};

// ───FIREBASE INIT ──────────────────────────────────────────────────────────
function getDb() {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    if (getApps().length === 0) initializeApp({ credential: cert(sa) });
    return getFirestore();
}

// ───HANDLER ────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    let db;
    try { db = getDb(); } catch (e) { return res.status(500).send(errorPage('Server Error', 'Misconfigured server.')); }

    const { username } = req.query;
    if (!username) return res.status(400).send(errorPage('No Username', 'Provide a username in the URL.'));

    try {
        const snap = await db.collection('users').where('username', '==', username).limit(1).get();
        if (snap.empty)           return res.status(404).send(errorPage('Not Found', `No profile for <strong>@${esc(username)}</strong>.`));
        const user = snap.docs[0].data();
        if (user.isPublic !== true) return res.status(403).send(errorPage('Private Profile', 'This profile is private.'));
        return res.status(200).send(generatePage(user));
    } catch (e) {
        console.error('[portfolio]', e);
        return res.status(500).send(errorPage('Server Error', 'Something went wrong. Please try again.'));
    }
};

// ───ERROR PAGE ────────────────────────────────────────────────────────────────
function errorPage(title, msg) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title} — Fuma Technologies</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>*{box-sizing:border-box;margin:0;padding:0}body{background:#07070a;color:#f0f0f5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}.err{max-width:440px}.err h1{font-size:3rem;color:#FF6F00;margin-bottom:1rem}.err h2{font-size:1.4rem;margin-bottom:.75rem}.err p{color:#777;line-height:1.6}.back{display:inline-block;margin-top:2rem;padding:10px 24px;background:#FF6F00;color:white;border-radius:8px;text-decoration:none;font-weight:700}</style>
    </head><body><div class="err"><h1>⚠</h1><h2>${title}</h2><p>${msg}</p><a href="https://fumatechnologies.vercel.app" class="back">Go to Fuma Technologies</a></div></body></html>`;
}

// ───SEO ────────────────────────────────────────────────────────────────────────
function buildSEO(user) {
    const name     = esc(`${user.firstName || ''} ${user.lastName || ''}`.trim());
    const headline = esc(user.portfolioHeadline || 'Professional Portfolio');
    const bio      = esc((user.bio || '').substring(0, 160));
    const img      = user.profilePhotoBase64 || 'https://fumatechnologies.vercel.app/assets/logo/fumatechnologies-logo.png';
    const url      = `https://fumatechnologies.vercel.app/@${esc(user.username || '')}`;
    const role     = esc(user.role || 'Professional');
    const ldJson   = JSON.stringify({ "@context":"https://schema.org","@type":"Person", name, url, image: img, jobTitle: role, description: bio });

    return `<title>${name} | ${role} — Fuma Technologies</title>
        <meta name="description" content="${bio}">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <meta property="og:type" content="profile">
        <meta property="og:url" content="${url}">
        <meta property="og:title" content="${name} — ${headline}">
        <meta property="og:description" content="${bio}">
        <meta property="og:image" content="${img}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${name} — ${headline}">
        <meta name="twitter:description" content="${bio}">
        <meta name="twitter:image" content="${img}">
        <link rel="canonical" href="${url}">
        <script type="application/ld+json">${ldJson}<\/script>`;
}

// ──────── SOCIAL LINKS ────                                              
function buildSocialLinks(user) {
    const platforms = [
        { key:'pf_github',    icon:'fab fa-github',      name:'GitHub'     },
        { key:'pf_linkedin',  icon:'fab fa-linkedin-in',  name:'LinkedIn'   },
        { key:'pf_twitter',   icon:'fab fa-twitter',      name:'Twitter/X'  },
        { key:'pf_instagram', icon:'fab fa-instagram',    name:'Instagram'  },
        { key:'pf_youtube',   icon:'fab fa-youtube',      name:'YouTube'    },
        { key:'pf_facebook',  icon:'fab fa-facebook-f',   name:'Facebook'   },
        { key:'pf_dribbble',  icon:'fab fa-dribbble',     name:'Dribbble'   },
        { key:'pf_behance',   icon:'fab fa-behance',      name:'Behance'    },
    ];
    const links = platforms.filter(p => user[p.key])
        .map(p => `<a href="${esc(user[p.key])}" target="_blank" rel="noopener" class="soc-link" title="${p.name}" aria-label="${p.name}"><i class="${p.icon}"></i></a>`);
    if (user.pf_customLinks?.length) {
        user.pf_customLinks.forEach(l => {
            if (l.url && l.label) links.push(`<a href="${esc(l.url)}" target="_blank" rel="noopener" class="soc-link" title="${esc(l.label)}"><i class="fas fa-link"></i></a>`);
        });
    }
    if (user.email) links.push(`<a href="mailto:${esc(user.email)}" class="soc-link" title="Email" aria-label="Email"><i class="fas fa-envelope"></i></a>`);
    return links.join('');
}

// ── AVAILABILITY BADGE ────
function availabilityBadge(user) {
    if (!user.talentHub?.enabled) return '';
    const map = { open: ['ðŸŸ¢','Open to Work','#22c55e'], 'collaboration-only':['ðŸ”µ','Collaboration Only','#3b82f6'], busy:['ðŸ”´','Not Available','#ef4444'] };
    const [emoji, label, color] = map[user.talentHub?.availability] || map.open;
    return `<span class="avail-badge" style="--avail:${color};">${emoji} ${label}</span>`;
}

// ── CARD / SECTION WRAPPERS ─────────────────────────────────────────────────────────────────────
const card  = (body, extra = '') => `<div class="card scroll-reveal" ${extra}>${body}</div>`;
const h2tag = (icon, title)      => `<h2><i class="${icon}"></i> ${title}</h2>`;

// ── SKILL CLOUD ────────────────────────────────────────────────────────────────
function skillCloud(str, color = '') {
    if (!str) return '';
    return `<div class="skill-cloud">${str.split(',').map(s => s.trim()).filter(Boolean)
        .map((s, i) => `<span class="skill-pill" style="animation-delay:${i * 0.04}s">${esc(s)}</span>`).join('')}</div>`;
}

// ── EXPERIENCE TIMELINE ────────────────────────────────────────────────────────
function timeline(items) {
    if (!items.length) return '';
    return `<div class="timeline">${items.map(e => `
        <div class="tl-item scroll-reveal">
            <div class="tl-dot"></div>
            <div class="tl-body">
                ${e.logo ? `<img src="${cldTransform(esc(e.logo),'w_48,h_48,c_fill,q_auto')}" class="tl-logo" alt="">` : ''}
                <h4>${esc(e.role || '')}</h4>
                <span class="tl-meta">${esc(e.company || '')}${e.year ? ' Â· ' + esc(e.year) : ''}</span>
                ${e.desc ? `<p>${esc(e.desc)}</p>` : ''}
            </div>
        </div>`).join('')}</div>`;
}

// ── PROJECT CARDS ────────────────────────────────────────────────────────────────
function projectCards(items) {
    if (!items.length) return '';
    return `<div class="proj-grid">${items.map((p, i) => `
        <div class="proj-card scroll-reveal" style="animation-delay:${i * 0.08}s">
            ${p.img ? `<div class="proj-img" style="background-image:url('${cldTransform(esc(p.img),'w_800,h_400,c_fill,q_auto:best,f_auto')}')"></div>` : ''}
            <div class="proj-body">
                <div class="proj-header">
                    <h3>${esc(p.name || '')}</h3>
                    ${p.tech ? `<span class="proj-tech">${esc(p.tech)}</span>` : ''}
                </div>
                ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
                <div class="proj-footer">
                    ${p.link   ? `<a href="${esc(p.link)}"   target="_blank" rel="noopener" class="proj-link"><i class="fas fa-external-link-alt"></i> Live</a>` : ''}
                    ${p.github ? `<a href="${esc(p.github)}" target="_blank" rel="noopener" class="proj-link ghost"><i class="fab fa-github"></i> GitHub</a>` : ''}
                </div>
            </div>
        </div>`).join('')}</div>`;
}

// ─── GALLERY GRID ────────────────────────────────────────────────────────────────
function galleryGrid(items) {
    // items can be objects {url,title,desc} or plain strings
    const normalized = items.map(i => typeof i === 'string' ? { url: i } : i).filter(i => i.url || i.img);
    if (!normalized.length) return '';
    return `<div class="gallery-grid">${normalized.map((item, idx) => {
        const imgUrl = cldTransform(esc(item.url || item.img || ''), 'w_1200,q_auto:best,f_auto');
        return `<div class="gallery-item scroll-reveal" style="animation-delay:${idx * 0.06}s" onclick="openLightbox('${imgUrl}', '${esc(item.title || '')}')">
            <img src="${cldTransform(esc(item.url || item.img || ''), 'w_600,h_400,c_fill,q_auto,f_auto')}" alt="${esc(item.title || 'Gallery image')}" loading="lazy">
            <div class="gal-overlay">
                ${item.title ? `<p>${esc(item.title)}</p>` : ''}
                <i class="fas fa-expand-alt"></i>
            </div>
        </div>`;
    }).join('')}</div>`;
}

// ─── PRODUCT CARDS ────────────────────────────────────────────────────────────────
function productCards(items) {
    if (!items.length) return '';
    return `<div class="product-grid">${items.map((p, i) => `
        <div class="product-card scroll-reveal" style="animation-delay:${i * 0.07}s">
            ${p.img ? `<div class="product-img"><img src="${cldTransform(esc(p.img),'w_600,h_360,c_fill,q_auto:best,f_auto')}" alt="${esc(p.name || '')}" loading="lazy"></div>`
                    : `<div class="product-img-ph"><i class="fas fa-box-open"></i></div>`}
            <div class="product-body">
                <h4>${esc(p.name || '')}</h4>
                ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
                ${p.price ? `<span class="product-price">${esc(p.price)}</span>` : ''}
                ${p.link  ? `<a href="${esc(p.link)}" target="_blank" rel="noopener" class="proj-link" style="margin-top:12px;display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-shopping-cart"></i> View / Buy</a>` : ''}
            </div>
        </div>`).join('')}</div>`;
}

// ─── TESTIMONIAL CARDS ────────────────────────────────────────────────────────
function testimonialCards(items) {
    if (!items.length) return '';
    return `<div class="testimonial-grid">${items.map((t, i) => `
        <div class="testimonial-card scroll-reveal" style="animation-delay:${i * 0.08}s">
            <i class="fas fa-quote-left t-quote-icon"></i>
            ${t.rating ? `<div class="t-stars">${stars(t.rating)}</div>` : ''}
            <p class="t-text">"${esc(t.quote || '')}"</p>
            <div class="t-meta">
                ${t.avatar
                    ? `<img src="${cldTransform(esc(t.avatar),'w_80,h_80,c_fill,q_auto,r_max')}" class="t-avatar-img" alt="${esc(t.author || '')}">`
                    : `<div class="t-avatar">${initials(t.author || '')}</div>`}
                <div class="t-info">
                    <strong>${esc(t.author || 'Anonymous')}</strong>
                    <span>${esc(t.role || '')}</span>
                </div>
            </div>
        </div>`).join('')}</div>`;
}

// ─── CUSTOM ELEMENTS RENDERER ────────────────────────────────────────────────────────
function renderCustomElements(elements) {
    if (!elements?.length) return '';

    const renderers = {
        el_showcase: (el) => card(`
            ${h2tag('fas fa-star', esc(el.title || 'Showcase'))}
            ${el.img ? `<div class="showcase-img scroll-reveal"><img src="${cldTransform(esc(el.img),'w_1400,q_auto:best,f_auto')}" alt="${esc(el.title||'')}"></div>` : ''}
            ${el.subtitle ? `<p class="showcase-sub">${esc(el.subtitle)}</p>` : ''}
            ${el.desc ? `<p class="showcase-desc">${esc(el.desc)}</p>` : ''}
            ${el.link ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="cta-btn" style="display:inline-flex;margin-top:1rem;"><i class="fas fa-arrow-right"></i> ${esc(el.linkText || 'View More')}</a>` : ''}`),

        el_project: (el) => card(`
            ${el.img ? `<div class="proj-img scroll-reveal" style="background-image:url('${cldTransform(esc(el.img),'w_900,h_450,c_fill,q_auto:best,f_auto')}')"></div>` : ''}
            <div class="proj-body">
                <div class="proj-header">
                    <h3>${esc(el.name || 'Project')}</h3>
                    ${el.tech ? `<span class="proj-tech">${esc(el.tech)}</span>` : ''}
                </div>
                ${el.desc ? `<p>${esc(el.desc)}</p>` : ''}
                <div class="proj-footer">
                    ${el.link   ? `<a href="${esc(el.link)}"   target="_blank" rel="noopener" class="proj-link"><i class="fas fa-external-link-alt"></i> Live</a>` : ''}
                    ${el.github ? `<a href="${esc(el.github)}" target="_blank" rel="noopener" class="proj-link ghost"><i class="fab fa-github"></i> GitHub</a>` : ''}
                </div>
            </div>`),

        el_gallery_item: (el) => card(`
            ${h2tag('fas fa-image', esc(el.title || 'Gallery'))}
            ${el.img ? `<div class="gallery-item solo scroll-reveal" onclick="openLightbox('${cldTransform(esc(el.img),'w_1400,q_auto:best,f_auto')}','${esc(el.title||'')}')">
                <img src="${cldTransform(esc(el.img),'w_900,q_auto:best,f_auto')}" alt="${esc(el.title||'')}" loading="lazy">
                <div class="gal-overlay"><i class="fas fa-expand-alt"></i></div>
            </div>` : ''}
            ${el.desc ? `<p style="margin-top:1rem;color:var(--muted);">${esc(el.desc)}</p>` : ''}`),

        el_experience: (el) => card(`
            ${h2tag('fas fa-briefcase', esc(el.role || 'Experience'))}
            <div class="tl-item" style="padding-left:0;">
                <div class="tl-body">
                    ${el.logo ? `<img src="${cldTransform(esc(el.logo),'w_60,h_60,c_fill,q_auto,r_max')}" class="tl-logo" alt="">` : ''}
                    <h4>${esc(el.role || '')}</h4>
                    <span class="tl-meta">${esc(el.company || '')}${el.year ? ' Â· '+esc(el.year) : ''}</span>
                    ${el.desc ? `<p>${esc(el.desc)}</p>` : ''}
                </div>
            </div>`),

        el_testimonial: (el) => card(`
            ${h2tag('fas fa-quote-left', 'Testimonial')}
            ${testimonialCards([el])}`),

        el_award: (el) => card(`
            ${h2tag('fas fa-trophy', esc(el.title || 'Award'))}
            <div class="award-card scroll-reveal">
                ${el.img ? `<img src="${cldTransform(esc(el.img),'w_400,q_auto:best,f_auto')}" class="award-img" alt="Certificate">` : ''}
                <div class="award-body">
                    <h4>${esc(el.title||'')}</h4>
                    ${el.org  ? `<span class="tl-meta">${esc(el.org)}${el.year ? ' Â· '+esc(el.year) : ''}</span>` : ''}
                    ${el.desc ? `<p>${esc(el.desc)}</p>` : ''}
                </div>
            </div>`),

        el_publication: (el) => card(`
            ${h2tag('fas fa-newspaper', esc(el.title || 'Publication'))}
            <div class="pub-card scroll-reveal">
                ${el.cover ? `<img src="${cldTransform(esc(el.cover),'w_200,q_auto:best,f_auto')}" class="pub-cover" alt="Cover">` : ''}
                <div>
                    <h4>${esc(el.title||'')}</h4>
                    ${el.publisher ? `<span class="tl-meta">${esc(el.publisher)}${el.date ? ' Â· '+esc(el.date) : ''}</span>` : ''}
                    ${el.desc ? `<p>${esc(el.desc)}</p>` : ''}
                    ${el.link ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="proj-link" style="margin-top:8px;"><i class="fas fa-book-open"></i> Read</a>` : ''}
                </div>
            </div>`),

        el_product: (el) => card(`
            ${h2tag('fas fa-box-open', esc(el.name || 'Product'))}
            ${productCards([el])}`),

        el_video: (el) => card(`
            ${h2tag('fas fa-play-circle', esc(el.title || 'Video'))}
            ${el.embedUrl ? `<div class="video-wrap scroll-reveal"><iframe src="${esc(el.embedUrl)}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" title="${esc(el.title||'Video')}"></iframe></div>` : ''}
            ${el.desc ? `<p style="margin-top:1rem;color:var(--muted);">${esc(el.desc)}</p>` : ''}`),

        el_skill_set: (el) => card(`
            ${h2tag('fas fa-sliders-h', esc(el.category || 'Skills'))}
            <div class="skill-bar-wrap scroll-reveal">
                <div class="skill-bar-label"><span>${esc(el.name||'')}</span><span>${esc(el.level||'0')}%</span></div>
                <div class="skill-bar-track"><div class="skill-bar-fill" style="--w:${Math.min(100,+el.level||0)}%"></div></div>
            </div>`),

        el_service: (el) => card(`
            ${h2tag(el.icon || 'fas fa-concierge-bell', esc(el.name || 'Service'))}
            ${el.desc ? `<p>${esc(el.desc)}</p>` : ''}
            ${el.price ? `<span class="product-price">${esc(el.price)}</span>` : ''}
            ${el.link  ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="cta-btn" style="display:inline-flex;margin-top:1rem;">Get Started</a>` : ''}`),

        el_case_study: (el) => card(`
            ${h2tag('fas fa-search-plus', esc(el.title || 'Case Study'))}
            ${el.img ? `<div class="showcase-img scroll-reveal"><img src="${cldTransform(esc(el.img),'w_1200,q_auto:best,f_auto')}" alt="Case Study"></div>` : ''}
            ${el.client   ? `<span class="tl-meta" style="display:block;margin:1rem 0 .5rem;">Client: ${esc(el.client)}</span>` : ''}
            ${el.problem  ? `<div class="cs-block"><h4>Problem</h4><p>${esc(el.problem)}</p></div>`  : ''}
            ${el.solution ? `<div class="cs-block"><h4>Solution</h4><p>${esc(el.solution)}</p></div>` : ''}
            ${el.result   ? `<div class="cs-block success"><h4>Result</h4><p>${esc(el.result)}</p></div>` : ''}
            ${el.link     ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="proj-link" style="margin-top:1rem;"><i class="fas fa-external-link-alt"></i> Full Case Study</a>` : ''}`),

        el_education: (el) => card(`
            ${h2tag('fas fa-graduation-cap', esc(el.degree || 'Education'))}
            <div class="tl-body">
                ${el.logo ? `<img src="${cldTransform(esc(el.logo),'w_60,h_60,c_fill,q_auto,r_max')}" class="tl-logo" alt="">` : ''}
                <h4>${esc(el.degree||'')}</h4>
                <span class="tl-meta">${esc(el.institution||'')}${el.year ? ' Â· '+esc(el.year) : ''}</span>
                ${el.desc ? `<p>${esc(el.desc)}</p>` : ''}
            </div>`),

        el_stat: (el) => card(`
            <div class="stat-block scroll-reveal">
                ${el.icon ? `<i class="${esc(el.icon)}" style="font-size:2rem;color:var(--primary);margin-bottom:.5rem;"></i>` : ''}
                <div class="stat-number">${esc(el.value||'0')}</div>
                <div class="stat-label">${esc(el.label||'')}</div>
            </div>`),

        el_certification: (el) => card(`
            ${h2tag('fas fa-certificate', esc(el.name || 'Certification'))}
            <div class="award-card scroll-reveal">
                ${el.img ? `<img src="${cldTransform(esc(el.img),'w_300,q_auto:best,f_auto')}" class="award-img" alt="Certificate">` : ''}
                <div class="award-body">
                    <h4>${esc(el.name||'')}</h4>
                    ${el.issuer ? `<span class="tl-meta">${esc(el.issuer)}${el.date ? ' Â· '+esc(el.date) : ''}</span>` : ''}
                    ${el.id   ? `<small style="color:var(--muted);">ID: ${esc(el.id)}</small>` : ''}
                    ${el.link ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="proj-link" style="display:block;margin-top:8px;"><i class="fas fa-external-link-alt"></i> Verify</a>` : ''}
                </div>
            </div>`),

        el_press: (el) => card(`
            ${h2tag('fas fa-newspaper', 'Press')}
            <div class="press-card scroll-reveal">
                ${el.logo ? `<img src="${cldTransform(esc(el.logo),'w_120,h_60,c_fit,q_auto')}" class="press-logo" alt="${esc(el.outlet||'')}">` : ''}
                <div>
                    <h4>${esc(el.title||'')}</h4>
                    <span class="tl-meta">${esc(el.outlet||'')}${el.date ? ' Â· '+esc(el.date) : ''}</span>
                    ${el.link ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="proj-link" style="display:block;margin-top:8px;"><i class="fas fa-external-link-alt"></i> Read Article</a>` : ''}
                </div>
            </div>`),

        el_podcast: (el) => card(`
            ${h2tag('fas fa-microphone', esc(el.title || 'Podcast'))}
            <div class="press-card scroll-reveal">
                ${el.thumb ? `<img src="${cldTransform(esc(el.thumb),'w_120,h_120,c_fill,q_auto')}" class="podcast-thumb" alt="">` : '<div class="podcast-thumb-ph"><i class="fas fa-microphone"></i></div>'}
                <div>
                    <h4>${esc(el.title||'')}</h4>
                    ${el.show ? `<span class="tl-meta">${esc(el.show)}${el.date ? ' Â· '+esc(el.date) : ''}</span>` : ''}
                    ${el.link ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="proj-link" style="display:block;margin-top:8px;"><i class="fas fa-headphones"></i> Listen</a>` : ''}
                </div>
            </div>`),

        el_collaboration: (el) => card(`
            ${h2tag('fas fa-handshake', esc(el.name || 'Collaboration'))}
            <div class="press-card scroll-reveal">
                ${el.logo ? `<img src="${cldTransform(esc(el.logo),'w_120,h_80,c_fit,q_auto:best,f_auto')}" class="press-logo" alt="${esc(el.name||'')}">` : ''}
                <div>
                    ${el.role ? `<span class="tl-meta" style="display:block;margin-bottom:.5rem;">${esc(el.role)}</span>` : ''}
                    ${el.desc ? `<p>${esc(el.desc)}</p>` : ''}
                    ${el.link ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="proj-link" style="display:block;margin-top:8px;"><i class="fas fa-globe"></i> Website</a>` : ''}
                </div>
            </div>`),

        el_before_after: (el) => card(`
            ${h2tag('fas fa-columns', esc(el.title || 'Before / After'))}
            <div class="ba-grid scroll-reveal">
                ${el.before ? `<div class="ba-item"><span class="ba-label">Before</span><img src="${cldTransform(esc(el.before),'w_800,q_auto:best,f_auto')}" alt="Before" onclick="openLightbox('${cldTransform(esc(el.before),'w_1400,q_auto:best,f_auto')}','Before')"></div>` : ''}
                ${el.after  ? `<div class="ba-item"><span class="ba-label after">After</span><img src="${cldTransform(esc(el.after),'w_800,q_auto:best,f_auto')}"  alt="After"  onclick="openLightbox('${cldTransform(esc(el.after),'w_1400,q_auto:best,f_auto')}','After')"></div>`  : ''}
            </div>
            ${el.desc ? `<p style="margin-top:1rem;color:var(--muted);">${esc(el.desc)}</p>` : ''}`),

        el_faq: (el) => card(`
            ${h2tag('fas fa-question-circle', 'FAQ')}
            <details class="faq-item scroll-reveal">
                <summary>${esc(el.question||'')}</summary>
                <p>${esc(el.answer||'')}</p>
            </details>`),

        el_quote: (el) => card(`
            <blockquote class="personal-quote scroll-reveal">
                <i class="fas fa-quote-left"></i>
                <p>${esc(el.quote||'')}</p>
                ${el.author ? `<cite>— ${esc(el.author)}</cite>` : ''}
            </blockquote>`),

        el_timeline: (el) => card(`
            ${h2tag(el.icon || 'fas fa-history', esc(el.title || 'Milestone'))}
            <div class="tl-item scroll-reveal">
                <div class="tl-dot"></div>
                <div class="tl-body">
                    <span class="tl-meta">${esc(el.date||'')}</span>
                    <h4>${esc(el.title||'')}</h4>
                    ${el.desc ? `<p>${esc(el.desc)}</p>` : ''}
                </div>
            </div>`),

        el_social_metric: (el) => card(`
            <div class="stat-block scroll-reveal">
                ${el.icon ? `<i class="${esc(el.icon)}" style="font-size:2rem;color:var(--primary);margin-bottom:.5rem;"></i>` : '<i class="fas fa-chart-line" style="font-size:2rem;color:var(--primary);margin-bottom:.5rem;"></i>'}
                <div class="stat-number">${esc(el.metric||'')}</div>
                <div class="stat-label">${esc(el.platform||'')}</div>
                ${el.link ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="proj-link" style="margin-top:.75rem;"><i class="fas fa-external-link-alt"></i> Follow</a>` : ''}
            </div>`),

        el_open_source: (el) => card(`
            ${h2tag('fab fa-github', esc(el.name || 'Open Source'))}
            ${el.img ? `<div class="proj-img scroll-reveal" style="background-image:url('${cldTransform(esc(el.img),'w_900,h_400,c_fill,q_auto:best,f_auto')}')"></div>` : ''}
            <div class="proj-body">
                ${el.desc  ? `<p>${esc(el.desc)}</p>`  : ''}
                ${el.stars ? `<span class="proj-tech">â­ ${esc(el.stars)} Stars</span>` : ''}
                ${el.link  ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="proj-link" style="margin-top:10px;"><i class="fab fa-github"></i> View on GitHub</a>` : ''}
            </div>`),

        el_speaking: (el) => card(`
            ${h2tag('fas fa-microphone-alt', esc(el.event || 'Speaking'))}
            <div class="press-card scroll-reveal">
                ${el.img ? `<img src="${cldTransform(esc(el.img),'w_140,h_140,c_fill,q_auto')}" class="podcast-thumb" alt="">` : ''}
                <div>
                    <h4>${esc(el.topic||'')}</h4>
                    <span class="tl-meta">${esc(el.event||'')}${el.location ? ' Â· '+esc(el.location) : ''}${el.date ? ' Â· '+esc(el.date) : ''}</span>
                    ${el.link ? `<a href="${esc(el.link)}" target="_blank" rel="noopener" class="proj-link" style="display:block;margin-top:8px;"><i class="fas fa-play-circle"></i> Watch / Slides</a>` : ''}
                </div>
            </div>`)
    };

    return elements
        .filter(el => el._type && renderers[el._type])
        .map(el => renderers[el._type](el))
        .join('\n');
}

// ── PROFESSION-SPECIFIC CONTENT ────────────────────────────────────────────────
function generateTypeContent(user) {
    const type = user.portfolioType || 'general';
    let html   = '';

    // Developer
    if (type === 'developer' || type === 'freelancer') {
        if (user.pf_techStack) html += card(`${h2tag('fas fa-terminal','Tech Stack')}${skillCloud(user.pf_techStack)}`);
        const exp  = parseJSON(user.pf_experience);
        const proj = parseJSON(user.pf_projects);
        if (exp.length)  html += card(`${h2tag('fas fa-briefcase','Experience')}${timeline(exp)}`);
        if (proj.length) html += `<div id="work">${card(`${h2tag('fas fa-laptop-code','Featured Projects')}${projectCards(proj)}`)}</div>`;
    }
    // Designer / Artist
    else if (['designer','3d_artist','artist'].includes(type)) {
        const tools   = user.pf_tools || user.pf_techStack || '';
        const gallRaw = parseJSON(user.pf_gallery).length ? parseJSON(user.pf_gallery) : (user.pf_gallery || '').split(',').map(s => s.trim()).filter(Boolean);
        const exp     = parseJSON(user.pf_experience);
        if (tools)      html += card(`${h2tag('fas fa-pen-nib','Toolkit')}${skillCloud(tools)}`);
        if (exp.length) html += card(`${h2tag('fas fa-briefcase','Experience')}${timeline(exp)}`);
        if (gallRaw.length) html += `<div id="work">${card(`${h2tag('fas fa-images','Gallery')}${galleryGrid(gallRaw)}`)}</div>`;
    }
    // Writer
    else if (type === 'writer') {
        const genre = user.pf_genre || user.pf_techStack || '';
        const works = parseJSON(user.pf_projects);
        if (genre)      html += card(`${h2tag('fas fa-feather-alt','Genres & Style')}${skillCloud(genre)}`);
        if (works.length) html += `<div id="work">${card(`${h2tag('fas fa-book','Published Works')}${projectCards(works)}`)}</div>`;
    }
    // General / Other / Entrepreneur / etc.
    else {
        const skills   = user.pf_techStack || user.pf_tools || '';
        const attrs    = parseJSON(user.pf_custom_attributes);
        const products = parseJSON(user.pf_products);
        const customTitle = esc(user.pf_custom_title || 'Professional Details');
        const extLink  = user.pf_portfolio_url ? esc(user.pf_portfolio_url) : null;

        if (skills) html += card(`${h2tag('fas fa-star','Skills')}${skillCloud(skills)}`);

        if (attrs.length || extLink) {
            const attrGrid = attrs.map(a => `
                <div class="attr-card scroll-reveal">
                    <div class="attr-label">${esc(a.label||'')}</div>
                    <div class="attr-value">${esc(a.value||'')}</div>
                </div>`).join('');
            const extBtn = extLink ? `<div style="margin-top:1.5rem;text-align:center;"><a href="${extLink}" target="_blank" rel="noopener" class="cta-btn"><i class="fas fa-external-link-alt"></i> Visit Site</a></div>` : '';
            html += card(`${h2tag('fas fa-id-card-alt', customTitle)}<div class="attr-grid">${attrGrid}</div>${extBtn}`);
        }
        if (products.length) html += `<div id="work">${card(`${h2tag('fas fa-box-open','Products & Services')}${productCards(products)}`)}</div>`;
    }

    // Common: products (if not already rendered)
    if (!['general','other','entrepreneur','freelancer','worker'].includes(type)) {
        const products = parseJSON(user.pf_products);
        if (products.length) html += `<div id="products">${card(`${h2tag('fas fa-box-open','Products & Services')}${productCards(products)}`)}</div>`;
    }

    // Common: testimonials
    const testimonials = parseJSON(user.pf_testimonials);
    if (testimonials.length) {
        html += `<div id="testimonials">${card(`${h2tag('fas fa-comment-dots','Testimonials')}<p style="color:var(--muted);margin-bottom:1.5rem;">What others say about working with me.</p>${testimonialCards(testimonials)}`)}</div>`;
    }

    // Custom Elements (from Add Element builder)
    const customElements = user.pf_elements || [];
    if (customElements.length) {
        html += `<div id="custom-elements">${renderCustomElements(customElements)}</div>`;
    }

    return html;
}

// ── SIDEBAR ────────────────────────────────────────────────────────────────────
function buildSidebar(user) {
    const rows = [];
    if (user.role)    rows.push(['Role',     esc(user.role)]);
    if (user.address) rows.push(['Location', `<i class="fas fa-map-marker-alt" style="color:var(--primary)"></i> ${esc(user.address)}`]);
    if (user.pf_website) rows.push(['Website', `<a href="${esc(user.pf_website)}" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none;">${esc(user.pf_website.replace(/https?:\/\//,''))}</a>`]);
    const th = user.talentHub || {};
    if (th.enabled) {
        const statusMap = { open:'ðŸŸ¢ Open to Work', 'collaboration-only':'ðŸ”µ Collaboration Only', busy:'ðŸ”´ Not Available' };
        rows.push(['Status', `<span style="color:${th.availability === 'busy' ? '#ef4444' : th.availability === 'collaboration-only' ? '#3b82f6' : '#22c55e'};font-weight:600;">${statusMap[th.availability] || 'ðŸŸ¢ Open to Work'}</span>`]);
        if (th.experienceLevel) {
            const expMap = { junior:'Junior (1-2 yrs)', mid:'Mid-Level (3-5 yrs)', senior:'Senior (5+ yrs)', expert:'Expert / Lead' };
            rows.push(['Experience', expMap[th.experienceLevel] || th.experienceLevel]);
        }
        if (th.hourlyRate) rows.push(['Rate', `$${esc(String(th.hourlyRate))} USD/hr`]);
    }

    const tbl = rows.map(([k,v]) => `<tr><td class="qi-k">${k}</td><td class="qi-v">${v}</td></tr>`).join('');
    const skillTags = (user.skills||[]).map(s=>`<span class="skill-pill sm">${esc(s)}</span>`).join('');
    const socials   = buildSocialLinks(user);

    return `<aside class="sidebar">
        <div class="card scroll-reveal">
            ${h2tag('fas fa-bolt','Quick Info')}
            <table class="qi-table">${tbl}</table>
        </div>
        ${skillTags ? `<div class="card scroll-reveal">${h2tag('fas fa-tag','Skills')}<div class="skill-cloud">${skillTags}</div></div>` : ''}
        <div id="contact" class="card contact-card scroll-reveal">
            ${h2tag('fas fa-paper-plane','Get in Touch')}
            <p>Open for collaborations, projects &amp; opportunities.</p>
            ${user.email ? `<a href="mailto:${esc(user.email)}" class="cta-btn full"><i class="fas fa-envelope"></i> Send Email</a>` : ''}
            ${th.enabled ? `<a href="https://fumatechnologies.vercel.app/TalentHub/index.html" class="cta-btn-ghost full" style="margin-top:10px;"><i class="fas fa-id-badge"></i> View on Talent Hub</a>` : ''}
            ${socials ? `<div class="contact-socials">${socials}</div>` : ''}
        </div>
    </aside>`;
}

// ── NAVBAR ────────────────────────────────────────────────────────────────────────
function buildNav(user, socials) {
    const name    = esc(`${user.firstName||''} ${user.lastName||''}`.trim());
    const avatar  = user.profilePhotoBase64 || 'https://fumatechnologies.vercel.app/assets/logo/fumatechnologies-logo.png';
    const hasTestimonials = parseJSON(user.pf_testimonials).length > 0;
    return `
        <nav class="pnav" id="pnav">
            <a class="pnav-brand" href="#top">
                <img src="${esc(avatar)}" alt="${name}" class="pnav-avatar">
                <span>${name}</span>
            </a>
            <div class="pnav-links" id="pnav-links">
                <a href="#top">Home</a>
                <a href="#work">Work</a>
                ${hasTestimonials ? '<a href="#testimonials">Reviews</a>' : ''}
                <a href="#contact">Contact</a>
            </div>
            <div class="pnav-right">
                <div class="pnav-soc">${socials}</div>
                <button class="pnav-burger" id="pnav-burger" aria-label="Menu" aria-expanded="false">
                    <span></span><span></span><span></span>
                </button>
            </div>
        </nav>
        <div class="pnav-drawer" id="pnav-drawer" aria-hidden="true">
            <a href="#top">Home</a>
            <a href="#work">Work</a>
            ${hasTestimonials ? '<a href="#testimonials">Reviews</a>' : ''}
            <a href="#contact">Contact</a>
        </div>`;
}

// ── MAIN PAGE GENERATOR ────────────────────────────────────────────────────────
function generatePage(user) {
    const seo       = buildSEO(user);
    const socials   = buildSocialLinks(user);
    const primary   = esc(user.primaryColor    || '#FF6F00');
    const bg        = esc(user.backgroundColor || '#070709');
    const fullName  = esc(`${user.firstName||''} ${user.lastName||''}`.trim());
    const avatar    = esc(user.profilePhotoBase64 || 'https://via.placeholder.com/150');
    const headline  = esc(user.portfolioHeadline || '');
    const verified  = user.isVerified
        ? `<span class="verified-badge" title="Verified"><img src="https://res.cloudinary.com/dyff2bufp/image/upload/w_200,c_fill/v1767689867/dbnhg3k0bq0dhledhkf4.png" alt="âœ“"></span>` : '';
    const about     = safeMd(user.portfolioAbout) || '<p style="color:#666;">No information provided.</p>';
    const content   = generateTypeContent(user);
    const sidebar   = buildSidebar(user);
    const nav       = buildNav(user, socials);

    let displayRole = user.portfolioType || 'Creator';
    if (displayRole === 'other' && user.customProfession) displayRole = esc(user.customProfession);
    else displayRole = displayRole.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    ${seo}
    <link rel="icon" href="${avatar}">
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
/* ── ROOT ──────────────────────────────────────────────────────────────────────── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
    --bg:${bg};--surface:rgba(20,20,26,.75);--border:rgba(255,255,255,.07);
    --primary:${primary};--primary-dim:color-mix(in srgb,${primary} 12%,transparent);
    --text:#f0f0f5;--muted:#8a8a9a;--green:#22c55e;
    --radius:16px;--radius-sm:10px;--shadow:0 16px 48px rgba(0,0,0,.55);
    --easing:cubic-bezier(.25,.46,.45,.94);
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;overflow-x:hidden;line-height:1.6}

/* ── AMBIENT BG ──────────────────────────────────────────────────────────────────── */
.bg-mesh{position:fixed;inset:0;z-index:-1;pointer-events:none;
    background:radial-gradient(ellipse 70% 55% at 10% 35%,color-mix(in srgb,${primary} 7%,transparent),transparent),
               radial-gradient(ellipse 50% 45% at 90% 70%,rgba(100,50,220,.045),transparent)}

/* ── SCROLL REVEAL ──────────────────────────────────────────────────────────────── */
.scroll-reveal{opacity:0;transform:translateY(28px);transition:opacity .7s var(--easing),transform .7s var(--easing)}
.scroll-reveal.visible{opacity:1;transform:translateY(0)}

/* Image scroll-in from below with scale */
.proj-img.scroll-reveal{transform:translateY(20px) scale(.97)}
.proj-img.scroll-reveal.visible{transform:translateY(0) scale(1)}
.gallery-item.scroll-reveal{transform:translateY(16px) scale(.95)}
.gallery-item.scroll-reveal.visible{transform:translateY(0) scale(1)}

/* Stagger helper: JS adds .visible in sequence */
.testimonial-card.scroll-reveal{transform:translateY(20px) rotateX(4deg);transform-origin:bottom center}
.testimonial-card.scroll-reveal.visible{transform:translateY(0) rotateX(0)}

/* ─── NAV ──────────────────────────────────────────────────────────────────────── */
.pnav{position:sticky;top:0;z-index:900;display:flex;align-items:center;justify-content:space-between;
    gap:16px;padding:0 2rem;height:60px;background:rgba(7,7,9,.88);
    backdrop-filter:blur(20px);border-bottom:1px solid var(--border);transition:box-shadow .3s}
.pnav.scrolled{box-shadow:0 4px 30px rgba(0,0,0,.4)}
.pnav-brand{display:flex;align-items:center;gap:10px;font-family:'Syne',sans-serif;
    font-weight:700;font-size:1rem;text-decoration:none;color:var(--text)}
.pnav-avatar{width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid var(--primary)}
.pnav-links{display:flex;gap:4px}
.pnav-links a,.pnav-drawer a{color:var(--muted);text-decoration:none;padding:6px 12px;border-radius:8px;
    font-size:.87rem;transition:color .2s,background .2s}
.pnav-links a:hover{color:var(--text);background:rgba(255,255,255,.06)}
.pnav-right{display:flex;align-items:center;gap:12px}
.pnav-soc{display:flex;gap:8px}
.pnav-soc .soc-link{color:var(--muted);font-size:.95rem;text-decoration:none;transition:color .2s}
.pnav-soc .soc-link:hover{color:var(--primary)}
.pnav-burger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:4px}
.pnav-burger span{display:block;width:22px;height:2px;background:var(--text);border-radius:2px;
    transition:transform .3s,opacity .3s}
.pnav-burger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.pnav-burger.open span:nth-child(2){opacity:0}
.pnav-burger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
.pnav-drawer{display:none;position:fixed;top:60px;left:0;right:0;background:rgba(10,10,14,.98);
    padding:1.5rem;z-index:899;flex-direction:column;gap:10px;border-bottom:1px solid var(--border)}
.pnav-drawer.open{display:flex}
.pnav-drawer a{font-size:1.05rem;padding:10px 0;border-bottom:1px solid var(--border)}
@media(max-width:720px){.pnav-links,.pnav-soc{display:none}.pnav-burger{display:flex}}

/* ─── HEADER ──────────────────────────────────────────────────────────────────── */
header{text-align:center;padding:7rem 1.5rem 5rem;position:relative;overflow:hidden}
header::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);
    width:45%;height:1px;background:linear-gradient(90deg,transparent,var(--primary),transparent)}
.hero-avatar-wrap{position:relative;display:inline-block;margin-bottom:1.75rem}
.avatar{width:155px;height:155px;border-radius:50%;object-fit:cover;
    border:3px solid var(--primary);
    box-shadow:0 0 0 10px var(--primary-dim),0 0 60px color-mix(in srgb,${primary} 18%,transparent)}
.avatar-ring{position:absolute;inset:-12px;border-radius:50%;
    border:1px dashed color-mix(in srgb,${primary} 40%,transparent);animation:spin 22s linear infinite}
.avatar-ring2{position:absolute;inset:-24px;border-radius:50%;
    border:1px dashed color-mix(in srgb,${primary} 18%,transparent);animation:spin 35s linear infinite reverse}
@keyframes spin{to{transform:rotate(360deg)}}
.role-badge{display:inline-block;background:linear-gradient(90deg,var(--primary),color-mix(in srgb,var(--primary) 70%,#f97316));
    color:#fff;padding:7px 20px;border-radius:30px;font-size:.72rem;font-weight:700;
    letter-spacing:1.5px;text-transform:uppercase;margin-bottom:1rem}
h1{font-family:'Syne',sans-serif;font-size:clamp(2rem,5vw,3.8rem);font-weight:800;
    letter-spacing:-1.5px;line-height:1.1;margin-bottom:.75rem}
.verified-badge{display:inline-flex;align-items:center;justify-content:center;
    width:1.1em;height:1.1em;vertical-align:middle;margin-left:8px;transform:translateY(-3px)}
.verified-badge img{width:26px;border-radius:50%;border:2px dotted #ff3300}
.headline{color:var(--muted);font-size:1.12rem;font-weight:300;max-width:560px;margin:0 auto 1.75rem;line-height:1.65}
.avail-badge{display:inline-flex;align-items:center;gap:7px;
    background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
    padding:6px 16px;border-radius:20px;font-size:.78rem;font-weight:600;
    color:var(--avail,var(--green));margin-bottom:.5rem}
.hero-social{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:1.5rem}

/* Social Links */
.soc-link{display:inline-flex;align-items:center;justify-content:center;
    width:40px;height:40px;border-radius:50%;font-size:1rem;
    background:rgba(255,255,255,.05);border:1px solid var(--border);
    color:var(--muted);text-decoration:none;transition:all .25s}
.soc-link:hover{background:var(--primary);border-color:var(--primary);color:#fff;transform:translateY(-3px) scale(1.08)}

/* ─── LAYOUT ──────────────────────────────────────────────────────────────────────── */
.container{max-width:1120px;margin:0 auto;padding:0 1.5rem}
.main-grid{display:grid;grid-template-columns:1fr 340px;gap:2rem;margin-top:2rem;align-items:start}
@media(max-width:960px){.main-grid{display: flex; flex-direction: column;}}

/* ─── CARDS ──────────────────────────────────────────────────────────────────────── */
.card{background:var(--surface);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    border:1px solid var(--border);padding:2rem;border-radius:var(--radius);
    margin-bottom:1.5rem;transition:border-color .3s,transform .3s,box-shadow .3s}
.card:hover{border-color:color-mix(in srgb,${primary} 30%,transparent);transform:translateY(-2px);
    box-shadow:0 12px 40px rgba(0,0,0,.25)}
h2{font-family:'Syne',sans-serif;font-size:1.05rem;font-weight:700;
    border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:1.5rem;
    display:flex;align-items:center;gap:10px;color:var(--text)}
h2 i{color:var(--primary);font-size:.95rem}

/* ─── SKILLS ──────────────────────────────────────────────────────────────────────── */
.skill-cloud{display:flex;flex-wrap:wrap;gap:8px}
.skill-pill{background:rgba(255,255,255,.05);border:1px solid var(--border);
    padding:6px 14px;border-radius:8px;font-size:.84rem;color:var(--text);
    transition:border-color .2s,color .2s,transform .2s;animation:pillIn .4s both var(--easing)}
@keyframes pillIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
.skill-pill:hover{border-color:var(--primary);color:var(--primary);transform:translateY(-2px)}
.skill-pill.sm{padding:4px 10px;font-size:.77rem}

/* Skill Bar */
.skill-bar-wrap{margin-bottom:1rem}
.skill-bar-label{display:flex;justify-content:space-between;margin-bottom:6px;font-size:.87rem;font-weight:500}
.skill-bar-track{background:rgba(255,255,255,.07);border-radius:4px;height:6px;overflow:hidden}
.skill-bar-fill{background:var(--primary);height:100%;width:0;border-radius:4px;
    transition:width 1.2s var(--easing);will-change:width}
.skill-bar-fill.animated{width:var(--w)}

/* ── TIMELINE ──────────── */
.timeline{display:flex;flex-direction:column;position:relative;padding-left:28px}
.timeline::before{content:'';position:absolute;left:8px;top:10px;bottom:10px;
    width:2px;background:linear-gradient(to bottom,var(--primary),transparent);opacity:.35;border-radius:2px}
.tl-item{display:flex;gap:18px;padding:0 0 1.5rem;position:relative}
.tl-dot{width:18px;height:18px;border-radius:50%;background:var(--bg);
    border:2px solid var(--primary);flex-shrink:0;margin-top:2px;position:relative;z-index:1;
    box-shadow:0 0 10px color-mix(in srgb,${primary} 35%,transparent);margin-left:-28px;margin-right:10px}
.tl-logo{width:36px;height:36px;border-radius:8px;object-fit:cover;
    border:1px solid var(--border);margin-bottom:6px}
.tl-body h4{font-weight:600;margin-bottom:4px;font-size:.95rem}
.tl-meta{font-size:.8rem;color:var(--primary);font-weight:500;display:block;margin-bottom:6px}
.tl-body p{color:var(--muted);font-size:.86rem;line-height:1.6}

/* ── PROJECTS ──────────────────────────────────────────────────────────────────────── */
.proj-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.1rem}
.proj-card{background:rgba(0,0,0,.28);border:1px solid var(--border);border-radius:var(--radius-sm);
    overflow:hidden;transition:border-color .25s,transform .25s,box-shadow .25s;display:flex;flex-direction:column}
.proj-card:hover{border-color:color-mix(in srgb,${primary} 45%,transparent);transform:translateY(-5px);
    box-shadow:0 16px 40px rgba(0,0,0,.3)}
.proj-img{height:200px;background-size:cover;background-position:center;transition:transform .5s var(--easing)}
.proj-card:hover .proj-img{transform:scale(1.04)}
.proj-body{padding:1.35rem;flex:1;display:flex;flex-direction:column}
.proj-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
.proj-card h3{font-size:.97rem;font-weight:700;font-family:'Syne',sans-serif}
.proj-tech{font-size:.7rem;background:var(--primary-dim);color:var(--primary);
    padding:3px 9px;border-radius:6px;font-weight:600;white-space:nowrap;flex-shrink:0}
.proj-body p{color:var(--muted);font-size:.85rem;line-height:1.55;flex:1}
.proj-footer{display:flex;gap:10px;flex-wrap:wrap;margin-top:1rem}
.proj-link{color:var(--primary);text-decoration:none;font-size:.82rem;font-weight:600;
    display:inline-flex;align-items:center;gap:5px;transition:opacity .2s}
.proj-link:hover{opacity:.7}
.proj-link.ghost{color:var(--muted)}
.proj-link.ghost:hover{color:var(--text)}

/* ── GALLERY ──────────────────────────────────────────────────────────────────────── */
.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.gallery-item{position:relative;border-radius:10px;overflow:hidden;
    aspect-ratio:4/3;cursor:pointer;border:1px solid var(--border)}
.gallery-item.solo{aspect-ratio:16/9;max-height:480px;border-radius:var(--radius-sm)}
.gallery-item img{width:100%;height:100%;object-fit:cover;transition:transform .5s var(--easing)}
.gallery-item:hover img{transform:scale(1.07)}
.gal-overlay{position:absolute;inset:0;background:rgba(0,0,0,.55);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    opacity:0;transition:opacity .3s;gap:8px;color:#fff}
.gallery-item:hover .gal-overlay{opacity:1}
.gal-overlay p{font-size:.8rem;font-weight:500;padding:0 1rem;text-align:center}
.gal-overlay i{font-size:1.4rem}

/* Lightbox */
.lightbox{display:none;position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.93);
    justify-content:center;align-items:center;flex-direction:column;padding:20px;cursor:zoom-out}
.lightbox.open{display:flex;animation:lbIn .25s var(--easing)}
@keyframes lbIn{from{opacity:0}to{opacity:1}}
.lightbox img{max-width:95vw;max-height:88vh;border-radius:8px;box-shadow:0 0 50px rgba(0,0,0,.7);cursor:default}
.lb-caption{color:rgba(255,255,255,.7);font-size:.85rem;margin-top:12px}
.lb-close{position:absolute;top:18px;right:24px;font-size:2.2rem;color:#fff;cursor:pointer;
    opacity:.65;transition:opacity .2s;background:none;border:none;line-height:1}
.lb-close:hover{opacity:1}

/* ── PRODUCT CARDS ──────────────────────────────────────────────────────────────── */
.product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.1rem}
.product-card{background:rgba(0,0,0,.28);border:1px solid var(--border);border-radius:var(--radius-sm);
    overflow:hidden;transition:border-color .25s,transform .25s}
.product-card:hover{border-color:color-mix(in srgb,${primary} 40%,transparent);transform:translateY(-4px)}
.product-img img{width:100%;height:160px;object-fit:cover;transition:transform .4s}
.product-card:hover .product-img img{transform:scale(1.05)}
.product-img-ph{height:160px;background:rgba(255,255,255,.03);display:flex;align-items:center;
    justify-content:center;font-size:2rem;color:var(--muted)}
.product-body{padding:1.1rem}
.product-body h4{font-weight:700;margin-bottom:6px;font-family:'Syne',sans-serif}
.product-body p{color:var(--muted);font-size:.84rem;line-height:1.5}
.product-price{display:inline-block;margin-top:8px;color:var(--primary);font-weight:700;font-size:1rem}

/* ── TESTIMONIALS ──────────────────────────────────────────────────────────────── */
.testimonial-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.1rem}
.testimonial-card{background:rgba(255,255,255,.03);border:1px solid var(--border);
    border-radius:14px;padding:1.75rem;display:flex;flex-direction:column;
    transition:border-color .3s,transform .3s,box-shadow .3s}
.testimonial-card:hover{border-color:color-mix(in srgb,${primary} 35%,transparent);
    transform:translateY(-5px);box-shadow:0 12px 36px rgba(0,0,0,.25)}
.t-quote-icon{font-size:1.7rem;color:var(--primary);opacity:.22;margin-bottom:.75rem}
.t-stars{color:var(--primary);font-size:.88rem;margin-bottom:8px;letter-spacing:2px}
.t-text{color:#ddd;font-size:.9rem;line-height:1.72;font-style:italic;flex:1;margin-bottom:1.25rem}
.t-meta{display:flex;align-items:center;gap:12px;border-top:1px solid rgba(255,255,255,.05);padding-top:1rem}
.t-avatar{width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;
    display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.95rem;flex-shrink:0}
.t-avatar-img{width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0}
.t-info strong{display:block;font-size:.9rem;color:#fff}
.t-info span{font-size:.78rem;color:var(--muted)}

/* ── QUICK INFO SIDEBAR ────────────────────────────────────────────────────────── */
.sidebar{position:sticky;top:76px}
.qi-table{width:100%;border-collapse:collapse}
.qi-table tr{border-bottom:1px solid rgba(255,255,255,.05)}
.qi-table tr:last-child{border-bottom:none}
.qi-k{padding:9px 0;color:var(--muted);font-size:.75rem;font-weight:600;
    text-transform:uppercase;letter-spacing:.8px;width:40%;vertical-align:top;padding-right:10px}
.qi-v{padding:9px 0;font-size:.87rem;color:var(--text);vertical-align:top}
.contact-card p{color:var(--muted);font-size:.86rem;line-height:1.6;margin-bottom:1rem}
.contact-socials{display:flex;flex-wrap:wrap;gap:8px;margin-top:1rem}
.contact-socials .soc-link{width:34px;height:34px;font-size:.88rem}

/* ── ATTR GRID (General) ────────────────────────────────────────────────────────── */
.attr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.attr-card{background:rgba(255,255,255,.04);border:1px solid var(--border);
    border-radius:10px;padding:13px;transition:border-color .2s}
.attr-card:hover{border-color:color-mix(in srgb,${primary} 35%,transparent)}
.attr-label{color:var(--primary);font-size:.7rem;font-weight:700;
    text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.attr-value{color:var(--text);font-size:.93rem;white-space:pre-wrap}

/* ── CUSTOM ELEMENTS ──────────────────────────────────────────────────────────────── */
.showcase-img{border-radius:var(--radius-sm);overflow:hidden;margin-bottom:1.25rem}
.showcase-img img{width:100%;height:auto;display:block;transition:transform .5s var(--easing)}
.showcase-img:hover img{transform:scale(1.02)}
.showcase-sub{font-size:1.05rem;font-weight:600;margin-bottom:.5rem}
.showcase-desc{color:var(--muted);line-height:1.65}

.award-card{display:flex;gap:1.25rem;align-items:flex-start}
.award-img{width:120px;flex-shrink:0;border-radius:8px;object-fit:contain;
    border:1px solid var(--border)}
.award-body h4{margin-bottom:6px}
.award-body p{color:var(--muted);font-size:.86rem;line-height:1.55}

.pub-card{display:flex;gap:1.25rem;align-items:flex-start}
.pub-cover{width:90px;flex-shrink:0;border-radius:8px;object-fit:cover;
    border:1px solid var(--border)}

.press-card{display:flex;gap:1.25rem;align-items:flex-start}
.press-logo{width:100px;height:50px;object-fit:contain;flex-shrink:0}
.press-card h4{margin-bottom:4px}
.podcast-thumb{width:100px;height:100px;object-fit:cover;border-radius:10px;flex-shrink:0}
.podcast-thumb-ph{width:100px;height:100px;background:rgba(255,255,255,.05);border-radius:10px;
    display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--muted);flex-shrink:0}

.video-wrap{position:relative;padding-top:56.25%;border-radius:var(--radius-sm);overflow:hidden;
    background:#000;border:1px solid var(--border)}
.video-wrap iframe{position:absolute;inset:0;width:100%;height:100%}

.ba-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ba-item{position:relative;border-radius:10px;overflow:hidden;cursor:zoom-in}
.ba-item img{width:100%;display:block;transition:transform .4s}
.ba-item:hover img{transform:scale(1.04)}
.ba-label{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.75);
    color:#fff;font-size:.73rem;font-weight:700;padding:3px 9px;border-radius:6px}
.ba-label.after{background:var(--primary);left:auto;right:10px}

.cs-block{background:rgba(255,255,255,.04);border-radius:8px;padding:1rem;margin-bottom:.75rem;
    border-left:3px solid var(--border)}
.cs-block.success{border-left-color:var(--green)}
.cs-block h4{margin-bottom:.5rem;font-size:.85rem;text-transform:uppercase;
    letter-spacing:.8px;color:var(--muted)}
.cs-block p{color:var(--text);font-size:.9rem;line-height:1.6}

.stat-block{text-align:center;padding:.5rem}
.stat-number{font-family:'Syne',sans-serif;font-size:2.8rem;font-weight:800;
    color:var(--primary);line-height:1;margin-bottom:.35rem}
.stat-label{color:var(--muted);font-size:.88rem;font-weight:500}

.faq-item{border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:.5rem}
.faq-item summary{padding:1rem 1.25rem;cursor:pointer;font-weight:600;
    list-style:none;display:flex;justify-content:space-between;align-items:center;
    transition:background .2s}
.faq-item summary:hover{background:rgba(255,255,255,.04)}
.faq-item summary::after{content:'\f078';font-family:'Font Awesome 6 Free';font-weight:900;
    color:var(--primary);font-size:.8rem;transition:transform .3s}
.faq-item[open] summary::after{transform:rotate(180deg)}
.faq-item p{padding:0 1.25rem 1.25rem;color:var(--muted);font-size:.9rem;line-height:1.6}

.personal-quote{border-left:4px solid var(--primary);padding:1.25rem 1.5rem;
    background:rgba(255,255,255,.03);border-radius:0 12px 12px 0}
.personal-quote i{color:var(--primary);font-size:1.5rem;opacity:.4;margin-bottom:.75rem;display:block}
.personal-quote p{font-size:1.05rem;font-style:italic;line-height:1.7;color:#ddd}
.personal-quote cite{display:block;margin-top:.75rem;color:var(--muted);font-size:.85rem}

/* ─── ABOUT ──────────────────────────────────────────────────────────────────────── */
.bio{color:var(--muted);line-height:1.8;font-size:.92rem}
.bio p{margin-bottom:1rem}.bio h1,.bio h2,.bio h3{color:var(--text);font-family:'Syne',sans-serif;margin:1.5rem 0 .75rem}
.bio strong{color:var(--text)}.bio a{color:var(--primary)}
.bio code{background:rgba(0,0,0,.4);padding:2px 6px;border-radius:4px;font-family:'DM Mono',monospace;font-size:.85em}
.bio blockquote{border-left:3px solid var(--primary);padding-left:1rem;color:rgba(255,255,255,.45);margin:1rem 0}
.bio ul,.bio ol{padding-left:1.5rem;margin-bottom:1rem}.bio li{margin-bottom:4px;color:var(--muted)}

/* ─── CTA BUTTONS ────────────────────────────────────────────────────────────────── */
.cta-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
    background:var(--primary);color:#fff;padding:12px 22px;border-radius:10px;
    text-decoration:none;font-weight:700;font-size:.88rem;transition:filter .2s,transform .15s}
.cta-btn:hover{filter:brightness(1.15);transform:translateY(-2px)}
.cta-btn.full{display:flex;width:100%}
.cta-btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;
    background:transparent;border:1px solid var(--border);color:var(--muted);
    padding:11px 22px;border-radius:10px;text-decoration:none;font-size:.88rem;transition:all .2s}
.cta-btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
.cta-btn-ghost.full{display:flex;width:100%;justify-content:center}

/* ── FOOTER ──────────────────────────────────────────────────────────────────────── */
footer{margin-top:6rem;background:#000;border-top:1px solid var(--border);padding:4.5rem 0 2.5rem}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:3rem;margin-bottom:2.5rem}
@media(max-width:768px){.footer-grid{grid-template-columns:1fr;gap:2rem;text-align:center}
.footer-social,.hero-social{justify-content:center}.ba-grid{grid-template-columns:1fr}}
.footer-brand h3{font-family:'Syne',sans-serif;font-size:1.25rem;margin-bottom:10px}
.footer-brand p{color:var(--muted);font-size:.84rem;line-height:1.6;max-width:320px}
.footer-social{display:flex;gap:8px;margin-top:1rem}
.footer-social a{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.05);
    border:1px solid var(--border);display:flex;align-items:center;justify-content:center;
    color:var(--muted);text-decoration:none;font-size:.88rem;transition:all .2s}
.footer-social a:hover{background:var(--primary);border-color:var(--primary);color:#fff}
.footer-links h4{font-family:'Syne',sans-serif;font-size:.75rem;font-weight:700;
    text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);margin-bottom:1.25rem}
.footer-links ul{list-style:none}.footer-links li{margin-bottom:10px}
.footer-links a{color:var(--muted);text-decoration:none;font-size:.86rem;transition:color .2s;cursor:pointer}
.footer-links a:hover{color:var(--primary)}
.footer-bottom{border-top:1px solid var(--border);padding-top:20px;
    display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.footer-bottom span{color:var(--muted);font-size:.8rem}
.footer-badge{display:inline-flex;align-items:center;gap:7px;
    background:var(--primary-dim);border:1px solid color-mix(in srgb,${primary} 25%,transparent);
    padding:5px 14px;border-radius:20px;color:var(--primary);font-size:.74rem;font-weight:600;text-decoration:none}
.footer-badge img{border-radius:50%;width:14px}

/* ── SCROLLBAR ────────────────────────────────────────────────────────────────── */
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:10px}
::-webkit-scrollbar-thumb:hover{background:var(--primary)}

/* ── RESPONSIVE ────────────────────────────────────────────────────────────────── */
@media(max-width:640px){
    .proj-grid,.product-grid{grid-template-columns:1fr}
    .award-card,.pub-card,.press-card{flex-direction:column}
    .award-img,.pub-cover{width:100%;max-height:200px}
}
    </style>
</head>
<body>
<div class="bg-mesh"></div>

${nav}

<!-- ── HERO ──────────────────────────────────────────────────────────────────────── -->
<header id="top">
    <div class="container">
        <div class="hero-avatar-wrap scroll-reveal">
            <div class="avatar-ring2"></div>
            <div class="avatar-ring"></div>
            <img src="${cldTransform(avatar,'w_400,h_400,c_fill,q_auto:best,r_max,f_auto')}" alt="${fullName}" class="avatar">
        </div>
        <div class="scroll-reveal" style="transition-delay:.1s">
            <div class="role-badge">${displayRole}</div>
        </div>
        <h1 class="scroll-reveal" style="transition-delay:.15s">${fullName} ${verified}</h1>
        ${headline ? `<p class="headline scroll-reveal" style="transition-delay:.2s">${headline}</p>` : ''}
        ${availabilityBadge(user) ? `<div class="scroll-reveal" style="transition-delay:.22s">${availabilityBadge(user)}</div>` : ''}
        <div class="hero-social scroll-reveal" style="transition-delay:.27s">${socials}</div>
    </div>
</header>

<!-- ── MAIN CONTENT ──────────────────────────────────────────────────────────────── -->
<div class="container">
    <div class="main-grid">
        <main>
            ${card(`${h2tag('fas fa-user-astronaut','About')}<div class="bio">${about}</div>`)}
            ${content}
        </main>
        ${sidebar}
    </div>
</div>

<!-- ── FOOTER ──────────────────────────────────────────────────────────────────────── -->
<footer>
    <div class="container">
        <div class="footer-grid">
            <div class="footer-brand">
                <h3>${fullName}</h3>
                <p>${esc((user.bio || 'Building great things.').substring(0,115))}!</p>
                <div class="footer-social">${socials}</div>
            </div>
            <div class="footer-links">
                <h4>Navigate</h4>
                <ul>
                    <li><a href="#top">Home</a></li>
                    <li><a href="#work">Work</a></li>
                    ${parseJSON(user.pf_testimonials).length ? '<li><a href="#testimonials">Reviews</a></li>' : ''}
                    <li><a href="#contact">Contact</a></li>
                </ul>
            </div>
            <div class="footer-links">
                <h4>Fuma Technologies</h4>
                <ul>
                    <li><a href="https://fumatechnologies.vercel.app" target="_blank" rel="noopener">Platform</a></li>
                    <li><a href="https://fumatechnologies.vercel.app/#report-portfolio" target="_blank" rel="noopener">Report Profile</a></li>
                    <li><a href="https://fumatechnologies.vercel.app/TPC.html" target="_blank" rel="noopener">Terms of Service</a></li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <span>&copy; ${new Date().getFullYear()} ${fullName}. All rights reserved.</span>
            <a href="https://fumatechnologies.vercel.app" target="_blank" rel="noopener" class="footer-badge">
                <img src="https://fumatechnologies.vercel.app/assets/logo/fumatechnologies-logo.png" alt="Fuma Technologies"> Hosted on Fuma Technologies
            </a>
        </div>
    </div>
</footer>

<!-- ── LIGHTBOX ────────────────────────────────────────────────────────────────── -->
<div class="lightbox" id="lightbox">
    <button class="lb-close" id="lb-close" aria-label="Close">&times;</button>
    <img id="lb-img" src="" alt="">
    <p class="lb-caption" id="lb-caption"></p>
</div>

<script>
// ── SCROLL REVEAL ────────────────────────────────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            // Stagger based on index within parent
            const siblings = [...entry.target.parentElement.querySelectorAll('.scroll-reveal:not(.visible)')];
            const delay = Math.max(0, siblings.indexOf(entry.target)) * 60;
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, delay);
            revealObs.unobserve(entry.target);
        }
    });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.scroll-reveal').forEach(el => revealObs.observe(el));

// ── SKILL BAR ANIMATION ────────────────────────────────────────────────────────
const barObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('animated');
            barObs.unobserve(e.target);
        }
    });
}, { threshold: 0.3 });
document.querySelectorAll('.skill-bar-fill').forEach(el => barObs.observe(el));

// ── SCROLL → NAV SHADOW ──────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
    document.getElementById('pnav').classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── MOBILE MENU ──────────────────────────────────────────────────────────────────
const burger = document.getElementById('pnav-burger');
const drawer = document.getElementById('pnav-drawer');
burger?.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    drawer.setAttribute('aria-hidden', !open);
});
drawer?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    drawer.classList.remove('open');
    burger.classList.remove('open');
}));

// ── LIGHTBOX ──────────────────────────────────────────────────────────────────
const lightbox = document.getElementById('lightbox');
const lbImg    = document.getElementById('lb-img');
const lbCap    = document.getElementById('lb-caption');

function openLightbox(url, caption) {
    lbImg.src = url;
    lbImg.alt = caption || '';
    if (lbCap) lbCap.textContent = caption || '';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    lbImg.style.opacity = '0';
    lbImg.onload = () => { lbImg.style.transition = 'opacity .35s'; lbImg.style.opacity = '1'; };
}
function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    lbImg.src = '';
}
document.getElementById('lb-close')?.addEventListener('click', closeLightbox);
lightbox?.addEventListener('click', e => { if (e.target === lightbox || e.target === lbImg) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ── STAT COUNTER ANIMATION ────────────────────────────────────────────────────────
const countObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el    = e.target;
        const raw   = el.textContent;
        const num   = parseFloat(raw.replace(/[^0-9.]/g, ''));
        const suffix = raw.replace(/[0-9.,]/g, '');
        if (isNaN(num)) return;
        let start = 0;
        const dur = 1400;
        const step = timestamp => {
            if (!start) start = timestamp;
            const pct = Math.min((timestamp - start) / dur, 1);
            const ease = 1 - Math.pow(1 - pct, 4);
            el.textContent = Math.round(ease * num).toLocaleString() + suffix;
            if (pct < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        countObs.unobserve(el);
    });
}, { threshold: 0.5 });
document.querySelectorAll('.stat-number').forEach(el => countObs.observe(el));
</script>
</body>
</html>`;
}
