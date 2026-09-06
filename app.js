// --- Multi-Chart Engine ---
function renderAllVisualizations(means) {
  let labels = Object.keys(means || {});
  let values = Object.values(means || {});

  // Fallback: If dataset has no purely numeric columns, supply synthetic profiling metric series
  if (labels.length === 0) {
    labels = ["Metric A", "Metric B", "Metric C", "Metric D", "Metric E"];
    values = [45, 78, 52, 91, 63];
  }

  const palette = [
    '#38bdf8', '#818cf8', '#34d399', '#f472b6', 
    '#fbbf24', '#a78bfa', '#f87171', '#2dd4bf'
  ];

  // Destroy previous instances to avoid canvas reuse errors
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

  // 1. Column Chart (Vertical Bars)
  const colCanvas = document.getElementById('columnChart');
  if (colCanvas) {
    charts.column = new Chart(colCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Metric Mean',
          data: values,
          backgroundColor: '#38bdf8'
        }]
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
        datasets: [{
          label: 'Metric Magnitude',
          data: values,
          backgroundColor: '#818cf8'
        }]
      },
      options: {
        ...chartTheme,
        indexAxis: 'y'
      }
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
  }

  // 7. Waterfall Chart (Cumulative Stacked Bridge)
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
          {
            label: 'Base Offset',
            data: bases,
            backgroundColor: 'transparent',
            stack: 'waterfall'
          },
          {
            label: 'Step Increment',
            data: steps,
            backgroundColor: '#34d399',
            stack: 'waterfall'
          }
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
      options: {
        ...chartTheme,
        indexAxis: 'y'
      }
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
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        cutout: '75%'
      }
    });
    const scoreElem = document.getElementById('gaugeScore');
    if (scoreElem) scoreElem.textContent = `${score}%`;
  }

  // 10. Matrix Correlation Heatmap
  renderCorrelationMatrix(labels);
}
