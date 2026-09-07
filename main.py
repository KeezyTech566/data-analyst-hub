import base64
import io
import os
import random
import re
import time
import requests
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import numpy as np
import pandas as pd
import sqlalchemy.exc
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel
from sqlalchemy import create_engine

app = FastAPI(title="Data Analyst Hub API")

# --- Security Headers Middleware ---
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# --- CORS Configuration ---
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:8000",
    "https://data-analyst-hub.netlify.app",
    "https://data-analyst-hub-eight.vercel.app",
    "https://dataanalysthub.com.ng",
    "https://www.dataanalysthub.com.ng",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- In-Memory Stores ---
reset_codes = {}
business_tenants = {}  # Multi-tenant directory with RLS definitions
auth_otp_store = {}    # Secure email OTP store with TTL

# --- API & OAuth Credentials ---
EMAIL_API_KEY = os.getenv("EMAIL_API_KEY", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "487022113604-rg3ha3890bhefro90rbv37m5fo1stt0k.apps.googleusercontent.com")

# --- Request Schemas ---
class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyResetRequest(BaseModel):
    email: str
    code: str
    new_password: str

class OnboardBusinessRequest(BaseModel):
    business_name: str
    admin_email: str
    industry: str
    chairman_key: str
    cto_key: str
    retail_officer_key: str

class EmailReportRequest(BaseModel):
    target_email: str
    business_name: str
    role: str
    pdf_base64: str

class DatabaseIngestRequest(BaseModel):
    engine_type: str
    connection_uri: str
    sql_query: str

class DaxEvaluateRequest(BaseModel):
    formula: str
    dataset_preview: list[dict]
    columns: list[str]

class GoogleTokenPayload(BaseModel):
    credential: str

class SendOtpRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    code: str

class TransformRequest(BaseModel):
    dataset_preview: list[dict]
    columns: list[str]
    action: str  # options: "drop_nulls", "drop_duplicates", "standardize_dates", "uppercase_text"

def validate_email_format(email: str) -> bool:
    regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    return bool(re.match(regex, email.strip()))

# --- HTTPS Email Dispatch Helper (Resend / SendGrid API) ---
def send_code_to_email(target_email: str, code: str):
    if not EMAIL_API_KEY:
        raise HTTPException(status_code=500, detail="Email API key not configured on backend.")

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {EMAIL_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "from": "Data Analyst Hub <support@dataanalysthub.com.ng>",
                "to": [target_email],
                "subject": f"{code} is your Data Analyst Hub verification code",
                "html": f"<p>Your 6-digit verification code is: <strong>{code}</strong></p><p>This code is valid for 10 minutes.</p>"
            },
            timeout=10
        )
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Email dispatch error: {response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email API connection error: {str(e)}")

# --- Root Endpoint ---
@app.get("/")
def read_root():
    return {"status": "online", "message": "Data Analyst Hub API is running"}

# --- Onboarding Endpoint ---
@app.post("/api/tenant/onboard")
async def onboard_tenant(req: OnboardBusinessRequest):
    tenant_id = req.business_name.lower().replace(" ", "-")
    business_tenants[tenant_id] = {
        "business_name": req.business_name,
        "admin_email": req.admin_email,
        "industry": req.industry,
        "roles": {
            "Chairman": req.chairman_key,
            "CTO": req.cto_key,
            "Retail Officer": req.retail_officer_key
        }
    }
    return {"message": "Business successfully onboarded.", "tenant_id": tenant_id}

# --- Multi-Format Ingestion & Dual RLS Profiling Endpoint ---
@app.post("/api/analyze")
async def analyze_file(
    file: UploadFile = File(...),
    x_user_role: str = Header(default="Chairman")
):
    filename = file.filename.lower()
    contents = await file.read()
    df = None

    try:
        # 1. CSV / TSV Parsing
        if filename.endswith(".csv") or filename.endswith(".tsv") or filename.endswith(".txt"):
            delimiter = "\t" if filename.endswith(".tsv") else ","
            encodings = ["utf-8", "utf-16", "utf-8-sig", "latin1", "cp1252"]
            for enc in encodings:
                try:
                    df = pd.read_csv(io.BytesIO(contents), encoding=enc, sep=delimiter)
                    break
                except (UnicodeDecodeError, pd.errors.ParserError):
                    continue

        # 2. Modern Excel (.xlsx, .xlsm)
        elif filename.endswith(".xlsx") or filename.endswith(".xlsm"):
            df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

        # 3. Legacy Excel (.xls)
        elif filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents), engine="xlrd")

        # 4. Apache Parquet (.parquet)
        elif filename.endswith(".parquet"):
            df = pd.read_parquet(io.BytesIO(contents))

        # 5. Structured JSON (.json)
        elif filename.endswith(".json"):
            try:
                df = pd.read_json(io.BytesIO(contents), orient="records")
            except ValueError:
                df = pd.read_json(io.BytesIO(contents))

        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Supported formats: CSV, XLSX, XLS, PARQUET, JSON, TSV."
            )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process {file.filename}: {str(e)}")

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="The uploaded file contains no readable records.")

    # -------------------------------------------------------------
    # Role Normalization Engine
    # -------------------------------------------------------------
    raw_role = x_user_role.strip()
    role_lower = raw_role.lower()

    if "chair" in role_lower:
        role = "Chairman"
    elif "cfo" in role_lower or "financial" in role_lower:
        role = "Chief Financial Officer (CFO)"
    elif "cto" in role_lower or "technology" in role_lower:
        role = "Chief Technology Officer (CTO)"
    elif "cio" in role_lower or "information" in role_lower:
        role = "Chief Information Officer (CIO)"
    elif "relationship" in role_lower or "rm" in role_lower:
        role = "Relationship Manager (RM)"
    elif "retail" in role_lower:
        role = "Retail Officer"
    else:
        role = "Chairman"

    # Security keywords classification
    pii_keywords = ["email", "phone", "ssn", "nin", "bvn", "address", "customer_name", "driver_name"]
    compensation_keywords = ["salary", "bonus", "commission", "remuneration", "wage"]
    high_finance_keywords = ["profit", "ebitda", "margin", "revenue", "supplier_cost", "net_profit"]
    infra_tech_keywords = ["latency", "uptime", "server", "ip_address", "error_rate", "db_cluster"]

    cols_lower = {str(c).lower(): c for c in df.columns}

    # -------------------------------------------------------------
    # 1. ROW-LEVEL SECURITY (RLS) - Department / Regional Isolation
    # -------------------------------------------------------------
    filter_col = None
    for c in df.columns:
        if str(c).lower() in ["store_location", "region", "desk", "operational_unit", "department"]:
            filter_col = c
            break

    if filter_col:
        unique_vals = [v for v in df[filter_col].dropna().unique()]
        if len(unique_vals) > 1:
            if role == "Retail Officer":
                df = df[df[filter_col].isin(unique_vals[:2])]
            elif role == "Relationship Manager (RM)":
                df = df[df[filter_col].isin(unique_vals[1:3])]
            elif role == "Chief Technology Officer (CTO)":
                df = df[df[filter_col].isin(unique_vals[:3])]
            elif role == "Chief Information Officer (CIO)":
                df = df[df[filter_col].isin(unique_vals[-3:])]

    # -------------------------------------------------------------
    # 2. COLUMN-LEVEL SECURITY - Attribute Masking
    # -------------------------------------------------------------
    if role == "Chairman":
        pass
    elif role == "Chief Financial Officer (CFO)":
        df = df[[orig for low, orig in cols_lower.items() if not any(k in low for k in infra_tech_keywords)]]
    elif role == "Chief Technology Officer (CTO)":
        df = df[[orig for low, orig in cols_lower.items() if not any(k in low for k in compensation_keywords + ["net_profit", "ebitda"])]]
    elif role == "Chief Information Officer (CIO)":
        df = df[[orig for low, orig in cols_lower.items() if not any(k in low for k in pii_keywords + ["bonus"])]]
    elif role == "Relationship Manager (RM)":
        restricted = compensation_keywords + ["supplier_cost", "maintenance_cost", "operational_cost", "expense_ratio"]
        df = df[[orig for low, orig in cols_lower.items() if not any(k in low for k in restricted)]]
    elif role == "Retail Officer":
        restricted = high_finance_keywords + compensation_keywords + ["volatility", "aum"]
        df = df[[orig for low, orig in cols_lower.items() if not any(k in low for k in restricted)]]

    # Clean numeric representations (stripping currency characters and commas)
    for col in df.columns:
        if df[col].dtype == object:
            cleaned = df[col].astype(str).str.replace(r"[\$,]", "", regex=True).str.strip()
            converted = pd.to_numeric(cleaned, errors="coerce")
            if converted.notnull().sum() > (0.5 * len(df)):
                df[col] = converted

    # Calculate aggregations on numerical columns
    numeric_df = df.select_dtypes(include=[np.number])
    numeric_means = {}
    if not numeric_df.empty:
        numeric_means = {
            str(col): round(float(numeric_df[col].mean()), 2)
            for col in numeric_df.columns
            if pd.notnull(numeric_df[col].mean())
        }

    preview_df = df.head(5).replace({np.nan: None})

    return {
        "filename": file.filename,
        "total_rows": int(len(df)),
        "total_columns": int(len(df.columns)),
        "columns": [str(c) for c in df.columns.tolist()],
        "numeric_means": numeric_means,
        "preview": preview_df.to_dict(orient="records"),
        "applied_role": role
    }

# --- Enterprise Database / Data Lake Profiling Endpoint ---
@app.post("/api/analyze/database")
async def analyze_database_query(
    req: DatabaseIngestRequest,
    x_user_role: str = Header(default="Chairman")
):
    # Enforce read-only safety checks
    query_clean = req.sql_query.strip().lower()
    dangerous_keywords = ["drop", "truncate", "delete", "update", "insert", "alter", "grant"]
    if any(k in query_clean.split() for k in dangerous_keywords):
        raise HTTPException(status_code=400, detail="Security Violation: Only read-only SELECT queries are allowed.")

    try:
        engine = create_engine(req.connection_uri)
        with engine.connect() as conn:
            df = pd.read_sql(req.sql_query, conn)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database connection error: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Query returned zero records.")

    role_lower = x_user_role.strip().lower()
    if "chair" in role_lower:
        role = "Chairman"
    elif "cfo" in role_lower or "financial" in role_lower:
        role = "Chief Financial Officer (CFO)"
    elif "cto" in role_lower or "technology" in role_lower:
        role = "Chief Technology Officer (CTO)"
    elif "cio" in role_lower or "information" in role_lower:
        role = "Chief Information Officer (CIO)"
    elif "relationship" in role_lower or "rm" in role_lower:
        role = "Relationship Manager (RM)"
    elif "retail" in role_lower:
        role = "Retail Officer"
    else:
        role = "Chairman"

    pii_keywords = ["email", "phone", "ssn", "nin", "bvn", "address", "customer_name", "driver_name"]
    compensation_keywords = ["salary", "bonus", "commission", "wage"]
    high_finance_keywords = ["profit", "margin", "revenue", "supplier_cost", "net_profit", "ebitda"]
    infra_tech_keywords = ["latency", "uptime", "server", "ip_address", "error_rate", "db_cluster"]

    cols_lower = {str(c).lower(): c for c in df.columns}

    filter_col = None
    for c in df.columns:
        if str(c).lower() in ["store_location", "region", "desk", "operational_unit", "department"]:
            filter_col = c
            break

    if filter_col:
        unique_vals = [v for v in df[filter_col].dropna().unique()]
        if len(unique_vals) > 1:
            if role == "Retail Officer":
                df = df[df[filter_col].isin(unique_vals[:2])]
            elif role == "Relationship Manager (RM)":
                df = df[df[filter_col].isin(unique_vals[1:3])]
            elif role == "Chief Technology Officer (CTO)":
                df = df[df[filter_col].isin(unique_vals[:3])]
            elif role == "Chief Information Officer (CIO)":
                df = df[df[filter_col].isin(unique_vals[-3:])]

    if role == "Chairman":
        pass
    elif role == "Chief Financial Officer (CFO)":
        df = df[[orig for low, orig in cols_lower.items() if not any(k in low for k in infra_tech_keywords)]]
    elif role == "Chief Technology Officer (CTO)":
        df = df[[orig for low, orig in cols_lower.items() if not any(k in low for k in compensation_keywords + ["net_profit", "ebitda"])]]
    elif role == "Chief Information Officer (CIO)":
        df = df[[orig for low, orig in cols_lower.items() if not any(k in low for k in pii_keywords + ["bonus"])]]
    elif role == "Relationship Manager (RM)":
        restricted = compensation_keywords + ["supplier_cost", "maintenance_cost", "operational_cost", "expense_ratio"]
        df = df[[orig for low, orig in cols_lower.items() if not any(k in low for k in restricted)]]
    elif role == "Retail Officer":
        restricted = high_finance_keywords + compensation_keywords + ["volatility", "aum"]
        df = df[[orig for low, orig in cols_lower.items() if not any(k in low for k in restricted)]]

    for col in df.columns:
        if df[col].dtype == object:
            cleaned = df[col].astype(str).str.replace(r"[\$,]", "", regex=True).str.strip()
            converted = pd.to_numeric(cleaned, errors="coerce")
            if converted.notnull().sum() > (0.5 * len(df)):
                df[col] = converted

    numeric_df = df.select_dtypes(include=[np.number])
    numeric_means = {
        str(col): round(float(numeric_df[col].mean()), 2)
        for col in numeric_df.columns
        if pd.notnull(numeric_df[col].mean())
    }

    return {
        "filename": f"{req.engine_type}://LiveStream",
        "total_rows": int(len(df)),
        "total_columns": int(len(df.columns)),
        "columns": [str(c) for c in df.columns.tolist()],
        "numeric_means": numeric_means,
        "preview": df.head(5).replace({np.nan: None}).to_dict(orient="records"),
        "applied_role": role
    }

# --- Data Transformation Endpoint ---
@app.post("/api/transform/apply")
async def apply_data_transformation(req: TransformRequest):
    df = pd.DataFrame(req.dataset_preview)
    if df.empty:
        raise HTTPException(status_code=400, detail="No active dataset available for transformation.")

    try:
        if req.action == "drop_nulls":
            df = df.dropna()
        elif req.action == "drop_duplicates":
            df = df.drop_duplicates()
        elif req.action == "standardize_dates":
            for col in df.columns:
                if "date" in col.lower() or "time" in col.lower() or df[col].dtype == object:
                    converted_dates = pd.to_datetime(df[col], errors="coerce")
                    if converted_dates.notnull().sum() > (0.3 * len(df)):
                        df[col] = converted_dates.dt.strftime("%Y-%m-%d")
        elif req.action == "uppercase_text":
            for col in df.select_dtypes(include=[object]).columns:
                df[col] = df[col].astype(str).str.upper()
        else:
            raise HTTPException(status_code=400, detail="Unsupported transformation action.")

        return {
            "columns": [str(c) for c in df.columns.tolist()],
            "total_rows": int(len(df)),
            "preview": df.replace({np.nan: None}).to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Transformation error: {str(e)}")

# --- Google OAuth Token Verification Endpoint ---
@app.post("/api/auth/google-sso")
async def verify_google_sso(payload: GoogleTokenPayload):
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.credential, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10
        )

        email = idinfo.get("email")
        if not email or not idinfo.get("email_verified"):
            raise HTTPException(status_code=400, detail="Google account email is not verified.")

        username = email.split("@")[0]
        return {
            "verified": True,
            "username": username,
            "email": email,
            "name": idinfo.get("name", username),
            "picture": idinfo.get("picture", "")
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token certificate: {str(e)}")

# --- Email OTP Dispatch Endpoint ---
@app.post("/api/auth/send-otp")
async def send_login_otp(req: SendOtpRequest):
    email_clean = req.email.strip().lower()
    if not validate_email_format(email_clean):
        raise HTTPException(status_code=400, detail="Invalid email format.")

    code = str(random.randint(100000, 999999))
    auth_otp_store[email_clean] = {
        "code": code,
        "expires_at": time.time() + 600
    }

    send_code_to_email(email_clean, code)
    return {"message": "A 6-digit verification code has been dispatched to your Gmail."}

# --- Email OTP Verification Endpoint ---
@app.post("/api/auth/verify-otp")
async def verify_login_otp(req: VerifyOtpRequest):
    email_clean = req.email.strip().lower()
    record = auth_otp_store.get(email_clean)

    if not record:
        raise HTTPException(status_code=400, detail="No active code request found for this email.")

    if time.time() > record["expires_at"]:
        del auth_otp_store[email_clean]
        raise HTTPException(status_code=400, detail="The verification code has expired. Request a new one.")

    if record["code"] != req.code.strip():
        raise HTTPException(status_code=400, detail="Incorrect verification code.")

    del auth_otp_store[email_clean]
    username = email_clean.split("@")[0]

    return {
        "verified": True,
        "username": username,
        "email": email_clean
    }

# --- DAX Measure Calculation Engine ---
@app.post("/api/measures/evaluate")
async def evaluate_dax_measure(req: DaxEvaluateRequest):
    if not req.formula or "=" not in req.formula:
        raise HTTPException(status_code=400, detail="Invalid syntax. Format as: MeasureName = FUNCTION([Column])")

    measure_name, expr = req.formula.split("=", 1)
    measure_name = measure_name.strip()
    expr = expr.strip()

    df = pd.DataFrame(req.dataset_preview)
    if df.empty:
        raise HTTPException(status_code=400, detail="No active dataset available to evaluate measures.")

    cols_lookup = {c.lower(): c for c in df.columns}

    def resolve_col(raw_name: str):
        cleaned = raw_name.replace("[", "").replace("]", "").strip().lower()
        return cols_lookup.get(cleaned)

    # 1. DIVIDE(Num, Denom)
    div_match = re.match(r"^DIVIDE\((.+),(.+)\)$", expr, re.IGNORECASE)
    if div_match:
        num_expr = div_match.group(1).strip()
        denom_expr = div_match.group(2).strip()

        col_num = resolve_col(num_expr)
        col_denom = resolve_col(denom_expr)

        if not col_num or not col_denom:
            raise HTTPException(status_code=400, detail="Columns specified inside DIVIDE not found.")

        sum_num = pd.to_numeric(df[col_num], errors="coerce").sum()
        sum_denom = pd.to_numeric(df[col_denom], errors="coerce").sum()
        res_val = round(float(sum_num / sum_denom), 4) if sum_denom != 0 else 0.0

        return {"name": measure_name, "value": f"{res_val:,.4f}", "formula": expr}

    # 2. CALCULATE(AGG([Col]), Filter)
    calc_match = re.match(r"^CALCULATE\(([A-Z]+)\(\[?([a-zA-Z0-9_ ]+)\]?\)\s*,\s*\[?([a-zA-Z0-9_ ]+)\]?\s*(==|!=|>|<|>=|<=)\s*['\"]?([^'\"]+)['\"]?\)$", expr, re.IGNORECASE)
    if calc_match:
        agg_func = calc_match.group(1).upper()
        target_col = resolve_col(calc_match.group(2))
        filter_col = resolve_col(calc_match.group(3))
        operator = calc_match.group(4)
        filter_val = calc_match.group(5).strip()

        if not target_col or not filter_col:
            raise HTTPException(status_code=400, detail="Columns specified in CALCULATE expression not found.")

        series_f = df[filter_col].astype(str)
        if operator == "==":
            mask = (series_f == filter_val)
        elif operator == "!=":
            mask = (series_f != filter_val)
        else:
            num_f = pd.to_numeric(df[filter_col], errors="coerce")
            num_target = float(filter_val)
            if operator == ">": mask = (num_f > num_target)
            elif operator == "<": mask = (num_f < num_target)
            elif operator == ">=": mask = (num_f >= num_target)
            elif operator == "<=": mask = (num_f <= num_target)
            else: mask = pd.Series(True, index=df.index)

        sub_df = df[mask]
        num_series = pd.to_numeric(sub_df[target_col], errors="coerce")

        if agg_func == "SUM": val = num_series.sum()
        elif agg_func in ["AVERAGE", "AVG"]: val = num_series.mean()
        elif agg_func == "COUNT": val = len(sub_df)
        elif agg_func == "MAX": val = num_series.max()
        elif agg_func == "MIN": val = num_series.min()
        else: val = num_series.sum()

        return {"name": measure_name, "value": f"{val:,.2f}", "formula": expr}

    # 3. Standard Aggregations: SUM, AVERAGE, COUNT, MIN, MAX
    agg_match = re.match(r"^([A-Z]+)\(\[?([a-zA-Z0-9_ ]+)\]?\)$", expr, re.IGNORECASE)
    if agg_match:
        func = agg_match.group(1).upper()
        col = resolve_col(agg_match.group(2))

        if not col:
            raise HTTPException(status_code=400, detail=f"Column [{agg_match.group(2)}] does not exist in dataset.")

        num_s = pd.to_numeric(df[col], errors="coerce")

        if func == "SUM": val = num_s.sum()
        elif func in ["AVERAGE", "AVG"]: val = num_s.mean()
        elif func == "COUNT": val = df[col].count()
        elif func == "MAX": val = num_s.max()
        elif func == "MIN": val = num_s.min()
        else:
            raise HTTPException(status_code=400, detail=f"DAX function {func} is unsupported.")

        return {"name": measure_name, "value": f"{val:,.2f}", "formula": expr}

    # 4. IF(Condition, TrueVal, FalseVal)
    if_match = re.match(r"^IF\((.+),(.+),(.+)\)$", expr, re.IGNORECASE)
    if if_match:
        cond = if_match.group(1).strip()
        val_true = if_match.group(2).strip().replace("'", "").replace('"', '')
        val_false = if_match.group(3).strip().replace("'", "").replace('"', '')
        return {"name": measure_name, "value": val_true, "formula": expr}

    raise HTTPException(status_code=400, detail="Unsupported DAX formula pattern. Supported: SUM, AVERAGE, COUNT, MIN, MAX, DIVIDE, CALCULATE, IF.")

# --- Email Exported PowerBI-Style PDF Report ---
@app.post("/api/reports/email")
async def email_dashboard_report(req: EmailReportRequest):
    if not EMAIL_API_KEY:
        raise HTTPException(status_code=500, detail="Email API key not configured on backend.")

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {EMAIL_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "from": "Data Analyst Hub <support@dataanalysthub.com.ng>",
                "to": [req.target_email],
                "subject": f"{req.business_name} - Visual Dashboard Report ({req.role})",
                "html": f"<p>Attached is your visual analytics report from Data Analyst Hub for business <strong>{req.business_name}</strong> under role <strong>{req.role}</strong>.</p>"
            },
            timeout=15
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Failed to transmit report: {response.text}")

        return {"message": f"Dashboard report successfully delivered to {req.target_email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to transmit report: {str(e)}")

# --- Password Recovery Endpoints ---
@app.post("/api/auth/forgot-password")
@app.post("/api/auth/forgot-password/")
async def forgot_password(req: ForgotPasswordRequest):
    email_clean = req.email.strip().lower()
    if not validate_email_format(email_clean):
        raise HTTPException(status_code=400, detail="Invalid email format.")

    code = str(random.randint(100000, 999999))
    reset_codes[email_clean] = code
    send_code_to_email(email_clean, code)
    return {"message": "Recovery code dispatched to your inbox."}

@app.post("/api/auth/verify-reset")
@app.post("/api/auth/verify-reset/")
async def verify_and_reset(req: VerifyResetRequest):
    email_clean = req.email.strip().lower()
    stored_code = reset_codes.get(email_clean)

    if not stored_code or stored_code != req.code.strip():
        raise HTTPException(status_code=400, detail="Invalid or expired recovery code.")

    del reset_codes[email_clean]
    return {"message": "Password reset verified successfully."}
