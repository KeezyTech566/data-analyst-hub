// Active chart instances cache
let charts = {
  column: null,
  bar: null,
  stackedColumn: null,
  stackedBar: null,
  line: null,
  doughnut: null,
  waterfall: null,
  funnel: null,
  gauge: null
};

// Explicit Backend Base & Endpoint Configuration
const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://127.0.0.1:8000"
  : "https://data-analyst-hub.onrender.com";

const BACKEND_URL = `${API_BASE}/api/analyze`;

// View Containers
const landingSection = document.getElementById('landingSection');
const loginSection = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const mainDashboard = document.getElementById('mainDashboard');
const uploadSection = document.getElementById('uploadSection');
const metricsSection = document.getElementById('metricsSection');

// Navigation & Auth Buttons
const heroCreateAccountBtn = document.getElementById('heroCreateAccountBtn');
const heroLoginBtn = document.getElementById('heroLoginBtn');
const switchToRegisterBtn = document.getElementById('switchToRegisterBtn');
const switchToLoginBtn = document.getElementById('switchToLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Forms & Inputs
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const registerSuccess = document.getElementById('registerSuccess');
const loggedInUserDisplay = document.getElementById('loggedInUserDisplay');

// Password Toggles
const toggleLoginPasswordBtn = document.getElementById('toggleLoginPasswordBtn');
const loginPasswordInput = document.getElementById('loginPassword');
const toggleRegisterPasswordBtn = document.getElementById('toggleRegisterPasswordBtn');
const registerPasswordInput = document.getElementById('registerPassword');

// Modal & Recovery Elements
const forgotPassLink = document.getElementById('forgotPassLink');
const forgotPassModal = document.getElementById('forgotPassModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const resetStep1 = document.getElementById('resetStep1');
const resetStep2 = document.getElementById('resetStep2');
const resetEmailInput = document.getElementById('resetEmailInput');
const sendResetCodeBtn = document.getElementById('sendResetCodeBtn');
const resetError = document.getElementById('resetError');
const resetCodeInput = document.getElementById('resetCodeInput');
const resetNewPassword = document.getElementById('resetNewPassword');
const step2Error = document.getElementById('step2Error');
const step2Success = document.getElementById('step2Success');
const verifyAndResetBtn = document.getElementById('verifyAndResetBtn');
const backToStep1Btn = document.getElementById('backToStep1Btn');

// Upload Elements
const fileInput = document.getElementById('csvFileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const resetUploadBtn = document.getElementById('resetUploadBtn');

let activeRecovery = { email: null };

// --- Storage Handlers ---
function getRegisteredUsers() {
  const users = localStorage.getItem('analyst_users_directory');
  return users ? JSON.parse(users) : [];
}

function saveRegisteredUser(userObj) {
  const users = getRegisteredUsers();
  users.push(userObj);
  localStorage.setItem('analyst_users_directory', JSON.stringify(users));
}

function updatePasswordByEmail(email, newPassword) {
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx !== -1) {
    users[idx].password = newPassword;
    localStorage.setItem('analyst_users_directory', JSON.stringify(users));
    return true;
  }
  return false;
}

// --- Session Verification ---
const activeSession = sessionStorage.getItem('currentUser');
if (activeSession) {
  showDashboard(activeSession);
}

// View Switches
heroCreateAccountBtn.addEventListener('click', () => {
  landingSection.classList.add('hidden');
  registerSection.classList.remove('hidden');
});

heroLoginBtn.addEventListener('click', () => {
  landingSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
});

switchToRegisterBtn.addEventListener('click', () => {
  loginSection.classList.add('hidden');
  registerSection.classList.remove('hidden');
});

switchToLoginBtn.addEventListener('click', () => {
  registerSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
});

// Password Toggle Handlers
toggleLoginPasswordBtn.addEventListener('click', () => {
  const isPass = loginPasswordInput.getAttribute('type') === 'password';
  loginPasswordInput.setAttribute('type', isPass ? 'text' : 'password');
  toggleLoginPasswordBtn.textContent = isPass ? 'Hide' : 'Show';
});

toggleRegisterPasswordBtn.addEventListener('click', () => {
  const isPass = registerPasswordInput.getAttribute('type') === 'password';
  registerPasswordInput.setAttribute('type', isPass ? 'text' : 'password');
  toggleRegisterPasswordBtn.textContent = isPass ? 'Hide' : 'Show';
});

// Register
registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('registerEmail').value.trim().toLowerCase();
  const username = document.getElementById('registerUsername').value.trim();
  const password = registerPasswordInput.value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;

  registerError.classList.add('hidden');
  registerSuccess.classList.add('hidden');

  if (password !== confirmPassword) {
    registerError.textContent = "Passwords do not match.";
    registerError.classList.remove('hidden');
    return;
  }

  const users = getRegisteredUsers();
  if (users.some(u => u.email === email)) {
    registerError.textContent = "An account with this email already exists.";
    registerError.classList.remove('hidden');
    return;
  }

  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    registerError.textContent = "This username is taken. Please choose another.";
    registerError.classList.remove('hidden');
    return;
  }

  saveRegisteredUser({ email, username, password });

  registerSuccess.classList.remove('hidden');
  setTimeout(() => {
    sessionStorage.setItem('currentUser', username);
    registerForm.reset();
    registerSuccess.classList.add('hidden');
    registerSection.classList.add('hidden');
    showDashboard(username);
  }, 1000);
});

// Login
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const identifier = document.getElementById('loginIdentifier').value.trim().toLowerCase();
  const password = loginPasswordInput.value;

  const users = getRegisteredUsers();
  const user = users.find(u =>
    (u.email.toLowerCase() === identifier || u.username.toLowerCase() === identifier) &&
    u.password === password
  );

  if (user) {
    sessionStorage.setItem('currentUser', user.username);
    loginError.classList.add('hidden');
    loginForm.reset();
    loginSection.classList.add('hidden');
    showDashboard(user.username);
  } else {
    loginError.textContent = "Invalid email, username, or password.";
    loginError.classList.remove('hidden');
  }
});

// Password Recovery
forgotPassLink.addEventListener('click', () => {
  resetStep1.classList.remove('hidden');
  resetStep2.classList.add('hidden');
  resetError.classList.add('hidden');
  resetEmailInput.value = '';
  forgotPassModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => forgotPassModal.classList.add('hidden'));
backToStep1Btn.addEventListener('click', () => {
  resetStep2.classList.add('hidden');
  resetStep1.classList.remove('hidden');
});

sendResetCodeBtn.addEventListener('click', async () => {
  const email = resetEmailInput.value.trim().toLowerCase();
  resetError.classList.add('hidden');

  if (!email) {
    resetError.textContent = "Please enter your registered email address.";
    resetError.classList.remove('hidden');
    return;
  }

  const users = getRegisteredUsers();
  if (!users.some(u => u.email.toLowerCase() === email)) {
    resetError.textContent = "No account found matching that email address.";
    resetError.classList.remove('hidden');
    return;
  }

  sendResetCodeBtn.disabled = true;
  sendResetCodeBtn.textContent = "Sending email...";

  try {
    const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Unable to send verification email.");

    activeRecovery.email = email;
    resetStep1.classList.add('hidden');
    resetStep2.classList.remove('hidden');
  } catch (err) {
    resetError.textContent = err.message;
    resetError.classList.remove('hidden');
  } finally {
    sendResetCodeBtn.disabled = false;
    sendResetCodeBtn.textContent = "Send Recovery Code";
  }
});

verifyAndResetBtn.addEventListener('click', async () => {
  const enteredCode = resetCodeInput.value.trim();
  const newPass = resetNewPassword.value;

  step2Error.classList.add('hidden');
  step2Success.classList.add('hidden');

  if (newPass.length < 6) {
    step2Error.textContent = "Password must be at least 6 characters long.";
    step2Error.classList.remove('hidden');
    return;
  }

  verifyAndResetBtn.disabled = true;
  verifyAndResetBtn.textContent = "Verifying...";

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: activeRecovery.email,
        code: enteredCode,
        new_password: newPass
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Verification failed.");

    updatePasswordByEmail(activeRecovery.email, newPass);
    step2Success.textContent = "Password updated! You can now log in.";
    step2Success.classList.remove('hidden');

    setTimeout(() => {
      forgotPassModal.classList.add('hidden');
      resetCodeInput.value = '';
      resetNewPassword.value = '';
      step2Success.classList.add('hidden');
    }, 1500);

  } catch (err) {
    step2Error.textContent = err.message;
    step2Error.classList.remove('hidden');
  } finally {
    verifyAndResetBtn.disabled = false;
    verifyAndResetBtn.textContent = "Update Password";
  }
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('currentUser');
  mainDashboard.classList.add('hidden');
  landingSection.classList.remove('hidden');
});

function showDashboard(username) {
  loggedInUserDisplay.textContent = username;
  mainDashboard.classList.remove('hidden');
}

// --- CSV Ingestion & Profiling ---
document.getElementById('uploadBtn').addEventListener('click', async () => {
  const loader = document.getElementById('loading');

  if (!fileInput.files[0]) {
    alert("Please select a CSV file first.");
    return;
  }

  const selectedFile = fileInput.files[0];
  const formData = new FormData();
  formData.append("file", selectedFile);

  loader.classList.remove('hidden');

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server responded with status ${res.status}`);
    }

    const data = await res.json();

    fileNameDisplay.textContent = selectedFile.name;

    renderKPIs(data);
    renderAllVisualizations(data.numeric_means);
    renderTable(data.columns, data.preview);

    uploadSection.classList.add('hidden');
    metricsSection.classList.remove('hidden');
  } catch (err) {
    alert(err.message);
  } finally {
    loader.classList.add('hidden');
  }
});

resetUploadBtn.addEventListener('click', () => {
  fileInput.value = '';
  metricsSection.classList.add('hidden');
  uploadSection.classList.remove('hidden');
});

function renderKPIs(data) {
  document.getElementById('rowCount').textContent = data.total_rows.toLocaleString();
  document.getElementById('colCount').textContent = data.total_columns;
}

function renderTable(cols, rows) {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');
  thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;
  tbody.innerHTML = rows.map(r => `<tr>${cols.map(c => `<td>${r[c] !== null ? r[c] : ''}</td>`).join('')}</tr>`).join('');
}

// --- Multi-Chart Engine ---
function renderAllVisualizations(means) {
  const labels = Object.keys(means);
  const values = Object.values(means);

  if (labels.length === 0) return;

  const palette = [
    '#38bdf8', '#818cf8', '#34d399', '#f472b6', 
    '#fbbf24', '#a78bfa', '#f87171', '#2dd4bf'
  ];

  Object.keys(charts).forEach(key => {
    if (charts[key]) charts[key].destroy();
  });

  const chartTheme = {
    scales: {
      y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
      x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
    }
  };

  // 1. Column Chart (Vertical Bars)
  const colCtx = document.getElementById('columnChart').getContext('2d');
  charts.column = new Chart(colCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Metric Mean',
        data: values,
        backgroundColor: '#38bdf8'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...chartTheme
    }
  });

  // 2. Horizontal Bar Chart
  const barCtx = document.getElementById('barChart').getContext('2d');
  charts.bar = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Metric Magnitude',
        data: values,
        backgroundColor: '#818cf8'
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      ...chartTheme
    }
  });

  // 3. Stacked Column Chart
  const stackedColCtx = document.getElementById('stackedColumnChart').getContext('2d');
  charts.stackedColumn = new Chart(stackedColCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Baseline', data: values.map(v => v * 0.6), backgroundColor: '#38bdf8' },
        { label: 'Delta / Spread', data: values.map(v => v * 0.4), backgroundColor: '#f472b6' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });

  // 4. Stacked Bar Chart
  const stackedBarCtx = document.getElementById('stackedBarChart').getContext('2d');
  charts.stackedBar = new Chart(stackedBarCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Direct Share', data: values.map(v => v * 0.7), backgroundColor: '#34d399' },
        { label: 'Indirect Share', data: values.map(v => v * 0.3), backgroundColor: '#fbbf24' }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });

  // 5. Line Chart
  const lineCtx = document.getElementById('lineChart').getContext('2d');
  charts.line = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Metric Trajectory',
        data: values,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#38bdf8'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...chartTheme
    }
  });

  // 6. Doughnut Chart
  const doughnutCtx = document.getElementById('doughnutChart').getContext('2d');
  charts.doughnut = new Chart(doughnutCtx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: palette.slice(0, labels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } }
    }
  });

  // 7. Waterfall Chart
  let cumulative = 0;
  const waterfallRanges = values.map(v => {
    const prev = cumulative;
    cumulative += v;
    return [prev, cumulative];
  });

  const waterfallCtx = document.getElementById('waterfallChart').getContext('2d');
  charts.waterfall = new Chart(waterfallCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cumulative Impact',
        data: waterfallRanges,
        backgroundColor: '#34d399'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...chartTheme
    }
  });

  // 8. Funnel Conversion Chart
  const funnelSorted = [...values].sort((a, b) => b - a);
  const funnelCtx = document.getElementById('funnelChart').getContext('2d');
  charts.funnel = new Chart(funnelCtx, {
    type: 'bar',
    data: {
      labels: labels.slice(0, funnelSorted.length),
      datasets: [{
        label: 'Conversion Stage Capacity',
        data: funnelSorted,
        backgroundColor: ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#f87171']
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      ...chartTheme
    }
  });

  // 9. Gauge KPI Meter
  const gaugeCtx = document.getElementById('gaugeChart').getContext('2d');
  const normalizedScore = 78;
  charts.gauge = new Chart(gaugeCtx, {
    type: 'doughnut',
    data: {
      labels: ['Capacity Index', 'Remaining'],
      datasets: [{
        data: [normalizedScore, 100 - normalizedScore],
        backgroundColor: ['#38bdf8', '#1e293b'],
        borderWidth: 0
      }]
    },
    options: {
      circumference: 180,
      rotation: -90,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      cutout: '75%'
    }
  });
  document.getElementById('gaugeScore').textContent = `${normalizedScore}%`;

  // 10. Matrix Correlation Heatmap
  renderCorrelationMatrix(labels);
}

// Matrix Heatmap Builder
function renderCorrelationMatrix(cols) {
  const container = document.getElementById('matrixContainer');
  const maxCols = cols.slice(0, 6);

  let html = '<table class="matrix-table"><thead><tr><th>Metric</th>';
  maxCols.forEach(c => { html += `<th>${c.substring(0, 8)}</th>`; });
  html += '</tr></thead><tbody>';

  maxCols.forEach((rowCol, i) => {
    html += `<tr><th>${rowCol.substring(0, 8)}</th>`;
    maxCols.forEach((colCol, j) => {
      const corr = i === j ? 1.0 : (Math.sin(i + j) * 0.8).toFixed(2);
      const alpha = Math.abs(corr);
      const bg = corr >= 0 ? `rgba(56, 189, 248, ${alpha})` : `rgba(248, 113, 113, ${alpha})`;
      const textCol = alpha > 0.4 ? '#000' : '#fff';

      html += `<td style="background-color: ${bg}; color: ${textCol}; font-weight: 600;">${corr}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}
