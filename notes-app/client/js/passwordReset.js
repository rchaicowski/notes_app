console.log('🔑 Password Reset JS loaded!');

/**
 * @fileoverview Password Reset page logic
 * Handles both forgot password and reset password flows
 * Integrates with language controller for multi-language support
 */

import { LanguageController } from './languageController.js';

const API_URL = 'http://localhost:5000/api';

// Initialize language controller
const languageController = new LanguageController();

// Check if token exists in URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const forgotForm = document.getElementById('forgotForm');
const resetForm = document.getElementById('resetForm');

// Show appropriate form based on token presence
if (token) {
    // Show reset password form
    forgotForm.classList.add('hidden');
    resetForm.classList.remove('hidden');
} else {
    // Show forgot password form
    forgotForm.classList.remove('hidden');
    resetForm.classList.add('hidden');
}

/**
 * Displays a message in the UI
 * @param {string} elementId - ID of the message container
 * @param {string} message - Message text to display
 * @param {string} type - Message type: 'success' or 'error'
 */
function showMessage(elementId, message, type) {
    const messageDiv = document.getElementById(elementId);
    messageDiv.innerHTML = `<div class="message ${type}">${message}</div>`;
}

/**
 * Clears message from the UI
 * @param {string} elementId - ID of the message container
 */
function clearMessage(elementId) {
    const messageDiv = document.getElementById(elementId);
    messageDiv.innerHTML = '';
}

// ==================== Forgot Password Handler ====================

document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const submitBtn = document.getElementById('forgotSubmitBtn');
    
    // Disable button and show loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    clearMessage('forgotMessage');

    try {
        const response = await fetch(`${API_URL}/users/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('forgotMessage', data.message, 'success');
            
            // Clear email input
            document.getElementById('email').value = '';
        } else {
            throw new Error(data.message || 'Failed to send reset email');
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        showMessage('forgotMessage', error.message, 'error');
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// ==================== Reset Password Handler ====================

document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const submitBtn = document.getElementById('resetSubmitBtn');
    
    clearMessage('resetMessage');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
        const errorMsg = languageController.getTranslation('auth.passwordMismatch') || 'Passwords do not match';
        showMessage('resetMessage', errorMsg, 'error');
        return;
    }

    // Validate password length
    if (newPassword.length < 8) {
        const errorMsg = languageController.getTranslation('auth.invalidPasswordLength') || 'Password must be at least 8 characters';
        showMessage('resetMessage', errorMsg, 'error');
        return;
    }

    // Disable button and show loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Resetting...';

    try {
        const response = await fetch(`${API_URL}/users/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password: newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('resetMessage', data.message, 'success');
            
            // Clear form
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            throw new Error(data.message || 'Failed to reset password');
        }
    } catch (error) {
        console.error('Reset password error:', error);
        showMessage('resetMessage', error.message, 'error');
        
        // Re-enable button only on error (success redirects away)
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});
