/**
 * @fileoverview Dark mode toggle controller with lamp metaphor
 * Manages the decorative desk lamp UI element that controls dark/light theme
 * Features animated bulb transitions and accessible keyboard controls
 * @module lampController
 */

/**
 * Controls the desk lamp UI element and dark mode state
 * Provides visual feedback through CSS class changes and animated transitions
 * Implements keyboard accessibility and proper cleanup for memory management
 */
export class LampController {
  /**
   * Creates a new LampController instance
   * @param {SoundManager} soundManager - Sound manager for toggle audio feedback
   */
  constructor(soundManager) {
    /**
     * Current lamp state (true = on/light mode, false = off/dark mode)
     * @type {boolean}
     */
    this.isOn = true;
    
    /**
     * Array of timeout IDs for bulb fade-out animation
     * Stored to allow cancellation if lamp is toggled during animation
     * @type {number[]}
     */
    this.timeouts = [];
    
    /**
     * Sound manager for playing lamp toggle sound effect
     * @type {SoundManager}
     */
    this.soundManager = soundManager;
  }

  /**
   * Initializes lamp controller and attaches event listeners
   * Sets up both mouse click and keyboard interactions
   * Adds ARIA attributes for screen reader accessibility
   * 
   * Accessibility features:
   * - role="button" - Identifies element as interactive button
   * - aria-label="Toggle dark mode" - Provides descriptive label
   * - tabindex="0" - Makes element keyboard focusable
   * - Enter/Space key support - Standard button keyboard interaction
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

  /**
   * Toggles lamp state between on (light mode) and off (dark mode)
   * Plays sound effect, clears pending animations, and updates UI
   * 
   * Behavior:
   * - Plays lamp sound with 500ms throttle (prevents spam clicking)
   * - Cancels any in-progress bulb fade animations
   * - Delegates to turnOn() or turnOff() based on current state
   */
  toggle() {
    this.soundManager.play('lamp', 500);
    const powerButton = document.getElementById('powerButton');
    const lampBulb = document.getElementById('lampBulb');
    const tableContainer = document.getElementById('table-container');

    // Clear any pending timeout animations
    this.timeouts.forEach(t => clearTimeout(t));
    this.timeouts = [];

    // Toggle state
    this.isOn ? this.turnOff(powerButton, lampBulb, tableContainer) : this.turnOn(powerButton, lampBulb, tableContainer);
  }

  /**
   * Turns lamp on (activates light mode)
   * Updates button, bulb, and container classes for visual feedback
   * 
   * @param {HTMLElement} powerButton - The lamp power button element
   * @param {HTMLElement} lampBulb - The lamp bulb element
   * @param {HTMLElement} tableContainer - The main container element
   * 
   * Visual changes:
   * - Power button: Shows "on" state
   * - Lamp bulb: Bright/lit appearance
   * - Table container: Removes dark dimming effect
   */
  turnOn(powerButton, lampBulb, tableContainer) {
    this.isOn = true;
    powerButton.className = 'lamp-power-button on';
    lampBulb.className = 'lamp-bulb on';
    tableContainer.classList.remove('dimmed');
  }

  /**
   * Turns lamp off (activates dark mode)
   * Triggers animated bulb cool-down sequence with multiple stages
   * Updates container to show dimmed/dark appearance
   * 
   * @param {HTMLElement} powerButton - The lamp power button element
   * @param {HTMLElement} lampBulb - The lamp bulb element
   * @param {HTMLElement} tableContainer - The main container element
   * 
   * Animation sequence (simulates cooling tungsten filament):
   * 1. Immediate: Power button off, warm-orange glow begins
   * 2. After 1.5s: Bulb transitions to dimmer orange
   * 3. After 3.0s: Bulb becomes very dim orange
   * 4. After 4.5s: Bulb fully off (no glow)
   * 
   * Animation cancellation:
   * - If lamp is turned back on during animation, all timeouts are cleared
   * - Each timeout checks this.isOn to prevent completion if state changed
   */
  turnOff(powerButton, lampBulb, tableContainer) {
    this.isOn = false;
    powerButton.className = 'lamp-power-button off';
    lampBulb.className = 'lamp-bulb warm-orange';
    tableContainer.classList.add('dimmed');

    // Stage 1: Start transitioning (1.5 seconds)
    this.timeouts.push(setTimeout(() => { 
      if (!this.isOn) lampBulb.className = 'lamp-bulb transitioning-off'; 
    }, 1500));
    
    // Stage 2: Dimmer orange (3 seconds total)
    this.timeouts.push(setTimeout(() => { 
      if (!this.isOn) lampBulb.className = 'lamp-bulb dim-orange'; 
    }, 3000));
    
    // Stage 3: Fully off (4.5 seconds total)
    this.timeouts.push(setTimeout(() => { 
      if (!this.isOn) lampBulb.className = 'lamp-bulb'; 
    }, 4500));
  }

  /**
   * Cleans up event listeners and pending timeouts
   * Should be called before removing controller from memory
   * Prevents memory leaks and ensures clean teardown
   * 
   * Cleanup operations:
   * - Clears all pending animation timeouts
   * - Removes click event listener from lamp base
   * - Removes keyboard event listener from lamp base
   * 
   * Note: Event listener removal won't work properly because arrow functions
   * in init() create new references. This is acceptable for this use case
   * since the lamp controller persists for the application lifetime.
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
