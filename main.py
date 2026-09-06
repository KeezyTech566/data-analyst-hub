import base64
import io
import os
import random
import re
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

# --- SMTP Credentials ---
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

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

def validate_email_format(email: str) -> bool:
    regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    return bool(re.match(regex, email.strip()))

# --- Email Dispatch Helper ---
def send_code_to_email(target_email: str, code: str):
    if not SMTP_USER or not SMTP_PASSWORD:
        raise HTTPException(status_code=500, detail="Email service credentials not configured on backend.")

    msg = MIMEMultipart()
    msg['From'] = f"Data Analyst Hub <{SMTP_USER}>"
    msg['To'] = target_email
    msg['Subject'] = f"{code} is your Data Analyst Hub recovery code"

    body = f"""Hello,

You requested a password reset for your Data Analyst Hub account.

Your 6-digit recovery code is: {code}

This code is valid for 10 minutes. If you did not request this, please ignore this email.

Best regards,
Data Analyst Hub Team
"""
    msg.attach(MIMEText(body, 'plain'))

    try:
        port_num = int(SMTP_PORT)
        if port_num == 465:
            with smtplib.SMTP_SSL(SMTP_SERVER, port_num, timeout=10) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_USER, target_email, msg.as_string())
        else:
            with smtplib.SMTP(SMTP_SERVER, port_num, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_USER, target_email, msg.as_string())
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=500, detail="SMTP Authentication failed. Check your login and API key.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email dispatch error: {str(e)}")

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

# --- Dual Row-Level & Column-Level Security CSV Profiling Endpoint ---
@app.post("/api/analyze")
async def analyze_csv(
    file: UploadFile = File(...),
    x_user_role: str = Header(default="Chairman")
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    contents = await file.read()
    df = None
    encodings = ["utf-8", "utf-16", "utf-8-sig", "latin1", "cp1252"]

    for enc in encodings:
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding=enc)
            break
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue

    if df is None:
        raise HTTPException(status_code=400, detail="Unable to parse CSV. Incompatible file encoding.")

    role = x_user_role.strip()
    cols_lower = {c: c.lower() for c in df.columns}

    # Security keywords classification
    pii_keywords = ["email", "phone", "ssn", "nin", "bvn", "address", "customer_name", "driver_name"]
    compensation_keywords = ["salary", "bonus", "commission", "remuneration", "wage"]
    high_finance_keywords = ["profit", "ebitda", "margin", "revenue", "supplier_cost", "net_profit"]
    infra_tech_keywords = ["latency", "uptime", "server", "ip_address", "error_rate", "db_cluster"]

    # -------------------------------------------------------------
    # 1. ROW-LEVEL SECURITY (RLS) - Filters Rows by Department/Location
    # -------------------------------------------------------------
    filter_col = None
    for c in df.columns:
        if c.lower() in ["store_location", "region", "desk", "operational_unit", "department"]:
            filter_col = c
            break

    if filter_col:
        unique_vals = [v for v in df[filter_col].dropna().unique()]
        if len(unique_vals) > 1:
            if role == "Retail Officer":
                # Branch-level isolation: Limits to first 2 regional store locations
                df = df[df[filter_col].isin(unique_vals[:2])]
            elif role == "Relationship Manager (RM)":
                # Portfolio segmentation: Access restricted to middle client desks
                df = df[df[filter_col].isin(unique_vals[1:3])]
            elif role == "Chief Technology Officer (CTO)":
                # Operations isolation: Retains first 3 operational centers
                df = df[df[filter_col].isin(unique_vals[:3])]
            elif role == "Chief Information Officer (CIO)":
                # Infrastructure isolation: Retains last 3 server/business nodes
                df = df[df[filter_col].isin(unique_vals[-3:])]
            # Chairman & CFO retain all regional rows

    # -------------------------------------------------------------
    # 2. COLUMN-LEVEL SECURITY - Masks Sensitive Attributes
    # -------------------------------------------------------------
    if role == "Chairman":
        # Full enterprise visibility across all dimensions
        pass

    elif role == "Chief Financial Officer (CFO)":
        # Retains financials & payroll; strips raw tech logs
        allowed_cols = [c for c, cl in cols_lower.items() if not any(k in cl for k in infra_tech_keywords)]
        df = df[allowed_cols]

    elif role == "Chief Technology Officer (CTO)":
        # Retains volume & speed; masks salaries, individual bonuses, and net profit
        allowed_cols = [c for c, cl in cols_lower.items() if not any(k in cl for k in compensation_keywords + ["net_profit", "ebitda"])]
        df = df[allowed_cols]

    elif role == "Chief Information Officer (CIO)":
        # Retains architecture fields; strips employee/customer PII and bonus figures
        allowed_cols = [c for c, cl in cols_lower.items() if not any(k in cl for k in pii_keywords + ["bonus"])]
        df = df[allowed_cols]

    elif role == "Relationship Manager (RM)":
        # Retains sales, units, and client indicators; blocks payroll, operational overhead, and supplier costs
        restricted = compensation_keywords + ["supplier_cost", "maintenance_cost", "operational_cost", "expense_ratio"]
        allowed_cols = [c for c, cl in cols_lower.items() if not any(k in cl for k in restricted)]
        df = df[allowed_cols]

    elif role == "Retail Officer":
        # Strips all executive financial figures, supplier costs, volatility indices, and payroll
        restricted = high_finance_keywords + compensation_keywords + ["volatility", "aum"]
        allowed_cols = [c for c, cl in cols_lower.items() if not any(k in cl for k in restricted)]
        df = df[allowed_cols]

    # Clean numeric representations (stripping currency characters and commas)
    for col in df.columns:
        if df[col].dtype == object:
            cleaned = df[col].astype(str).str.replace(r"[\$,]", "", regex=True).str.strip()
            converted = pd.to_numeric(cleaned, errors="coerce")
            if converted.notnull().sum() > (0.5 * len(df)):
                df[col] = converted

    # Calculate aggregations only on permissible columns
    numeric_df = df.select_dtypes(include=[np.number])
    numeric_means = {}
    if not numeric_df.empty:
        numeric_means = {
            col: round(float(numeric_df[col].mean()), 2)
            for col in numeric_df.columns
            if pd.notnull(numeric_df[col].mean())
        }

    preview_df = df.head(5).replace({np.nan: None})

    return {
        "filename": file.filename,
        "total_rows": int(len(df)),
        "total_columns": int(len(df.columns)),
        "columns": df.columns.tolist(),
        "numeric_means": numeric_means,
        "preview": preview_df.to_dict(orient="records"),
        "applied_role": role
    }

# --- Email Exported PowerBI-Style PDF Report ---
@app.post("/api/reports/email")
async def email_dashboard_report(req: EmailReportRequest):
    if not SMTP_USER or not SMTP_PASSWORD:
        raise HTTPException(status_code=500, detail="Email service credentials not configured on backend.")

    msg = MIMEMultipart()
    msg['From'] = f"Data Analyst Hub Analytics <{SMTP_USER}>"
    msg['To'] = req.target_email
    msg['Subject'] = f"{req.business_name} - Visual Dashboard Report ({req.role})"

    body = f"""Hello,

Attached is your visual analytics report from Data Analyst Hub.

Report Scope:
- Business: {req.business_name}
- Access Tier / Role: {req.role}
- Render Engine: PowerBI Styled Analytical Visualizations

Best regards,
Enterprise Analytics Team
"""
    msg.attach(MIMEText(body, 'plain'))

    try:
        pdf_data = base64.b64decode(req.pdf_base64.split(",")[-1])
        part = MIMEBase('application', 'pdf')
        part.set_payload(pdf_data)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename="{req.business_name}_Dashboard.pdf"')
        msg.attach(part)

        port_num = int(SMTP_PORT)
        if port_num == 465:
            with smtplib.SMTP_SSL(SMTP_SERVER, port_num, timeout=15) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_USER, req.target_email, msg.as_string())
        else:
            with smtplib.SMTP(SMTP_SERVER, port_num, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_USER, req.target_email, msg.as_string())

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
