"""Transactional email via Resend REST API (httpx — no new dependency)."""
from __future__ import annotations
import logging
import os

import httpx

log = logging.getLogger(__name__)

_KEY = os.getenv("RESEND_API_KEY", "")
_FROM = "QCI Club <info@qciclub.com>"


def _confirmation_html(founder_name: str, startup_name: str, status_url: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Application Received — QCI Club</title>
</head>
<body style="margin:0;padding:0;background:#F0F3FA;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F3FA;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

      <!-- Header -->
      <tr>
        <td style="background:#0F2D6B;padding:28px 40px 24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:#FCB303;letter-spacing:0.02em;">
              QCI Club
            </td>
          </tr></table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#ffffff;padding:44px 40px 36px;">

          <div style="display:inline-block;background:#EBF0FF;border-radius:100px;padding:5px 14px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#0F2D6B;margin-bottom:24px;">
            APPLICATION RECEIVED
          </div>

          <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;color:#0F2D6B;margin:0 0 16px;line-height:1.15;">
            Thank you, {founder_name}.
          </h1>

          <p style="font-size:15px;color:#4A5C8A;line-height:1.75;margin:0 0 32px;">
            We've received your application for
            <strong style="color:#0F2D6B;">{startup_name}</strong>.
            Our member panel will review it within <strong style="color:#0F2D6B;">48 hours</strong>
            and you'll hear back from us with a clear next step.
          </p>

          <!-- Stat cards -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td width="50%" style="padding-right:8px;">
                <div style="background:#F0F3FA;border-radius:8px;padding:18px 20px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4A5C8A;margin-bottom:6px;">COMPANY</div>
                  <div style="font-size:20px;font-weight:700;color:#0F2D6B;">{startup_name}</div>
                </div>
              </td>
              <td width="50%" style="padding-left:8px;">
                <div style="background:#F0F3FA;border-radius:8px;padding:18px 20px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4A5C8A;margin-bottom:6px;">REVIEW WINDOW</div>
                  <div style="font-size:20px;font-weight:700;color:#0F2D6B;">48 hours</div>
                </div>
              </td>
            </tr>
          </table>

          <!-- What's next -->
          <h2 style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;color:#0F2D6B;margin:0 0 14px;">
            What happens next
          </h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td style="padding:0 0 10px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="width:24px;vertical-align:top;padding-top:2px;">
                    <div style="width:20px;height:20px;border-radius:50%;background:#0F2D6B;color:#FCB303;font-size:11px;font-weight:700;text-align:center;line-height:20px;">1</div>
                  </td>
                  <td style="padding-left:12px;font-size:14px;color:#4A5C8A;line-height:1.65;">Our member panel reviews your deck and background.</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 10px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="width:24px;vertical-align:top;padding-top:2px;">
                    <div style="width:20px;height:20px;border-radius:50%;background:#0F2D6B;color:#FCB303;font-size:11px;font-weight:700;text-align:center;line-height:20px;">2</div>
                  </td>
                  <td style="padding-left:12px;font-size:14px;color:#4A5C8A;line-height:1.65;">If shortlisted, you'll receive a pitch evening invitation.</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td>
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="width:24px;vertical-align:top;padding-top:2px;">
                    <div style="width:20px;height:20px;border-radius:50%;background:#0F2D6B;color:#FCB303;font-size:11px;font-weight:700;text-align:center;line-height:20px;">3</div>
                  </td>
                  <td style="padding-left:12px;font-size:14px;color:#4A5C8A;line-height:1.65;">Every founder hears back — we don't ghost applicants.</td>
                </tr></table>
              </td>
            </tr>
          </table>

          <!-- Status link -->
          <div style="background:#FFFBEA;border:1px solid rgba(252,179,3,0.35);border-radius:8px;padding:16px 20px;margin-bottom:28px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#92400E;margin-bottom:6px;">TRACK YOUR APPLICATION</div>
            <a href="{status_url}" style="font-size:13px;color:#0F2D6B;text-decoration:none;word-break:break-all;">{status_url}</a>
          </div>

          <!-- CTA button -->
          <a href="{status_url}" style="display:inline-block;background:#0F2D6B;color:#FCB303;padding:13px 28px;border-radius:4px;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em;">
            Check Application Status →
          </a>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#F0F3FA;padding:20px 40px;border-top:1px solid #DDE3F0;">
          <p style="font-size:12px;color:#8a8a8a;margin:0;line-height:1.7;">
            QCI Club &nbsp;·&nbsp;
            <a href="mailto:info@qciclub.com" style="color:#4A5C8A;text-decoration:none;">info@qciclub.com</a><br>
            You're receiving this because you submitted an application via qciclub.com.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""


async def send_application_confirmation(
    founder_name: str,
    founder_email: str,
    startup_name: str,
    status_token: str,
    frontend_url: str,
) -> None:
    if not _KEY:
        log.warning("RESEND_API_KEY not set — skipping confirmation email to %s", founder_email)
        return

    status_url = f"{frontend_url.rstrip('/')}/apply/status/{status_token}"

    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {_KEY}", "Content-Type": "application/json"},
                json={
                    "from": _FROM,
                    "to": [founder_email],
                    "subject": f"QCI Club — Application received for {startup_name}",
                    "html": _confirmation_html(founder_name, startup_name, status_url),
                },
                timeout=10,
            )
            r.raise_for_status()
            log.info("Confirmation email sent to %s (id=%s)", founder_email, r.json().get("id"))
        except Exception as exc:
            log.error("Confirmation email failed for %s: %s", founder_email, exc)
