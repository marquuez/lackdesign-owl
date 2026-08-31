(function () {
  'use strict';

  const TOKEN_KEY = 'lackdesign_provider_token';
  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get('token');

  const tokenGate = document.getElementById('tokenGate');
  const tokenForm = document.getElementById('tokenForm');
  const tokenError = document.getElementById('tokenError');
  const intakeApp = document.getElementById('intakeApp');
  const batchForm = document.getElementById('batchForm');
  const vehiclesList = document.getElementById('vehiclesList');
  const addVehicleBtn = document.getElementById('addVehicleBtn');
  const formAlert = document.getElementById('formAlert');
  const successPanel = document.getElementById('successPanel');
  const successMessage = document.getElementById('successMessage');
  const newBatchBtn = document.getElementById('newBatchBtn');
  const submitBtn = document.getElementById('submitBtn');
  const vehicleTemplate = document.getElementById('vehicleTemplate');

  /** @type {Map<number, File[]>} */
  const vehicleFiles = new Map();
  let vehicleCount = 0;

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function showAlert(message, type) {
    formAlert.className = `alert alert--${type}`;
    formAlert.textContent = message;
    formAlert.classList.remove('hidden');
    formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    formAlert.classList.add('hidden');
  }

  async function verifyToken(token) {
    const fd = new FormData();
    fd.append('data', JSON.stringify({ probe: true }));
    const res = await fetch('/api/intake/batch', {
      method: 'POST',
      headers: { 'X-Provider-Token': token },
      body: fd,
    });
    if (res.status === 403) return false;
    return true;
  }

  function unlockForm() {
    tokenGate.classList.add('hidden');
    intakeApp.classList.remove('hidden');
    if (vehiclesList.children.length === 0) addVehicle();
  }

  async function initAccess() {
    let token = tokenFromUrl || getToken();
    if (token) {
      const ok = await verifyToken(token);
      if (ok) {
        setToken(token);
        unlockForm();
        return;
      }
      sessionStorage.removeItem(TOKEN_KEY);
    }
    tokenGate.classList.remove('hidden');
  }

  tokenForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('accessToken').value.trim();
    if (!token) return;

    tokenError.classList.add('hidden');
    submitBtn.disabled = true;

    const ok = await verifyToken(token);
    if (!ok) {
      tokenError.textContent = 'Zugangscode ungültig.';
      tokenError.classList.remove('hidden');
      return;
    }

    setToken(token);
    unlockForm();
  });

  function renumberVehicles() {
    const cards = vehiclesList.querySelectorAll('.vehicle-card');
    cards.forEach((card, index) => {
      card.dataset.vehicleIndex = String(index);
      card.querySelector('.vehicle-num').textContent = String(index + 1);
      const pickupCheck = card.querySelector('[name="pickup_required"]');
      if (pickupCheck) pickupCheck.id = `pickup_${index}`;
      card.querySelector('.form-check label')?.setAttribute('for', `pickup_${index}`);
      card.querySelector('.remove-vehicle').style.visibility =
        cards.length > 1 ? 'visible' : 'hidden';
    });
    vehicleCount = cards.length;
  }

  function setupVehicleCard(card, index) {
    const pickupCheck = card.querySelector('[name="pickup_required"]');
    const pickupField = card.querySelector('.pickup-field');
    pickupCheck?.addEventListener('change', () => {
      pickupField?.classList.toggle('hidden', !pickupCheck.checked);
    });

    card.querySelector('.remove-vehicle')?.addEventListener('click', () => {
      if (vehiclesList.children.length <= 1) return;
      vehicleFiles.delete(index);
      card.remove();
      renumberVehicles();
      rebuildFileMap();
    });

    const dropzone = card.querySelector('.dropzone');
    const fileInput = dropzone?.querySelector('input[type="file"]');
    const thumbs = card.querySelector('.thumbs');

    function renderThumbs() {
      if (!thumbs) return;
      thumbs.innerHTML = '';
      const files = vehicleFiles.get(index) || [];
      files.forEach((file, fileIdx) => {
        const wrap = document.createElement('div');
        wrap.className = 'thumb';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '×';
        btn.addEventListener('click', () => {
          const list = vehicleFiles.get(index) || [];
          list.splice(fileIdx, 1);
          vehicleFiles.set(index, list);
          renderThumbs();
        });
        wrap.appendChild(img);
        wrap.appendChild(btn);
        thumbs.appendChild(wrap);
      });
    }

    function addFiles(fileList) {
      const list = vehicleFiles.get(index) || [];
      for (const file of fileList) {
        if (!file.type.startsWith('image/')) continue;
        if (list.length >= 12) break;
        list.push(file);
      }
      vehicleFiles.set(index, list);
      renderThumbs();
    }

    dropzone?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      dropzone.classList.add('is-dragover');
    });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
    dropzone?.addEventListener('drop', (ev) => {
      ev.preventDefault();
      dropzone.classList.remove('is-dragover');
      addFiles(ev.dataTransfer?.files || []);
    });
    fileInput?.addEventListener('change', () => addFiles(fileInput.files || []));
  }

  function rebuildFileMap() {
    const newMap = new Map();
    vehiclesList.querySelectorAll('.vehicle-card').forEach((card) => {
      const oldIdx = Number(card.dataset.vehicleIndex);
      if (vehicleFiles.has(oldIdx)) {
        newMap.set(Number(card.dataset.vehicleIndex), vehicleFiles.get(oldIdx));
      }
    });
    vehicleFiles.clear();
    newMap.forEach((v, k) => vehicleFiles.set(k, v));
  }

  function addVehicle() {
    if (vehicleCount >= 20) {
      showAlert('Maximal 20 Fahrzeuge pro Anmeldung.', 'error');
      return;
    }
    const clone = vehicleTemplate.content.cloneNode(true);
    const card = clone.querySelector('.vehicle-card');
    const index = vehiclesList.children.length;
    card.dataset.vehicleIndex = String(index);
    card.querySelector('.vehicle-num').textContent = String(index + 1);
    vehicleFiles.set(index, []);
    setupVehicleCard(card, index);
    vehiclesList.appendChild(card);
    renumberVehicles();
  }

  addVehicleBtn?.addEventListener('click', addVehicle);

  function collectVehicleData(card) {
    return {
      make_model: card.querySelector('[name="make_model"]').value.trim(),
      license_plate: card.querySelector('[name="license_plate"]').value.trim(),
      description: card.querySelector('[name="description"]').value.trim(),
      agreed_work: card.querySelector('[name="agreed_work"]').value.trim(),
      pickup_required: card.querySelector('[name="pickup_required"]').checked,
      pickup_address: card.querySelector('[name="pickup_address"]').value.trim(),
      deadline: card.querySelector('[name="deadline"]').value,
      urgency: card.querySelector('[name="urgency"]').value,
    };
  }

  batchForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const vehicles = [];
    const cards = vehiclesList.querySelectorAll('.vehicle-card');
    cards.forEach((card, i) => {
      vehicles.push(collectVehicleData(card));
    });

    const payload = {
      provider_company: document.getElementById('providerCompany').value.trim(),
      contact_name: document.getElementById('contactName').value.trim(),
      contact_phone: document.getElementById('contactPhone').value.trim(),
      contact_email: document.getElementById('contactEmail').value.trim(),
      batch_notes: document.getElementById('batchNotes').value.trim(),
      vehicles,
    };

    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));

    cards.forEach((card, i) => {
      const files = vehicleFiles.get(i) || [];
      files.forEach((file) => fd.append(`vehicle_${i}_images`, file));
    });

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gesendet …';

    try {
      const res = await fetch('/api/intake/batch', {
        method: 'POST',
        headers: { 'X-Provider-Token': getToken() },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAlert(data.error || 'Senden fehlgeschlagen.', 'error');
        return;
      }

      intakeApp.classList.add('hidden');
      successPanel.classList.remove('hidden');
      successMessage.textContent = data.message || `Referenz: ${data.reference_code}`;
    } catch {
      showAlert('Netzwerkfehler – bitte erneut versuchen.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Alle Fahrzeuge anmelden';
    }
  });

  newBatchBtn?.addEventListener('click', () => {
    successPanel.classList.add('hidden');
    intakeApp.classList.remove('hidden');
    batchForm.reset();
    vehiclesList.innerHTML = '';
    vehicleFiles.clear();
    vehicleCount = 0;
    addVehicle();
    hideAlert();
  });

  initAccess();
})();
