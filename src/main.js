import { BootScene } from "./scenes/BootScene.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { LoadingScene } from "./scenes/LoadingScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { CONFIG } from "./game/config.js";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: CONFIG.width,
  height: CONFIG.height,
  backgroundColor: "#1a1d27",
  pixelArt: true,
  scene: [BootScene, MenuScene, LoadingScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

window.__JUMP_BITCH_ONLINE__ = game;
