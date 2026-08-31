(function () {
  'use strict';

  const TOKEN_KEY = 'lackdesign_admin_token';
  const STATUS_LABELS = {
    neu: 'Neu',
    bestaetigt: 'Bestätigt',
    abholung_geplant: 'Abholung geplant',
    in_arbeit: 'In Arbeit',
    fertig: 'Fertig',
    abgeschlossen: 'Abgeschlossen',
    storniert: 'Storniert',
  };

  let currentItemId = null;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setToken('');
      showLogin();
      throw new Error(data.error || 'Nicht angemeldet.');
    }
    if (!res.ok) throw new Error(data.error || 'Anfrage fehlgeschlagen.');
    return data;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function fmtDateShort(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('de-DE');
  }

  function statusBadge(status) {
    return `<span class="status-badge status-${status}">${STATUS_LABELS[status] || status}</span>`;
  }

  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const adminHeaderUser = document.getElementById('adminHeaderUser');
  const adminUserName = document.getElementById('adminUserName');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const intakeTableBody = document.getElementById('intakeTableBody');
  const statsRow = document.getElementById('statsRow');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const drawer = document.getElementById('detailDrawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const drawerContent = document.getElementById('drawerContent');

  function showLogin() {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    adminHeaderUser.classList.add('hidden');
  }

  function showDashboard(admin) {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    adminHeaderUser.classList.remove('hidden');
    adminHeaderUser.style.display = 'flex';
    adminUserName.textContent = admin?.name || admin?.email || '';
    loadStats();
    loadIntakes();
    loadSettings();
  }

  async function init() {
    if (!getToken()) {
      showLogin();
      return;
    }
    try {
      const { admin } = await api('/api/admin/me');
      showDashboard(admin);
    } catch {
      showLogin();
    }
  }

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('loginEmail').value.trim(),
          password: document.getElementById('loginPassword').value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToken(data.token);
      showDashboard(data.admin);
    } catch (err) {
      loginError.textContent = err.message || 'Anmeldung fehlgeschlagen.';
      loginError.classList.remove('hidden');
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    setToken('');
    showLogin();
  });

  async function loadStats() {
    try {
      const { by_status } = await api('/api/admin/stats');
      statsRow.innerHTML = by_status
        .map(
          (s) =>
            `<span class="stat-chip"><strong>${s.count}</strong> ${STATUS_LABELS[s.status] || s.status}</span>`,
        )
        .join('');
    } catch {
      statsRow.innerHTML = '';
    }
  }

  async function loadIntakes() {
    const q = searchInput?.value.trim() || '';
    const status = statusFilter?.value || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);

    try {
      const { items } = await api(`/api/admin/intakes?${params}`);
      intakeTableBody.innerHTML =
        items.length === 0
          ? '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#525252;">Keine Einträge</td></tr>'
          : items
              .map(
                (item) => `
          <tr data-id="${item.id}">
            <td>${item.reference_code}</td>
            <td>
              <strong>${item.make_model}</strong><br />
              <small>${item.license_plate || '—'} · ${item.image_count} Bilder</small>
            </td>
            <td>${item.provider_company}<br /><small>${item.contact_name}</small></td>
            <td>${statusBadge(item.status)}</td>
            <td>${item.urgency}</td>
            <td>${fmtDate(item.created_at)}</td>
          </tr>`,
              )
              .join('');

      intakeTableBody.querySelectorAll('tr[data-id]').forEach((row) => {
        row.addEventListener('click', () => openDetail(row.dataset.id));
      });
    } catch (err) {
      intakeTableBody.innerHTML = `<tr><td colspan="6">${err.message}</td></tr>`;
    }
  }

  function updateProviderLinkHint(token) {
    const hint = document.getElementById('providerLinkHint');
    if (!hint) return;
    if (!token) {
      hint.textContent = 'Nach dem Speichern können Sie den Link an Stammkunden weitergeben.';
      return;
    }
    const url = `${window.location.origin}/anbieter.html?token=${encodeURIComponent(token)}`;
    hint.innerHTML = `Kunden-Link: <a href="${url}">${url}</a>`;
  }

  async function loadSettings() {
    const input = document.getElementById('providerTokenInput');
    if (!input) return;
    try {
      const data = await api('/api/admin/settings');
      input.value = data.provider_token || '';
      updateProviderLinkHint(input.value.trim());
    } catch {
      updateProviderLinkHint('');
    }
  }

  document.getElementById('providerTokenInput')?.addEventListener('input', (e) => {
    updateProviderLinkHint(e.target.value.trim());
  });

  document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('providerTokenInput');
    const alertEl = document.getElementById('settingsAlert');
    const token = input?.value.trim() || '';
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ provider_token: token }),
      });
      updateProviderLinkHint(token);
      if (alertEl) {
        alertEl.className = 'alert alert--success';
        alertEl.textContent = 'Zugangscode gespeichert.';
        alertEl.classList.remove('hidden');
      }
    } catch (err) {
      if (alertEl) {
        alertEl.className = 'alert alert--error';
        alertEl.textContent = err.message || 'Speichern fehlgeschlagen.';
        alertEl.classList.remove('hidden');
      }
    }
  });

  searchInput?.addEventListener('input', debounce(loadIntakes, 300));
  statusFilter?.addEventListener('change', loadIntakes);
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    loadStats();
    loadIntakes();
  });

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  async function openDetail(id) {
    currentItemId = id;
    try {
      const { item, images } = await api(`/api/admin/intakes/${id}`);
      drawerContent.innerHTML = renderDetail(item, images);
      bindDetailEvents(item);
      loadDetailImages(item.id, images);
      drawer.classList.add('is-open');
      drawerBackdrop.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
    } catch (err) {
      alert(err.message);
    }
  }

  function renderDetail(item, images) {
    const imageHtml = images.length
      ? `<div class="detail-images" id="detailImages" data-vehicle-id="${item.id}">
          ${images.map((img) => `<div class="detail-image-slot" data-image-id="${img.id}">Lade Bild …</div>`).join('')}
        </div>`
      : '<p style="color:#525252;">Keine Bilder</p>';

    return `
      <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.1em;color:#525252;">${item.reference_code}</p>
      <h2 style="font-family:var(--font-display);font-size:2rem;margin:0.5rem 0 1rem;">${item.make_model}</h2>
      ${statusBadge(item.status)}

      <dl class="detail-meta">
        <div><dt>Anbieter</dt><dd>${item.provider_company}</dd></div>
        <div><dt>Kontakt</dt><dd>${item.contact_name}<br />${item.contact_phone}${item.contact_email ? `<br />${item.contact_email}` : ''}</dd></div>
        <div><dt>Kennzeichen</dt><dd>${item.license_plate || '—'}</dd></div>
        <div><dt>Beschreibung</dt><dd>${escapeHtml(item.description)}</dd></div>
        <div><dt>Ausgemacht</dt><dd>${escapeHtml(item.agreed_work)}</dd></div>
        <div><dt>Abholung</dt><dd>${item.pickup_required ? `Ja – ${escapeHtml(item.pickup_address || 'Adresse fehlt')}` : 'Nein'}</dd></div>
        <div><dt>Dringlichkeit / Wunschtermin</dt><dd>${item.urgency}${item.deadline ? ` · ${fmtDateShort(item.deadline)}` : ''}</dd></div>
        ${item.batch_notes ? `<div><dt>Auftragshinweise</dt><dd>${escapeHtml(item.batch_notes)}</dd></div>` : ''}
        <div><dt>Eingang</dt><dd>${fmtDate(item.created_at)}</dd></div>
      </dl>

      <h3 style="margin:1.5rem 0 0.75rem;font-size:0.875rem;text-transform:uppercase;letter-spacing:0.06em;">Bilder</h3>
      <div class="detail-images">${imageHtml}</div>

      <form id="detailForm" style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid #e5e5e5;">
        <h3 style="margin-bottom:1rem;font-size:0.875rem;text-transform:uppercase;letter-spacing:0.06em;">Intern (Lackdesigner)</h3>
        <div class="form-field">
          <label>Status</label>
          <select name="status">
            ${Object.entries(STATUS_LABELS)
              .map(
                ([v, l]) =>
                  `<option value="${v}" ${item.status === v ? 'selected' : ''}>${l}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div class="form-grid form-grid--2" style="margin-top:1rem;">
          <div class="form-field">
            <label>Vereinbarter Preis (€)</label>
            <input type="number" name="agreed_price_eur" min="0" step="0.01"
              value="${item.agreed_price_eur ?? ''}" placeholder="Telefonisch vereinbart" />
          </div>
          <div class="form-field">
            <label>Interne Deadline</label>
            <input type="date" name="internal_deadline" value="${item.internal_deadline ? item.internal_deadline.slice(0, 10) : ''}" />
          </div>
        </div>
        <div class="form-field" style="margin-top:1rem;">
          <label>Interne Notizen</label>
          <textarea name="internal_notes" rows="3">${escapeHtml(item.internal_notes || '')}</textarea>
        </div>
        <div class="form-field" style="margin-top:1rem;">
          <label>Weitere Bilder hinzufügen</label>
          <input type="file" name="new_images" accept="image/*" multiple />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn--primary">Speichern</button>
        </div>
      </form>
    `;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadDetailImages(vehicleId, images) {
    const container = document.getElementById('detailImages');
    if (!container) return;

    for (const img of images) {
      const slot = container.querySelector(`[data-image-id="${img.id}"]`);
      if (!slot) continue;
      try {
        const res = await fetch(`/api/admin/intakes/${vehicleId}/images/${img.id}/file`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error('Bild nicht ladbar');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const el = document.createElement('img');
        el.src = url;
        el.alt = img.original_filename || '';
        slot.replaceWith(el);
      } catch {
        slot.textContent = 'Fehler';
      }
    }
  }

  function bindDetailEvents(item) {
    document.getElementById('detailForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const body = {
        status: form.status.value,
        internal_notes: form.internal_notes.value,
        agreed_price_eur: form.agreed_price_eur.value,
        internal_deadline: form.internal_deadline.value,
      };

      try {
        await api(`/api/admin/intakes/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });

        const files = form.new_images.files;
        if (files?.length) {
          const fd = new FormData();
          for (const f of files) fd.append('images', f);
          await api(`/api/admin/intakes/${item.id}/images`, { method: 'POST', body: fd });
        }

        closeDrawer();
        loadStats();
        loadIntakes();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawerBackdrop.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    currentItemId = null;
  }

  document.getElementById('closeDrawer')?.addEventListener('click', closeDrawer);
  drawerBackdrop?.addEventListener('click', closeDrawer);

  init();
})();
