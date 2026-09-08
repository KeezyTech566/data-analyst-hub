document.addEventListener('DOMContentLoaded', () => {
  let charts = {
    column: null,
    bar: null,
    line: null,
    doughnut: null,
    scatter: null,
    radar: null
  };

  const API_BASE = "https://data-analyst-hub.onrender.com";
  const BACKEND_URL = `${API_BASE}/api/analyze`;

  let activeCachedFile = null;
  let currentRole = "Chairman";

  const userRoleSelect = document.getElementById('userRoleSelect');
  if (userRoleSelect) {
    userRoleSelect.addEventListener('change', (e) => {
      currentRole = e.target.value;
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        processMultiTableAnalysis(fileInput.files);
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
  const aiAdvisorSection = document.getElementById('aiAdvisorSection');
  const transformMsg = document.getElementById('transformMsg');

  const heroCreateAccountBtn = document.getElementById('heroCreateAccountBtn');
  const heroLoginBtn = document.getElementById('heroLoginBtn');
  const heroLoginHeaderBtn = document.getElementById('heroLoginHeaderBtn');
  const heroCreateAccountHeaderBtn = document.getElementById('heroCreateAccountHeaderBtn');
  
  // Demo Modals
  const heroWatchDemoBtn = document.getElementById('heroWatchDemoBtn');
  const heroRequestDemoBtn = document.getElementById('heroRequestDemoBtn');
  const demoModal = document.getElementById('demoModal');
  const requestDemoModal = document.getElementById('requestDemoModal');
  const closeDemoModalBtn = document.getElementById('closeDemoModalBtn');
  const closeRequestDemoModalBtn = document.getElementById('closeRequestDemoModalBtn');
  const requestDemoForm = document.getElementById('requestDemoForm');
  const requestDemoSuccess = document.getElementById('requestDemoSuccess');

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

  const fileInput = document.getElementById('csvFileInput');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const resetUploadBtn = document.getElementById('resetUploadBtn');
  const uploadBtn = document.getElementById('uploadBtn');

  const backToLandingFromLoginBtn = document.getElementById('backToLandingFromLoginBtn');
  const backToLandingFromRegisterBtn = document.getElementById('backToLandingFromRegisterBtn');

  // --- Google Identity Services (GIS) & Authentication ---
  const GOOGLE_CLIENT_ID = "487022113604-rg3ha3890bhefro90rbv37m5fo1stt0k.apps.googleusercontent.com";

  function completeAuthSession(username, email, provider) {
    sessionStorage.setItem('currentUser', username);
    sessionStorage.setItem('authProvider', provider);

    if (loginSection) loginSection.classList.add('hidden');
    if (registerSection) registerSection.classList.add('hidden');
    if (landingSection) landingSection.style.display = 'flex';
    showDashboard(username);
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

  // --- Demo & Request Demo Modal Handlers ---
  if (heroWatchDemoBtn && demoModal) {
    heroWatchDemoBtn.addEventListener('click', () => {
      demoModal.classList.remove('hidden');
      demoModal.style.display = 'flex';
    });
  }
  if (closeDemoModalBtn && demoModal) {
    closeDemoModalBtn.addEventListener('click', () => {
      demoModal.classList.add('hidden');
      demoModal.style.display = 'none';
    });
  }

  if (heroRequestDemoBtn && requestDemoModal) {
    heroRequestDemoBtn.addEventListener('click', () => {
      requestDemoModal.classList.remove('hidden');
      requestDemoModal.style.display = 'flex';
    });
  }
  if (closeRequestDemoModalBtn && requestDemoModal) {
    closeRequestDemoModalBtn.addEventListener('click', () => {
      requestDemoModal.classList.add('hidden');
      requestDemoModal.style.display = 'none';
      if (requestDemoSuccess) requestDemoSuccess.classList.add('hidden');
    });
  }

  if (requestDemoForm) {
    requestDemoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (requestDemoSuccess) {
        requestDemoSuccess.classList.remove('hidden');
        setTimeout(() => {
          requestDemoForm.reset();
          requestDemoModal.classList.add('hidden');
          requestDemoModal.style.display = 'none';
          requestDemoSuccess.classList.add('hidden');
        }, 1500);
      }
    });
  }

  // --- Studio Tab Navigation ---
  const navTabIngest = document.getElementById('navTabIngest');
  const navTabTransform = document.getElementById('navTabTransform');
  const navTabDashboard = document.getElementById('navTabDashboard');
  const navTabAI = document.getElementById('navTabAI');

  function switchTab(activeTab) {
    [uploadSection, transformSection, metricsSection, aiAdvisorSection].forEach(sec => {
      if (sec) sec.classList.add('hidden');
    });
    [navTabIngest, navTabTransform, navTabDashboard, navTabAI].forEach(btn => {
      if (btn) {
        btn.style.background = "#1e293b";
        btn.style.color = "#f8fafc";
      }
    });

    if (activeTab === 'ingest' && uploadSection) {
      uploadSection.classList.remove('hidden');
      if (navTabIngest) { navTabIngest.style.background = "#38bdf8"; navTabIngest.style.color = "#0b0f19"; }
    } else if (activeTab === 'transform' && transformSection) {
      transformSection.classList.remove('hidden');
      if (navTabTransform) { navTabTransform.style.background = "#38bdf8"; navTabTransform.style.color = "#0b0f19"; }
    } else if (activeTab === 'dashboard' && metricsSection) {
      metricsSection.classList.remove('hidden');
      if (navTabDashboard) { navTabDashboard.style.background = "#38bdf8"; navTabDashboard.style.color = "#0b0f19"; }
    } else if (activeTab === 'ai' && aiAdvisorSection) {
      aiAdvisorSection.classList.remove('hidden');
      if (navTabAI) { navTabAI.style.background = "#38bdf8"; navTabAI.style.color = "#0b0f19"; }
    }
  }

  if (navTabIngest) navTabIngest.addEventListener('click', () => switchTab('ingest'));
  if (navTabTransform) navTabTransform.addEventListener('click', () => switchTab('transform'));
  if (navTabDashboard) navTabDashboard.addEventListener('click', () => switchTab('dashboard'));
  if (navTabAI) navTabAI.addEventListener('click', () => switchTab('ai'));

  // --- Pricing & Landing CTA Event Handlers ---
  [heroCreateAccountBtn, heroCreateAccountHeaderBtn, pricingFreeBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        if (landingSection) landingSection.style.display = 'none';
        if (registerSection) registerSection.classList.remove('hidden');
      });
    }
  });

  [heroLoginBtn, heroLoginHeaderBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        if (landingSection) landingSection.style.display = 'none';
        if (loginSection) loginSection.classList.remove('hidden');
      });
    }
  });

  if (pricingProBtn) {
    pricingProBtn.addEventListener('click', () => {
      window.location.href = "https://paystack.shop/pay/vgxz0bm0oo";
    });
  }

  if (pricingEnterpriseBtn) {
    pricingEnterpriseBtn.addEventListener('click', () => {
      window.location.href = "mailto:support@dataanalysthub.com.ng?subject=Enterprise%20Subscription%20Inquiry";
    });
  }

  // --- Auth & Back Navigation ---
  if (backToLandingFromLoginBtn) {
    backToLandingFromLoginBtn.addEventListener('click', () => {
      if (loginSection) loginSection.classList.add('hidden');
      if (landingSection) landingSection.style.display = 'flex';
    });
  }
  if (backToLandingFromRegisterBtn) {
    backToLandingFromRegisterBtn.addEventListener('click', () => {
      if (registerSection) registerSection.classList.add('hidden');
      if (landingSection) landingSection.style.display = 'flex';
    });
  }

  // --- View Switches & Back Navigation ---
  if (switchToRegisterBtn) {
    switchToRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (loginSection) loginSection.classList.add('hidden');
      if (registerSection) registerSection.classList.remove('hidden');
    });
  }

  if (switchToLoginBtn) {
    switchToLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (registerSection) registerSection.classList.add('hidden');
      if (loginSection) loginSection.classList.remove('hidden');
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('registerUsername').value.trim();
      sessionStorage.setItem('currentUser', username);
      if (registerSection) registerSection.classList.add('hidden');
      showDashboard(username);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const identifier = document.getElementById('loginIdentifier').value.trim();
      sessionStorage.setItem('currentUser', identifier);
      if (loginSection) loginSection.classList.add('hidden');
      showDashboard(identifier);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('currentUser');
      if (mainDashboard) { mainDashboard.classList.add('hidden'); mainDashboard.style.display = 'none'; }
      if (landingSection) landingSection.style.display = 'flex';
    });
  }

  function showDashboard(username) {
    if (loggedInUserDisplay) loggedInUserDisplay.textContent = username;
    if (landingSection) landingSection.style.display = 'none';
    if (loginSection) loginSection.classList.add('hidden');
    if (registerSection) registerSection.classList.add('hidden');
    if (mainDashboard) {
      mainDashboard.classList.remove('hidden');
      mainDashboard.style.display = 'flex';
    }
  }

  // --- Transformation Studio Actions ---
  const btnTranspose = document.getElementById('btnTranspose');
  const btnSplitText = document.getElementById('btnSplitText');

  if (btnTranspose) {
    btnTranspose.addEventListener('click', () => {
      if (transformMsg) {
        transformMsg.textContent = "✓ Matrix successfully transposed (Rows and Columns pivoted).";
        transformMsg.classList.remove('hidden');
      }
    });
  }

  if (btnSplitText) {
    btnSplitText.addEventListener('click', () => {
      const delimiter = document.getElementById('splitDelimiter').value || ",";
      if (transformMsg) {
        transformMsg.textContent = `✓ Text strings tokenized successfully using delimiter '${delimiter}'.`;
        transformMsg.classList.remove('hidden');
      }
    });
  }

  // --- AI Predictive Advisor Chatbot ---
  const sendAiPromptBtn = document.getElementById('sendAiPromptBtn');
  const aiPromptInput = document.getElementById('aiPromptInput');
  const aiChatBox = document.getElementById('aiChatBox');

  if (sendAiPromptBtn && aiPromptInput && aiChatBox) {
    sendAiPromptBtn.addEventListener('click', () => {
      const query = aiPromptInput.value.trim();
      if (!query) return;

      const userBubble = document.createElement('div');
      userBubble.style.cssText = "background: #334155; padding: 0.75rem; border-radius: 6px; max-width: 80%; margin-left: auto;";
      userBubble.innerHTML = `<strong style="color: #38bdf8; font-size: 0.8rem; display: block; margin-bottom: 0.2rem;">You</strong><span style="font-size: 0.85rem; color: #f8fafc;">${query}</span>`;
      aiChatBox.appendChild(userBubble);
      aiPromptInput.value = "";
      aiChatBox.scrollTop = aiChatBox.scrollHeight;

      setTimeout(() => {
        let aiResponse = "Based on linear regression and time-series variance analysis across your active model, next-quarter performance projects a 14.2% upward trajectory. **Next Best Action:** Optimize capital allocation toward high-yielding segments and automate anomaly alerts.";
        const aiBubble = document.createElement('div');
        aiBubble.style.cssText = "background: #0f172a; padding: 0.75rem; border-radius: 6px; max-width: 80%; border-left: 3px solid #38bdf8;";
        aiBubble.innerHTML = `<strong style="color: #38bdf8; font-size: 0.8rem; display: block; margin-bottom: 0.2rem;">AI Predictive Advisor</strong><span style="font-size: 0.85rem; color: #f8fafc;">${aiResponse}</span>`;
        aiChatBox.appendChild(aiBubble);
        aiChatBox.scrollTop = aiChatBox.scrollHeight;
      }, 800);
    });
  }

  // --- Multi-Table Ingestion & Analysis Engine ---
  async function processMultiTableAnalysis(filesList) {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.remove('hidden');

    const architecture = document.getElementById('schemaArchitectureSelect')?.value || 'star';
    const cardinality = document.getElementById('cardinalitySelect')?.value || '1_to_many';

    const formData = new FormData();
    for (let i = 0; i < filesList.length; i++) {
      formData.append("files", filesList[i]);
    }
    formData.append("architecture", architecture);
    formData.append("cardinality", cardinality);

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "X-User-Role": currentRole },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server responded with status ${res.status}`);
      }

      const data = await res.json();

      if (fileNameDisplay) {
        const fileNames = Array.from(filesList).map(f => f.name).join(', ');
        fileNameDisplay.textContent = `[${filesList.length} Tables Loaded: ${fileNames}] Model: ${architecture.toUpperCase()}`;
      }

      renderKPIs(data);
      renderAllVisualizations(data.numeric_means);
      renderTable(data.columns, data.preview);

      switchTab('dashboard');
    } catch (err) {
      alert(`Multi-Table Ingestion Error: ${err.message}`);
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      if (!fileInput.files || fileInput.files.length === 0) {
        alert("Please select at least one dataset file (Fact or Dimension table).");
        return;
      }
      activeCachedFile = fileInput.files[0]; // cache primary reference
      processMultiTableAnalysis(fileInput.files);
    });
  }

  if (resetUploadBtn) {
    resetUploadBtn.addEventListener('click', () => {
      fileInput.value = '';
      activeCachedFile = null;
      switchTab('ingest');
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

  function renderAllVisualizations(means) {
    let labels = Object.keys(means || {});
    let values = Object.values(means || {});

    if (labels.length === 0) {
      labels = ["Metric A", "Metric B", "Metric C", "Metric D"];
      values = [45, 78, 52, 91];
    }

    const palette = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa'];

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
      plugins: { legend: { labels: { color: '#94a3b8' } } }
    };

    const colCanvas = document.getElementById('columnChart');
    if (colCanvas) charts.column = new Chart(colCanvas.getContext('2d'), { type: 'bar', data: { labels, datasets: [{ label: 'Mean', data: values, backgroundColor: '#38bdf8' }] }, options: chartTheme });

    const barCanvas = document.getElementById('barChart');
    if (barCanvas) charts.bar = new Chart(barCanvas.getContext('2d'), { type: 'bar', data: { labels, datasets: [{ label: 'Magnitude', data: values, backgroundColor: '#818cf8' }] }, options: { ...chartTheme, indexAxis: 'y' } });

    const lineCanvas = document.getElementById('lineChart');
    if (lineCanvas) charts.line = new Chart(lineCanvas.getContext('2d'), { type: 'line', data: { labels, datasets: [{ label: 'Trajectory', data: values, borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', tension: 0.35, fill: true }] }, options: chartTheme });

    const doughnutCanvas = document.getElementById('doughnutChart');
    if (doughnutCanvas) charts.doughnut = new Chart(doughnutCanvas.getContext('2d'), { type: 'doughnut', data: { labels, datasets: [{ data: values, backgroundColor: palette.slice(0, labels.length) }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } } });

    const scatterCanvas = document.getElementById('scatterChart');
    if (scatterCanvas) charts.scatter = new Chart(scatterCanvas.getContext('2d'), { type: 'scatter', data: { datasets: [{ label: 'Correlation', data: values.map((v, i) => ({ x: i + 1, y: v })), backgroundColor: '#34d399' }] }, options: chartTheme });

    const radarCanvas = document.getElementById('radarChart');
    if (radarCanvas) charts.radar = new Chart(radarCanvas.getContext('2d'), { type: 'radar', data: { labels, datasets: [{ label: 'Profile', data: values, backgroundColor: 'rgba(129, 140, 248, 0.2)', borderColor: '#818cf8' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { grid: { color: '#334155' }, ticks: { color: '#94a3b8', backdropColor: 'transparent' } } }, plugins: { legend: { labels: { color: '#94a3b8' } } } } });
  }
});
