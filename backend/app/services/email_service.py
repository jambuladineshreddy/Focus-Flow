"""
Gmail Email Service using Python's built-in smtplib (no extra packages needed).
Sends task reminders, daily digests, and goal alerts via Gmail SMTP.
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, date
from typing import List, Optional

from ..config import settings

logger = logging.getLogger(__name__)


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Core email sender using Gmail SMTP with App Password."""
    if not settings.GMAIL_USER or not settings.GMAIL_APP_PASSWORD:
        logger.warning("Gmail credentials not configured — email not sent.")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"FocusFlow AI <{settings.GMAIL_USER}>"
        msg["To"] = to_email

        # Plain-text fallback
        plain = html_body.replace("<br>", "\n").replace("</p>", "\n").replace("<li>", "• ")
        import re
        plain = re.sub(r"<[^>]+>", "", plain)
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.GMAIL_USER, to_email, msg.as_string())

        logger.info(f"Email sent to {to_email}: {subject}")
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error("Gmail auth failed — check GMAIL_USER and GMAIL_APP_PASSWORD in .env")
        return False
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False


def _base_template(title: str, content: str) -> str:
    """Returns a styled HTML email template."""
    return f"""
<!DOCTYPE html>
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
      Manage your notification settings in the app.
    </div>
  </div>
</body>
</html>
"""


def send_test_email(to_email: str, user_name: str) -> bool:
    content = f"""
    <p>Hey <strong>{user_name}</strong> 👋</p>
    <p>Your Gmail notifications are working perfectly with FocusFlow AI!</p>
    <div class="card">
      <p style="margin:0;font-weight:600;color:#6366f1;">✅ Connection successful</p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">
        You'll now receive task reminders, daily digests, and goal alerts right in your inbox.
      </p>
    </div>
    <a href="http://localhost:5173" class="btn">Open FocusFlow →</a>
    """
    return _send_email(to_email, "✅ FocusFlow AI — Notifications Connected!", _base_template("Test Email", content))


def send_daily_digest(to_email: str, user_name: str, tasks: list, goals: list) -> bool:
    today = date.today().strftime("%A, %B %d")
    overdue = [t for t in tasks if t.get("is_overdue")]
    due_today = [t for t in tasks if t.get("due_today")]
    high_priority = [t for t in tasks if t.get("priority") == "high" and t.get("status") != "completed"]

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
    return _send_email(to_email, f"📅 FocusFlow Daily Digest — {today}", _base_template("Your Daily Digest", content))


def send_task_reminder(to_email: str, user_name: str, task: dict) -> bool:
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
    return _send_email(to_email, f"⏰ Reminder: {task['title']}", _base_template("Task Reminder", content))


def send_goal_alert(to_email: str, user_name: str, goal: dict, alert_type: str) -> bool:
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
    return _send_email(to_email, f"{title} — {goal['title']}", _base_template(title, content))
