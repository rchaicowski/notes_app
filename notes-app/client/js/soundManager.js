export class SoundManager {
  constructor() {
    this.sounds = {
      bush: new Audio('./sounds/bush_sound.wav'),
      lamp: new Audio('./sounds/lamp_sound.wav'),
      eraser: new Audio('./sounds/eraser.wav'),
      pencil: new Audio('./sounds/pencil.wav'),
      calculator: new Audio('./sounds/calculator_button.wav')
    };

    this.sounds.bush.volume = 0.5;
    this.sounds.lamp.volume = 0.5;
    this.sounds.eraser.volume = 0.4;
    this.sounds.pencil.volume = 0.4;
    this.sounds.calculator.volume = 0.2;

    this.lastPlayed = {};
    Object.keys(this.sounds).forEach(key => this.lastPlayed[key] = 0);
  }

  play(soundName, minInterval = 100) {
    const now = Date.now();
    if (now - this.lastPlayed[soundName] > minInterval && this.sounds[soundName]) {
      this.sounds[soundName].currentTime = 0;
      this.sounds[soundName].play().catch(e => console.log('Sound play failed:', e));
      this.lastPlayed[soundName] = now;
    }
  }
}
