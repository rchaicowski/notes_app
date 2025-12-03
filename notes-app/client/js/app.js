import { SoundManager } from './soundManager.js';
import { SettingsController } from './settingsController.js';
import { Calculator } from './calculator.js';
import { LampController } from './lampController.js';
import { NotesManager } from './notesManager.js';
import { LoginManager } from './loginManager.js';

class NotesApp {
  constructor() {
    this.soundManager = new SoundManager();
    this.settingsController = new SettingsController();
    this.calculator = new Calculator(this.soundManager);
    this.lamp = new LampController(this.soundManager);
    this.loginManager = new LoginManager();
    this.notesManager = new NotesManager(this.soundManager, this.settingsController.storageManager);
    
    // Language controller is initialized within settingsController
    this.languageController = this.settingsController.languageController;

    const volume = this.settingsController.savedVolume / 100;
    const enabled = this.settingsController.soundEnabled;
    Object.values(this.soundManager.sounds).forEach(s => s.volume = volume * (enabled ? 1 : 0));

    this.init();
  }

  init() {
    // Initialize all controllers with event listeners
    this.calculator.init();
    this.lamp.init();
    
    // Initialize other components
    this.notesManager.loadNotes();
    this.notesManager.initializeCharacterLimit();
    this.setupEventListeners();
    this.setupPlantSound();
    this.setupLanguageHandlers();
  }

  setupLanguageHandlers() {
    // Listen for language changes to update dynamic content
    window.addEventListener('language-changed', () => {
      // Update page info when language changes
      this.updatePageInfo();
      
      // Update settings box label
      this.updateSettingsLabel();
    });
  }

  updatePageInfo() {
    const pageInfo = document.getElementById('page-info');
    if (pageInfo && this.notesManager) {
      const totalPages = this.notesManager.getTotalPages();
      
      // Handle no pages case
      if (totalPages === 0) {
        const noPages = this.languageController.getTranslation('page.noPages') || 'No pages';
        pageInfo.textContent = noPages;
        return;
      }
      
      // Use current page directly (not +1)
      const current = this.notesManager.currentPage;
      const total = totalPages;
      
      const template = this.languageController.getTranslation('page.info');
      pageInfo.textContent = template.replace('{current}', current).replace('{total}', total);
    }
  }

  updateSettingsLabel() {
    const settingsLabel = document.querySelector('.matchbox-cover::after');
    // This is handled via CSS content, but we could update it dynamically if needed
    // For now, the CSS approach with data attributes works fine
  }

  setupPlantSound() {
    const plantGroup = document.getElementById('plantGroup');
    plantGroup?.addEventListener('mouseenter', () => this.soundManager.play('bush', 300));
  }

  setupEventListeners() {
    document.getElementById('edit-mode-btn')?.addEventListener('click', () => this.notesManager.toggleEditMode());
    document.getElementById('delete-mode-btn')?.addEventListener('click', () => this.notesManager.toggleDeleteMode());
    document.getElementById('add-btn')?.addEventListener('click', () => this.notesManager.handleAddOrUpdate());
    document.getElementById('prev-page')?.addEventListener('click', () => {
      this.notesManager.changePage('prev');
      this.updatePageInfo(); // Update page info after page change
    });
    document.getElementById('next-page')?.addEventListener('click', () => {
      this.notesManager.changePage('next');
      this.updatePageInfo(); // Update page info after page change
    });

    document.getElementById('content')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') { 
        e.preventDefault(); 
        this.notesManager.handleAddOrUpdate(); 
      }
    });

    document.addEventListener('keydown', e => this.handleGlobalKeydown(e));
  }

  handleGlobalKeydown(e) {
    const form = document.getElementById('note-form');
    if (e.key === 'Escape') {
      if (form?.dataset.editing) { 
        form.reset(); 
        form.removeAttribute('data-editing'); 
      }
      else if (this.notesManager.isEditMode || this.notesManager.isDeleteMode) {
        this.notesManager.exitModes();
      }
    } else if (e.key === 'ArrowLeft' && !e.target.matches('input')) {
      this.notesManager.changePage('prev');
      this.updatePageInfo();
    }
    else if (e.key === 'ArrowRight' && !e.target.matches('input')) {
      this.notesManager.changePage('next');
      this.updatePageInfo();
    }
  }
}

// Initialize the app
window.app = new NotesApp();
