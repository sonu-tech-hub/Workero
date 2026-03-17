/**
 * ============================================================
 * NOTIFICATION SERVICE - Advanced Worker Finder v3.0.0
 * Push notifications, email, in-app notifications
 * ============================================================
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const aiService = require('./aiService');

class NotificationService {
  constructor() {
    this.transporter = null;
    this._initEmail();
  }

  _initEmail() {
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
          }
        });
        logger.info('✅ Email transporter initialized');
      }
    } catch (err) {
      logger.warn('Email transporter init failed', { error: err.message });
    }
  }

  // ─── Send OTP Email ──────────────────────────────────────
  async sendOTPEmail(to, otp, name = 'User') {
    const subject = '🔐 Your OTP - Worker Finder';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 500px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
          .header h1 { color: #fff; margin: 0; font-size: 24px; }
          .body { padding: 30px; }
          .otp-box { background: #f8f9ff; border: 2px dashed #667eea; border-radius: 8px; text-align: center; padding: 20px; margin: 20px 0; }
          .otp { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
          .warning { color: #e74c3c; font-size: 12px; margin-top: 15px; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔨 Worker Finder</h1>
          </div>
          <div class="body">
            <h2>Hello ${name}! 👋</h2>
            <p>Your verification OTP is:</p>
            <div class="otp-box">
              <div class="otp">${otp}</div>
            </div>
            <p>This OTP is valid for <strong>${process.env.OTP_EXPIRY_MINUTES || 10} minutes</strong>.</p>
            <p class="warning">⚠️ Do NOT share this OTP with anyone. Worker Finder will never ask for your OTP.</p>
          </div>
          <div class="footer">
            <p>If you didn't request this, please ignore this email.</p>
            <p>© ${new Date().getFullYear()} Worker Finder. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  // ─── Send Generic Email ───────────────────────────────────
  async sendEmail(to, subject, html, text = '') {
    if (!this.transporter) {
      logger.warn('Email not sent (no transporter)', { to, subject });
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Worker Finder" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        text: text || subject
      });
      logger.info('Email sent', { to, subject, messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      logger.error('Email send failed', { to, subject, error: err.message });
      return { success: false, error: err.message };
    }
  }

  // ─── Save In-App Notification ────────────────────────────
  async saveNotification(pool, userId, type, data = {}) {
    try {
      const notification = aiService.generateNotification(type, data);
      const sql = `
        INSERT INTO notifications (user_id, type, title, body, data, priority, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;
      await pool.execute(sql, [
        userId,
        type,
        notification.title,
        notification.body,
        JSON.stringify(data),
        notification.priority || 'medium'
      ]);
      return { success: true, notification };
    } catch (err) {
      logger.error('Failed to save notification', { userId, type, error: err.message });
      return { success: false, error: err.message };
    }
  }

  // ─── Payment Receipt Email ────────────────────────────────
  async sendPaymentReceipt(to, paymentData) {
    const { amount, jobTitle, paymentId, workerName } = paymentData;
    const subject = `✅ Payment Confirmed - ₹${amount} | Worker Finder`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; }
          .container { max-width: 500px; margin: 30px auto; background: #fff; border-radius: 12px; padding: 30px; }
          .header { text-align: center; color: #27ae60; }
          .amount { font-size: 48px; font-weight: bold; color: #27ae60; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          td { padding: 10px; border-bottom: 1px solid #eee; }
          td:first-child { color: #666; }
          td:last-child { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✅ Payment Successful!</h2>
          </div>
          <div class="amount">₹${amount}</div>
          <table>
            <tr><td>Payment ID</td><td>${paymentId}</td></tr>
            <tr><td>Job</td><td>${jobTitle}</td></tr>
            <tr><td>Worker</td><td>${workerName}</td></tr>
            <tr><td>Date</td><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
            <tr><td>Status</td><td>✅ Confirmed</td></tr>
          </table>
          <p style="color: #666; font-size: 12px; text-align: center;">
            Keep this receipt for your records. For disputes, contact support within 7 days.
          </p>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(to, subject, html);
  }
}

module.exports = new NotificationService();
