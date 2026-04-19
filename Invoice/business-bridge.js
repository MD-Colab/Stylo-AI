/**
 * FUMA Invoice — business-bridge.js
 *
 * Connects FUMA Invoice to FUMA Business.
 * Place this file at:  /invoice/business-bridge.js
 *
 * ADD one line to shared.js onAuthStateChanged, after currentUser is set:
 *   await MDBusinessBridge.init(user);
 *
 * What it does:
 *  1. Reads businesses/{uid} — checks meta.mdinvoiceLinked + meta.verified
 *  2. If linked → merges business data into invoice_settings/{uid}
 *     (never overwrites user-customised fields if they already exist)
 *  3. Exposes MDBusinessBridge.getBizData() to any page that needs it
 *  4. Shows a persistent business-badge in the topbar (verified / pending)
 *  5. If NOT linked → shows a soft "Connect Business" nudge banner
 *  6. Auto-syncs: invoice customer collection ← business address details
 */

'use strict';

window.MDBusinessBridge = (function () {

    /* ── Internal state ──────────────────────────────────────────── */
    let _bizData     = null;   // raw businesses/{uid} doc data
    let _isLinked    = false;
    let _isVerified  = false;
    let _uid         = null;

    /* ── Currency symbols (same as shared.js) ─────────────────────── */
    const CSYM = { INR:'₹', USD:'$', EUR:'€', GBP:'£', AED:'د.إ', SGD:'S$' };

    /* ═══════════════════════════════════════════════════════════════
       PUBLIC — init(user)
       Called once after auth resolves.
    ═══════════════════════════════════════════════════════════════ */
    async function init(user) {
        if (!user) return;
        _uid = user.uid;

        try {
            /* 1. Read businesses/{uid} -------------------------------- */
            const bizSnap = await db.collection('businesses').doc(user.uid).get();

            if (!bizSnap.exists) {
                /* No business profile — show soft nudge banner */
                _injectNudgeBanner();
                return;
            }

            _bizData    = bizSnap.data();
            _isLinked   = _bizData.meta?.mdinvoiceLinked === true;
            _isVerified = _bizData.meta?.verified         === true;

            if (!_isLinked) {
                /* Business exists but FUMA Invoice is not connected yet */
                _injectConnectBanner(_bizData.businessName || 'your business');
                return;
            }

            /* 2. Business IS linked — sync into invoice_settings ------- */
            await _syncToInvoiceSettings(user.uid, _bizData);

            /* 3. Inject verified / pending badge into topbar ----------- */
            _injectTopbarBadge(_isVerified, _bizData);

        } catch (e) {
            console.warn('[MDBusinessBridge] init error:', e);
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       PUBLIC — getBizData()
       Returns the raw businesses/{uid} object (or null).
    ═══════════════════════════════════════════════════════════════ */
    function getBizData() { return _bizData; }

    /* ═══════════════════════════════════════════════════════════════
       PUBLIC — isLinked / isVerified
    ═══════════════════════════════════════════════════════════════ */
    function isLinked()   { return _isLinked;   }
    function isVerified() { return _isVerified; }

    /* ═══════════════════════════════════════════════════════════════
       PRIVATE — _syncToInvoiceSettings
       Maps businesses/{uid} → invoice_settings/{uid}
       Uses { merge: true } so existing user customisations survive.

       Field mapping (from Firestore screenshots):
         businesses.businessName          → invoice_settings.businessName
         businesses.businessEmail         → invoice_settings.companyEmail (only if blank)
         businesses.businessPhone         → invoice_settings.businessPhone
         businesses.businessLogoBase64    → invoice_settings.logoUrl
         businesses.address.street        → invoice_settings.address.street
         businesses.address.city          → invoice_settings.address.city
         businesses.address.state         → invoice_settings.address.state
         businesses.address.country       → invoice_settings.address.country
         businesses.address.postalCode    → invoice_settings.address.pincode
         businesses.identity.gstNumber    → invoice_settings.taxId
         businesses.identity.panNumber    → invoice_settings.panNumber
         businesses.meta.razorpayAccountId→ invoice_settings.linkedAccount.accountId
         businesses.bank.bankAccountHolder→ invoice_settings.linkedAccount.bankName
         businesses.bank.bankAccountNumber→ invoice_settings.linkedAccount.bankAccount
         businesses.bank.bankIFSC         → invoice_settings.linkedAccount.ifsc
    ═══════════════════════════════════════════════════════════════ */
    async function _syncToInvoiceSettings(uid, biz) {
        try {
            /* Read existing invoice_settings first so we never clobber
               fields the user has already customised. */
            const snap    = await db.collection('invoice_settings').doc(uid).get();
            const current = snap.exists ? snap.data() : {};

            /* Build merged address object */
            const mergedAddress = {
                street:   current.address?.street   || biz.address?.addressLine || '',
                city:     current.address?.city     || biz.address?.city        || '',
                state:    current.address?.state    || biz.address?.state       || '',
                country:  current.address?.country  || biz.address?.country     || 'India',
                pincode:  current.address?.pincode  || biz.address?.postalCode  || '',
            };

            /* Build Razorpay / linked account block */
            const rzpId   = biz.meta?.razorpayAccountId;
            const isRzpOk = rzpId && rzpId !== 'Pending';

            const mergedLinkedAccount = isRzpOk ? {
                accountId:   current.linkedAccount?.accountId   || rzpId,
                bankAccount: current.linkedAccount?.bankAccount || biz.bank?.bankAccountNumber || '',
                bankName:    current.linkedAccount?.bankName    || biz.bank?.bankAccountHolder || '',
                ifsc:        current.linkedAccount?.ifsc        || biz.bank?.bankIFSC          || '',
                businessName:current.linkedAccount?.businessName|| biz.businessName           || '',
                email:       current.linkedAccount?.email       || biz.businessEmail          || '',
                ownerId:     uid,
                status:      _isVerified && isRzpOk ? 'active' : 'pending',
                submissionTime: current.linkedAccount?.submissionTime || new Date().toISOString(),
            } : (current.linkedAccount || null);

            /* Fields to write — only fill blanks, never overwrite */
            const updates = {
                /* Core business identity */
                businessName:  current.businessName  || biz.businessName  || '',
                companyName:   current.companyName   || biz.businessName  || '',
                companyEmail:  current.companyEmail  || biz.businessEmail || '',
                businessPhone: current.businessPhone || biz.businessPhone || '',
                logoUrl:       current.logoUrl       || biz.businessLogoBase64 || '',

                /* Address (nested merge) */
                address: mergedAddress,

                /* Tax / identity */
                taxId:      current.taxId      || biz.identity?.gstNumber || '',
                panNumber:  current.panNumber  || biz.identity?.panNumber  || '',

                /* Currency — keep existing or default INR */
                currency:   current.currency   || 'INR',
                defaultTax: current.defaultTax != null ? current.defaultTax : 18,

                /* Razorpay linked account */
                ...(mergedLinkedAccount && { linkedAccount: mergedLinkedAccount }),

                /* Bridge metadata (not used in display, just for debugging) */
                _bizBridgeSynced: true,
                _bizBridgeSyncedAt: firebase.firestore.FieldValue.serverTimestamp(),
                _bizVerified: _isVerified,
            };

            await db.collection('invoice_settings').doc(uid).set(updates, { merge: true });

        } catch (e) {
            console.warn('[MDBusinessBridge] _syncToInvoiceSettings failed:', e);
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       PRIVATE — _injectTopbarBadge
       Adds a verified/pending pill next to the avatar in the topbar.
    ═══════════════════════════════════════════════════════════════ */
    function _injectTopbarBadge(isVerified, biz) {
        if (document.getElementById('md-biz-badge')) return;

        const pill = document.createElement('a');
        pill.id    = 'md-biz-badge';
        pill.href  = '/Business/dashboard.html';
        pill.title = isVerified
            ? `${biz.businessName} — Verified Business`
            : `${biz.businessName} — Verification Pending`;

        const logoHtml = biz.businessLogoBase64
            ? `<img src="${biz.businessLogoBase64}" alt="logo">`
            : `<i class="fas fa-building"></i>`;

        pill.innerHTML = `
            ${logoHtml}
            <span class="mbb-name">${escHtml(biz.businessName || 'Business')}</span>
            <span class="mbb-dot ${isVerified ? 'verified' : 'pending'}"></span>
        `;

        /* Inject style once */
        if (!document.getElementById('mbb-style')) {
            const s = document.createElement('style');
            s.id = 'mbb-style';
            s.textContent = `
                #md-biz-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 10px 4px 4px;
                    border-radius: 20px;
                    background: rgba(255,111,0,0.08);
                    border: 1px solid rgba(255,111,0,0.25);
                    text-decoration: none;
                    font-size: .78rem;
                    font-weight: 600;
                    color: #FF6F00;
                    cursor: pointer;
                    transition: all .2s;
                    max-width: 160px;
                    overflow: hidden;
                }
                #md-biz-badge:hover {
                    background: rgba(255,111,0,0.15);
                    transform: scale(1.03);
                }
                #md-biz-badge img,
                #md-biz-badge i {
                    width: 22px; height: 22px;
                    border-radius: 50%;
                    object-fit: cover;
                    font-size: .7rem;
                    display: flex; align-items: center; justify-content: center;
                    background: #FF6F00;
                    color: #fff;
                    flex-shrink: 0;
                }
                #md-biz-badge i {
                    padding: 0;
                    width: 22px; height: 22px;
                    line-height: 22px;
                    text-align: center;
                }
                .mbb-name {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 90px;
                }
                .mbb-dot {
                    width: 7px; height: 7px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                .mbb-dot.verified { background: #10B981; }
                .mbb-dot.pending  { background: #F59E0B; animation: mbbPulse 1.8s infinite; }
                @keyframes mbbPulse { 0%,100%{opacity:1}50%{opacity:.4} }
            `;
            document.head.appendChild(s);
        }

        /* Insert before the avatar in topbar-right */
        const avatarEl = document.getElementById('topbar-avatar');
        if (avatarEl && avatarEl.parentElement) {
            avatarEl.parentElement.insertBefore(pill, avatarEl);
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       PRIVATE — _injectConnectBanner
       Shown when business exists but mdinvoiceLinked is false.
    ═══════════════════════════════════════════════════════════════ */
    function _injectConnectBanner(bizName) {
        if (document.getElementById('mbb-connect-banner')) return;

        const banner = document.createElement('div');
        banner.id    = 'mbb-connect-banner';
        banner.innerHTML = `
            <div class="mbb-banner mbb-banner-connect">
                <i class="fas fa-plug"></i>
                <div>
                    <strong>Connect your business</strong> — 
                    <em>${escHtml(bizName)}</em> is set up in FUMA Business but not yet connected to FUMA Invoice.
                </div>
                <a href="/Business/dashboard.html" class="mbb-banner-btn">Connect now →</a>
                <button class="mbb-banner-close" onclick="document.getElementById('mbb-connect-banner').remove()">✕</button>
            </div>
        `;
        _injectBannerStyles();
        _insertBanner(banner);
    }

    /* ═══════════════════════════════════════════════════════════════
       PRIVATE — _injectNudgeBanner
       Shown when no business profile exists at all.
    ═══════════════════════════════════════════════════════════════ */
    function _injectNudgeBanner() {
        if (document.getElementById('mbb-nudge-banner')) return;

        const banner = document.createElement('div');
        banner.id    = 'mbb-nudge-banner';
        banner.innerHTML = `
            <div class="mbb-banner mbb-banner-nudge">
                <i class="fas fa-store"></i>
                <div>
                    <strong>Want payment links & verified invoices?</strong> 
                    Create a free FUMA Business profile to unlock Razorpay payments.
                </div>
                <a href="/Business/index.html" class="mbb-banner-btn">Set up business →</a>
                <button class="mbb-banner-close" onclick="document.getElementById('mbb-nudge-banner').remove()">✕</button>
            </div>
        `;
        _injectBannerStyles();
        _insertBanner(banner);
    }

    function _insertBanner(el) {
        const mainContent = document.querySelector('.main-content, #main-content, main');
        if (mainContent) mainContent.insertBefore(el, mainContent.children[1] || mainContent.firstChild);
        else document.body.insertBefore(el, document.body.firstChild);
    }

    function _injectBannerStyles() {
        if (document.getElementById('mbb-banner-style')) return;
        const s = document.createElement('style');
        s.id = 'mbb-banner-style';
        s.textContent = `
            .mbb-banner {
                display: flex;
                align-items: center;
                gap: .85rem;
                padding: .8rem 1.3rem;
                font-size: .86rem;
                font-weight: 500;
                border-radius: 10px;
                margin: 1rem 1.5rem 0;
                flex-wrap: wrap;
            }
            .mbb-banner-connect {
                background: rgba(255,111,0,0.08);
                border: 1px solid rgba(255,111,0,0.3);
                color: #FF6F00;
            }
            .mbb-banner-nudge {
                background: rgba(59,130,246,0.07);
                border: 1px solid rgba(59,130,246,0.3);
                color: #1D4ED8;
            }
            .mbb-banner i { font-size: 1.1rem; flex-shrink: 0; }
            .mbb-banner div { flex: 1; color: #374151; }
            .mbb-banner strong { color: #111827; }
            .mbb-banner-btn {
                padding: 5px 14px;
                border-radius: 20px;
                background: #FF6F00;
                color: #fff;
                text-decoration: none;
                font-size: .8rem;
                font-weight: 700;
                white-space: nowrap;
                transition: background .2s;
            }
            .mbb-banner-btn:hover { background: #E65100; }
            .mbb-banner-nudge .mbb-banner-btn { background: #1D4ED8; }
            .mbb-banner-nudge .mbb-banner-btn:hover { background: #1E40AF; }
            .mbb-banner-close {
                background: none;
                border: none;
                color: #9CA3AF;
                cursor: pointer;
                font-size: .9rem;
                padding: 2px 4px;
                flex-shrink: 0;
            }
            .mbb-banner-close:hover { color: #374151; }
        `;
        document.head.appendChild(s);
    }

    /* ── Tiny HTML escape ─────────────────────────────────────────── */
    function escHtml(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    /* ── Public API ──────────────────────────────────────────────── */
    return { init, getBizData, isLinked, isVerified };

})();