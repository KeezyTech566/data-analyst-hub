
document.addEventListener('DOMContentLoaded', () => {
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
  const API_BASE = "https://data-analyst-hub.onrender.com";
  const BACKEND_URL = `${API_BASE}/api/analyze`;

  // Retain active file and role in memory for instant switching
  let activeCachedFile = null;
  let currentRole = "Chairman";

  // Active dataset context for DAX measure calculations
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

  // View Containers
  const landingSection = document.getElementById('landingSection');
  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');
  const mainDashboard = document.getElementById('mainDashboard');
  const uploadSection = document.getElementById('uploadSection');
  const metricsSection = document.getElementById('metricsSection');
  const transformSection = document.getElementById('transformSection');
  const transformMsg = document.getElementById('transformMsg');

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
  const uploadBtn = document.getElementById('uploadBtn');

  // --- Ingestion Source Toggles ---
  const tabCSV = document.getElementById('tabCSV');
  const tabDB = document.getElementById('tabDB');
  const csvIngestBox = document.getElementById('csvIngestBox');
  const dbIngestBox = document.getElementById('dbIngestBox');
  const connectDbBtn = document.getElementById('connectDbBtn');

  if (tabCSV && tabDB) {
    tabCSV.addEventListener('click', () => {
      tabCSV.className = 'btn-primary';
      tabDB.className = 'btn-secondary';
      if (csvIngestBox) csvIngestBox.classList.remove('hidden');
      if (dbIngestBox) dbIngestBox.classList.add('hidden');
    });

    tabDB.addEventListener('click', () => {
      tabDB.className = 'btn-primary';
      tabCSV.className = 'btn-secondary';
      if (dbIngestBox) dbIngestBox.classList.remove('hidden');
      if (csvIngestBox) csvIngestBox.classList.add('hidden');
    });
  }

  // --- Live SQL & Lake Execution ---
  if (connectDbBtn) {
    connectDbBtn.addEventListener('click', async () => {
      const engine = document.getElementById('dbEngine').value;
      const uri = document.getElementById('dbUri').value.trim();
      const query = document.getElementById('dbQuery').value.trim();
      const loader = document.getElementById('loading');

      if (!uri || !query) {
        alert("Please provide both a connection string and an operational SQL query.");
        return;
      }

      if (loader) loader.classList.remove('hidden');

      try {
        const res = await fetch(`${API_BASE}/api/analyze/database`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Role": currentRole
          },
          body: JSON.stringify({
            engine_type: engine,
            connection_uri: uri,
            sql_query: query
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Query execution failed.");

        if (fileNameDisplay) {
          fileNameDisplay.textContent = `${engine.toUpperCase()} Live Query (View: ${data.applied_role || currentRole})`;
        }

        activeDatasetContext.columns = data.columns || [];
        activeDatasetContext.preview = data.preview || [];

        renderKPIs(data);
        renderAllVisualizations(data.numeric_means);
        renderTable(data.columns, data.preview);

        uploadSection.classList.add('hidden');
        if (transformSection) transformSection.classList.remove('hidden');
        metricsSection.classList.remove('hidden');
      } catch (err) {
        alert(err.message);
      } finally {
        if (loader) loader.classList.add('hidden');
      }
    });
  }

  // --- Data Transformation Studio Event Handlers ---
  async function applyTransformation(actionType, successMessage) {
    if (activeDatasetContext.preview.length === 0) {
      alert("No active dataset loaded to transform.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/transform/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          dataset_preview: activeDatasetContext.preview,
          columns: activeDatasetContext.columns
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Transformation failed.");

      activeDatasetContext.columns = data.columns || [];
      activeDatasetContext.preview = data.preview || [];

      renderTable(data.columns, data.preview);
      
      if (transformMsg) {
        transformMsg.textContent = successMessage;
        transformMsg.classList.remove('hidden');
        setTimeout(() => transformMsg.classList.add('hidden'), 3000);
      }
    } catch (err) {
      alert(`Transformation Error: ${err.message}`);
    }
  }

  const btnDropNulls = document.getElementById('btnDropNulls');
  if (btnDropNulls) {
    btnDropNulls.addEventListener('click', () => applyTransformation('drop_nulls', 'Null rows successfully removed!'));
  }

  const btnDropDuplicates = document.getElementById('btnDropDuplicates');
  if (btnDropDuplicates) {
    btnDropDuplicates.addEventListener('click', () => applyTransformation('drop_duplicates', 'Duplicate records successfully stripped!'));
  }

  const btnStandardizeDates = document.getElementById('btnStandardizeDates');
  if (btnStandardizeDates) {
    btnStandardizeDates.addEventListener('click', () => applyTransformation('standardize_dates', 'Date fields standardized to YYYY-MM-DD!'));
  }

  const btnUppercase = document.getElementById('btnUppercase');
  if (btnUppercase) {
    btnUppercase.addEventListener('click', () => applyTransformation('uppercase_text', 'Text attributes converted to uppercase!'));
  }

  // --- DAX Measure Calculation & Dynamic Card Generation ---
  const evaluateDaxBtn = document.getElementById('evaluateDaxBtn');
  const daxInput = document.getElementById('daxInput');
  const daxOutputMsg = document.getElementById('daxOutputMsg');
  const dynamicCardGrid = document.getElementById('dynamicCardGrid');

  if (evaluateDaxBtn) {
    evaluateDaxBtn.addEventListener('click', async () => {
      const formula = daxInput.value.trim();
      if (!formula) {
        alert("Please enter a DAX formula (e.g., Total Sales = SUM([Revenue]))");
        return;
      }

      if (activeDatasetContext.preview.length === 0) {
        alert("Please analyze a dataset or connect a database first before creating measures.");
        return;
      }

      evaluateDaxBtn.disabled = true;
      evaluateDaxBtn.textContent = "Calculating...";
      daxOutputMsg.classList.add('hidden');

      try {
        const res = await fetch(`${API_BASE}/api/measures/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formula: formula,
            dataset_preview: activeDatasetContext.preview,
            columns: activeDatasetContext.columns
          })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.detail || "DAX computation failed.");

        const newCard = document.createElement('div');
        newCard.className = 'card';
        newCard.style.border = '1px solid #38bdf8';
        newCard.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <h3 style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.35rem;">${result.name}</h3>
            <span style="font-size: 0.65rem; color: #38bdf8; font-family: monospace;">DAX</span>
          </div>
          <p style="font-size: 1.6rem; font-weight: 700; color: #38bdf8; margin: 0.2rem 0;">${result.value}</p>
          <span style="font-size: 0.7rem; color: #64748b; font-family: monospace; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${result.formula}">fx: ${result.formula}</span>
        `;
        dynamicCardGrid.appendChild(newCard);

        daxOutputMsg.textContent = `Measure "${result.name}" evaluated successfully and added as a visual card!`;
        daxOutputMsg.style.color = "#34d399";
        daxOutputMsg.classList.remove('hidden');
        daxInput.value = '';
      } catch (err) {
        daxOutputMsg.textContent = err.message;
        daxOutputMsg.style.color = "#f87171";
        daxOutputMsg.classList.remove('hidden');
      } finally {
        evaluateDaxBtn.disabled = false;
        evaluateDaxBtn.textContent = "Run Measure";
      }
    });
  }

  // =========================================================================
  // Google Identity Services (GIS) & Inbox OTP Engine
  // =========================================================================
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

  // --- Email OTP Handlers ---
  const otpModal = document.getElementById('otpModal');
  const otpStep1 = document.getElementById('otpStep1');
  const otpStep2 = document.getElementById('otpStep2');
  const otpEmailInput = document.getElementById('otpEmailInput');
  const otpCodeInput = document.getElementById('otpCodeInput');
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const closeOtpBtn = document.getElementById('closeOtpBtn');
  const backOtpBtn = document.getElementById('backOtpBtn');
  const otpError = document.getElementById('otpError');
  const otpStep2Error = document.getElementById('otpStep2Error');

  let activeOtpEmail = "";

  document.querySelectorAll('.gmail-otp-link').forEach(link => {
    link.addEventListener('click', () => {
      if (otpModal) {
        otpModal.classList.remove('hidden');
        otpStep1.classList.remove('hidden');
        otpStep2.classList.add('hidden');
        otpError.classList.add('hidden');
        otpEmailInput.value = "";
      }
    });
  });

  if (closeOtpBtn) {
    closeOtpBtn.addEventListener('click', () => otpModal.classList.add('hidden'));
  }

  if (backOtpBtn) {
    backOtpBtn.addEventListener('click', () => {
      otpStep2.classList.add('hidden');
      otpStep1.classList.remove('hidden');
    });
  }

  if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', async () => {
      const email = otpEmailInput.value.trim().toLowerCase();
      otpError.classList.add('hidden');

      if (!email || !email.includes('@')) {
        otpError.textContent = "Please enter a valid email address.";
        otpError.classList.remove('hidden');
        return;
      }

      sendOtpBtn.disabled = true;
      sendOtpBtn.textContent = "Transmitting code...";

      try {
        const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to dispatch verification email.");

        activeOtpEmail = email;
        otpStep1.classList.add('hidden');
        otpStep2.classList.remove('hidden');
      } catch (err) {
        otpError.textContent = err.message;
        otpError.classList.remove('hidden');
      } finally {
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = "Send Code";
      }
    });
  }

  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', async () => {
      const code = otpCodeInput.value.trim();
      otpStep2Error.classList.add('hidden');

      if (code.length !== 6) {
        otpStep2Error.textContent = "Please enter the complete 6-digit code.";
        otpStep2Error.classList.remove('hidden');
        return;
      }

      verifyOtpBtn.disabled = true;
      verifyOtpBtn.textContent = "Authenticating...";

      try {
        const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: activeOtpEmail, code: code })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Verification failed.");

        otpModal.classList.add('hidden');
        completeAuthSession(data.username, data.email, "email_otp");
      } catch (err) {
        otpStep2Error.textContent = err.message;
        otpStep2Error.classList.remove('hidden');
      } finally {
        verifyOtpBtn.disabled = false;
        verifyOtpBtn.textContent = "Verify & Enter";
      }
    });
  }

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

  // --- Session Verification ---
  const activeSession = sessionStorage.getItem('currentUser');
  if (activeSession && mainDashboard) {
    showDashboard(activeSession);
  }

  // --- View Switches ---
  if (heroCreateAccountBtn) {
    heroCreateAccountBtn.addEventListener('click', () => {
      landingSection.classList.add('hidden');
      registerSection.classList.remove('hidden');
    });
  }

  if (heroLoginBtn) {
    heroLoginBtn.addEventListener('click', () => {
      landingSection.classList.add('hidden');
      loginSection.classList.remove('hidden');
    });
  }

  if (switchToRegisterBtn) {
    switchToRegisterBtn.addEventListener('click', () => {
      loginSection.classList.add('hidden');
      registerSection.classList.remove('hidden');
    });
  }

  if (switchToLoginBtn) {
    switchToLoginBtn.addEventListener('click', () => {
      registerSection.classList.add('hidden');
      loginSection.classList.remove('hidden');
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
        loginError.classList.add('hidden');
        loginForm.reset();
        loginSection.classList.add('hidden');
        showDashboard(user.username);
      } else {
        loginError.textContent = "Invalid email, username, or password.";
        loginError.classList.remove('hidden');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('activeTenant');
      activeCachedFile = null;
      activeDatasetContext = { columns: [], preview: [] };
      mainDashboard.classList.add('hidden');
      landingSection.classList.remove('hidden');
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

      uploadSection.classList.add('hidden');
      if (transformSection) transformSection.classList.remove('hidden');
      metricsSection.classList.remove('hidden');
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
      metricsSection.classList.add('hidden');
      uploadSection.classList.remove('hidden');
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
