/**
 * @fileoverview Settings panel controller managing app configuration
 * Handles storage mode, audio settings, language selection, and account management
 * Coordinates between StorageManager and LanguageController
 * @module settingsController
 */

import { StorageManager } from './storageManager.js';
import { LanguageController } from './languageController.js';

/**
 * Manages the settings panel and application configuration
 * Coordinates storage mode, audio preferences, language selection, and UI updates
 * Persists settings to localStorage and syncs with SoundManager
 */
export class SettingsController {
  /**
   * Creates a new SettingsController instance
   * Initializes storage and language controllers, loads saved settings
   * Sets up event listeners for settings panel interactions
   */
  constructor() {
    /**
     * Settings panel element
     * @type {HTMLElement}
     */
    this.panel = document.getElementById('settingsPanel');
    
    /**
     * Settings overlay (backdrop) element
     * @type {HTMLElement}
     */
    this.overlay = document.getElementById('settingsOverlay');
    
    /**
     * Settings trigger button (matchbox element)
     * @type {HTMLElement}
     */
    this.trigger = document.getElementById('settingsTrigger');
    
    /**
     * Settings close button
     * @type {HTMLElement}
     */
    this.closeBtn = document.getElementById('settingsClose');

    /**
     * Storage manager for handling offline/online data persistence
     * @type {StorageManager}
     */
    this.storageManager = new StorageManager();
    
    /**
     * Language controller for internationalization
     * @type {LanguageController}
     */
    this.languageController = new LanguageController();
    
    // Initialize settings
    this.loadSavedSettings();
    this.updateStorageModeDisplay();
    this.updateSettingsButtonText();
    this.init();
  }

  /**
   * Updates the storage mode display in settings panel
   * Shows current mode (Online/Offline) and toggle button visibility
   * Uses translations from LanguageController for localized text
   * Checks authentication state as the primary source of truth
   */
  updateStorageModeDisplay() {
    const storageModeDisplay = document.getElementById('storageModeDisplay');
    const switchToOnlineBtn = document.getElementById('switchToOnline');
    
    // Check authentication state first - this is the source of truth
    const hasToken = !!localStorage.getItem('authToken') || !!localStorage.getItem('token');
    
    // If authenticated, user is online regardless of flags
    const isOffline = hasToken ? false : 
                     (localStorage.getItem('offlineMode') === 'true' || 
                      localStorage.getItem('storageMode') === 'offline');

    if (storageModeDisplay) {
      // Get localized mode text
      const modeText = isOffline ? 
        this.languageController.getTranslation('settings.offline') : 
        this.languageController.getTranslation('settings.online');
      
      storageModeDisplay.textContent = modeText;
      storageModeDisplay.className = isOffline ? 'mode-offline' : 'mode-online';
    }

    // Show/hide online mode switch button
    if (switchToOnlineBtn) {
      if (isOffline) {
        switchToOnlineBtn.classList.remove('hidden');
      } else {
        switchToOnlineBtn.classList.add('hidden');
      }
    }
  }

  /**
   * Updates settings button text using CSS custom properties
   * Dynamically adjusts font size based on translated text length
   * Ensures text fits within matchbox button constraints
   * 
   * Font size calculation:
   * - <= 8 chars: 16.8px (default)
   * - 9-10 chars: 15.5px
   * - 11-12 chars: 14.5px
   * - > 12 chars: 12px (minimum)
   */
  updateSettingsButtonText() {
    const settingsText = this.languageController.getTranslation('settings.trigger');
    
    // Update CSS variable for ::after pseudo-element content
    document.documentElement.style.setProperty('--settings-text', `"${settingsText}"`);
    
    // Calculate appropriate font size for text length
    let fontSize = '16.8px'; 
    if (settingsText.length > 12) {
      fontSize = '12px';
    } else if (settingsText.length > 10) {
      fontSize = '14.5px';
    } else if (settingsText.length > 8) {
      fontSize = '15.5px';
    }
    
    document.documentElement.style.setProperty('--settings-font-size', fontSize);
  }

  /**
   * Loads saved settings from localStorage
   * Restores volume level, sound enabled state, and updates UI controls
   * Stores values on instance for access by other components
   * 
   * @property {number} savedVolume - Saved volume level (0-100)
   * @property {boolean} soundEnabled - Whether sounds are enabled
   */
  loadSavedSettings() {
    const savedVolume = localStorage.getItem('masterVolume') || 50;
    const savedSoundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    
    const volumeSlider = document.getElementById('masterVolume');
    const volumeValue = document.getElementById('masterVolumeValue');
    const soundToggle = document.getElementById('soundEnabled');

    // Update volume controls
    if (volumeSlider && volumeValue) { 
      volumeSlider.value = savedVolume; 
      volumeValue.textContent = `${savedVolume}%`; 
    }
    
    // Update sound toggle
    if (soundToggle) {
      soundToggle.checked = savedSoundEnabled;
    }

    // Store on instance for external access
    this.savedVolume = savedVolume;
    this.soundEnabled = savedSoundEnabled;
  }

  /**
   * Initializes event listeners and reactivity
   * Sets up panel open/close triggers, keyboard shortcuts, and setting controls
   * Listens for offline-mode-changed and language-changed events
   */
  init() {
    // React to offline mode changes from other components
    window.addEventListener('offline-mode-changed', () => {
      this.updateStorageModeDisplay();
    });

    // React to language changes
    window.addEventListener('language-changed', () => {
      this.updateStorageModeDisplay();
      this.updateSettingsButtonText();
    });

    // React to auth changes
    window.addEventListener('auth-changed', () => {
      this.updateStorageModeDisplay();
    });

    // Switch to online mode button
    document.getElementById('switchToOnline')?.addEventListener('click', async () => {
      // Clear offline mode flags
      localStorage.removeItem('offlineMode');
      localStorage.setItem('storageMode', 'online');
      
      // Reload the page to reinitialize with online mode (show login)
      window.location.reload();
    });

    // Settings trigger - click event
    this.trigger.addEventListener('click', () => {
      if (window.app?.soundManager) {
        window.app.soundManager.play('box');
      }
      this.open();
    });

    // Settings trigger - keyboard support (Enter or Space)
    this.trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (window.app?.soundManager) {
          window.app.soundManager.play('box');
        }
        this.open();
      }
    });
    
    // Close button
    this.closeBtn.addEventListener('click', () => this.close());
    
    // Click overlay to close
    this.overlay.addEventListener('click', () => this.close());
    
    // Escape key to close (when panel is open)
    document.addEventListener('keydown', e => { 
      if (e.key === 'Escape' && this.panel.classList.contains('open')) {
        this.close();
      }
    });
    
    // Set up audio and other controls
    this.setupControls();
  }

  /**
   * Opens the settings panel
   * Adds visual classes, updates ARIA states, and prevents body scroll
   * Updates display to reflect current state
   */
  open() {
    // Update display when opening to ensure fresh state
    this.updateStorageModeDisplay();
    
    this.trigger.classList.add('open');
    this.panel.classList.add('open'); 
    this.overlay.classList.add('open');
    
    // Update ARIA state for accessibility
    this.overlay?.setAttribute('aria-hidden', 'false');
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden'; 
  }
  
  /**
   * Closes the settings panel
   * Removes visual classes, updates ARIA states, and restores body scroll
   */
  close() { 
    this.trigger.classList.remove('open');
    this.panel.classList.remove('open'); 
    this.overlay.classList.remove('open');
    
    // Update ARIA state for accessibility
    this.overlay?.setAttribute('aria-hidden', 'true');
    
    // Restore background scrolling
    document.body.style.overflow = 'auto'; 
  }

  /**
   * Sets up audio control event listeners
   * Handles volume slider and sound toggle interactions
   * Syncs changes with SoundManager and persists to localStorage
   * 
   * Volume behavior:
   * - Updates all sound volumes in real-time
   * - Respects sound enabled toggle (volume * enabled)
   * - Persists value to localStorage
   * 
   * Sound toggle behavior:
   * - When enabled: Sets volumes to slider value
   * - When disabled: Mutes all sounds (volume = 0)
   * - Persists state to localStorage
   */
  setupControls() {
    const volumeSlider = document.getElementById('masterVolume');
    const volumeValue = document.getElementById('masterVolumeValue');
    const soundToggle = document.getElementById('soundEnabled');

    // Volume slider handler
    volumeSlider?.addEventListener('input', e => {
      const value = e.target.value;
      
      // Update display
      volumeValue.textContent = `${value}%`;
      
      // Update all sound volumes
      if (window.app?.soundManager) {
        const actualVolume = (value / 100) * (soundToggle.checked ? 1 : 0);
        Object.values(window.app.soundManager.sounds).forEach(sound => {
          sound.volume = actualVolume;
        });
      }
      
      // Persist to localStorage
      localStorage.setItem('masterVolume', value);
    });

    // Sound enable/disable toggle handler
    soundToggle?.addEventListener('change', e => {
      const enabled = e.target.checked;
      
      // Persist to localStorage
      localStorage.setItem('soundEnabled', enabled);
      
      // Update all sound volumes
      if (window.app?.soundManager) {
        const volume = volumeSlider ? volumeSlider.value / 100 : 0.5;
        const actualVolume = enabled ? volume : 0;
        Object.values(window.app.soundManager.sounds).forEach(sound => {
          sound.volume = actualVolume;
        });
      }
    });
  }
}
