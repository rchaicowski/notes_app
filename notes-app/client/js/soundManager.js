/**
 * @fileoverview Audio feedback manager for UI interactions
 * Provides sound effects for various user actions throughout the application
 * Implements throttling to prevent sound spam and audio overlapping
 * @module soundManager
 */

/**
 * Manages audio playback for UI sound effects
 * Loads and plays sound effects for user interactions
 * Prevents rapid-fire sound spam through time-based throttling
 */
export class SoundManager {
  /**
   * Creates a new SoundManager instance
   * Loads all sound files and sets default volume levels
   * Initializes throttling timestamps for each sound
   */
  constructor() {
    /**
     * Audio objects mapped by sound name
     * @type {Object<string, HTMLAudioElement>}
     * 
     * Available sounds:
     * - bush: Plant hover sound effect
     * - lamp: Dark mode toggle sound
     * - eraser: Delete/erase action sound
     * - pencil: Edit/write action sound
     * - calculator: Calculator button press sound
     * - box: Settings/box open sound
     * - page_turn: Pagination sound effect
     */
    this.sounds = {
      bush: new Audio('./sounds/bush_sound.wav'),
      lamp: new Audio('./sounds/lamp_sound.wav'),
      eraser: new Audio('./sounds/eraser.wav'),
      pencil: new Audio('./sounds/pencil.wav'),
      calculator: new Audio('./sounds/calculator_button.wav'),
      box: new Audio('./sounds/box.wav'),
      page_turn: new Audio('./sounds/page_turn.wav'),
    };

    // Set individual volume levels for each sound
    // Volumes range from 0.0 (silent) to 1.0 (full volume)
    this.sounds.bush.volume = 0.5;        // Medium volume
    this.sounds.lamp.volume = 0.5;        // Medium volume
    this.sounds.eraser.volume = 0.3;      // Lower volume (can be harsh)
    this.sounds.pencil.volume = 0.4;      // Medium-low volume
    this.sounds.calculator.volume = 0.2;  // Low volume (played frequently)
    this.sounds.box.volume = 0.5;         // Medium volume
    this.sounds.page_turn.volume = 0.3;   // Lower volume (can be jarring)

    /**
     * Timestamp tracking for throttling sound playback
     * Maps sound name to last play time in milliseconds
     * Used to prevent rapid-fire sound spam
     * @type {Object<string, number>}
     * @private
     */
    this.lastPlayed = {};
    Object.keys(this.sounds).forEach(key => this.lastPlayed[key] = 0);
  }

  /**
   * Plays a sound effect with optional throttling
   * Prevents sound spam by enforcing minimum interval between plays
   * Resets audio to start if already playing (prevents overlap)
   * 
   * @param {string} soundName - Name of the sound to play (must exist in this.sounds)
   * @param {number} [minInterval=100] - Minimum milliseconds between plays (throttle time)
   * 
   * @example
   * // Play calculator sound with default 100ms throttle
   * soundManager.play('calculator');
   * 
   * @example
   * // Play lamp sound with 500ms throttle
   * soundManager.play('lamp', 500);
   * 
   * Throttling behavior:
   * - If called faster than minInterval, sound is skipped
   * - If called after minInterval has passed, sound plays
   * - Helps prevent audio spam from rapid clicking
   * 
   * Error handling:
   * - Silently catches and logs play() failures (e.g., no user interaction yet)
   * - Fails gracefully if sound name doesn't exist
   */
  play(soundName, minInterval = 100) {
    const now = Date.now();
    
    // Check if enough time has passed and sound exists
    if (now - this.lastPlayed[soundName] > minInterval && this.sounds[soundName]) {
      // Reset to start (allows replay of same sound)
      this.sounds[soundName].currentTime = 0;
      
      // Play sound and catch errors (e.g., autoplay policy restrictions)
      this.sounds[soundName].play().catch(e => {
        console.log('Sound play failed:', e);
      });
      
      // Update last played timestamp
      this.lastPlayed[soundName] = now;
    }
  }
}
