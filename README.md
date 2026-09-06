# Data Analyst Hub 📊

An end-to-end web analytics tool that allows users to upload raw CSV datasets for immediate data profiling, statistical aggregation, and interactive distribution visualizations.

## 🚀 Live Demos
- **Frontend App (Netlify):** [https://data-analyst-hub.netlify.app](https://data-analyst-hub.netlify.app)
- **Interactive API Docs (Swagger/Render):** [https://data-analyst-hub.onrender.com/docs](https://data-analyst-hub.onrender.com/docs)

## 🛠 Tech Stack
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Modern Dark Theme), Chart.js
- **Backend:** FastAPI (Python), Uvicorn
- **Data Engine:** Pandas (data profiling, preview generation, numeric mean calculations)
- **Hosting & CI/CD:** Netlify (Continuous Deployment for UI), Render (Cloud Web Service for API)

## ⚙️ Local Development

### 1. Backend Setup
```bash
# Install dependencies
pip install -r requirement.txt

# Run server locally
python -m uvicorn main:app --reload --port 8000
