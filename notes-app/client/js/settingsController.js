import { StorageManager } from './storageManager.js';
import { LanguageController } from './languageController.js';

export class SettingsController {
  constructor() {
    this.panel = document.getElementById('settingsPanel');
    this.overlay = document.getElementById('settingsOverlay');
    this.trigger = document.getElementById('settingsTrigger');
    this.closeBtn = document.getElementById('settingsClose');

    this.storageManager = new StorageManager();
    this.languageController = new LanguageController();
    
    this.loadSavedSettings();
    this.updateStorageModeDisplay();
    this.updateSettingsButtonText();
    this.init();
  }

  updateStorageModeDisplay() {
    const storageModeDisplay = document.getElementById('storageModeDisplay');
    const switchToOnlineBtn = document.getElementById('switchToOnline');
    const isOffline = localStorage.getItem('offlineMode') === 'true';

    if (storageModeDisplay) {
      const modeText = isOffline ? 
        this.languageController.getTranslation('settings.offline') : 
        this.languageController.getTranslation('settings.online');
      
      storageModeDisplay.textContent = modeText;
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

  updateSettingsButtonText() {
    const settingsText = this.languageController.getTranslation('settings.trigger');
    document.documentElement.style.setProperty('--settings-text', `"${settingsText}"`);
    
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

  loadSavedSettings() {
    const savedVolume = localStorage.getItem('masterVolume') || 50;
    const savedSoundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    const volumeSlider = document.getElementById('masterVolume');
    const volumeValue = document.getElementById('masterVolumeValue');
    const soundToggle = document.getElementById('soundEnabled');

    if (volumeSlider && volumeValue) { 
      volumeSlider.value = savedVolume; 
      volumeValue.textContent = `${savedVolume}%`; 
    }
    if (soundToggle) soundToggle.checked = savedSoundEnabled;

    this.savedVolume = savedVolume;
    this.soundEnabled = savedSoundEnabled;
  }

  init() {
    window.addEventListener('offline-mode-changed', () => {
      this.updateStorageModeDisplay();
    });

    window.addEventListener('language-changed', () => {
      this.updateStorageModeDisplay();
      this.updateSettingsButtonText();
    });

    document.getElementById('switchToOnline')?.addEventListener('click', () => {
      localStorage.removeItem('offlineMode');
      this.close();
      document.getElementById('authContainer')?.classList.remove('hidden');
      window.dispatchEvent(new CustomEvent('offline-mode-changed', { 
        detail: { isOffline: false } 
      }));
    });

    // Click event for settings trigger
    this.trigger.addEventListener('click', () => {
      if (window.app?.soundManager) {
        window.app.soundManager.play('box');
      }
      this.open();
    });

    // Keyboard support for settings trigger
    this.trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (window.app?.soundManager) {
          window.app.soundManager.play('box');
        }
        this.open();
      }
    });
    
    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', () => this.close());
    document.addEventListener('keydown', e => { 
      if (e.key === 'Escape' && this.panel.classList.contains('open')) this.close(); 
    });
    this.setupControls();
  }

  open() {
    this.trigger.classList.add('open');
    this.panel.classList.add('open'); 
    this.overlay.classList.add('open');
    
    // Update ARIA state for overlay
    this.overlay?.setAttribute('aria-hidden', 'false');
    
    document.body.style.overflow = 'hidden'; 
  }
  
  close() { 
    this.trigger.classList.remove('open');
    this.panel.classList.remove('open'); 
    this.overlay.classList.remove('open');
    
    // Update ARIA state for overlay
    this.overlay?.setAttribute('aria-hidden', 'true');
    
    document.body.style.overflow = 'auto'; 
  }

  setupControls() {
    const volumeSlider = document.getElementById('masterVolume');
    const volumeValue = document.getElementById('masterVolumeValue');
    const soundToggle = document.getElementById('soundEnabled');

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
  }
}
