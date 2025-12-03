export class LampController {
  constructor(soundManager) {
    this.isOn = true;
    this.timeouts = [];
    this.soundManager = soundManager;
  }

  /**
   * Initialize lamp controller and attach event listeners
   */
  init() {
    const lampBase = document.querySelector('.lamp-base');
    
    if (lampBase) {
      // Make it keyboard accessible
      lampBase.setAttribute('role', 'button');
      lampBase.setAttribute('aria-label', 'Toggle dark mode');
      lampBase.setAttribute('tabindex', '0');
      
      // Click event
      lampBase.addEventListener('click', () => this.toggle());
      
      // Keyboard event (Enter or Space)
      lampBase.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggle();
        }
      });
    } else {
      console.warn('Lamp base element not found');
    }
  }

  toggle() {
    this.soundManager.play('lamp', 500);
    const powerButton = document.getElementById('power-button');
    const lampBulb = document.getElementById('lamp-bulb');
    const tableContainer = document.getElementById('table-container');

    this.timeouts.forEach(t => clearTimeout(t));
    this.timeouts = [];

    this.isOn ? this.turnOff(powerButton, lampBulb, tableContainer) : this.turnOn(powerButton, lampBulb, tableContainer);
  }

  turnOn(powerButton, lampBulb, tableContainer) {
    this.isOn = true;
    powerButton.className = 'lamp-power-button on';
    lampBulb.className = 'lamp-bulb on';
    tableContainer.classList.remove('dimmed');
  }

  turnOff(powerButton, lampBulb, tableContainer) {
    this.isOn = false;
    powerButton.className = 'lamp-power-button off';
    lampBulb.className = 'lamp-bulb warm-orange';
    tableContainer.classList.add('dimmed');

    this.timeouts.push(setTimeout(() => { if (!this.isOn) lampBulb.className = 'lamp-bulb transitioning-off'; }, 1500));
    this.timeouts.push(setTimeout(() => { if (!this.isOn) lampBulb.className = 'lamp-bulb dim-orange'; }, 3000));
    this.timeouts.push(setTimeout(() => { if (!this.isOn) lampBulb.className = 'lamp-bulb'; }, 4500));
  }

  /**
   * Clean up event listeners and timeouts when needed
   */
  destroy() {
    this.timeouts.forEach(t => clearTimeout(t));
    this.timeouts = [];
    
    const lampBase = document.querySelector('.lamp-base');
    if (lampBase) {
      lampBase.removeEventListener('click', this.toggle);
      lampBase.removeEventListener('keydown', this.toggle);
    }
  }
}
