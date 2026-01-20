/**
 * @fileoverview Email service for sending verification and password reset emails
 * Uses Nodemailer with Gmail SMTP (configurable for other providers)
 * @module services/emailService
 */

const nodemailer = require('nodemailer');

/**
 * Email transporter configuration
 * 
 * Environment variables required:
 * - EMAIL_USER: Your Gmail address
 * - EMAIL_PASSWORD: App-specific password (not your regular Gmail password!)
 * - EMAIL_FROM: Sender email address
 * 
 * To get Gmail app password:
 * 1. Go to Google Account settings
 * 2. Security → 2-Step Verification
 * 3. App passwords → Generate new
 * 4. Use generated password in .env
 */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Base URL for email links
 * Uses frontend URL from environment or defaults to localhost
 */
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Sends verification email to new user
 * Contains link to verify email address
 * 
 * @param {string} email - User email address
 * @param {string} token - Verification token (64-char hex)
 * @returns {Promise<void>}
 * @throws {Error} If email sending fails
 */
async function sendVerificationEmail(email, token) {
    const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}`;
    
    const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: 'Verify Your Email - Notes App',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Welcome to Notes App!</h2>
                <p>Thanks for signing up. Please verify your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" 
                       style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Email
                    </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                    Or copy and paste this link:<br>
                    <a href="${verificationUrl}">${verificationUrl}</a>
                </p>
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    This link will expire in 24 hours. If you didn't create an account, please ignore this email.
                </p>
            </div>
        `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
}

/**
 * Sends password reset email to user
 * Contains link with secure token to reset password
 * 
 * @param {string} email - User email address
 * @param {string} token - Password reset token (64-char hex)
 * @returns {Promise<void>}
 * @throws {Error} If email sending fails
 */
async function sendPasswordResetEmail(email, token) {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    
    const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: 'Reset Your Password - Notes App',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Password Reset Request</h2>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" 
                       style="background-color: #2196F3; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                    Or copy and paste this link into your browser:<br>
                    <a href="${resetUrl}">${resetUrl}</a>
                </p>
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    This link will expire in 1 hour. If you didn't request a password reset, 
                    please ignore this email and your password will remain unchanged.
                </p>
                <p style="color: #999; font-size: 11px; margin-top: 20px;">
                    For security reasons, never share this email with anyone.
                </p>
            </div>
        `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
}

/**
 * Verifies email service is configured correctly
 * Should be called at server startup
 * 
 * @returns {Promise<boolean>} True if email service is working
 */
async function verifyEmailService() {
    try {
        await transporter.verify();
        console.log('✅ Email service is ready');
        return true;
    } catch (error) {
        console.error('⚠️ Email service not configured:', error.message);
        console.error('Set EMAIL_USER and EMAIL_PASSWORD in .env to enable email features');
        return false;
    }
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    verifyEmailService
};
