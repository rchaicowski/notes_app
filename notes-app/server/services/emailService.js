/**
 * @fileoverview Email service for sending verification emails
 * @module services/emailService
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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
                    This link will expire in 24 hours.
                </p>
            </div>
        `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
}

async function verifyEmailService() {
    try {
        await transporter.verify();
        console.log('✅ Email service is ready');
        return true;
    } catch (error) {
        console.error('⚠️ Email service not configured:', error.message);
        return false;
    }
}

module.exports = {
    sendVerificationEmail,
    verifyEmailService
};
