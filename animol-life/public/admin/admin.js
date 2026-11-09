/* Pannello di amministrazione Animol Life (vanilla JS).
   Tutti i dati inseriti dai clienti vengono mostrati con escape HTML (nessun innerHTML di dati grezzi). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var EUR = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  var eur = function (n) { return EUR.format(n); };
  var cents = function (c) { return EUR.format(c / 100); };
  var date = function (s) { return s ? new Date(s).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '-'; };
  var CSRF = null;
  var CATS = { cani: 'Cani', gatti: 'Gatti', uccelli: 'Uccelli', pesci: 'Pesci', piccoli: 'Piccoli animali' };
  var STATUS = { ricevuto: 'ricevuto', in_preparazione: 'in preparazione', spedito: 'spedito', consegnato: 'consegnato', annullato: 'annullato', rimborsato: 'rimborsato' };
  var PAY = { pending: 'in attesa', paid: 'pagato', failed: 'non riuscito', refunded: 'rimborsato', cod: 'contrassegno' };

  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }
  function api(method, path, body) {
    var opts = { method: method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    if (CSRF && method !== 'GET') opts.headers['X-CSRF-Token'] = CSRF;
    return fetch('/api/admin' + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401 && path !== '/login') { showLogin(); }
        if (!res.ok) { var e = new Error(data.message || ('Errore ' + res.status)); e.status = res.status; e.field = data.field; throw e; }
        return data;
      });
    });
  }

  /* ---------------- accesso ---------------- */
  function showLogin() {
    CSRF = null;
    $('#app').hidden = true; $('#logout').hidden = true; $('#who').textContent = '';
    $('#login-view').hidden = false;
    setTimeout(function () { $('#l-email').focus(); }, 30);
  }
  function showApp(data) {
    CSRF = data.csrfToken;
    $('#login-view').hidden = true; $('#app').hidden = false; $('#logout').hidden = false;
    $('#who').textContent = data.admin.email;
    go(location.hash.replace('#', '') || 'dashboard');
  }
  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#login-err'); err.hidden = true; $('#login-submit').disabled = true;
    api('POST', '/login', { email: $('#l-email').value.trim(), password: $('#l-pass').value })
      .then(function (d) { $('#l-pass').value = ''; showApp(d); })
      .catch(function (e2) { err.textContent = e2.message; err.hidden = false; })
      .then(function () { $('#login-submit').disabled = false; });
  });
  $('#logout').addEventListener('click', function () { api('POST', '/logout', {}).catch(function () {}).then(showLogin); });

  /* ---------------- navigazione ---------------- */
  var VIEWS = {};
  function go(tab) {
    if (!VIEWS[tab]) tab = 'dashboard';
    $$('.tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    try { history.replaceState(null, '', '#' + tab); } catch (e) { /* ignorato */ }
    $('#view').innerHTML = '<p class="card muted">Caricamento…</p>';
    VIEWS[tab]().catch(function (e) { $('#view').innerHTML = '<p class="card err">' + esc(e.message) + '</p>'; });
  }
  $('.tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });

  /* ---------------- dashboard ---------------- */
  VIEWS.dashboard = function () {
    return api('GET', '/dashboard').then(function (d) {
      var k = function (label, v, sub) { return '<div class="kpi"><div class="muted small">' + esc(label) + '</div><div class="v">' + esc(v) + '</div>' + (sub ? '<div class="muted small">' + esc(sub) + '</div>' : '') + '</div>'; };
      $('#view').innerHTML = '<div class="kpis">' +
        k('Vendite oggi', cents(d.today.salesCents), d.today.orders + ' ordini') +
        k('Vendite 30 giorni', cents(d.last30.salesCents), d.last30.orders + ' ordini pagati o in contrassegno') +
        k('Scontrino medio (30 gg)', cents(d.last30.aovCents)) +
        k('Ordini 30 gg (tutti)', String(d.last30.allOrders), d.last30.pendingPayment + ' in attesa di pagamento') +
        k('Da spedire', String(d.last30.toShip)) +
        k('Membri Plus attivi', String(d.plus.active), d.plus.total + ' in totale') +
        k('Clienti registrati', String(d.customers)) +
        k('Contatti B2B', String(d.leads)) +
        '</div>' +
        (d.lowStock.length ? '<div class="card"><h2>Scorte basse</h2><ul>' + d.lowStock.map(function (p) { return '<li>' + esc(p.name) + ': <strong>' + esc(p.stock) + '</strong></li>'; }).join('') + '</ul></div>' : '') +
        '<p class="card muted small">Le vendite contano gli ordini pagati e quelli in contrassegno, esclusi annullati e rimborsati.</p>';
    });
  };

  /* ---------------- ordini ---------------- */
  var orderFilter = { q: '', status: '', payment: '' };
  VIEWS.orders = function () {
    var qs = '?limit=100' + (orderFilter.q ? '&q=' + encodeURIComponent(orderFilter.q) : '') + (orderFilter.status ? '&status=' + orderFilter.status : '') + (orderFilter.payment ? '&payment=' + orderFilter.payment : '');
    return api('GET', '/orders' + qs).then(function (d) {
      var opt = function (map, sel) { return '<option value="">Tutti</option>' + Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join(''); };
      $('#view').innerHTML = '<div class="card"><form class="row" id="of">' +
        '<div><label for="of-q">Cerca (numero o email)</label><input id="of-q" value="' + esc(orderFilter.q) + '"></div>' +
        '<div><label for="of-s">Stato</label><select id="of-s">' + opt(STATUS, orderFilter.status) + '</select></div>' +
        '<div><label for="of-p">Pagamento</label><select id="of-p">' + opt(PAY, orderFilter.payment) + '</select></div>' +
        '<div style="flex:0"><button class="btn primary" type="submit">Filtra</button></div></form></div>' +
        '<div class="card"><p class="muted small">' + d.total + ' ordini</p><div class="table-wrap"><table><thead><tr><th>Ordine</th><th>Data</th><th>Cliente</th><th>Stato</th><th>Pagamento</th><th class="num">Totale</th></tr></thead><tbody>' +
        d.orders.map(function (o) {
          var pc = o.paymentStatus === 'paid' ? 'ok' : o.paymentStatus === 'pending' ? 'warn' : o.paymentStatus === 'failed' ? 'bad' : '';
          return '<tr class="click" data-order="' + esc(o.orderId) + '" tabindex="0"><td><strong>' + esc(o.orderId) + '</strong>' + (o.account ? ' <span class="pill">account</span>' : '') + '</td><td>' + date(o.createdAt) + '</td><td>' + esc(o.customer.name) + '<br><span class="muted small">' + esc(o.customer.email) + '</span></td><td><span class="pill">' + esc(STATUS[o.status] || o.status) + '</span></td><td><span class="pill ' + pc + '">' + esc(PAY[o.paymentStatus] || o.paymentStatus) + '</span><br><span class="muted small">' + esc(o.paymentMethod) + '</span></td><td class="num">' + eur(o.total) + '</td></tr>';
        }).join('') + '</tbody></table></div></div><div id="order-detail"></div>';
      $('#of').addEventListener('submit', function (e) { e.preventDefault(); orderFilter = { q: $('#of-q').value.trim(), status: $('#of-s').value, payment: $('#of-p').value }; go('orders'); });
      $('#view tbody').addEventListener('click', function (e) { var tr = e.target.closest('[data-order]'); if (tr) openOrder(tr.dataset.order); });
      $('#view tbody').addEventListener('keydown', function (e) { var tr = e.target.closest('[data-order]'); if (tr && e.key === 'Enter') openOrder(tr.dataset.order); });
    });
  };
  function openOrder(id) {
    api('GET', '/orders/' + encodeURIComponent(id)).then(function (d) {
      var o = d.order, c = o.customer;
      var box = $('#order-detail');
      box.innerHTML = '<div class="card" id="od"><h2>Ordine ' + esc(o.orderId) + '</h2><div class="grid2"><div>' +
        '<p><strong>' + esc(c.name) + '</strong><br>' + esc(c.address) + '<br>' + esc(c.cap) + ' ' + esc(c.city) + (c.province ? ' (' + esc(c.province) + ')' : '') + '<br>' + esc(c.email) + (c.phone ? '<br>' + esc(c.phone) : '') + '</p>' +
        (o.notes ? '<p class="small">Note: ' + esc(o.notes) + '</p>' : '') +
        '<ul>' + o.lines.map(function (l) { return '<li>' + l.qty + '× ' + esc(l.name) + (l.variant ? ' (' + esc(l.variant) + ')' : '') + ' · ' + cents(l.unitCents * l.qty) + '</li>'; }).join('') + '</ul>' +
        '<p>Subtotale ' + cents(o.subtotalCents) + ' · Sconti ' + cents(o.couponDiscountCents + o.plusDiscountCents) + (o.couponCode ? ' (' + esc(o.couponCode) + ')' : '') + (o.isPlus ? ' · Plus' : '') + ' · Spedizione ' + esc(o.shippingMethod) + ' ' + cents(o.shippingCents) + '<br><strong>Totale ' + cents(o.totalCents) + '</strong></p></div><div>' +
        '<p>Stato: <span class="pill">' + esc(STATUS[o.status] || o.status) + '</span> · Pagamento: <span class="pill">' + esc(PAY[o.paymentStatus] || o.paymentStatus) + '</span> (' + esc(o.paymentMethod) + (o.payment && o.payment.provider ? ', ' + esc(o.payment.provider) : '') + ')</p>' +
        (o.payment && o.payment.mismatch ? '<p class="err">Attenzione: il provider ha notificato un importo diverso (' + cents(o.payment.mismatch.amountCents) + ').</p>' : '') +
        (o.tracking ? '<p>Tracciamento: ' + esc(o.tracking.carrier) + ' ' + esc(o.tracking.code) + '</p>' : '') +
        '<div class="row"><div><label for="t-carrier">Corriere</label><input id="t-carrier" maxlength="50" placeholder="BRT, GLS, Poste…"></div><div><label for="t-code">N. tracciamento</label><input id="t-code" maxlength="60"></div></div>' +
        '<label for="t-url">Link di tracciamento (https, facoltativo)</label><input id="t-url" maxlength="300">' +
        '<label><input type="checkbox" id="t-notify" checked> Avvisa il cliente via email</label>' +
        '<div class="actions">' +
        [['paid', 'Segna pagato'], ['processing', 'In preparazione'], ['shipped', 'Spedito'], ['delivered', 'Consegnato'], ['refunded', 'Rimborsa'], ['canceled', 'Annulla']].map(function (a) {
          return '<button type="button" class="btn' + (a[0] === 'refunded' || a[0] === 'canceled' ? ' danger' : '') + '" data-action="' + a[0] + '">' + a[1] + '</button>';
        }).join('') + '</div><p class="err" id="od-err" role="alert" hidden></p>' +
        '<h2 style="margin-top:16px">Cronologia</h2><ul class="small">' + (o.history || []).map(function (h) { return '<li>' + date(h.at) + ' · ' + esc(h.event) + (h.by ? ' · ' + esc(h.by) : '') + '</li>'; }).join('') + '</ul></div></div></div>';
      box.scrollIntoView({ behavior: 'smooth' });
      $('#od .actions').addEventListener('click', function (e) {
        var b = e.target.closest('[data-action]'); if (!b) return;
        var action = b.dataset.action;
        if ((action === 'refunded' || action === 'canceled') && !confirm('Confermi "' + b.textContent + '" per l\'ordine ' + o.orderId + '?')) return;
        var body = { action: action, notify: $('#t-notify').checked };
        if (action === 'shipped') body.tracking = { carrier: $('#t-carrier').value.trim(), code: $('#t-code').value.trim(), url: $('#t-url').value.trim() || undefined };
        b.disabled = true;
        api('POST', '/orders/' + encodeURIComponent(o.orderId) + '/status', body).then(function (r) {
          toast('Ordine aggiornato' + (r.notified ? ': cliente avvisato' : ''));
          go('orders'); setTimeout(function () { openOrder(o.orderId); }, 300);
        }).catch(function (e2) { var err = $('#od-err'); err.textContent = e2.message; err.hidden = false; b.disabled = false; });
      });
    }).catch(function (e) { toast(e.message); });
  }

  /* ---------------- prodotti ---------------- */
  VIEWS.products = function () {
    return api('GET', '/products').then(function (d) {
      $('#view').innerHTML = '<div class="card"><div class="actions" style="margin-top:0"><button class="btn primary" type="button" id="p-new">Nuovo prodotto</button></div></div>' +
        '<div id="product-form"></div>' +
        '<div class="card"><div class="table-wrap"><table><thead><tr><th>Prodotto</th><th>Categoria</th><th class="num">Prezzo</th><th class="num">Scontato</th><th class="num">Più basso 30 gg</th><th class="num">Scorte</th><th>Stato</th></tr></thead><tbody>' +
        d.products.map(function (p) {
          return '<tr class="click" data-pid="' + esc(p.id) + '" tabindex="0"><td><strong>' + esc(p.name) + '</strong><br><span class="muted small">' + esc(p.id) + ' · ' + esc(p.brand) + '</span></td><td>' + esc(CATS[p.category] || p.category) + '</td><td class="num">' + eur(p.price) + '</td><td class="num">' + (p.salePrice != null ? eur(p.salePrice) : '-') + '</td><td class="num">' + (p.lowestPrice30d != null ? eur(p.lowestPrice30d) : '-') + '</td><td class="num">' + (p.stock == null ? 'non gestite' : esc(p.stock)) + '</td><td>' + (p.active ? '<span class="pill ok">attivo</span>' : '<span class="pill bad">disattivato</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      $('#p-new').addEventListener('click', function () { productForm(null); });
      $('#view tbody').addEventListener('click', function (e) { var tr = e.target.closest('[data-pid]'); if (tr) loadProduct(tr.dataset.pid); });
      $('#view tbody').addEventListener('keydown', function (e) { var tr = e.target.closest('[data-pid]'); if (tr && e.key === 'Enter') loadProduct(tr.dataset.pid); });
    });
  };
  function loadProduct(id) { api('GET', '/products/' + encodeURIComponent(id)).then(function (d) { productForm(d.product, d.priceHistory); }).catch(function (e) { toast(e.message); }); }
  function specsToText(s) { return Object.keys(s || {}).map(function (k) { return k + ': ' + s[k]; }).join('\n'); }
  function variantsToText(v) { return (v || []).map(function (x) { return x.label + ' | ' + String(x.price).replace('.', ',') + (x.salePrice != null ? ' | ' + String(x.salePrice).replace('.', ',') : ''); }).join('\n'); }
  function parseSpecs(t) {
    var out = {};
    t.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l) { var i = l.indexOf(':'); if (i > 0) out[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
    return out;
  }
  function parseVariants(t) {
    return t.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var p = l.split('|').map(function (x) { return x.trim(); });
      return { label: p[0], price: Number((p[1] || '').replace(',', '.')), salePrice: p[2] ? Number(p[2].replace(',', '.')) : null };
    });
  }
  function productForm(p, history) {
    var isNew = !p; p = p || { name: '', brand: '', category: 'cani', price: '', salePrice: null, stock: null, active: true, description: '', specs: {}, variants: [] };
    var box = $('#product-form');
    box.innerHTML = '<div class="card"><h2>' + (isNew ? 'Nuovo prodotto' : 'Modifica ' + esc(p.name)) + '</h2><form id="pf" novalidate><div class="grid2"><div>' +
      '<label for="pf-name">Nome *</label><input id="pf-name" maxlength="120" value="' + esc(p.name) + '">' +
      (isNew ? '<label for="pf-id">Codice (facoltativo, generato dal nome)</label><input id="pf-id" maxlength="80" pattern="[a-z0-9-]+">' : '') +
      '<label for="pf-brand">Marca</label><input id="pf-brand" maxlength="60" value="' + esc(p.brand) + '">' +
      '<label for="pf-cat">Categoria *</label><select id="pf-cat">' + Object.keys(CATS).map(function (c) { return '<option value="' + c + '"' + (c === p.category ? ' selected' : '') + '>' + CATS[c] + '</option>'; }).join('') + '</select>' +
      '<div class="row"><div><label for="pf-price">Prezzo € *</label><input id="pf-price" inputmode="decimal" value="' + esc(p.price === '' ? '' : String(p.price).replace('.', ',')) + '"></div>' +
      '<div><label for="pf-sale">Prezzo scontato €</label><input id="pf-sale" inputmode="decimal" value="' + esc(p.salePrice == null ? '' : String(p.salePrice).replace('.', ',')) + '"></div>' +
      '<div><label for="pf-stock">Scorte (vuoto = non gestite)</label><input id="pf-stock" inputmode="numeric" value="' + esc(p.stock == null ? '' : p.stock) + '"></div></div>' +
      '<label><input type="checkbox" id="pf-active"' + (p.active ? ' checked' : '') + '> Attivo (visibile nel negozio)</label>' +
      (!isNew && p.lowestPrice30d != null ? '<p class="small muted">Prezzo più basso degli ultimi 30 giorni (Omnibus, calcolato in automatico): <strong>' + eur(p.lowestPrice30d) + '</strong></p>' : '') +
      '</div><div>' +
      '<label for="pf-desc">Descrizione</label><textarea id="pf-desc" maxlength="2000">' + esc(p.description) + '</textarea>' +
      '<div class="actions" style="margin-top:6px"><button type="button" class="btn" id="pf-ai">Genera descrizione con IA</button><span class="muted small" id="pf-ai-note"></span></div>' +
      '<label for="pf-specs">Specifiche (una per riga, "Nome: valore")</label><textarea id="pf-specs">' + esc(specsToText(p.specs)) + '</textarea>' +
      '<label for="pf-var">Varianti (una per riga, "etichetta | prezzo | prezzo scontato")</label><textarea id="pf-var" placeholder="3 kg | 18,90 | 16,90">' + esc(variantsToText(p.variants)) + '</textarea>' +
      '</div></div><p class="err" id="pf-err" role="alert" hidden></p><div class="actions"><button class="btn primary" type="submit">' + (isNew ? 'Crea prodotto' : 'Salva modifiche') + '</button>' +
      (!isNew && p.active ? '<button class="btn danger" type="button" id="pf-off">Disattiva</button>' : '') + '<button class="btn ghost" type="button" id="pf-close">Chiudi</button></div></form>' +
      (history && history.length ? '<h2 style="margin-top:16px">Storico prezzi</h2><div class="table-wrap"><table><thead><tr><th>Data</th><th>Variante</th><th class="num">Prezzo</th><th class="num">Scontato</th></tr></thead><tbody>' +
        history.slice().reverse().slice(0, 50).map(function (h) { return '<tr><td>' + date(h.at) + '</td><td>' + esc(h.variant || '(prodotto)') + '</td><td class="num">' + eur(h.price) + '</td><td class="num">' + (h.salePrice != null ? eur(h.salePrice) : '-') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '</div>';
    box.scrollIntoView({ behavior: 'smooth' });
    $('#pf-name').focus();
    $('#pf-close').addEventListener('click', function () { box.innerHTML = ''; });
    if ($('#pf-off')) $('#pf-off').addEventListener('click', function () {
      if (!confirm('Disattivare il prodotto? Non sarà più visibile né ordinabile.')) return;
      api('DELETE', '/products/' + encodeURIComponent(p.id)).then(function () { toast('Prodotto disattivato'); go('products'); }).catch(function (e) { toast(e.message); });
    });
    $('#pf-ai').addEventListener('click', function () {
      var b = this; b.disabled = true; $('#pf-ai-note').textContent = 'Generazione in corso…';
      api('POST', '/products/ai-description', { id: isNew ? undefined : p.id, name: $('#pf-name').value.trim(), brand: $('#pf-brand').value.trim(), category: $('#pf-cat').value, description: $('#pf-desc').value, specs: parseSpecs($('#pf-specs').value) })
        .then(function (r) { $('#pf-desc').value = r.description; $('#pf-ai-note').textContent = r.mode === 'claude' ? 'Bozza generata con Claude: rileggila prima di salvare.' : 'Bozza dal modello di testo (IA non configurata): rileggila prima di salvare.'; })
        .catch(function (e) { $('#pf-ai-note').textContent = e.message; })
        .then(function () { b.disabled = false; });
    });
    $('#pf').addEventListener('submit', function (e) {
      e.preventDefault();
      var num = function (v) { v = v.trim(); return v === '' ? null : Number(v.replace(',', '.')); };
      var body = {
        name: $('#pf-name').value.trim(), brand: $('#pf-brand').value.trim(), category: $('#pf-cat').value,
        price: num($('#pf-price').value), salePrice: num($('#pf-sale').value), stock: $('#pf-stock').value.trim() === '' ? null : Number($('#pf-stock').value.trim()),
        active: $('#pf-active').checked, description: $('#pf-desc').value, specs: parseSpecs($('#pf-specs').value), variants: parseVariants($('#pf-var').value),
      };
      if (isNew && $('#pf-id').value.trim()) body.id = $('#pf-id').value.trim();
      var req = isNew ? api('POST', '/products', body) : api('PUT', '/products/' + encodeURIComponent(p.id), body);
      req.then(function (r) { toast(isNew ? 'Prodotto creato: è già visibile nel negozio' : 'Prodotto salvato' + (r.priceChanges && r.priceChanges.length ? ' (prezzo registrato nello storico)' : '')); go('products'); setTimeout(function () { loadProduct(r.product.id); }, 300); })
        .catch(function (e2) { var err = $('#pf-err'); err.textContent = e2.message; err.hidden = false; });
    });
  }

  /* ---------------- coupon ---------------- */
  VIEWS.coupons = function () {
    return api('GET', '/coupons').then(function (d) {
      $('#view').innerHTML = '<div class="card"><h2>Nuovo coupon o modifica</h2><form id="cf" novalidate><div class="row">' +
        '<div><label for="cf-code">Codice *</label><input id="cf-code" maxlength="20" style="text-transform:uppercase"></div>' +
        '<div><label for="cf-pct">Sconto % *</label><input id="cf-pct" inputmode="numeric" maxlength="2"></div>' +
        '<div><label for="cf-from">Valido dal</label><input id="cf-from" type="date"></div>' +
        '<div><label for="cf-to">Valido fino al</label><input id="cf-to" type="date"></div>' +
        '<div><label for="cf-max">Utilizzi massimi</label><input id="cf-max" inputmode="numeric"></div></div>' +
        '<label for="cf-desc">Descrizione</label><input id="cf-desc" maxlength="120">' +
        '<label><input type="checkbox" id="cf-active" checked> Attivo</label><p class="err" id="cf-err" role="alert" hidden></p>' +
        '<div class="actions"><button class="btn primary" type="submit">Salva coupon</button></div></form></div>' +
        '<div class="card"><div class="table-wrap"><table><thead><tr><th>Codice</th><th class="num">Sconto</th><th>Validità</th><th class="num">Usi</th><th>Stato</th><th></th></tr></thead><tbody>' +
        d.coupons.map(function (c) {
          return '<tr><td><strong>' + esc(c.code) + '</strong><br><span class="muted small">' + esc(c.description) + '</span></td><td class="num">' + c.percent + '%</td><td>' + esc(c.validFrom || '…') + ' → ' + esc(c.validTo || '…') + '</td><td class="num">' + c.usedCount + (c.maxUses ? ' / ' + c.maxUses : '') + '</td><td>' + (c.active ? '<span class="pill ok">attivo</span>' : '<span class="pill">disattivato</span>') + '</td>' +
            '<td><button class="btn" type="button" data-edit="' + esc(c.code) + '">Modifica</button> <button class="btn danger" type="button" data-del="' + esc(c.code) + '">Elimina</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
      var byCode = {}; d.coupons.forEach(function (c) { byCode[c.code] = c; });
      $('#view tbody').addEventListener('click', function (e) {
        var ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
        if (ed) {
          var c = byCode[ed.dataset.edit];
          $('#cf-code').value = c.code; $('#cf-code').readOnly = true; $('#cf-pct').value = c.percent; $('#cf-from').value = c.validFrom || ''; $('#cf-to').value = c.validTo || '';
          $('#cf-max').value = c.maxUses || ''; $('#cf-desc').value = c.description; $('#cf-active').checked = c.active; $('#cf-code').focus();
        }
        if (del && confirm('Eliminare il coupon ' + del.dataset.del + '?')) api('DELETE', '/coupons/' + encodeURIComponent(del.dataset.del)).then(function () { toast('Coupon eliminato'); go('coupons'); }).catch(function (e2) { toast(e2.message); });
      });
      $('#cf').addEventListener('submit', function (e) {
        e.preventDefault();
        var code = $('#cf-code').value.trim().toUpperCase();
        var body = { code: code, percent: Number($('#cf-pct').value), validFrom: $('#cf-from').value || null, validTo: $('#cf-to').value || null, maxUses: $('#cf-max').value ? Number($('#cf-max').value) : null, description: $('#cf-desc').value.trim(), active: $('#cf-active').checked };
        var req = byCode[code] ? api('PUT', '/coupons/' + encodeURIComponent(code), body) : api('POST', '/coupons', body);
        req.then(function () { toast('Coupon salvato'); go('coupons'); }).catch(function (e2) { var err = $('#cf-err'); err.textContent = e2.message; err.hidden = false; });
      });
    });
  };

  /* ---------------- Plus, newsletter, contatti, registro ---------------- */
  VIEWS.plus = function () {
    return api('GET', '/plus-members').then(function (d) {
      $('#view').innerHTML = '<div class="card"><p class="muted small">' + d.members.length + ' membri (attivi, in prova e disdetti)</p><div class="table-wrap"><table><thead><tr><th>Email</th><th>Piano</th><th>Stato</th><th>Dal</th><th>Fine prova / periodo</th></tr></thead><tbody>' +
        d.members.map(function (m) {
          return '<tr><td>' + esc(m.email) + (m.userId ? '' : ' <span class="pill warn">senza account</span>') + (m.demo ? ' <span class="pill">demo</span>' : '') + '</td><td>' + esc(m.plan === 'yearly' ? 'annuale' : 'mensile') + '</td><td><span class="pill' + (m.status === 'active' || m.status === 'trialing' ? ' ok' : '') + '">' + esc(m.status) + '</span>' + (m.cancelAtPeriodEnd ? ' <span class="pill warn">disdetto a fine periodo</span>' : '') + '</td><td>' + date(m.since) + '</td><td>' + date(m.trialEndsAt) + ' / ' + date(m.currentPeriodEnd) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    });
  };
  VIEWS.newsletter = function () {
    $('#view').innerHTML = '<div class="card"><h2>Iscritti alla newsletter</h2><p>Esporta gli iscritti che hanno confermato il doppio opt-in (email, data del consenso e della conferma). Il file è in formato CSV con separatore ";" per Excel e LibreOffice.</p>' +
      '<p><a class="btn primary" style="display:inline-flex;align-items:center;text-decoration:none" href="/api/admin/newsletter.csv" download>Scarica CSV</a></p><p class="muted small">L\'esportazione viene registrata nel registro delle azioni. Conserva il file in modo sicuro e cancellalo dopo l\'uso.</p></div>';
    return Promise.resolve();
  };
  VIEWS.leads = function () {
    return api('GET', '/leads').then(function (d) {
      $('#view').innerHTML = '<div class="card"><div class="actions" style="margin-top:0"><a class="btn primary" style="display:inline-flex;align-items:center;text-decoration:none" href="/api/admin/leads.csv" download>Esporta CSV</a><span class="muted small">' + d.leads.length + ' richieste dalla pagina /vendita/</span></div></div>' +
        '<div class="card"><div class="table-wrap"><table><thead><tr><th>Data</th><th>Attività</th><th>Referente</th><th>Contatti</th><th>Interesse e messaggio</th><th>Consensi</th></tr></thead><tbody>' +
        d.leads.map(function (l) {
          return '<tr><td>' + date(l.createdAt) + '</td><td><strong>' + esc(l.shop) + '</strong><br><span class="muted small">' + esc(l.type || '') + (l.city ? ' · ' + esc(l.city) : '') + '</span></td><td>' + esc(l.name) + '</td><td>' + esc(l.email) + (l.phone ? '<br>' + esc(l.phone) : '') + '</td><td>' + esc(l.interest || '') + (l.message ? '<br><span class="small">' + esc(l.message) + '</span>' : '') + '</td>' +
            '<td class="small">privacy ' + date(l.privacyAcceptedAt) + (l.consentVersion ? ' (v. ' + esc(l.consentVersion) + ')' : '') + '<br>marketing: ' + (l.marketingConsent ? 'sì' : 'no') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    });
  };
  VIEWS.audit = function () {
    return api('GET', '/audit?limit=200').then(function (d) {
      $('#view').innerHTML = '<div class="card"><div class="table-wrap"><table><thead><tr><th>Data</th><th>Utente</th><th>Azione</th><th>Oggetto</th><th>IP</th></tr></thead><tbody>' +
        d.entries.map(function (e) { return '<tr><td>' + date(e.at) + '</td><td>' + esc(e.actorEmail || '-') + '</td><td>' + esc(e.action) + '</td><td>' + esc(e.target || '') + '</td><td>' + esc(e.ip || '') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    });
  };

  /* ---------------- avvio ---------------- */
  fetch('/api/admin/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(showApp)
    .catch(showLogin);
})();
