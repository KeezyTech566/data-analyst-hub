import io
import os
import random
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Data Analyst Hub API")

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

# In-memory storage for active reset codes
reset_codes = {}

# SMTP Credentials from Render Environment Variables
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")


# Schemas using standard str (eliminates email-validator import crashes)
class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyResetRequest(BaseModel):
    email: str
    code: str
    new_password: str


def validate_email_format(email: str):
    regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    return bool(re.match(regex, email.strip()))


def send_code_to_email(target_email: str, code: str):
    if not SMTP_USER or not SMTP_PASSWORD:
        raise HTTPException(
            status_code=500,
            detail="Email service credentials not configured on backend."
        )

    msg = MIMEMultipart()
    msg["From"] = f"Data Analyst Hub <{SMTP_USER}>"
    msg["To"] = target_email
    msg["Subject"] = f"{code} is your Data Analyst Hub recovery code"

    body = f"""Hello,

You requested a password reset for your Data Analyst Hub account.

Your 6-digit recovery code is: {code}

This code is valid for 10 minutes. If you did not request this, please ignore this email.

Best regards,
Data Analyst Hub Team
"""
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, target_email, msg.as_string())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to deliver email: {str(e)}")


@app.get("/")
def read_root():
    return {"status": "online", "message": "Data Analyst Hub API is running"}


@app.post("/api/analyze")
async def analyze_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")

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
    }


@app.post("/api/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    email_clean = req.email.strip().lower()
    if not validate_email_format(email_clean):
        raise HTTPException(status_code=400, detail="Invalid email format.")

    code = str(random.randint(100000, 999999))
    reset_codes[email_clean] = code

    send_code_to_email(email_clean, code)
    return {"message": "Recovery code dispatched to your inbox."}


@app.post("/api/auth/verify-reset")
async def verify_and_reset(req: VerifyResetRequest):
    email_clean = req.email.strip().lower()
    stored_code = reset_codes.get(email_clean)

    if not stored_code or stored_code != req.code.strip():
        raise HTTPException(status_code=400, detail="Invalid or expired recovery code.")

    del reset_codes[email_clean]
    return {"message": "Password reset verified successfully."}
