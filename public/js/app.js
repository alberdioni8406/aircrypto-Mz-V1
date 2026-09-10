/* AirCrypto MZ — Frontend (no secrets) */

const CRYPTO_META = {
  BCH: { icon: '💚', label: 'Bitcoin Cash', recommended: true },
  USDT: { icon: '💵', label: 'USDT' },
  BTC: { icon: '🟠', label: 'Bitcoin' },
  LTC: { icon: '⚫', label: 'Litecoin' },
  ETH: { icon: '🔷', label: 'Ethereum' },
};

let state = {
  service: 'airtime',
  provider: 'Vodacom',
  phone: '',
  amount: 100,
  coin: 'BCH',
  order: null,
  pollTimer: null,
  countdownTimer: null,
  config: null,
};

// ─── Boot ───────────────────────────────────────────────────
async function boot() {
  try {
    const res = await fetch('/api/config');
    state.config = await res.json();
  } catch {
    state.config = {
      enabledCryptos: ['BCH', 'USDT', 'BTC', 'LTC', 'ETH'],
      allowSimulation: false,
    };
  }
  renderCryptos();
  validateForm();
}

function renderCryptos() {
  const list = document.getElementById('cryptoList');
  const coins = state.config?.enabledCryptos || ['BCH'];
  list.innerHTML = coins
    .map((c, i) => {
      const meta = CRYPTO_META[c] || { icon: '🪙', label: c };
      const isBch = c === 'BCH';
      const selected = state.coin === c ? 'selected' : '';
      const bchClass = isBch ? 'bch-first' : '';
      const badge = isBch ? '<span class="c-badge">Recomendado</span>' : '';
      return `
        <button type="button" class="crypto-btn ${selected} ${bchClass}" data-coin="${c}" onclick="selectCrypto(this)">
          <span class="c-icon">${meta.icon}</span>
          <span class="c-name">${meta.label} (${c})</span>
          ${badge}
        </button>`;
    })
    .join('');
}

// ─── UI helpers ─────────────────────────────────────────────
function selectService(el) {
  if (el.disabled) return;
  document.querySelectorAll('.service-btn').forEach((b) => b.classList.remove('selected'));
  el.classList.add('selected');
  state.service = el.dataset.service;
  validateForm();
}

function selectOp(el) {
  document.querySelectorAll('.op-btn').forEach((b) => b.classList.remove('selected'));
  el.classList.add('selected');
  state.provider = el.dataset.op;
  validateForm();
}

function selectAmount(val, el) {
  document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('selected'));
  el.classList.add('selected');
  state.amount = val;
  document.getElementById('amountInput').value = '';
  validateForm();
}

function onAmountInput(input) {
  document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('selected'));
  const v = parseFloat(input.value);
  state.amount = Number.isFinite(v) ? v : 0;
  validateForm();
}

function onPhoneInput(input) {
  input.value = input.value.replace(/\D/g, '').slice(0, 9);
  state.phone = input.value;
  validateForm();
}

function selectCrypto(el) {
  document.querySelectorAll('.crypto-btn').forEach((b) => b.classList.remove('selected'));
  el.classList.add('selected');
  state.coin = el.dataset.coin;
}

function validateForm() {
  const phoneOk = /^\d{9}$/.test(state.phone) && /^[2-9]/.test(state.phone);
  const amountOk = state.amount >= 10 && state.amount <= 5000;
  document.getElementById('nextBtn').disabled = !(phoneOk && amountOk && state.service === 'airtime');
}

function setStep(n) {
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`dot${i}`);
    dot.classList.remove('active', 'done');
    if (i < n) dot.classList.add('done');
    if (i === n) dot.classList.add('active');
  }
  const labels = ['O que quer?', 'Pagamento', 'Recibo'];
  document.getElementById('stepLabel').textContent = labels[n - 1] || '';
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(`screen${n}`).classList.add('active');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function copyAddress() {
  const addr = state.order?.payment_address;
  if (!addr) return;
  navigator.clipboard.writeText(addr).then(() => toast('📋 Endereço copiado!'));
}

function copyRef() {
  const ref = state.order?.order_reference;
  if (!ref) return;
  navigator.clipboard.writeText(ref).then(() => toast('📋 Referência copiada!'));
}

// ─── Flow ───────────────────────────────────────────────────
async function goToPayment() {
  const btn = document.getElementById('nextBtn');
  btn.disabled = true;
  btn.textContent = 'A criar pedido…';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_type: state.service,
        provider: state.provider,
        customer_identifier: state.phone,
        local_amount: state.amount,
        crypto_currency: state.coin,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao criar pedido');
    }
    state.order = data;
    showPaymentScreen(data);
  } catch (e) {
    alert(e.message || 'Erro de rede');
    btn.disabled = false;
    btn.textContent = 'Continuar →';
    return;
  }
  btn.disabled = false;
  btn.textContent = 'Continuar →';
}

function showPaymentScreen(order) {
  setStep(2);
  document.getElementById('s-service').textContent =
    order.service_type === 'airtime' ? 'Airtime' : order.service_type;
  document.getElementById('s-op').textContent = order.provider;
  document.getElementById('s-phone').textContent = order.customer_identifier;
  document.getElementById('s-amount').textContent = `${order.local_amount} MZN`;
  document.getElementById('s-total').textContent = `${order.total_price} MZN`;
  document.getElementById('s-crypto').textContent = order.crypto_currency;

  const meta = CRYPTO_META[order.crypto_currency] || {};
  document.getElementById('payCoin').textContent = `${meta.label || order.crypto_currency} (${order.crypto_currency})`;
  document.getElementById('payAmount').textContent = `${order.crypto_amount} ${order.crypto_currency}`;
  document.getElementById('payAddress').textContent = order.payment_address || '—';

  const qr = document.getElementById('qrContainer');
  if (order.qr_data_url) {
    qr.innerHTML = `<img src="${order.qr_data_url}" alt="QR Code de pagamento">`;
  } else {
    qr.innerHTML = `<div class="qr-placeholder">Endereço<br>disponível abaixo</div>`;
  }

  // Simulation button only in dev
  const simBtn = document.getElementById('simBtn');
  simBtn.style.display = state.config?.allowSimulation ? 'block' : 'none';

  startCountdown(order.expires_at);
  startPolling(order.order_reference);
}

function startCountdown(expiresAt) {
  clearInterval(state.countdownTimer);
  const el = document.getElementById('timerDisplay');
  if (!expiresAt) {
    el.textContent = '15:00';
    let remaining = 15 * 60;
    state.countdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(state.countdownTimer);
        el.textContent = '00:00';
        return;
      }
      const m = String(Math.floor(remaining / 60)).padStart(2, '0');
      const s = String(remaining % 60).padStart(2, '0');
      el.textContent = `${m}:${s}`;
    }, 1000);
    return;
  }
  state.countdownTimer = setInterval(() => {
    const end = new Date(expiresAt).getTime();
    const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const m = String(Math.floor(left / 60)).padStart(2, '0');
    const s = String(left % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
    if (left <= 0) clearInterval(state.countdownTimer);
  }, 1000);
}

function startPolling(ref) {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(ref)}`);
      if (!res.ok) return;
      const data = await res.json();
      state.order = { ...state.order, ...data };

      if (data.payment_status === 'confirmed' && data.fulfillment_status === 'completed') {
        clearInterval(state.pollTimer);
        showSuccess(data);
      } else if (data.payment_status === 'confirmed' && data.fulfillment_status === 'failed') {
        clearInterval(state.pollTimer);
        showPendingFulfillment(data);
      } else if (data.payment_status === 'expired' || data.payment_status === 'failed') {
        clearInterval(state.pollTimer);
        document.getElementById('pollingRow').innerHTML =
          `<span style="color:var(--danger)">Pagamento ${data.payment_status}</span>`;
      } else if (data.payment_status === 'confirmed') {
        document.getElementById('pollingRow').innerHTML =
          `<div class="spinner"></div><span>Pagamento recebido — a processar serviço…</span>`;
      }
    } catch {
      /* ignore transient network errors */
    }
  }, 4000);
}

function showSuccess(order) {
  setStep(3);
  document.getElementById('statusIcon').textContent = '✅';
  document.getElementById('statusTitle').textContent = 'Serviço entregue';
  document.getElementById('statusSub').textContent =
    `${order.local_amount} MZN de airtime enviado para ${order.customer_identifier}`;
  document.getElementById('r-service').textContent = `${order.provider} Airtime`;
  document.getElementById('r-phone').textContent = order.customer_identifier;
  document.getElementById('r-amount').textContent = `${order.local_amount} MZN`;
  document.getElementById('r-crypto').textContent = order.crypto_currency;
  document.getElementById('r-ref').textContent = order.order_reference;
}

function showPendingFulfillment(order) {
  setStep(3);
  document.getElementById('statusIcon').textContent = '⏳';
  document.getElementById('statusTitle').textContent = 'Pagamento recebido';
  document.getElementById('statusSub').textContent =
    'O seu serviço está a ser processado. Guarde a referência.';
  document.getElementById('r-service').textContent = `${order.provider} Airtime`;
  document.getElementById('r-phone').textContent = order.customer_identifier;
  document.getElementById('r-amount').textContent = `${order.local_amount} MZN`;
  document.getElementById('r-crypto').textContent = order.crypto_currency;
  document.getElementById('r-ref').textContent = order.order_reference;
}

async function simulatePayment() {
  if (!state.order?.order_reference) return;
  if (!state.config?.allowSimulation) return;
  const res = await fetch(`/api/orders/${encodeURIComponent(state.order.order_reference)}/simulate-payment`, {
    method: 'POST',
  });
  const data = await res.json();
  if (data.ok && data.order?.fulfillment_status === 'completed') {
    clearInterval(state.pollTimer);
    // refetch full order for display
    const full = await fetch(`/api/orders/${encodeURIComponent(state.order.order_reference)}`).then((r) => r.json());
    showSuccess(full);
  } else if (data.order?.payment_status === 'confirmed') {
    document.getElementById('pollingRow').innerHTML =
      `<div class="spinner"></div><span>Pagamento simulado — a processar…</span>`;
  } else {
    alert(data.error || 'Simulação falhou (verifique credenciais Reloadly em sandbox)');
  }
}

function goBack() {
  clearInterval(state.pollTimer);
  clearInterval(state.countdownTimer);
  setStep(1);
  validateForm();
}

function resetAll() {
  clearInterval(state.pollTimer);
  clearInterval(state.countdownTimer);
  state.order = null;
  state.phone = '';
  state.amount = 100;
  document.getElementById('phoneInput').value = '';
  document.getElementById('amountInput').value = '';
  document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('selected'));
  document.querySelectorAll('.preset-btn')[1]?.classList.add('selected');
  setStep(1);
  validateForm();
}

boot();
