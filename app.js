let charts = {
  bar: null,
  line: null,
  doughnut: null
};

const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://127.0.0.1:8000/api/analyze"
  : "https://data-analyst-hub.onrender.com/api/analyze";

// View Elements
const landingSection = document.getElementById('landingSection');
const authSection = document.getElementById('authSection');
const mainDashboard = document.getElementById('mainDashboard');
const uploadSection = document.getElementById('uploadSection');
const metricsSection = document.getElementById('metricsSection');

// Auth & Modals
const getStartedBtn = document.getElementById('getStartedBtn');
const loginForm = document.getElementById('loginForm');
const authError = document.getElementById('authError');
const logoutBtn = document.getElementById('logoutBtn');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const forgotPassLink = document.getElementById('forgotPassLink');
const forgotPassModal = document.getElementById('forgotPassModal');
const closeModalBtn = document.getElementById('closeModalBtn');

// Data Elements
const fileInput = document.getElementById('csvFileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const resetUploadBtn = document.getElementById('resetUploadBtn');

// Initial Route Check
if (sessionStorage.getItem('isAuthenticated') === 'true') {
  showDashboard();
}

// Landing to Auth
getStartedBtn.addEventListener('click', () => {
  landingSection.classList.add('hidden');
  authSection.classList.remove('hidden');
});

// Password Show/Hide Toggle
togglePasswordBtn.addEventListener('click', () => {
  const isPass = passwordInput.getAttribute('type') === 'password';
  passwordInput.setAttribute('type', isPass ? 'text' : 'password');
  togglePasswordBtn.textContent = isPass ? 'Hide' : 'Show';
});

// Forgot Password Modal
forgotPassLink.addEventListener('click', () => forgotPassModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => forgotPassModal.classList.add('hidden'));

// Login Submission
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const user = document.getElementById('username').value.trim();
  const pass = passwordInput.value;

  if (user === 'admin' && pass === 'analyst123') {
    sessionStorage.setItem('isAuthenticated', 'true');
    authError.classList.add('hidden');
    loginForm.reset();
    showDashboard();
  } else {
    authError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('isAuthenticated');
  mainDashboard.classList.add('hidden');
  authSection.classList.add('hidden');
  landingSection.classList.remove('hidden');
});

function showDashboard() {
  landingSection.classList.add('hidden');
  authSection.classList.add('hidden');
  mainDashboard.classList.remove('hidden');
}

// CSV File Upload & Processing
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

    // Display selected file name
    fileNameDisplay.textContent = selectedFile.name;

    // Render Data
    renderKPIs(data);
    renderAllCharts(data.numeric_means);
    renderTable(data.columns, data.preview);

    // Hide the file upload card and reveal the metrics
    uploadSection.classList.add('hidden');
    metricsSection.classList.remove('hidden');
  } catch (err) {
    alert(err.message);
  } finally {
    loader.classList.add('hidden');
  }
});

// Analyze Another File Action
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

function renderAllCharts(means) {
  const labels = Object.keys(means);
  const values = Object.values(means);

  const colors = [
    '#38bdf8', '#818cf8', '#34d399', '#f472b6', 
    '#fbbf24', '#a78bfa', '#f87171', '#2dd4bf'
  ];

  Object.keys(charts).forEach(key => {
    if (charts[key]) charts[key].destroy();
  });

  // 1. Bar Chart
  const barCtx = document.getElementById('barChart').getContext('2d');
  charts.bar = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Mean Value',
        data: values,
        backgroundColor: colors.slice(0, labels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { ticks: { color: '#94a3b8' } },
        x: { ticks: { color: '#94a3b8' } }
      }
    }
  });

  // 2. Line Chart
  const lineCtx = document.getElementById('lineChart').getContext('2d');
  charts.line = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Trajectory Across Metrics',
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
      scales: {
        y: { ticks: { color: '#94a3b8' } },
        x: { ticks: { color: '#94a3b8' } }
      }
    }
  });

  // 3. Doughnut Chart
  const doughnutCtx = document.getElementById('doughnutChart').getContext('2d');
  charts.doughnut = new Chart(doughnutCtx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8' }
        }
      }
    }
  });
}
