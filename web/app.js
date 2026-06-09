const els = {
  signInBtn: document.getElementById('sign-in-btn'),
  signOutBtn: document.getElementById('sign-out-btn'),
  signedOut: document.getElementById('signed-out'),
  signedIn: document.getElementById('signed-in'),
  userLabel: document.getElementById('user-label'),
  appContent: document.getElementById('app-content'),
  profileForm: document.getElementById('profile-form'),
  profileUsername: document.getElementById('profile-username'),
  profileBirthdate: document.getElementById('profile-birthdate'),
  profileSex: document.getElementById('profile-sex'),
  profileHeight: document.getElementById('profile-height'),
  profileTimezone: document.getElementById('profile-timezone'),
  timezoneList: document.getElementById('timezone-list'),
  idealWeightDisplay: document.getElementById('ideal-weight-display'),
  profileTarget: document.getElementById('profile-target'),
  intermediateGoalsList: document.getElementById('intermediate-goals-list'),
  addGoalBtn: document.getElementById('add-goal-btn'),
  form: document.getElementById('weigh-in-form'),
  weight: document.getElementById('weight'),
  datetime: document.getElementById('datetime'),
  status: document.getElementById('status'),
  historyBody: document.getElementById('history-body'),
  historyEmpty: document.getElementById('history-empty'),
  chartCanvas: document.getElementById('weight-chart'),
  chartEmpty: document.getElementById('chart-empty'),
  progressSummary: document.getElementById('progress-summary'),
  progressEmpty: document.getElementById('progress-empty'),
  signedOutHint: document.getElementById('signed-out-hint'),
  navButtons: document.querySelectorAll('.nav-btn'),
  views: {
    home: document.getElementById('view-home'),
    profile: document.getElementById('view-profile'),
    history: document.getElementById('view-history'),
  },
};

const auth = window.WeightTrackerAuth;
const dt = window.WeightTrackerDateTime;
const progress = window.WeightTrackerProgress;
const VIEW_NAMES = ['home', 'profile', 'history'];
let chart;
let loadedProfile = null;
let chartWeighIns = [];
let currentView = 'home';

function getApiBaseUrl() {
  const base = window.APP_CONFIG?.apiBaseUrl;
  if (base === undefined || base === null || base === '') {
    throw new Error(
      'API URL is not configured. Deploy with CDK or set apiBaseUrl in config.js.',
    );
  }
  if (base.startsWith('/')) {
    const origin = window.location.origin.replace(/\/$/, '');
    const path = base.startsWith('/') ? base : `/${base}`;
    return `${origin}${path.endsWith('/') ? path : `${path}/`}`;
  }
  return base.endsWith('/') ? base : `${base}/`;
}

function setStatus(message, type = '') {
  els.status.textContent = message;
  els.status.className = type ? `status ${type}` : 'status';
}

function getDisplayTimezone() {
  return dt.getProfileTimezone(loadedProfile);
}

function setDefaultDateTime() {
  els.datetime.value = dt.nowForDatetimeLocal(getDisplayTimezone());
}

function toApiDateTime(datetimeLocalValue) {
  return dt.datetimeLocalToUtcIso(datetimeLocalValue, getDisplayTimezone());
}

function showView(name) {
  if (!VIEW_NAMES.includes(name)) {
    return;
  }

  currentView = name;

  for (const viewName of VIEW_NAMES) {
    const panel = els.views[viewName];
    const isActive = viewName === name;
    panel.classList.toggle('hidden', !isActive);
    panel.hidden = !isActive;

    const navBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
    if (navBtn) {
      navBtn.setAttribute('aria-selected', String(isActive));
    }
  }

  if (name === 'history' && chart) {
    requestAnimationFrame(() => chart.resize());
  }

  if (location.hash !== `#${name}`) {
    history.replaceState(null, '', `#${name}`);
  }
}

function initNavigation() {
  for (const btn of els.navButtons) {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  }

  const hash = location.hash.replace(/^#/, '');
  if (VIEW_NAMES.includes(hash)) {
    showView(hash);
  } else {
    showView('home');
  }

  window.addEventListener('hashchange', () => {
    const next = location.hash.replace(/^#/, '');
    if (VIEW_NAMES.includes(next) && next !== currentView) {
      showView(next);
    }
  });
}

function updateAuthUi() {
  const signedIn = auth.isAuthenticated();
  els.signedOut.classList.toggle('hidden', signedIn);
  els.signedIn.classList.toggle('hidden', !signedIn);
  els.signedOutHint.classList.toggle('hidden', signedIn);
  els.appContent.classList.toggle('hidden', !signedIn);

  if (signedIn) {
    els.userLabel.textContent = auth.getUserDisplayName();
    showView(currentView && VIEW_NAMES.includes(currentView) ? currentView : 'home');
  } else {
    history.replaceState(null, '', location.pathname);
  }
}

async function apiRequest(path, options = {}) {
  const token = auth.getIdToken();
  if (!token) {
    throw new Error('You must sign in to continue.');
  }

  const url = `${getApiBaseUrl()}${path.replace(/^\//, '')}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    auth.signOut();
    throw new Error('Session expired. Please sign in again.');
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.error ?? `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function getProfile() {
  try {
    return await apiRequest('profile');
  } catch (err) {
    if (err.status === 404) {
      return null;
    }
    throw err;
  }
}

async function saveProfile(profile) {
  return apiRequest('profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

function updateIdealWeightDisplay(profile) {
  if (!profile?.idealWeight) {
    els.idealWeightDisplay.classList.add('hidden');
    return;
  }

  const range = profile.idealWeightRange;
  const rangeText = range
    ? ` (healthy BMI range: ${range.min}–${range.max} lbs)`
    : '';
  els.idealWeightDisplay.textContent = `Estimated ideal weight: ${profile.idealWeight} lbs${rangeText}`;
  els.idealWeightDisplay.classList.remove('hidden');
}

function createGoalRow(goal = {}) {
  const row = document.createElement('div');
  row.className = 'goal-row';

  const weightInput = document.createElement('input');
  weightInput.type = 'number';
  weightInput.step = '0.1';
  weightInput.min = '50';
  weightInput.max = '600';
  weightInput.placeholder = 'Weight';
  weightInput.className = 'goal-weight';
  weightInput.value = goal.weight ?? '';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.placeholder = 'Label (optional)';
  labelInput.className = 'goal-label';
  labelInput.maxLength = 50;
  labelInput.value = goal.label ?? '';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn danger';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => row.remove());

  row.append(weightInput, labelInput, removeBtn);
  return row;
}

function fillGoalsForm(goals) {
  els.intermediateGoalsList.replaceChildren();
  for (const goal of goals ?? []) {
    els.intermediateGoalsList.appendChild(createGoalRow(goal));
  }
}

function readGoalsFromForm() {
  const goals = [];
  for (const row of els.intermediateGoalsList.querySelectorAll('.goal-row')) {
    const weight = Number(row.querySelector('.goal-weight').value);
    const label = row.querySelector('.goal-label').value.trim();
    if (!Number.isFinite(weight)) {
      continue;
    }
    goals.push(label ? { weight, label } : { weight });
  }
  return goals;
}

function fillProfileForm(profile) {
  els.profileUsername.value = profile.username;
  els.profileBirthdate.value = profile.birthdate;
  els.profileSex.value = profile.sex;
  els.profileHeight.value = String(profile.heightInches);
  els.profileTimezone.value =
    profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  els.profileTarget.value =
    profile.targetWeight !== undefined ? String(profile.targetWeight) : '';
  fillGoalsForm(profile.intermediateGoals);
  updateIdealWeightDisplay(profile);
}

function buildProfilePayload() {
  const targetRaw = els.profileTarget.value.trim();
  const payload = {
    username: els.profileUsername.value.trim(),
    birthdate: els.profileBirthdate.value,
    sex: els.profileSex.value,
    heightInches: Number(els.profileHeight.value),
    timezone: els.profileTimezone.value.trim(),
    intermediateGoals: readGoalsFromForm(),
  };

  if (targetRaw !== '') {
    payload.targetWeight = Number(targetRaw);
  }

  return payload;
}

function applyLoadedProfile(profile) {
  loadedProfile = profile;
  if (profile) {
    fillProfileForm(profile);
  }
  setDefaultDateTime();
}

async function loadProfile() {
  try {
    const profile = await getProfile();
    applyLoadedProfile(profile);
    if (!profile) {
      els.profileTimezone.value =
        Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function onProfileSubmit(event) {
  event.preventDefault();

  setStatus('Saving profile…');

  try {
    const profile = await saveProfile(buildProfilePayload());
    applyLoadedProfile(profile);
    await refreshHistory();
    showView('home');
    setStatus('Profile saved.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function listWeighIns() {
  const data = await apiRequest('weigh-ins');
  return data.weighIns ?? [];
}

async function addWeighIn(dateTime, weight) {
  return apiRequest('weigh-ins', {
    method: 'POST',
    body: JSON.stringify({ DateTime: dateTime, weight }),
  });
}

async function deleteWeighIn(dateTime) {
  const encoded = encodeURIComponent(dateTime);
  return apiRequest(`weigh-ins/${encoded}`, { method: 'DELETE' });
}

function appendProgressMetric(container, title, value, detail, extraClass = '') {
  const item = document.createElement('dl');
  item.className = `progress-metric${extraClass ? ` ${extraClass}` : ''}`;

  const dtEl = document.createElement('dt');
  dtEl.textContent = title;

  const ddEl = document.createElement('dd');
  ddEl.textContent = value;

  item.append(dtEl, ddEl);

  if (detail) {
    const detailEl = document.createElement('p');
    detailEl.className = 'progress-detail';
    detailEl.textContent = detail;
    item.appendChild(detailEl);
  }

  container.appendChild(item);
}

function renderProgressSummary(weighIns, profile = loadedProfile) {
  const summary = progress.computeProgressSummary(weighIns, profile);

  if (!summary.hasWeighIns) {
    els.progressSummary.classList.add('hidden');
    els.progressSummary.replaceChildren();
    els.progressEmpty.classList.remove('hidden');
    return;
  }

  els.progressEmpty.classList.add('hidden');
  els.progressSummary.classList.remove('hidden');
  els.progressSummary.replaceChildren();

  appendProgressMetric(
    els.progressSummary,
    'Initial weigh-in',
    summary.startingWeight.toFixed(1) + ' lbs',
  );
  appendProgressMetric(
    els.progressSummary,
    'Last weigh-in',
    summary.currentWeight.toFixed(1) + ' lbs',
  );
  appendProgressMetric(
    els.progressSummary,
    summary.change.label,
    summary.change.value,
  );

  const gp = summary.goalProgress;
  if (gp.kind === 'prompt') {
    appendProgressMetric(els.progressSummary, gp.title, gp.message, null, 'prompt');
  } else if (gp.kind === 'percent') {
    appendProgressMetric(els.progressSummary, gp.title, gp.value, gp.detail);
  } else {
    appendProgressMetric(els.progressSummary, gp.title, gp.value, gp.detail);
  }

  const tp = summary.targetProgress;
  if (tp.kind === 'prompt') {
    appendProgressMetric(els.progressSummary, tp.title, tp.message, null, 'prompt');
  } else {
    appendProgressMetric(els.progressSummary, tp.title, tp.value, tp.detail);
  }
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
    dateCell.textContent = dt.formatDisplayDateTime(
      entry.DateTime,
      getDisplayTimezone(),
    );

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

function buildReferenceLineDataset(label, weight, color, dash, pointCount) {
  return {
    label,
    data: Array.from({ length: pointCount }, () => weight),
    borderColor: color,
    borderWidth: 2,
    borderDash: dash,
    pointRadius: 0,
    fill: false,
    tension: 0,
  };
}

function renderChart(weighIns, profile = loadedProfile) {
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

  chartWeighIns = sorted;
  const timeZone = getDisplayTimezone();
  const labels = sorted.map((w) =>
    dt.formatDisplayDate(w.DateTime, timeZone),
  );
  const values = sorted.map((w) => w.weight);

  const datasets = [
    {
      label: 'Weight (lbs)',
      data: values,
      borderColor: '#0d7a6f',
      backgroundColor: 'rgba(13, 122, 111, 0.12)',
      fill: true,
      tension: 0.2,
      pointRadius: 4,
    },
  ];

  if (profile?.targetWeight) {
    datasets.push(
      buildReferenceLineDataset(
        `Target (${profile.targetWeight} lbs)`,
        profile.targetWeight,
        '#b42318',
        [8, 4],
        labels.length,
      ),
    );
  }

  if (profile?.idealWeight) {
    datasets.push(
      buildReferenceLineDataset(
        `Ideal (${profile.idealWeight} lbs)`,
        profile.idealWeight,
        '#175cd3',
        [4, 4],
        labels.length,
      ),
    );
  }

  for (const goal of profile?.intermediateGoals ?? []) {
    const name = goal.label
      ? `${goal.label} (${goal.weight} lbs)`
      : `Goal (${goal.weight} lbs)`;
    datasets.push(
      buildReferenceLineDataset(name, goal.weight, '#b54708', [2, 2], labels.length),
    );
  }

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(els.chartCanvas, {
    type: 'line',
    data: { labels, datasets },
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
        legend: { display: datasets.length > 1 },
        tooltip: {
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            title(items) {
              const idx = items[0].dataIndex;
              return dt.formatDisplayDateTime(
                chartWeighIns[idx].DateTime,
                timeZone,
              );
            },
            label(ctx) {
              return `Weight: ${ctx.parsed.y} lbs`;
            },
          },
        },
      },
    },
  });
}

async function refreshHistory() {
  if (!auth.isAuthenticated()) {
    return;
  }

  setStatus('Loading…');

  try {
    const weighIns = await listWeighIns();
    renderProgressSummary(weighIns, loadedProfile);
    renderTable(weighIns);
    renderChart(weighIns, loadedProfile);
    setStatus(`Loaded ${weighIns.length} weigh-in(s).`, 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function onSubmit(event) {
  event.preventDefault();

  const weight = Number(els.weight.value);
  const dateTime = toApiDateTime(els.datetime.value);

  setStatus('Saving…');

  try {
    await addWeighIn(dateTime, weight);
    els.weight.value = '';
    setDefaultDateTime();
    await refreshHistory();
    setStatus('Weigh-in saved.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function onDelete(entry) {
  const label = dt.formatDisplayDateTime(entry.DateTime, getDisplayTimezone());
  if (!window.confirm(`Delete weigh-in from ${label}?`)) {
    return;
  }

  setStatus('Deleting…');

  try {
    await deleteWeighIn(entry.DateTime);
    await refreshHistory();
    setStatus('Weigh-in deleted.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

function init() {
  dt.populateTimezoneDatalist(els.timezoneList);
  initNavigation();
  updateAuthUi();
  setDefaultDateTime();

  if (auth.isAuthenticated()) {
    loadProfile().then(() => refreshHistory());
  } else if (!window.APP_CONFIG?.auth?.clientId) {
    setStatus(
      'Set auth settings in config.js for local use, or open the CloudFront URL after deploy.',
      'error',
    );
  }
}

els.signInBtn.addEventListener('click', () => auth.signIn());
els.signOutBtn.addEventListener('click', () => auth.signOut());
els.addGoalBtn.addEventListener('click', () => {
  els.intermediateGoalsList.appendChild(createGoalRow());
});
els.profileForm.addEventListener('submit', onProfileSubmit);
els.form.addEventListener('submit', onSubmit);

init();
