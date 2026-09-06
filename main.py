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

# --- In-Memory Reset Code Cache ---
reset_codes = {}

# --- SMTP Credentials (Configured in Render Dashboard -> Environment) ---
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER", "")         # Sender email address
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "") # App Password / API Key


# --- Request Schemas ---
class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyResetRequest(BaseModel):
    email: str
    code: str
    new_password: str


def validate_email_format(email: str) -> bool:
    regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    return bool(re.match(regex, email.strip()))


# --- Email Dispatch Helper ---
def send_code_to_email(target_email: str, code: str):
    if not SMTP_USER or not SMTP_PASSWORD:
        raise HTTPException(
            status_code=500,
            detail="Email service credentials not configured on backend."
        )

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
        # Port 465 uses direct SSL; Port 587 uses STARTTLS
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
        raise HTTPException(
            status_code=500, 
            detail="SMTP Authentication failed. Check your login and API key."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Email dispatch error: {str(e)}"
        )


# --- Root & Health Check ---
@app.get("/")
def read_root():
    return {"status": "online", "message": "Data Analyst Hub API is running"}


# --- CSV Profiling & Analysis Endpoint (With Multi-Encoding Detection) ---
@app.post("/api/analyze")
async def analyze_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    contents = await file.read()
    df = None
    
    # Priority list covering standard exports, Excel UTF-16 BOM, and legacy encodings
    encodings = ["utf-8", "utf-16", "utf-8-sig", "latin1", "cp1252"]
    
    for enc in encodings:
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding=enc)
            break
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue

    if df is None:
        raise HTTPException(
            status_code=400, 
            detail="Unable to parse CSV. The file encoding is incompatible."
        )

    # Clean numeric representations (strip currency symbols and commas)
    for col in df.columns:
        if df[col].dtype == object:
            cleaned = df[col].astype(str).str.replace(r"[\$,]", "", regex=True).str.
