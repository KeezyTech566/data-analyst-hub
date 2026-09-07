document.addEventListener('DOMContentLoaded', () => {
  let charts = {
    column: null,
    bar: null,
    line: null,
    doughnut: null
  };

  const API_BASE = "https://data-analyst-hub.onrender.com";
  const BACKEND_URL = `${API_BASE}/api/analyze`;

  let activeCachedFile = null;
  let currentRole = "Chairman";

  let activeDatasetContext = {
    columns: [],
    preview: []
  };

  const userRoleSelect = document.getElementById('userRoleSelect');
  if (userRoleSelect) {
    userRoleSelect.addEventListener('change', (e) => {
      currentRole = e.target.value;
      if (activeCachedFile) {
        processCSVAnalysis(activeCachedFile);
      }
    });
  }

  const landingSection = document.getElementById('landingSection');
  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');
  const mainDashboard = document.getElementById('mainDashboard');
  const uploadSection = document.getElementById('uploadSection');
  const metricsSection = document.getElementById('metricsSection');
  const transformSection = document.getElementById('transformSection');
  const transformMsg = document.getElementById('transformMsg');

  const heroCreateAccountBtn = document.getElementById('heroCreateAccountBtn');
  const heroLoginBtn = document.getElementById('heroLoginBtn');
  const heroLoginHeaderBtn = document.getElementById('heroLoginHeaderBtn');
  const heroCreateAccountHeaderBtn = document.getElementById('heroCreateAccountHeaderBtn');
  const heroCreateAccountBottomBtn = document.getElementById('heroCreateAccountBottomBtn');
  
  const pricingFreeBtn = document.getElementById('pricingFreeBtn');
  const pricingProBtn = document.getElementById('pricingProBtn');
  const pricingEnterpriseBtn = document.getElementById('pricingEnterpriseBtn');

  const switchToRegisterBtn = document.getElementById('switchToRegisterBtn');
  const switchToLoginBtn = document.getElementById('switchToLoginBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginError = document.getElementById('loginError');
  const registerError = document.getElementById('registerError');
  const registerSuccess = document.getElementById('registerSuccess');
  const loggedInUserDisplay = document.getElementById('loggedInUserDisplay');

  const toggleLoginPasswordBtn = document.getElementById('toggleLoginPasswordBtn');
  const loginPasswordInput = document.getElementById('loginPassword');
  const toggleRegisterPasswordBtn = document.getElementById('toggleRegisterPasswordBtn');
  const registerPasswordInput = document.getElementById('registerPassword');

  const fileInput = document.getElementById('csvFileInput');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const resetUploadBtn = document.getElementById('resetUploadBtn');
  const uploadBtn = document.getElementById('uploadBtn');

  // --- Pricing & Landing CTA Event Handlers ---
  [heroCreateAccountBtn, heroCreateAccountHeaderBtn, heroCreateAccountBottomBtn, pricingFreeBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        if (landingSection) landingSection.classList.add('hidden');
        if (registerSection) registerSection.classList.remove('hidden');
      });
    }
  });

  [heroLoginBtn, heroLoginHeaderBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        if (landingSection) landingSection.classList.add('hidden');
        if (loginSection) loginSection.classList.remove('hidden');
      });
    }
  });

  // Professional Tier Button -> Redirect to your real Paystack Payment Page
  if (pricingProBtn) {
    pricingProBtn.addEventListener('click', () => {
      window.location.href = "https://paystack.shop/pay/vgxz0bm0oo";
    });
  }

  // Enterprise Tier Button -> Contact Sales
  if (pricingEnterpriseBtn) {
    pricingEnterpriseBtn.addEventListener('click', () => {
      window.location.href = "mailto:support@dataanalysthub.com.ng?subject=Enterprise%20Subscription%20Inquiry";
    });
  }

  // --- Google Identity Services (GIS) & Authentication ---
  const GOOGLE_CLIENT_ID = "487022113604-rg3ha3890bhefro90rbv37m5fo1stt0k.apps.googleusercontent.com";

  function completeAuthSession(username, email, provider) {
    const users = getRegisteredUsers();
    let existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!existingUser) {
      existingUser = {
        email: email.toLowerCase(),
        username: username,
        auth_provider: provider,
        created_at: new Date().toISOString()
      };
      saveRegisteredUser(existingUser);
    }

    sessionStorage.setItem('currentUser', existingUser.username);
    sessionStorage.setItem('authProvider', provider);

    if (loginSection) loginSection.classList.add('hidden');
    if (registerSection) registerSection.classList.add('hidden');
    if (landingSection) landingSection.classList.add('hidden');
    showDashboard(existingUser.username);
  }

  async function handleGoogleCredentialResponse(response) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/google-sso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Google authentication failed.");

      completeAuthSession(data.username, data.email, "google");
    } catch (err) {
      alert(`Google Security Verification Error: ${err.message}`);
    }
  }

  window.onload = function () {
    if (window.google) {
      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });
      } catch (e) {
        console.error("GIS Initialization error:", e);
      }
    }
  };

  document.querySelectorAll('.google-auth-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.google) {
        alert("Google services are still loading. Please try again in a moment.");
        return;
      }
      try {
        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            google.accounts.id.renderButton(
              document.querySelector('.google-auth-btn').parentNode,
              { theme: 'outline', size: 'large', width: '100%' }
            );
          }
        });
      } catch (err) {
        alert("Google Auth Popup error: " + err.message);
      }
    });
  });

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

  const activeSession = sessionStorage.getItem('currentUser');
  if (activeSession && mainDashboard) {
    showDashboard(activeSession);
  }

  // --- View Switches ---
  if (switchToRegisterBtn) {
    switchToRegisterBtn.addEventListener('click', () => {
      if (loginSection) loginSection.classList.add('hidden');
      if (registerSection) registerSection.classList.remove('hidden');
    });
  }

  if (switchToLoginBtn) {
    switchToLoginBtn.addEventListener('click', () => {
      if (registerSection) registerSection.classList.add('hidden');
      if (loginSection) loginSection.classList.remove('hidden');
    });
  }

  // --- Password Toggles ---
  if (toggleLoginPasswordBtn && loginPasswordInput) {
    toggleLoginPasswordBtn.addEventListener('click', () => {
      const isPass = loginPasswordInput.getAttribute('type') === 'password';
      loginPasswordInput.setAttribute('type', isPass ? 'text' : 'password');
      toggleLoginPasswordBtn.textContent = isPass ? 'Hide' : 'Show';
    });
  }

  if (toggleRegisterPasswordBtn && registerPasswordInput) {
    toggleRegisterPasswordBtn.addEventListener('click', () => {
      const isPass = registerPasswordInput.getAttribute('type') === 'password';
      registerPasswordInput.setAttribute('type', isPass ? 'text' : 'password');
      toggleRegisterPasswordBtn.textContent = isPass ? 'Hide' : 'Show';
    });
  }

  // --- Registration ---
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('registerEmail').value.trim().toLowerCase();
      const username = document.getElementById('registerUsername').value.trim();
      const password = registerPasswordInput.value;
      const confirmPassword = document.getElementById('registerConfirmPassword').value;

      if (registerError) registerError.classList.add('hidden');
      if (registerSuccess) registerSuccess.classList.add('hidden');

      if (password !== confirmPassword) {
        if (registerError) {
          registerError.textContent = "Passwords do not match.";
          registerError.classList.remove('hidden');
        }
        return;
      }

      const users = getRegisteredUsers();
      if (users.some(u => u.email === email)) {
        if (registerError) {
          registerError.textContent = "An account with this email already exists.";
          registerError.classList.remove('hidden');
        }
        return;
      }

      if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        if (registerError) {
          registerError.textContent = "This username is taken. Please choose another.";
          registerError.classList.remove('hidden');
        }
        return;
      }

      saveRegisteredUser({ email, username, password });

      if (registerSuccess) registerSuccess.classList.remove('hidden');
      setTimeout(() => {
        sessionStorage.setItem('currentUser', username);
        registerForm.reset();
        if (registerSuccess) registerSuccess.classList.add('hidden');
        if (registerSection) registerSection.classList.add('hidden');
        showDashboard(username);
      }, 1000);
    });
  }

  // --- Login ---
  if (loginForm) {
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
        if (loginError) loginError.classList.add('hidden');
        loginForm.reset();
        if (loginSection) loginSection.classList.add('hidden');
        showDashboard(user.username);
      } else {
        if (loginError) {
          loginError.textContent = "Invalid email, username, or password.";
          loginError.classList.remove('hidden');
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('activeTenant');
      activeCachedFile = null;
      activeDatasetContext = { columns: [], preview: [] };
      if (mainDashboard) mainDashboard.classList.add('hidden');
      if (landingSection) landingSection.classList.remove('hidden');
    });
  }

  function showDashboard(username) {
    const activeTenant = sessionStorage.getItem('activeTenant');
    if (loggedInUserDisplay) {
      loggedInUserDisplay.textContent = activeTenant ? `${username} (${activeTenant})` : username;
    }
    if (landingSection) landingSection.classList.add('hidden');
    if (loginSection) loginSection.classList.add('hidden');
    if (registerSection) registerSection.classList.add('hidden');
    if (mainDashboard) mainDashboard.classList.remove('hidden');
  }

  // --- Central Analysis Engine ---
  async function processCSVAnalysis(fileObj) {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.remove('hidden');

    const formData = new FormData();
    formData.append("file", fileObj);

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "X-User-Role": currentRole
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server responded with status ${res.status}`);
      }

      const data = await res.json();

      if (fileNameDisplay) {
        fileNameDisplay.textContent = `${fileObj.name} (View: ${data.applied_role || currentRole})`;
      }

      activeDatasetContext.columns = data.columns || [];
      activeDatasetContext.preview = data.preview || [];

      renderKPIs(data);
      renderAllVisualizations(data.numeric_means);
      renderTable(data.columns, data.preview);

      if (uploadSection) uploadSection.classList.add('hidden');
      if (transformSection) transformSection.classList.remove('hidden');
      if (metricsSection) metricsSection.classList.remove('hidden');
    } catch (err) {
      alert(err.message);
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      if (!fileInput.files[0]) {
        alert("Please select a valid dataset file (CSV, XLSX, XLS, PARQUET, or JSON).");
        return;
      }
      activeCachedFile = fileInput.files[0];
      processCSVAnalysis(activeCachedFile);
    });
  }

  if (resetUploadBtn) {
    resetUploadBtn.addEventListener('click', () => {
      fileInput.value = '';
      activeCachedFile = null;
      activeDatasetContext = { columns: [], preview: [] };
      if (transformSection) transformSection.classList.add('hidden');
      if (metricsSection) metricsSection.classList.add('hidden');
      if (uploadSection) uploadSection.classList.remove('hidden');
    });
  }

  function renderKPIs(data) {
    const rowElem = document.getElementById('rowCount');
    const colElem = document.getElementById('colCount');
    if (rowElem) rowElem.textContent = data.total_rows.toLocaleString();
    if (colElem) colElem.textContent = data.total_columns;
  }

  function renderTable(cols, rows) {
    const thead = document.getElementById('tableHead');
    const tbody = document.getElementById('tableBody');
    if (!thead || !tbody) return;
    thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;
    tbody.innerHTML = rows.map(r => `<tr>${cols.map(c => `<td>${r[c] !== null ? r[c] : ''}</td>`).join('')}</tr>`).join('');
  }

  // --- Multi-Chart Engine ---
  function renderAllVisualizations(means) {
    let labels = Object.keys(means || {});
    let values = Object.values(means || {});

    if (labels.length === 0) {
      labels = ["Metric A", "Metric B", "Metric C", "Metric D", "Metric E"];
      values = [45, 78, 52, 91, 63];
    }

    const palette = [
      '#38bdf8', '#818cf8', '#34d399', '#f472b6', 
      '#fbbf24', '#a78bfa', '#f87171', '#2dd4bf'
    ];

    Object.keys(charts).forEach(key => {
      if (charts[key] && typeof charts[key].destroy === 'function') {
        charts[key].destroy();
        charts[key] = null;
      }
    });

    const chartTheme = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      },
      plugins: {
        legend: { labels: { color: '#94a3b8' } }
      }
    };

    const colCanvas = document.getElementById('columnChart');
    if (colCanvas) {
      charts.column = new Chart(colCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{ label: 'Metric Mean', data: values, backgroundColor: '#38bdf8' }]
        },
        options: chartTheme
      });
    }

    const barCanvas = document.getElementById('barChart');
    if (barCanvas) {
      charts.bar = new Chart(barCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{ label: 'Metric Magnitude', data: values, backgroundColor: '#818cf8' }]
        },
        options: { ...chartTheme, indexAxis: 'y' }
      });
    }

    const lineCanvas = document.getElementById('lineChart');
    if (lineCanvas) {
      charts.line = new Chart(lineCanvas.getContext('2d'), {
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
        options: chartTheme
      });
    }

    const doughnutCanvas = document.getElementById('doughnutChart');
    if (doughnutCanvas) {
      charts.doughnut = new Chart(doughnutCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{ data: values, backgroundColor: palette.slice(0, labels.length) }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8' } } }
        }
      });
    }
  }
});
