import { CONFIG } from "../game/config.js";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  create() {
    this.cameras.main.setBackgroundColor("#1a1d27");
    this.registry.set("levelNumber", CONFIG.debugStartLevel);

    const centerX = CONFIG.width / 2;
    this.add.text(centerX, 140, "JUMP BITCH", {
      fontFamily: CONFIG.fontFamily,
      fontSize: "54px",
      fontStyle: "bold",
      color: "#f6ec90",
    }).setOrigin(0.5);

    this.add.text(centerX, 220, "ONLINE PROTOTYPE", {
      fontFamily: CONFIG.fontFamily,
      fontSize: "20px",
      color: "#bfd4ff",
    }).setOrigin(0.5);

    const panel = this.add.rectangle(centerX, 410, 460, 190, 0x1d2230, 1).setStrokeStyle(4, 0x78dcff);
    panel.setOrigin(0.5);

    this.options = ["START GAME", "CLOSE WINDOW"];
    this.menuIndex = 0;
    this.optionTexts = this.options.map((label, index) =>
      this.add.text(centerX, 360 + index * 70, label, {
        fontFamily: CONFIG.fontFamily,
        fontSize: "20px",
        color: "#f8f8f8",
      }).setOrigin(0.5)
    );

    this.add.text(centerX, CONFIG.height - 88, "W / S OR ARROWS · ENTER", {
      fontFamily: CONFIG.fontFamily,
      fontSize: "12px",
      color: "#7d889c",
    }).setOrigin(0.5);

    this.updateSelection();

    this.input.keyboard.on("keydown-UP", () => this.move(-1));
    this.input.keyboard.on("keydown-W", () => this.move(-1));
    this.input.keyboard.on("keydown-DOWN", () => this.move(1));
    this.input.keyboard.on("keydown-S", () => this.move(1));
    this.input.keyboard.on("keydown-ENTER", () => this.confirm());
    this.input.keyboard.on("keydown-SPACE", () => this.confirm());
  }

  move(direction) {
    this.ensureMenuMusic();
    this.menuIndex = Phaser.Math.Wrap(this.menuIndex + direction, 0, this.options.length);
    this.updateSelection();
  }

  updateSelection() {
    this.optionTexts.forEach((text, index) => {
      const selected = index === this.menuIndex;
      text.setColor(selected ? "#78dcff" : "#cbd2e0");
      text.setScale(selected ? 1.08 : 1);
    });
  }

  confirm() {
    this.ensureMenuMusic();
    if (this.menuIndex === 0) {
      if (this.sound.context && this.sound.context.state === "suspended") {
        this.sound.context.resume();
      }
      this.sound.stopAll();
      this.scene.start("loading", { levelNumber: this.registry.get("levelNumber") ?? CONFIG.debugStartLevel });
      return;
    }
    window.close();
  }

  ensureMenuMusic() {
    const menuSound = this.sound.get("menu");
    if (menuSound && menuSound.isPlaying) {
      return;
    }
    if (this.sound.context && this.sound.context.state === "suspended") {
      this.sound.context.resume();
    }
    this.sound.stopAll();
    this.sound.play("menu", { loop: true, volume: 0.7 });
  }
}
