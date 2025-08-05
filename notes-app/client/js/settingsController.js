import { StorageManager } from './storageManager.js';

export class SettingsController {
  constructor() {
    this.panel = document.getElementById('settingsPanel');
    this.overlay = document.getElementById('settingsOverlay');
    this.trigger = document.getElementById('settingsTrigger');
    this.closeBtn = document.getElementById('settingsClose');

    this.storageManager = new StorageManager();
    this.updateStorageIndicator();

    this.loadSavedSettings();
    this.init();
  }

  updateStorageIndicator() {
    const indicator = document.querySelector('.storage-mode-indicator');
    if (!indicator) return;
    indicator.className = `storage-mode-indicator ${this.storageManager.isOnline ? 'online' : 'offline'}`;
    indicator.innerHTML = `<div class="status-dot ${this.storageManager.isOnline ? 'online' : 'offline'}"></div>Currently using ${this.storageManager.isOnline ? 'online' : 'offline'} storage`;
  }

  loadSavedSettings() {
    const savedVolume = localStorage.getItem('masterVolume') || 50;
    const savedSoundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    const volumeSlider = document.getElementById('masterVolume');
    const volumeValue = document.getElementById('masterVolumeValue');
    const soundToggle = document.getElementById('soundEnabled');
    const storageToggle = document.getElementById('storageMode');

    if (volumeSlider && volumeValue) { volumeSlider.value = savedVolume; volumeValue.textContent = `${savedVolume}%`; }
    if (soundToggle) soundToggle.checked = savedSoundEnabled;
    if (storageToggle) storageToggle.checked = this.storageManager.isOnline;

    this.savedVolume = savedVolume;
    this.soundEnabled = savedSoundEnabled;
  }

  init() {
    this.trigger.addEventListener('click', () => this.open());
    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', () => this.close());
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.panel.classList.contains('open')) this.close(); });
    this.setupControls();
  }

  open() { this.panel.classList.add('open'); this.overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
  close() { this.panel.classList.remove('open'); this.overlay.classList.remove('open'); document.body.style.overflow = 'auto'; }

  setupControls() {
    const storageToggle = document.getElementById('storageMode');
    const volumeSlider = document.getElementById('masterVolume');
    const volumeValue = document.getElementById('masterVolumeValue');
    const soundToggle = document.getElementById('soundEnabled');
    const notesPerPageSelect = document.getElementById('notesPerPage');

    storageToggle?.addEventListener('change', e => {
      this.storageManager.setMode(e.target.checked);
      this.updateStorageIndicator();
    });

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
