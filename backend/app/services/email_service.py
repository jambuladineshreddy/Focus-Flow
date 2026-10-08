"""
Gmail Email Service using Python's built-in smtplib (no extra packages needed).
Supports per-user Gmail SMTP authentication + system-wide fallback SMTP.
Sends task reminders, daily digests, test emails, and goal alerts.
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, date
from typing import List, Optional, Tuple, Any

from ..config import settings
from ..models.models import User

logger = logging.getLogger(__name__)


def verify_smtp_credentials(smtp_user: str, smtp_password: str) -> Tuple[bool, str]:
    """
    Test Gmail SMTP credentials directly without sending an email.
    Returns (True, "Connection successful") or (False, "Error message").
    """
    if not smtp_user or not smtp_password:
        return False, "Gmail username and App Password are required."

    clean_user = smtp_user.strip()
    clean_pw = smtp_password.strip().replace(" ", "")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(clean_user, clean_pw)
        return True, f"Authentication successful for {clean_user}!"
    except smtplib.SMTPAuthenticationError:
        return False, (
            "Gmail authentication failed. Please make sure 2-Step Verification is enabled "
            "on your Google account and you are using a 16-character App Password (not your normal password)."
        )
    except smtplib.SMTPConnectError as e:
        return False, f"Could not connect to Gmail SMTP server: {str(e)}"
    except Exception as e:
        return False, f"SMTP verification error: {str(e)}"


def get_smtp_sender(user: Optional[User] = None) -> Tuple[Optional[str], Optional[str], str]:
    """
    Resolves which SMTP sender credentials to use.
    Priority 1: User's personal credentials (smtp_email, smtp_password).
    Priority 2: System-wide credentials (settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD).
    Returns (sender_email, sender_password, mode: "user" | "system" | "none").
    """
    if user and user.smtp_email and user.smtp_password:
        return user.smtp_email.strip(), user.smtp_password.strip().replace(" ", ""), "user"

    if settings.GMAIL_USER and settings.GMAIL_APP_PASSWORD:
        return settings.GMAIL_USER.strip(), settings.GMAIL_APP_PASSWORD.strip().replace(" ", ""), "system"

    return None, None, "none"


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    user: Optional[User] = None,
) -> Tuple[bool, str]:
    """
    Core email sender using Gmail SMTP with per-user or system App Password.
    Returns (True, "Success message") or (False, "Error details").
    """
    sender_email, sender_password, mode = get_smtp_sender(user)

    if not sender_email or not sender_password:
        msg = (
            "Gmail credentials not configured. Please add your Gmail address and 16-character "
            "App Password in Notification Settings, or configure server GMAIL_USER in .env."
        )
        logger.warning(msg)
        return False, msg

    target_email = to_email.strip() if to_email else None
    if not target_email and user:
        target_email = (user.notification_email or user.email or "").strip()

    if not target_email:
        return False, "No recipient email address specified."

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"FocusFlow AI <{sender_email}>"
        msg["To"] = target_email

        # Plain-text fallback
        plain = html_body.replace("<br>", "\n").replace("</p>", "\n").replace("<li>", "• ")
        import re
        plain = re.sub(r"<[^>]+>", "", plain)
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=12) as server:
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, target_email, msg.as_string())

        success_msg = f"Email sent to {target_email} from {sender_email} ({mode} credentials)"
        logger.info(success_msg)
        return True, success_msg

    except smtplib.SMTPAuthenticationError:
        err = (
            f"Gmail authentication failed for {sender_email}. "
            "Verify your 16-character Google App Password in settings."
        )
        logger.error(err)
        return False, err
    except smtplib.SMTPConnectError as e:
        err = f"Failed to connect to Gmail SMTP server: {str(e)}"
        logger.error(err)
        return False, err
    except Exception as e:
        err = f"Email sending failed: {str(e)}"
        logger.error(err)
        return False, err


def _base_template(title: str, content: str) -> str:
    """Returns a styled HTML email template."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; }}
    .wrapper {{ max-width: 600px; margin: 32px auto; background: white; border-radius: 16px;
                box-shadow: 0 4px 24px rgba(99,102,241,0.08); overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 28px 32px; }}
    .header h1 {{ margin: 0; color: white; font-size: 22px; font-weight: 700; }}
    .header p  {{ margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 13px; }}
    .logo {{ display: inline-flex; align-items: center; gap: 8px; margin-bottom: 12px; }}
    .logo-icon {{ width: 32px; height: 32px; background: rgba(255,255,255,0.2);
                  border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;
                  font-size: 16px; }}
    .body {{ padding: 28px 32px; }}
    .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
              padding: 16px 20px; margin: 12px 0; }}
    .badge {{ display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }}
    .badge-high   {{ background: #fee2e2; color: #dc2626; }}
    .badge-medium {{ background: #fef3c7; color: #d97706; }}
    .badge-low    {{ background: #f1f5f9; color: #64748b; }}
    .task-item {{ padding: 10px 0; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 10px; }}
    .task-item:last-child {{ border-bottom: none; }}
    .dot {{ width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }}
    .dot-high {{ background: #ef4444; }}
    .dot-medium {{ background: #f59e0b; }}
    .dot-low {{ background: #94a3b8; }}
    .btn {{ display: inline-block; background: #6366f1; color: white; padding: 12px 24px;
            border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;
            margin: 16px 0; }}
    .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px;
               text-align: center; font-size: 12px; color: #94a3b8; }}
    h2 {{ color: #1e293b; font-size: 16px; margin: 20px 0 8px; }}
    p  {{ color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 8px; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">⚡</div>
        <span style="color:white;font-weight:700;font-size:16px;">FocusFlow AI</span>
      </div>
      <h1>{title}</h1>
      <p>{datetime.now().strftime("%A, %B %d, %Y")}</p>
    </div>
    <div class="body">
      {content}
    </div>
    <div class="footer">
      You're receiving this because you have email notifications enabled in FocusFlow AI.<br>
      Manage your notification settings anytime in the app.
    </div>
  </div>
</body>
</html>
"""


def send_test_email(to_email: str, user_name: str, user: Optional[User] = None) -> Tuple[bool, str]:
    content = f"""
    <p>Hey <strong>{user_name}</strong> 👋</p>
    <p>Your Gmail notifications are configured and working smoothly with FocusFlow AI!</p>
    <div class="card">
      <p style="margin:0;font-weight:600;color:#6366f1;">✅ Connection Verified</p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">
        You'll receive personalized task reminders, morning daily digests, and goal alerts right to this inbox.
      </p>
    </div>
    <a href="http://localhost:5173" class="btn">Open FocusFlow →</a>
    """
    return send_email(
        to_email=to_email,
        subject="✅ FocusFlow AI — Email Notifications Connected!",
        html_body=_base_template("Test Email", content),
        user=user,
    )


def send_daily_digest(
    to_email: str,
    user_name: str,
    tasks: list,
    goals: list,
    user: Optional[User] = None,
) -> Tuple[bool, str]:
    today = date.today().strftime("%A, %B %d")
    overdue = [t for t in tasks if t.get("is_overdue")]
    due_today = [t for t in tasks if t.get("due_today")]

    def task_row(t: dict) -> str:
        p = t.get("priority", "medium")
        return f"""
        <div class="task-item">
          <div class="dot dot-{p}"></div>
          <div style="flex:1">
            <span style="font-size:14px;color:#1e293b;font-weight:500;">{t['title']}</span>
            {f'<span style="font-size:12px;color:#94a3b8;margin-left:8px;">{t.get("due_label","")}</span>' if t.get("due_label") else ""}
          </div>
          <span class="badge badge-{p}">{p}</span>
        </div>"""

    overdue_html = "".join(task_row(t) for t in overdue[:5]) if overdue else \
        "<p style='color:#10b981;font-weight:500;'>🎉 No overdue tasks!</p>"

    due_html = "".join(task_row(t) for t in due_today[:5]) if due_today else \
        "<p style='color:#64748b;'>Nothing due today.</p>"

    goals_html = "".join(
        f"""<div class="card" style="margin:8px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:600;color:#1e293b;font-size:14px;">{g['title']}</span>
            <span style="font-size:12px;color:#6366f1;font-weight:600;">{g.get('progress',0):.0f}%</span>
          </div>
          <div style="background:#e2e8f0;border-radius:4px;height:6px;margin-top:8px;">
            <div style="background:#6366f1;width:{g.get('progress',0)}%;height:6px;border-radius:4px;"></div>
          </div>
        </div>"""
        for g in goals[:4]
    ) if goals else "<p style='color:#64748b;'>No active goals.</p>"

    content = f"""
    <p>Good morning, <strong>{user_name}</strong>! Here's your productivity snapshot for <strong>{today}</strong>.</p>

    {"<div class='card' style='border-color:#fca5a5;background:#fff5f5;'><p style='color:#dc2626;font-weight:700;margin:0;'>⚠️ " + str(len(overdue)) + " Overdue Task" + ("s" if len(overdue)!=1 else "") + "</p></div>" if overdue else ""}

    <h2>📋 Due Today ({len(due_today)})</h2>
    <div class="card">{due_html}</div>

    {"<h2>🔴 Overdue Tasks</h2><div class='card'>" + overdue_html + "</div>" if overdue else ""}

    <h2>🎯 Active Goals</h2>
    {goals_html}

    <a href="http://localhost:5173/tasks" class="btn">View All Tasks →</a>
    """
    return send_email(
        to_email=to_email,
        subject=f"📅 FocusFlow Daily Digest — {today}",
        html_body=_base_template("Your Daily Digest", content),
        user=user,
    )


def send_task_reminder(
    to_email: str,
    user_name: str,
    task: dict,
    user: Optional[User] = None,
) -> Tuple[bool, str]:
    priority = task.get("priority", "medium")
    due_label = task.get("due_label", "soon")
    content = f"""
    <p>Hey <strong>{user_name}</strong>, just a friendly reminder:</p>
    <div class="card" style="border-left: 4px solid {'#ef4444' if priority=='high' else '#f59e0b' if priority=='medium' else '#94a3b8'};">
      <p style="font-size:18px;font-weight:700;color:#1e293b;margin:0 0 8px;">{task['title']}</p>
      <p style="color:#64748b;margin:0 0 12px;">{task.get('description') or 'No description'}</p>
      <div style="display:flex;gap:12px;">
        <span class="badge badge-{priority}">{priority.upper()} PRIORITY</span>
        <span style="font-size:12px;color:#94a3b8;align-self:center;">⏰ Due {due_label}</span>
      </div>
    </div>
    <a href="http://localhost:5173/tasks" class="btn">Complete Task →</a>
    """
    return send_email(
        to_email=to_email,
        subject=f"⏰ Reminder: {task['title']}",
        html_body=_base_template("Task Reminder", content),
        user=user,
    )


def send_goal_alert(
    to_email: str,
    user_name: str,
    goal: dict,
    alert_type: str,
    user: Optional[User] = None,
) -> Tuple[bool, str]:
    if alert_type == "completed":
        title = "🏆 Goal Completed!"
        msg = f"<p>Congratulations <strong>{user_name}</strong>! You've completed your goal:</p>"
        color = "#10b981"
    else:
        title = "⚠️ Goal Deadline Approaching"
        msg = f"<p>Hey <strong>{user_name}</strong>, your goal deadline is coming up:</p>"
        color = "#f59e0b"

    content = f"""
    {msg}
    <div class="card" style="border-left:4px solid {color};">
      <p style="font-weight:700;font-size:18px;color:#1e293b;margin:0 0 8px;">{goal['title']}</p>
      <p style="color:#64748b;margin:0 0 12px;">{goal.get('description') or ''}</p>
      <div style="background:#e2e8f0;border-radius:4px;height:8px;">
        <div style="background:{color};width:{goal.get('progress',0)}%;height:8px;border-radius:4px;"></div>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin:8px 0 0;">{goal.get('progress',0):.0f}% complete</p>
    </div>
    <a href="http://localhost:5173/goals" class="btn">View Goals →</a>
    """
    return send_email(
        to_email=to_email,
        subject=f"{title} — {goal['title']}",
        html_body=_base_template(title, content),
        user=user,
    )
