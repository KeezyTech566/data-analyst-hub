let currentChart = null;

document.getElementById('uploadBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('csvFileInput');
  const loader = document.getElementById('loading');

  if (!fileInput.files[0]) {
    alert("Please select a CSV file first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  loader.classList.remove('hidden');

  try {
    const res = await fetch("http://127.0.0.1:8000/api/analyze", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server responded with status ${res.status}`);
    }

    const data = await res.json();

    renderKPIs(data);
    renderTable(data.columns, data.preview);
    renderChart(data.columns, data.numeric_means);

    document.getElementById('metricsSection').classList.remove('hidden');
  } catch (err) {
    alert(err.message);
  } finally {
    loader.classList.add('hidden');
  }
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

function renderChart(cols, means) {
  const ctx = document.getElementById('analyticsChart').getContext('2d');
  if (currentChart) currentChart.destroy();

  const labels = Object.keys(means);
  const values = Object.values(means);

  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Averages of Numeric Columns',
        data: values,
        backgroundColor: '#38bdf8'
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
}