/**
 * @fileoverview Authentication state management module
 * Centralized auth token and user data handling with localStorage persistence
 * Single source of truth: localStorage (in-memory cache for performance)
 * UI event handling is delegated to LoginManager to avoid duplicate listeners
 * @module auth
 */

/**
 * Base API URL for all backend endpoints
 * @const {string}
 */
export const API_URL = 'http://localhost:5000/api';

/**
 * In-memory cache of authentication token
 * Synced with localStorage for cross-tab consistency
 * Supports both 'authToken' (current) and 'token' (legacy) keys
 * @type {string|null}
 */
let authToken = localStorage.getItem('authToken') || localStorage.getItem('token');

/**
 * In-memory cache of current user object
 * Synced with localStorage for cross-tab consistency
 * @type {Object|null}
 */
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

/**
 * Retrieves the current authentication token
 * Always reads from localStorage to ensure fresh state across tabs/windows
 * 
 * @returns {string|null} The auth token if authenticated, null otherwise
 */
export function getAuthToken() {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
}

/**
 * Sets the authentication token and persists it to localStorage
 * Handles both setting and clearing the token
 * 
 * @param {string|null} token - The auth token to store, or null to clear
 */
export function setAuthToken(token) {
    authToken = token;
    
    if (token) {
        localStorage.setItem('authToken', token);
    } else {
        // Clear both current and legacy token keys
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
    }
}

/**
 * Checks if user is currently authenticated
 * 
 * @returns {boolean} True if valid auth token exists, false otherwise
 */
export function isAuthenticated() {
    return !!(localStorage.getItem('authToken') || localStorage.getItem('token'));
}

/**
 * Retrieves the current user object
 * Always reads from localStorage to ensure fresh state across tabs/windows
 * 
 * @returns {Object|null} The user object if authenticated, null otherwise
 */
export function getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
}

/**
 * Sets the current user and persists to localStorage
 * Handles both setting and clearing the user
 * 
 * @param {Object|null} user - The user object to store, or null to clear
 */
export function setCurrentUser(user) {
    currentUser = user;
    
    if (user) {
        localStorage.setItem('user', JSON.stringify(user));
    } else {
        localStorage.removeItem('user');
    }
}

/**
 * Logs out the current user
 * Clears all authentication data from memory and localStorage
 * Dispatches 'auth-changed' custom event to notify other components
 * 
 * @fires CustomEvent#auth-changed
 */
export function logout() {
    // Clear in-memory cache
    authToken = null;
    currentUser = null;
    
    // Clear localStorage (both current and legacy keys)
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Notify application of auth state change
    window.dispatchEvent(new CustomEvent('auth-changed', { 
        detail: { isAuthenticated: false } 
    }));
}
