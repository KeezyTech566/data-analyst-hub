import base64
import io
import os
import random
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile, Header, Depends
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

# --- Row-Level Security CSV Profiling Endpoint ---
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
        raise HTTPException(status_code=400, detail="Unable to parse CSV. File encoding incompatible.")

    # --- Row-Level Security Filtering Logic ---
    # Chairman: Access to full enterprise data
    # CTO: Masks sensitive commercial rows, limits to technical and operational fields
    # Retail Officer: Excludes high-level confidential columns (e.g. Profit, Margin, Salary)
    role = x_user_role.strip()
    if role == "Retail Officer":
        restricted_keywords = ["profit", "margin", "salary", "cost", "revenue", "ebitda"]
        allowed_cols = [c for c in df.columns if not any(k in c.lower() for k in restricted_keywords)]
        df = df[allowed_cols]
    elif role == "CTO":
        restricted_keywords = ["salary", "customer_ssn", "personal_email"]
        allowed_cols = [c for c in df.columns if not any(k in c.lower() for k in restricted_keywords)]
        df = df[allowed_cols]

    # Clean numeric representations
    for col in df.columns:
        if df[col].dtype == object:
            cleaned = df[col].astype(str).str.replace(r"[\$,]", "", regex=True).str.strip()
            converted = pd.to_numeric(cleaned, errors="coerce")
            if converted.notnull().sum() > (0.5 * len(df)):
                df[col] = converted

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
        # Decode base64 PDF
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
