# Add both slash variations so FastAPI never throws a 404 routing error
@app.post("/api/auth/forgot-password")
@app.post("/api/auth/forgot-password/")
async def forgot_password(req: ForgotPasswordRequest):
    code = str(random.randint(100000, 999999))
    reset_codes[req.email.lower()] = code

    send_code_to_email(req.email.lower(), code)
    return {"message": "Recovery code dispatched to your inbox."}


@app.post("/api/auth/verify-reset")
@app.post("/api/auth/verify-reset/")
async def verify_and_reset(req: VerifyResetRequest):
    email_key = req.email.lower()
    stored_code = reset_codes.get(email_key)

    if not stored_code or stored_code != req.code.strip():
        raise HTTPException(status_code=400, detail="Invalid or expired recovery code.")

    del reset_codes[email_key]
    return {"message": "Password reset verified successfully."}
