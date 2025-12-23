/**
 * @fileoverview Main application entry point for the Notes App
 * Coordinates all controllers and manages global event handlers
 * @module app
 */

import { SoundManager } from './soundManager.js';
import { SettingsController } from './settingsController.js';
import { Calculator } from './calculator.js';
import { LampController } from './lampController.js';
import { NotesManager } from './notesManager.js';
import { LoginManager } from './loginManager.js';

/**
 * Main application class that orchestrates all components
 * Initializes and coordinates: calculator, lamp, notes, settings, auth, and sound
 */
class NotesApp {
  /**
   * Creates the application instance and initializes all controllers
   * Sets up initial sound volume based on saved settings
   */
  constructor() {
    // FIRST: Sync storage mode with authentication state
    this.syncStorageModeWithAuth();
    
    // Initialize core services
    this.soundManager = new SoundManager();
    this.settingsController = new SettingsController();
    
    // Initialize feature controllers
    this.calculator = new Calculator(this.soundManager);
    this.lamp = new LampController(this.soundManager);
    this.loginManager = new LoginManager();
    this.notesManager = new NotesManager(
      this.soundManager, 
      this.settingsController.storageManager
    );
    
    // Reference to language controller (initialized within settingsController)
    this.languageController = this.settingsController.languageController;

    // Apply saved audio settings to all sounds
    const volume = this.settingsController.savedVolume / 100;
    const enabled = this.settingsController.soundEnabled;
    Object.values(this.soundManager.sounds).forEach(sound => {
      sound.volume = volume * (enabled ? 1 : 0);
    });

    this.init();
  }

  /**
   * Synchronizes storage mode with authentication state
   * Ensures consistency between auth token and storage mode flags
   * Fixes state mismatch where user is logged in but storage shows offline
   * Called before any other initialization to ensure correct state
   * @returns {void}
   */
  syncStorageModeWithAuth() {
    const hasToken = !!localStorage.getItem('authToken') || !!localStorage.getItem('token');
    const currentStorageMode = localStorage.getItem('storageMode');
    
    if (hasToken) {
      // User is authenticated - ensure online mode
      if (currentStorageMode !== 'online') {
        console.log('[App Init] User authenticated, switching to online mode');
        localStorage.setItem('storageMode', 'online');
        localStorage.setItem('offlineMode', 'false');
      }
    } else {
      // User not authenticated - ensure offline mode
      if (currentStorageMode !== 'offline') {
        console.log('[App Init] User not authenticated, switching to offline mode');
        localStorage.setItem('storageMode', 'offline');
        localStorage.setItem('offlineMode', 'true');
      }
    }
  }

  /**
   * Initializes all application components and sets up event listeners
   * Called automatically after constructor completes
   */
  init() {
    // Initialize controllers that need DOM setup
    this.calculator.init();
    this.lamp.init();
    
    // Load and initialize notes data
    this.notesManager.loadNotes();
    this.notesManager.initializeCharacterLimit();
    
    // Set up all event handlers
    this.setupEventListeners();
    this.setupPlantSound();
    this.setupLanguageHandlers();
  }

  /**
   * Sets up handlers for language change events
   * Updates UI elements that display translated content
   */
  setupLanguageHandlers() {
    window.addEventListener('language-changed', () => {
      this.updatePageInfo();
      this.updateSettingsLabel();
    });
  }

  /**
   * Updates the pagination info display with current language
   * Handles both normal pagination and "no pages" state
   */
  updatePageInfo() {
    const pageInfo = document.getElementById('pageInfo');
    if (!pageInfo || !this.notesManager) return;

    const totalPages = this.notesManager.getTotalPages();
    
    if (totalPages === 0) {
      const noPages = this.languageController.getTranslation('page.noPages') || 'No pages';
      pageInfo.textContent = noPages;
      return;
    }
    
    const current = this.notesManager.currentPage;
    const total = totalPages;
    const template = this.languageController.getTranslation('page.info');
    
    pageInfo.textContent = template
      .replace('{current}', current)
      .replace('{total}', total);
  }

  /**
   * Updates the settings box label text
   * Currently handled via CSS ::after pseudo-element
   */
  updateSettingsLabel() {
    // Note: This is managed through CSS custom properties
    // See settingsController.updateSettingsButtonText() for implementation
  }

  /**
   * Attaches sound effect to the decorative plant element
   */
  setupPlantSound() {
    const plantGroup = document.getElementById('plantGroup');
    plantGroup?.addEventListener('mouseenter', () => {
      this.soundManager.play('bush', 300);
    });
  }

  /**
   * Sets up all DOM event listeners for the application
   * Includes: mode toggles, pagination, form submission, and keyboard shortcuts
   */
  setupEventListeners() {
    // Mode toggle buttons
    document.getElementById('editModeBtn')?.addEventListener('click', () => {
      this.notesManager.toggleEditMode();
    });
    
    document.getElementById('deleteModeBtn')?.addEventListener('click', () => {
      this.notesManager.toggleDeleteMode();
    });
    
    // Note creation button
    document.getElementById('addBtn')?.addEventListener('click', () => {
      this.notesManager.handleAddOrUpdate();
    });
    
    // Pagination controls
    document.getElementById('prevPage')?.addEventListener('click', () => {
      this.notesManager.changePage('prev');
      this.updatePageInfo();
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
      this.notesManager.changePage('next');
      this.updatePageInfo();
    });

    // Enter key in note input creates new note
    document.getElementById('content')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { 
        e.preventDefault(); 
        this.notesManager.handleAddOrUpdate(); 
      }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
  }

  /**
   * Handles global keyboard shortcuts
   * @param {KeyboardEvent} e - The keyboard event
   * 
   * Shortcuts:
   * - Escape: Cancel editing or exit modes
   * - ArrowLeft: Previous page (when not in input)
   * - ArrowRight: Next page (when not in input)
   */
  handleGlobalKeydown(e) {
    const form = document.getElementById('noteForm');
    
    // Escape key handling
    if (e.key === 'Escape') {
      if (form?.dataset.editing) { 
        form.reset(); 
        form.removeAttribute('data-editing'); 
      } else if (this.notesManager.isEditMode || this.notesManager.isDeleteMode) {
        this.notesManager.exitModes();
      }
      return;
    }
    
    // Prevent arrow navigation when typing in input fields
    if (e.target.matches('input')) return;
    
    // Arrow key navigation
    if (e.key === 'ArrowLeft') {
      this.notesManager.changePage('prev');
      this.updatePageInfo();
    } else if (e.key === 'ArrowRight') {
      this.notesManager.changePage('next');
      this.updatePageInfo();
    }
  }
}

// Initialize the application when script loads
window.app = new NotesApp();
