export const CONFIG = Object.freeze({
  width: 1280,
  height: 720,
  tileSize: 24,
  gravity: 2400,
  runAcceleration: 4200,
  maxRunSpeed: 280,
  groundDeceleration: 3200,
  airDeceleration: 900,
  jumpSpeed: 760,
  doubleJumpSpeed: 720,
  wallJumpX: 360,
  wallJumpY: 760,
  wallSlideSpeed: 180,
  maxFallSpeed: 1100,
  coyoteTime: 80,
  jumpBufferTime: 120,
  playerWidth: 18,
  playerHeight: 22,
  enemySpeed: 84,
  movingPlatformSpeed: 80,
  sawRadius: 18,
  deathDuration: 420,
  ghostExplosionDuration: 550,
  replayPauseDuration: 320,
  loadingDuration: 850,
  debugStartLevel: 1,
  worldHeightTiles: 24,
  startMusicMin: 1,
  startMusicMax: 10,
  fontFamily: '"Press Start 2P", "Courier New", monospace',
  cameraLerp: 9,
  cornerCorrection: 8,
});

export const TILE_COLORS = Object.freeze({
  B: 0x6e7388,
  J: 0x7be391,
  D: 0xc38cf4,
  S: 0xe06d57,
  W: 0x6aa5ef,
  H: 0xb082ed,
  V: 0xb082ed,
  R: 0xb082ed,
  T: 0xa875f0,
  E: 0xf16969,
  F: 0x7ddfb4,
});

export function difficultyForLevel(levelNumber) {
  if (levelNumber <= 1) {
    return 1;
  }
  if (levelNumber <= 3) {
    return 2 + levelNumber;
  }
  if (levelNumber <= 6) {
    return 5 + Math.floor((levelNumber - 4) * 1.5);
  }
  if (levelNumber <= 12) {
    return Math.min(10, 8 + Math.floor((levelNumber - 7) / 2));
  }
  return 12;
}
