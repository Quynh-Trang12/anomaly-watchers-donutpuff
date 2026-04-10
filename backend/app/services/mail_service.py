import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger("anomaly_watchers.mail")

async def send_security_alert_email(recipient_email: str, otp_code: str, transaction_details: dict):
    """
    Sends an out-of-band security alert email with an OTP for transaction verification.
    """
    
    smtp_server = os.getenv("SMTP_SERVER", "localhost")
    smtp_port = int(os.getenv("SMTP_PORT", "1025"))
    smtp_user = os.getenv("SMTP_USER", "security@anomalywatchers.com")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    transaction_id = transaction_details.get("transaction_id", "UNKNOWN")

    message = MIMEMultipart("alternative")
    message["Subject"] = "🔐 Security Verification Required — AnomalyWatchers"
    message["From"] = f"Anomaly Watchers Security <{smtp_user}>"
    message["To"] = recipient_email

    # Point to backend port 8000 for emergency freeze functionality
    freeze_url = f"http://localhost:8000/api/security/freeze?id={transaction_id}"

    html_content = f"""
    <html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #f4f7f9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <div style="background-color: #0f172a; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Security Verification</h1>
          </div>
          
          <div style="padding: 40px;">
            <p style="font-size: 16px;">We noticed a transaction that requires a one-time security code to proceed.</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin: 25px 0;">
              <p style="margin: 5px 0;"><strong>Amount:</strong> ${transaction_details.get('amount', 0.0):,.2f}</p>
              <p style="margin: 5px 0;"><strong>Type:</strong> {transaction_details.get('type', 'N/A')}</p>
              <p style="margin: 5px 0;"><strong>Reference:</strong> {transaction_id}</p>
            </div>

            <p style="font-weight: 600; text-align: center; margin-bottom: 10px;">Your Verification Code:</p>
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="display: inline-block; background: #f1f5f9; border: 2px solid #3b82f6; color: #1d4ed8; font-size: 36px; font-weight: 800; padding: 15px 40px; border-radius: 12px; font-family: monospace; letter-spacing: 8px;">
                {otp_code}
              </div>
            </div>

            <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h3 style="color: #9f1239; margin-top: 0; font-size: 16px;">⚠️ Not you? Your account may be at risk.</h3>
              <p style="font-size: 14px; color: #be123c; margin-bottom: 15px;">If you did not authorize this transaction, someone may have access to your credentials.</p>
              <a href="{freeze_url}" style="display: inline-block; background: #e11d48; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px;">Freeze Account Immediately</a>
            </div>

            <p style="font-size: 12px; color: #64748b; text-align: center;">This code will expire in 10 minutes. For your security, never share this code with anyone.</p>
          </div>
          
          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            © 2026 Anomaly Watchers Donutpuff FinTech. All rights reserved.
          </div>
        </div>
      </body>
    </html>
    """
    
    message.attach(MIMEText(html_content, "html"))

    try:
        # Actual SMTP Attempt
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            if smtp_password:
                server.starttls()
                server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, recipient_email, message.as_string())
        
        logger.info(f"OOB_AUTH_SUCCESS: Security code {otp_code} sent to {recipient_email}")
        
    except Exception as e:
        # Fallback OOB Logging
        logger.error(f"OOB_AUTH_SMTP_FAILURE: Could not deliver email to {recipient_email}. Error: {e}")
        logger.warning(f"OOB_AUTH_FALLBACK_DELIVERY: [OTP_CODE: {otp_code}] [RECIPIENT: {recipient_email}]")
        print(
            f"\n{'='*50}\n"
            f"  OOB SECURITY CODE — CHECK THIS TO TEST STEP-UP\n"
            f"  Recipient : {recipient_email}\n"
            f"  OTP Code  : {otp_code}\n"
            f"{'='*50}\n"
        )
