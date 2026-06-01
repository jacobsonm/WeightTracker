const STORAGE_KEY = 'weightTracker.username';

const els = {
  username: document.getElementById('username'),
  loadBtn: document.getElementById('load-btn'),
  form: document.getElementById('weigh-in-form'),
  weight: document.getElementById('weight'),
  datetime: document.getElementById('datetime'),
  status: document.getElementById('status'),
  historyBody: document.getElementById('history-body'),
  historyEmpty: document.getElementById('history-empty'),
  chartCanvas: document.getElementById('weight-chart'),
  chartEmpty: document.getElementById('chart-empty'),
};

let chart;

function getApiBaseUrl() {
  const base = window.APP_CONFIG?.apiBaseUrl;
  if (!base) {
    throw new Error(
      'API URL is not configured. Deploy with CDK or set apiBaseUrl in config.js.',
    );
  }
  return base.endsWith('/') ? base : `${base}/`;
}

function setStatus(message, type = '') {
  els.status.textContent = message;
  els.status.className = type ? `status ${type}` : 'status';
}

function getUsername() {
  return els.username.value.trim();
}

function saveUsername(username) {
  localStorage.setItem(STORAGE_KEY, username);
}

function loadStoredUsername() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    els.username.value = stored;
  }
}

function setDefaultDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  els.datetime.value = local.toISOString().slice(0, 16);
}

function toApiDateTime(datetimeLocalValue) {
  return new Date(datetimeLocalValue).toISOString();
}

function formatDisplayDateTime(isoUtc) {
  return isoUtc.replace('T', ' ').replace('Z', ' UTC');
}

async function apiRequest(path, options = {}) {
  const url = `${getApiBaseUrl()}${path.replace(/^\//, '')}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.error ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

async function listWeighIns(username) {
  const params = new URLSearchParams({ Username: username });
  const data = await apiRequest(`weigh-ins?${params}`);
  return data.weighIns ?? [];
}

async function addWeighIn(username, dateTime, weight) {
  return apiRequest('weigh-ins', {
    method: 'POST',
    body: JSON.stringify({
      Username: username,
      DateTime: dateTime,
      weight,
    }),
  });
}

async function deleteWeighIn(username, dateTime) {
  const encoded = encodeURIComponent(dateTime);
  const params = new URLSearchParams({ Username: username });
  return apiRequest(`weigh-ins/${encoded}?${params}`, {
    method: 'DELETE',
  });
}

function renderTable(weighIns) {
  els.historyBody.replaceChildren();

  if (weighIns.length === 0) {
    els.historyEmpty.classList.remove('hidden');
    return;
  }

  els.historyEmpty.classList.add('hidden');

  for (const entry of weighIns) {
    const row = document.createElement('tr');

    const dateCell = document.createElement('td');
    dateCell.textContent = formatDisplayDateTime(entry.DateTime);

    const weightCell = document.createElement('td');
    weightCell.textContent = entry.weight.toFixed(1);

    const actionsCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => onDelete(entry));
    actionsCell.appendChild(deleteBtn);

    row.append(dateCell, weightCell, actionsCell);
    els.historyBody.appendChild(row);
  }
}

function renderChart(weighIns) {
  const sorted = [...weighIns].sort((a, b) =>
    a.DateTime.localeCompare(b.DateTime),
  );

  if (sorted.length === 0) {
    els.chartEmpty.classList.remove('hidden');
    if (chart) {
      chart.destroy();
      chart = undefined;
    }
    return;
  }

  els.chartEmpty.classList.add('hidden');

  const labels = sorted.map((w) => formatDisplayDateTime(w.DateTime));
  const values = sorted.map((w) => w.weight);

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(els.chartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Weight (lbs)',
          data: values,
          borderColor: '#0d7a6f',
          backgroundColor: 'rgba(13, 122, 111, 0.12)',
          fill: true,
          tension: 0.2,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: 'lbs' },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

async function refreshHistory() {
  const username = getUsername();
  if (!username) {
    setStatus('Enter a username to load history.', 'error');
    return;
  }

  saveUsername(username);
  setStatus('Loading…');

  try {
    const weighIns = await listWeighIns(username);
    renderTable(weighIns);
    renderChart(weighIns);
    setStatus(`Loaded ${weighIns.length} weigh-in(s).`, 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function onSubmit(event) {
  event.preventDefault();

  const username = getUsername();
  if (!username) {
    setStatus('Enter a username before saving.', 'error');
    return;
  }

  const weight = Number(els.weight.value);
  const dateTime = toApiDateTime(els.datetime.value);

  setStatus('Saving…');

  try {
    await addWeighIn(username, dateTime, weight);
    saveUsername(username);
    els.weight.value = '';
    setDefaultDateTime();
    await refreshHistory();
    setStatus('Weigh-in saved.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function onDelete(entry) {
  const username = getUsername();
  if (!username) {
    return;
  }

  const label = formatDisplayDateTime(entry.DateTime);
  if (!window.confirm(`Delete weigh-in from ${label}?`)) {
    return;
  }

  setStatus('Deleting…');

  try {
    await deleteWeighIn(username, entry.DateTime);
    await refreshHistory();
    setStatus('Weigh-in deleted.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

els.loadBtn.addEventListener('click', refreshHistory);
els.form.addEventListener('submit', onSubmit);

loadStoredUsername();
setDefaultDateTime();

if (!window.APP_CONFIG?.apiBaseUrl) {
  setStatus(
    'Set apiBaseUrl in config.js for local use, or open the CloudFront URL after deploy.',
    'error',
  );
}
