export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.audio("menu", "assets/audio/menu.wav");
    this.load.audio("coin", "assets/audio/coin.wav");
    this.load.audio("win", "assets/audio/win.wav");
    this.load.audio("jump", "assets/audio/jump.wav");
    this.load.audio("gameover", "assets/audio/gameover.wav");
    for (let index = 1; index <= 10; index += 1) {
      this.load.audio(`level_${String(index).padStart(2, "0")}`, `assets/audio/${index}.wav`);
    }
  }

  create() {
    this.scene.start("menu");
  }
}
