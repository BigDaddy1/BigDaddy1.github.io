import { CONFIG } from "../game/config.js";
import { generateLevel } from "../game/generator.js";
import { buildLevelData } from "../game/level.js";

export class LoadingScene extends Phaser.Scene {
  constructor() {
    super("loading");
  }

  init(data) {
    this.levelNumber = data.levelNumber ?? 1;
  }

  create() {
    this.cameras.main.setBackgroundColor("#1a1d27");
    this.add.text(CONFIG.width / 2, 220, "GENERATING LEVEL", {
      fontFamily: CONFIG.fontFamily,
      fontSize: "32px",
      fontStyle: "bold",
      color: "#f6ec90",
    }).setOrigin(0.5);

    this.subtitle = this.add.text(CONFIG.width / 2, 310, `LEVEL ${this.levelNumber}`, {
      fontFamily: CONFIG.fontFamily,
      fontSize: "18px",
      color: "#bfd4ff",
    }).setOrigin(0.5);

    this.progressBar = this.add.rectangle(CONFIG.width / 2 - 210, 430, 0, 18, 0x78dcff).setOrigin(0, 0.5);
    this.add.rectangle(CONFIG.width / 2, 430, 426, 26, 0x2a3144, 1).setStrokeStyle(2, 0x4f5f83);

    const generated = generateLevel(this.levelNumber);
    const levelData = buildLevelData(generated);
    this.registry.set("generatedLevel", generated);
    this.registry.set("levelData", levelData);
    this.registry.set("ghostRuns", []);

    this.elapsed = 0;
  }

  update(_, delta) {
    this.elapsed += delta;
    const progress = Phaser.Math.Clamp(this.elapsed / CONFIG.loadingDuration, 0, 1);
    this.progressBar.width = 420 * progress;
    this.subtitle.setText(`LEVEL ${this.levelNumber}${".".repeat(1 + Math.floor(this.elapsed / 160) % 3)}`);
    if (progress >= 1) {
      this.scene.start("game", { levelNumber: this.levelNumber });
    }
  }
}
