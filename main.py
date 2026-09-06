from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io

app = FastAPI(title="Analyst Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/analyze")
async def analyze_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
        
        # Try UTF-8 first; fallback to latin1 if Excel/Windows formatted
        try:
            decoded = contents.decode("utf-8")
        except UnicodeDecodeError:
            decoded = contents.decode("latin1")

        # Parse CSV with pandas
        df = pd.read_csv(io.StringIO(decoded), on_bad_lines='skip')

        # Clean NaN values so JSON serialization doesn't crash
        df_clean = df.fillna("")

        num_cols = df.select_dtypes(include="number")
        numeric_means = num_cols.mean().round(2).to_dict() if not num_cols.empty else {}

        return {
            "total_rows": int(len(df)),
            "total_columns": int(len(df.columns)),
            "columns": list(df.columns),
            "preview": df_clean.head(5).to_dict(orient="records"),
            "numeric_means": numeric_means
        }
    except Exception as e:
        # Return a clean 400 error instead of a hard crash
        raise HTTPException(status_code=400, detail=f"CSV Processing Error: {str(e)}")