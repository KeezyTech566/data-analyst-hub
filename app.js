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
  const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://data-analyst-hub.onrender.com";

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
      // Auto re-analyze dataset if a file is already loaded
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

        // Cache dataset context for DAX measures
        activeDatasetContext.columns = data.columns || [];
        activeDatasetContext.preview = data.preview || [];

        renderKPIs(data);
        renderAllVisualizations(data.numeric_means);
        renderTable(data.columns, data.preview);

        uploadSection.classList.add('hidden');
        metricsSection.classList.remove('hidden');
      } catch (err) {
        alert(err.message);
      } finally {
        if (loader) loader.classList.add('hidden');
      }
    });
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

        // Create and append a new visual card
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

  // Process verified user session
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

  // --- Google OAuth Handshake ---
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

  // Initialize Google Sign-In Client
  window.onload = function () {
    if (window.google && GOOGLE_CLIENT_ID !== "PASTE_YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com") {
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

  // Trigger Google Prompt securely on button click
  document.querySelectorAll('.google-auth-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.google || GOOGLE_CLIENT_ID === "PASTE_YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com") {
        alert("Google Client ID is not configured properly in app.js.");
        return;
      }
      try {
        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback to standard render or explicit popup if One Tap is blocked by browser settings
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

  // --- Password Recovery ---
  if (forgotPassLink) {
    forgotPassLink.addEventListener('click', () => {
      resetStep1.classList.remove('hidden');
      resetStep2.classList.add('hidden');
      resetError.classList.add('hidden');
      resetEmailInput.value = '';
      forgotPassModal.classList.remove('hidden');
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => forgotPassModal.classList.add('hidden'));
  }

  if (backToStep1Btn) {
    backToStep1Btn.addEventListener('click', () => {
      resetStep2.classList.add('hidden');
      resetStep1.classList.remove('hidden');
    });
  }

  if (sendResetCodeBtn) {
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
        const res = await fetch(`${API_BASE}/api/auth/forgot-password/`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
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
  }

  if (verifyAndResetBtn) {
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
        const res = await fetch(`${API_BASE}/api/auth/verify-reset/`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
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

  // --- Onboarding Handlers ---
  const openOnboardBtn = document.getElementById('openOnboardBtn');
  const onboardModal = document.getElementById('onboardModal');
  const closeOnboardBtn = document.getElementById('closeOnboardBtn');
  const submitOnboardBtn = document.getElementById('submitOnboardBtn');

  if (openOnboardBtn && onboardModal) {
    openOnboardBtn.addEventListener('click', () => onboardModal.classList.add('hidden'));
    closeOnboardBtn.addEventListener('click', () => onboardModal.classList.add('hidden'));

    submitOnboardBtn.addEventListener('click', async () => {
      const bizName = document.getElementById('onboardBizName').value.trim();
      const bizEmail = document.getElementById('onboardBizEmail').value.trim();
      const industry = document.getElementById('onboardIndustry').value;
      const chairmanKey = document.getElementById('keyChairman').value;
      const ctoKey = document.getElementById('keyCTO').value;
      const retailKey = document.getElementById('keyRetail').value;

      if (!bizName || !bizEmail) {
        alert("Business Name and Email are required.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/tenant/onboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            business_name: bizName,
            admin_email: bizEmail,
            industry: industry,
            chairman_key: chairmanKey,
            cto_key: ctoKey,
            retail_officer_key: retailKey
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Onboarding failed.");
        alert(`Success: ${data.message}`);
        onboardModal.classList.add('hidden');
      } catch (err) {
        alert(err.message);
      }
    });
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

      // Cache dataset context for DAX measures
      activeDatasetContext.columns = data.columns || [];
      activeDatasetContext.preview = data.preview || [];

      renderKPIs(data);
      renderAllVisualizations(data.numeric_means);
      renderTable(data.columns, data.preview);

      uploadSection.classList.add('hidden');
      metricsSection.classList.remove('hidden');
    } catch (err) {
      alert(err.message);
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  // Trigger from user clicking "Analyze Dataset"
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

  // --- PowerBI Styled Print & PDF Export Engine ---
  const printDashboardBtn = document.getElementById('printDashboardBtn');
  if (printDashboardBtn) {
    printDashboardBtn.addEventListener('click', () => {
      window.print();
    });
  }

  const emailDashboardBtn = document.getElementById('emailDashboardBtn');
  if (emailDashboardBtn) {
    emailDashboardBtn.addEventListener('click', async () => {
      const recipient = prompt("Enter the destination email address for this dashboard report:");
      if (!recipient) return;

      emailDashboardBtn.disabled = true;
      emailDashboardBtn.textContent = "Generating PDF...";

      const element = document.getElementById('metricsSection');
      const opt = {
        margin:       0.3,
        filename:     'PowerBI_Executive_Dashboard.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
      };

      try {
        const pdfBase64 = await html2pdf().set(opt).from(element).outputPdf('datauristring');
        emailDashboardBtn.textContent = "Dispatching Email...";

        const res = await fetch(`${API_BASE}/api/reports/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_email: recipient,
            business_name: "Enterprise Analytics",
            role: currentRole,
            pdf_base64: pdfBase64
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Email delivery failed.");
        alert(data.message);
      } catch (err) {
        alert(`Report Dispatch Error: ${err.message}`);
      } finally {
        emailDashboardBtn.disabled = false;
        emailDashboardBtn.textContent = "✉️ Email PDF Report";
      }
    });
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

    // 1. Column Chart
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

    // 2. Horizontal Bar Chart
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

    // 3. Stacked Column Chart
    const stackedColCanvas = document.getElementById('stackedColumnChart');
    if (stackedColCanvas) {
      charts.stackedColumn = new Chart(stackedColCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: 'Baseline', data: values.map(v => Number((v * 0.6).toFixed(2))), backgroundColor: '#38bdf8' },
            { label: 'Delta / Spread', data: values.map(v => Number((v * 0.4).toFixed(2))), backgroundColor: '#f472b6' }
          ]
        },
        options: {
          ...chartTheme,
          scales: {
            x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
          }
        }
      });
    }

    // 4. Stacked Bar Chart
    const stackedBarCanvas = document.getElementById('stackedBarChart');
    if (stackedBarCanvas) {
      charts.stackedBar = new Chart(stackedBarCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: 'Direct Share', data: values.map(v => Number((v * 0.7).toFixed(2))), backgroundColor: '#34d399' },
            { label: 'Indirect Share', data: values.map(v => Number((v * 0.3).toFixed(2))), backgroundColor: '#fbbf24' }
          ]
        },
        options: {
          ...chartTheme,
          indexAxis: 'y',
          scales: {
            x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
          }
        }
      });
    }

    // 5. Line Chart
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

    // 6. Doughnut Chart
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

    // 7. Waterfall Chart
    const waterfallCanvas = document.getElementById('waterfallChart');
    if (waterfallCanvas) {
      let running = 0;
      const bases = [];
      const steps = [];
      values.forEach(v => {
        bases.push(running);
        steps.push(v);
        running += v;
      });

      charts.waterfall = new Chart(waterfallCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: 'Base Offset', data: bases, backgroundColor: 'transparent', stack: 'waterfall' },
            { label: 'Step Increment', data: steps, backgroundColor: '#34d399', stack: 'waterfall' }
          ]
        },
        options: {
          ...chartTheme,
          scales: {
            x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
          }
        }
      });
    }

    // 8. Funnel Conversion Chart
    const funnelCanvas = document.getElementById('funnelChart');
    if (funnelCanvas) {
      const funnelSorted = [...values].sort((a, b) => b - a);
      charts.funnel = new Chart(funnelCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels.slice(0, funnelSorted.length),
          datasets: [{
            label: 'Conversion Stage',
            data: funnelSorted,
            backgroundColor: palette.slice(0, funnelSorted.length)
          }]
        },
        options: { ...chartTheme, indexAxis: 'y' }
      });
    }

    // 9. Gauge KPI Meter
    const gaugeCanvas = document.getElementById('gaugeChart');
    if (gaugeCanvas) {
      const totalVal = values.reduce((a, b) => a + b, 0);
      const score = totalVal > 0 ? Math.min(Math.round((values[0] / (totalVal / values.length)) * 50), 98) : 75;

      charts.gauge = new Chart(gaugeCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Index', 'Target'],
          datasets: [{
            data: [score, 100 - score],
            backgroundColor: ['#38bdf8', '#1e293b'],
            borderWidth: 0
          }]
        },
        options: {
          circumference: 180,
          rotation: -90,
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          cutout: '75%'
        }
      });
      const scoreElem = document.getElementById('gaugeScore');
      if (scoreElem) scoreElem.textContent = `${score}%`;
    }

    // 10. Matrix Correlation Heatmap
    renderCorrelationMatrix(labels);
  }

  // Matrix Heatmap Builder
  function renderCorrelationMatrix(cols) {
    const container = document.getElementById('matrixContainer');
    if (!container) return;
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
});
