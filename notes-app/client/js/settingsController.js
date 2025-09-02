import { StorageManager } from './storageManager.js';

export class SettingsController {
  constructor() {
    this.panel = document.getElementById('settingsPanel');
    this.overlay = document.getElementById('settingsOverlay');
    this.trigger = document.getElementById('settingsTrigger');
    this.closeBtn = document.getElementById('settingsClose');

    this.storageManager = new StorageManager();
    this.loadSavedSettings();
    this.updateStorageModeDisplay();
    this.init();
  }

  updateStorageModeDisplay() {
    const storageModeDisplay = document.getElementById('storageModeDisplay');
    const switchToOnlineBtn = document.getElementById('switchToOnline');
    const isOffline = localStorage.getItem('offlineMode') === 'true';

    if (storageModeDisplay) {
      storageModeDisplay.textContent = isOffline ? 'Offline' : 'Online';
      storageModeDisplay.className = isOffline ? 'mode-offline' : 'mode-online';
    }

    if (switchToOnlineBtn) {
      if (isOffline) {
        switchToOnlineBtn.classList.remove('hidden');
      } else {
        switchToOnlineBtn.classList.add('hidden');
      }
    }
  }

  loadSavedSettings() {
    const savedVolume = localStorage.getItem('masterVolume') || 50;
    const savedSoundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    const volumeSlider = document.getElementById('masterVolume');
    const volumeValue = document.getElementById('masterVolumeValue');
    const soundToggle = document.getElementById('soundEnabled');

    if (volumeSlider && volumeValue) { volumeSlider.value = savedVolume; volumeValue.textContent = `${savedVolume}%`; }
    if (soundToggle) soundToggle.checked = savedSoundEnabled;

    this.savedVolume = savedVolume;
    this.soundEnabled = savedSoundEnabled;
  }

  init() {
    // Listen for offline mode changes
    window.addEventListener('offline-mode-changed', () => {
      this.updateStorageModeDisplay();
    });

    // Setup switch to online button
    document.getElementById('switchToOnline')?.addEventListener('click', () => {
      localStorage.removeItem('offlineMode');
      this.close();
      document.getElementById('authContainer')?.classList.remove('hidden');
      window.dispatchEvent(new CustomEvent('offline-mode-changed', { 
        detail: { isOffline: false } 
      }));
    });

    // Changed from hover to click, and added sound effect
    this.trigger.addEventListener('click', () => {
      // Play box sound when opening
      if (window.app?.soundManager) {
        window.app.soundManager.play('box');
      }
      this.open();
    });
    
    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', () => this.close());
    document.addEventListener('keydown', e => { 
      if (e.key === 'Escape' && this.panel.classList.contains('open')) this.close(); 
    });
    this.setupControls();
  }

  open() { 
    // Add 'open' class to trigger to keep the box open
    this.trigger.classList.add('open');
    this.panel.classList.add('open'); 
    this.overlay.classList.add('open'); 
    document.body.style.overflow = 'hidden'; 
  }
  
  close() { 
    // Remove 'open' class from trigger to close the box
    this.trigger.classList.remove('open');
    this.panel.classList.remove('open'); 
    this.overlay.classList.remove('open'); 
    document.body.style.overflow = 'auto'; 
  }

  setupControls() {
    const volumeSlider = document.getElementById('masterVolume');
    const volumeValue = document.getElementById('masterVolumeValue');
    const soundToggle = document.getElementById('soundEnabled');
    const notesPerPageSelect = document.getElementById('notesPerPage');

    volumeSlider?.addEventListener('input', e => {
      const value = e.target.value;
      volumeValue.textContent = `${value}%`;
      if (window.app?.soundManager) {
        const actualVolume = (value / 100) * (soundToggle.checked ? 1 : 0);
        Object.values(window.app.soundManager.sounds).forEach(s => s.volume = actualVolume);
      }
      localStorage.setItem('masterVolume', value);
    });

    soundToggle?.addEventListener('change', e => {
      const enabled = e.target.checked;
      localStorage.setItem('soundEnabled', enabled);
      if (window.app?.soundManager) {
        const volume = volumeSlider ? volumeSlider.value / 100 : 0.5;
        const actualVolume = enabled ? volume : 0;
        Object.values(window.app.soundManager.sounds).forEach(s => s.volume = actualVolume);
      }
    });

    notesPerPageSelect?.addEventListener('change', e => {
      const n = parseInt(e.target.value);
      if (window.app?.notesManager) {
        window.app.notesManager.notesPerPage = n;
        window.app.notesManager.renderNotes();
      }
    });
  }
}
