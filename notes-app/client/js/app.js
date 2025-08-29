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

    const volume = this.settingsController.savedVolume / 100;
    const enabled = this.settingsController.soundEnabled;
    Object.values(this.soundManager.sounds).forEach(s => s.volume = volume * (enabled ? 1 : 0));

    this.init();
  }

  init() {
    this.calculator.updateDisplay();
    this.notesManager.loadNotes();
    this.notesManager.initializeCharacterLimit();
    this.setupEventListeners();
    this.setupPlantSound();
  }

  setupPlantSound() {
    const plantGroup = document.getElementById('plantGroup');
    plantGroup?.addEventListener('mouseenter', () => this.soundManager.play('bush', 300));
  }

  setupEventListeners() {
    document.getElementById('edit-mode-btn')?.addEventListener('click', () => this.notesManager.toggleEditMode());
    document.getElementById('delete-mode-btn')?.addEventListener('click', () => this.notesManager.toggleDeleteMode());
    document.getElementById('add-btn')?.addEventListener('click', () => this.notesManager.handleAddOrUpdate());
    document.getElementById('prev-page')?.addEventListener('click', () => this.notesManager.changePage('prev'));
    document.getElementById('next-page')?.addEventListener('click', () => this.notesManager.changePage('next'));

    document.getElementById('content')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.notesManager.handleAddOrUpdate(); }
    });

    document.addEventListener('keydown', e => this.handleGlobalKeydown(e));
  }

  handleGlobalKeydown(e) {
    const form = document.getElementById('note-form');
    if (e.key === 'Escape') {
      if (form?.dataset.editing) { form.reset(); form.removeAttribute('data-editing'); }
      else if (this.notesManager.isEditMode || this.notesManager.isDeleteMode) this.notesManager.exitModes();
    } else if (e.key === 'ArrowLeft' && !e.target.matches('input')) this.notesManager.changePage('prev');
    else if (e.key === 'ArrowRight' && !e.target.matches('input')) this.notesManager.changePage('next');
  }
}

// Global for inline HTML functions
window.app = new NotesApp();

// Expose calculator functions globally if needed
window.inputNumber = num => app.calculator.inputNumber(num);
window.inputOperator = op => app.calculator.inputOperator(op);
window.inputDecimal = () => app.calculator.inputDecimal();
window.calculate = () => app.calculator.calculate();
window.clearCalculator = () => app.calculator.clear();
window.deleteLast = () => app.calculator.deleteLast();
window.toggleLamp = () => app.lamp.toggle();
