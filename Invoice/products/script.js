// FUMA Invoice — /invoice/products/script.js
'use strict';
let allProducts = [];
let prodFilter  = 'all';
let prodSearch  = '';

async function onUserReady(user) {
    renderSidebar('products');
    await loadCurrency(user.uid);
    await fetchProducts(user.uid);
    renderStats();
    renderTable();
    bindEvents();
}

async function fetchProducts(uid) {
    try {
        const snap = await db.collection('invoice_products').where('ownerId','==',uid).orderBy('name').get();
        allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error('fetchProducts:', e); }
}

function renderStats() {
    const count    = allProducts.length;
    const avgPrice = count ? allProducts.reduce((s,p) => s+parseFloat(p.price||0),0)/count : 0;
    const taxable  = allProducts.filter(p => parseFloat(p.tax||0) > 0).length;
    setText('st-products',  String(count));
    setText('st-avg-price', fmt(avgPrice));
    setText('st-taxable',   String(taxable));
}

function renderTable() {
    const tbody = document.getElementById('prod-body');
    if (!tbody) return;
    let list = allProducts;
    if (prodFilter !== 'all') list = list.filter(p => (p.type||'service') === prodFilter);
    if (prodSearch) {
        const q = prodSearch.toLowerCase();
        list = list.filter(p => (p.name||'').toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q) || (p.hsn||'').includes(q));
    }
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-box"></i><p>No products found.</p><a href="#" onclick="openProductModal()">Add your first product →</a></div></td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(p => {
        const type = p.type || 'service';
        const tax  = parseFloat(p.tax||0);
        return `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:.7rem">
                    <div class="prod-icon ${type}"><i class="fas fa-${type==='product'?'box':'cog'}"></i></div>
                    <div>
                        <div class="td-bold">${escHtml(p.name||'—')}</div>
                        <div class="td-muted">${escHtml((p.description||'').substring(0,60))}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge badge-info" style="text-transform:capitalize">${type}</span></td>
            <td class="td-bold">${fmt(p.price||0)}</td>
            <td>${tax > 0 ? `<span class="badge badge-paid">${tax}%</span>` : '<span style="color:var(--muted)">—</span>'}</td>
            <td class="td-muted">${escHtml(p.hsn||'—')}</td>
            <td class="td-muted">${escHtml(p.unit||'nos')}</td>
            <td>
                <div style="display:flex;gap:.4rem">
                    <button class="btn btn-secondary btn-sm" onclick="openProductModal('${p.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function openProductModal(prodId) {
    const isEdit = !!prodId;
    setText('prod-modal-title', isEdit ? 'Edit Product' : 'Add Product / Service');
    document.getElementById('edit-prod-id').value = prodId || '';
    if (isEdit) {
        const p = allProducts.find(x => x.id === prodId);
        if (!p) return;
        document.getElementById('prod-name').value  = p.name  || '';
        document.getElementById('prod-type').value  = p.type  || 'service';
        document.getElementById('prod-desc').value  = p.description || '';
        document.getElementById('prod-price').value = p.price || '';
        document.getElementById('prod-tax').value   = p.tax   || '';
        document.getElementById('prod-hsn').value   = p.hsn   || '';
        document.getElementById('prod-unit').value  = p.unit  || 'nos';
    } else {
        ['prod-name','prod-desc','prod-price','prod-tax','prod-hsn'].forEach(id => { document.getElementById(id).value=''; });
        document.getElementById('prod-type').value = 'service';
        document.getElementById('prod-unit').value = 'nos';
    }
    document.getElementById('prod-modal').classList.add('open');
}
window.openProductModal = openProductModal;

function closeProdModal() { document.getElementById('prod-modal').classList.remove('open'); }
window.closeProdModal = closeProdModal;

async function saveProduct() {
    const name  = document.getElementById('prod-name').value.trim();
    const price = parseFloat(document.getElementById('prod-price').value) || 0;
    if (!name)  { showToast('Product name is required.', 'error'); return; }
    if (price < 0) { showToast('Price cannot be negative.', 'error'); return; }

    const prodId = document.getElementById('edit-prod-id').value;
    const isEdit = !!prodId;
    const data = {
        name,
        type:        document.getElementById('prod-type').value,
        description: document.getElementById('prod-desc').value.trim(),
        price,
        tax:         parseFloat(document.getElementById('prod-tax').value) || 0,
        hsn:         document.getElementById('prod-hsn').value.trim(),
        unit:        document.getElementById('prod-unit').value,
        ownerId:     currentUser.uid,
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (!isEdit) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    try {
        if (isEdit) {
            await db.collection('invoice_products').doc(prodId).update(data);
            const idx = allProducts.findIndex(p => p.id === prodId);
            if (idx > -1) allProducts[idx] = { ...allProducts[idx], ...data };
        } else {
            const ref = await db.collection('invoice_products').add(data);
            allProducts.push({ id: ref.id, ...data });
        }
        closeProdModal();
        renderStats();
        renderTable();
        showToast(isEdit ? 'Product updated.' : 'Product added.', 'success');
    } catch(e) { showToast('Save failed: ' + e.message, 'error'); }
}
window.saveProduct = saveProduct;

async function deleteProduct(prodId) {
    if (!confirm('Delete this product?')) return;
    try {
        await db.collection('invoice_products').doc(prodId).delete();
        allProducts = allProducts.filter(p => p.id !== prodId);
        renderStats();
        renderTable();
        showToast('Product deleted.', 'info');
    } catch(e) { showToast('Delete failed.', 'error'); }
}
window.deleteProduct = deleteProduct;

function bindEvents() {
    document.getElementById('prod-search')?.addEventListener('input', e => { prodSearch = e.target.value.trim(); renderTable(); });
    document.getElementById('type-pills')?.addEventListener('click', e => {
        const pill = e.target.closest('.filter-pill'); if (!pill) return;
        document.querySelectorAll('#type-pills .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active'); prodFilter = pill.dataset.type; renderTable();
    });
    document.querySelectorAll('.modal-backdrop').forEach(mb => { mb.addEventListener('click', e => { if (e.target===mb) mb.classList.remove('open'); }); });
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }