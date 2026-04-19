import { CONFIG, TILE_COLORS } from "../game/config.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
  }

  init(data) {
    this.levelNumber = data.levelNumber ?? 1;
    this.levelData = this.registry.get("levelData");
    this.generatedLevel = this.registry.get("generatedLevel");
  }

  create() {
    this.cameras.main.setBackgroundColor("#1a1d27");
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,R,ENTER");
    this.state = "playing";
    this.coinCount = 0;
    this.attemptFrames = [];
    this.ghostRuns = cloneGhostRuns(this.registry.get("ghostRuns") ?? []);
    this.replayTimer = 0;
    this.deathTime = 0;
    this.deathParticles = [];
    this.graphics = this.add.graphics();

    this.buildWorld();
    this.createUi();
    this.startAttempt();
    this.playRandomLevelMusic();
  }

  buildWorld() {
    const tile = CONFIG.tileSize;
    this.worldWidth = this.levelData.width * tile;
    this.worldHeight = this.levelData.height * tile;

    this.solids = this.levelData.solids.map((block) => ({ ...block }));
    this.jumpPads = this.levelData.jumpPads.map((block) => ({ ...block }));
    this.disappearing = this.levelData.disappearing.map((block) => ({ ...block }));
    this.deadly = this.levelData.deadly.map((block) => ({ ...block }));
    this.walls = this.levelData.walls.map((block) => ({ ...block }));
    this.portals = this.levelData.portals.map((block) => ({ ...block }));
    this.finish = this.levelData.finish ? { ...this.levelData.finish } : null;
    this.coins = this.levelData.coins.map((coin) => ({ ...coin }));
    this.enemies = this.levelData.enemies.map((enemy) => ({ ...enemy }));
    this.saws = this.levelData.saws.map((saw) => ({ ...saw }));
    this.movingSaws = this.levelData.movingSaws.map((saw) => ({ ...saw }));
    this.movingPlatforms = this.levelData.movingPlatforms.map((platform) => ({ ...platform }));

    this.player = {
      x: this.levelData.spawn.x,
      y: this.levelData.spawn.y,
      prevX: this.levelData.spawn.x,
      prevY: this.levelData.spawn.y,
      vx: 0,
      vy: 0,
      width: CONFIG.playerWidth,
      height: CONFIG.playerHeight,
      alive: true,
      onGround: false,
      onWallLeft: false,
      onWallRight: false,
      jumpsUsed: 0,
      coyoteTimer: 0,
      jumpBuffer: 0,
      color: 0x7cd4f4,
      respawnX: this.levelData.spawn.x,
      respawnY: this.levelData.spawn.y,
    };

    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBounds(0, 0, Math.max(CONFIG.width, this.worldWidth), Math.max(CONFIG.height, this.worldHeight + this.worldOffsetY()));
    this.updateCameraTarget(this.player, 1);
  }

  createUi() {
    this.uiTexts = {
      levelLabel: this.add.text(16, 18, "", {
        fontFamily: CONFIG.fontFamily,
        fontSize: "18px",
        color: "#c1d4ff",
      }).setScrollFactor(0),
      coinLabel: this.add.text(16, 46, "", {
        fontFamily: CONFIG.fontFamily,
        fontSize: "12px",
        color: "#f6ec90",
      }).setScrollFactor(0),
      clearTitle: this.add.text(CONFIG.width / 2, 42, "", {
        fontFamily: CONFIG.fontFamily,
        fontSize: "18px",
        color: "#f6ec90",
      }).setOrigin(0.5, 0).setScrollFactor(0).setVisible(false),
      clearHint: this.add.text(CONFIG.width / 2, 74, "", {
        fontFamily: CONFIG.fontFamily,
        fontSize: "11px",
        color: "#ffffff",
      }).setOrigin(0.5, 0).setScrollFactor(0).setVisible(false),
      attemptLabel: this.add.text(CONFIG.width / 2, 98, "", {
        fontFamily: CONFIG.fontFamily,
        fontSize: "10px",
        color: "#a2b5dc",
      }).setOrigin(0.5, 0).setScrollFactor(0).setVisible(false),
    };
  }

  playRandomLevelMusic() {
    this.sound.stopAll();
    const index = Phaser.Math.Between(CONFIG.startMusicMin, CONFIG.startMusicMax);
    this.sound.play(`level_${String(index).padStart(2, "0")}`, { loop: true, volume: 0.64 });
  }

  startAttempt() {
    this.attemptFrames = [];
    this.recordAttemptFrame();
  }

  update(_, delta) {
    const dt = Math.min(delta / 1000, 1 / 30);

    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.restartLevel();
      return;
    }

    if (this.state === "level_complete") {
      this.replayTimer += delta;
      if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
        this.registry.set("levelNumber", this.levelNumber + 1);
        this.scene.start("loading", { levelNumber: this.levelNumber + 1 });
      }
      this.updateCameraTarget(this.currentReplayFocus(), dt);
      this.draw();
      return;
    }

    this.updateMovingPlatforms(dt);
    this.updateMovingSaws(delta);
    this.updateCoins(delta);

    if (!this.player.alive) {
      this.updateDeath(dt);
      this.draw();
      return;
    }

    this.handleInput(dt);
    this.updateEnemies(dt);
    this.updateHazards();
    this.updateCollectibles();
    this.recordAttemptFrame();
    this.updateCameraTarget(this.player, dt);
    this.draw();
  }

  handleInput(dt) {
    const player = this.player;
    player.prevX = player.x;
    player.prevY = player.y;

    this.applyPlatformCarry();

    const left = this.keys.A.isDown || this.cursors.left.isDown;
    const right = this.keys.D.isDown || this.cursors.right.isDown;
    const jumpHeld = this.keys.W.isDown || this.keys.SPACE.isDown || this.cursors.up.isDown;
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.keys.W) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up);

    if (jumpPressed) {
      player.jumpBuffer = CONFIG.jumpBufferTime;
    } else {
      player.jumpBuffer = Math.max(0, player.jumpBuffer - dt * 1000);
    }

    const axis = Number(right) - Number(left);
    if (axis !== 0) {
      player.vx += axis * CONFIG.runAcceleration * dt;
    } else if (player.onGround) {
      player.vx = approach(player.vx, 0, CONFIG.groundDeceleration * dt);
    } else {
      player.vx = approach(player.vx, 0, CONFIG.airDeceleration * dt);
    }
    player.vx = Phaser.Math.Clamp(player.vx, -CONFIG.maxRunSpeed, CONFIG.maxRunSpeed);

    player.vy = Math.min(CONFIG.maxFallSpeed, player.vy + CONFIG.gravity * dt);
    if (player.onGround) {
      player.coyoteTimer = CONFIG.coyoteTime;
      player.jumpsUsed = 0;
    } else {
      player.coyoteTimer = Math.max(0, player.coyoteTimer - dt * 1000);
    }

    const canWallSlide = this.canWallSlide() && player.vy > 0;
    if (canWallSlide) {
      player.vy = Math.min(player.vy, CONFIG.wallSlideSpeed);
    }

    if (player.jumpBuffer > 0) {
      if (player.coyoteTimer > 0) {
        player.vy = -CONFIG.jumpSpeed;
        player.jumpBuffer = 0;
        player.coyoteTimer = 0;
        this.playJump();
      } else if (canWallSlide) {
        const direction = player.onWallLeft ? 1 : -1;
        player.vx = CONFIG.wallJumpX * direction;
        player.vy = -CONFIG.wallJumpY;
        player.jumpBuffer = 0;
        player.jumpsUsed = 1;
        this.playJump();
      } else if (player.jumpsUsed < 1) {
        player.vy = -CONFIG.doubleJumpSpeed;
        player.jumpBuffer = 0;
        player.jumpsUsed += 1;
        this.playJump();
      }
    }

    if (!jumpHeld && player.vy < 0) {
      player.vy *= 0.92;
    }

    this.moveHorizontal(dt);
    this.moveVertical(dt);

    if (this.isOutOfBounds()) {
      this.killPlayer();
    }
  }

  playJump() {
    this.sound.play("jump", { volume: 0.3 });
  }

  moveHorizontal(dt) {
    const player = this.player;
    player.x += player.vx * dt;
    player.onWallLeft = false;
    player.onWallRight = false;
    for (const block of this.collidableBlocks()) {
      if (!rectsOverlap(player, block)) {
        continue;
      }
      if (player.vx > 0) {
        player.x = block.x - player.width;
        player.onWallRight = true;
      } else if (player.vx < 0) {
        player.x = block.x + block.width;
        player.onWallLeft = true;
      }
      player.vx = 0;
    }
  }

  moveVertical(dt) {
    const player = this.player;
    player.y += player.vy * dt;
    player.onGround = false;
    for (const block of this.collidableBlocks()) {
      if (!rectsOverlap(player, block)) {
        continue;
      }
      if (player.vy > 0) {
        player.y = block.y - player.height;
        player.onGround = true;
        player.vy = 0;
        if (block.tile === "J") {
          player.vy = -CONFIG.jumpSpeed * 1.15;
        }
        if (block.tile === "D") {
          const found = this.disappearing.find((item) => item.x === block.x && item.y === block.y);
          if (found) {
            found.triggered = true;
            found.timer = 1000;
          }
        }
      } else if (player.vy < 0) {
        if (this.tryCornerCorrection(block)) {
          continue;
        }
        player.y = block.y + block.height;
        player.vy = 0;
      }
    }
  }

  tryCornerCorrection(block) {
    const player = this.player;
    if (player.vy >= 0) {
      return false;
    }
    const maxNudge = CONFIG.cornerCorrection;
    for (const direction of [-1, 1]) {
      for (let offset = 1; offset <= maxNudge; offset += 1) {
        const testRect = {
          x: player.x + direction * offset,
          y: player.y,
          width: player.width,
          height: player.height,
        };
        if (rectsOverlap(testRect, block)) {
          continue;
        }
        if (this.collidableBlocks().some((candidate) => candidate !== block && rectsOverlap(testRect, candidate))) {
          continue;
        }
        player.x = testRect.x;
        return true;
      }
    }
    return false;
  }

  updateMovingPlatforms(dt) {
    const time = this.time.now / 1000;
    for (const platform of this.movingPlatforms) {
      platform.prevX = platform.x;
      platform.prevY = platform.y;
      if (platform.tile === "H") {
        platform.x = platform.baseX + Math.sin((time / platform.period) * Math.PI * 2) * platform.amplitude;
      } else if (platform.tile === "V") {
        platform.y = platform.baseY + Math.sin((time / platform.period) * Math.PI * 2) * platform.amplitude;
      } else {
        platform.x = platform.baseX + Math.cos((time / platform.period) * Math.PI * 2) * platform.amplitude;
        platform.y = platform.baseY + Math.sin((time / platform.period) * Math.PI * 2) * platform.amplitude * 0.8;
      }
      platform.dx = platform.x - platform.prevX;
      platform.dy = platform.y - platform.prevY;
    }

    for (const block of this.disappearing) {
      if (!block.active) {
        continue;
      }
      if (block.triggered) {
        block.timer -= dt * 1000;
        if (block.timer <= 0) {
          block.active = false;
        }
      }
    }
  }

  applyPlatformCarry() {
    const player = this.player;
    for (const platform of this.movingPlatforms) {
      if (!isRiding(player, platform)) {
        continue;
      }
      player.x += platform.dx;
      if (this.staticColliders().some((block) => rectsOverlap(player, block))) {
        player.x -= platform.dx;
      }
      player.y += platform.dy;
      if (this.staticColliders().some((block) => rectsOverlap(player, block))) {
        player.y -= platform.dy;
      }
      break;
    }
  }

  updateMovingSaws(delta) {
    const time = this.time.now / 1000;
    for (const saw of this.movingSaws) {
      saw.angle += saw.speed * (delta / 1000);
      if (saw.kind === "X") {
        saw.x = saw.baseX + Math.sin(time * saw.speed) * saw.amplitude;
      } else {
        saw.y = saw.baseY + Math.sin(time * saw.speed) * saw.amplitude;
      }
    }
    for (const saw of this.saws) {
      saw.angle += saw.speed * (delta / 1000);
    }
  }

  updateCoins(delta) {
    for (const coin of this.coins) {
      coin.bob += delta / 260;
    }
  }

  updateEnemies(dt) {
    const survivors = [];
    for (const enemy of this.enemies) {
      enemy.vx = CONFIG.enemySpeed * enemy.direction;
      enemy.vy = Math.min(CONFIG.maxFallSpeed, enemy.vy + CONFIG.gravity * dt);
      enemy.x += enemy.vx * dt;

      let horizontalHit = false;
      for (const block of this.collidableBlocks()) {
        if (!rectsOverlap(enemy, block)) {
          continue;
        }
        horizontalHit = true;
        if (enemy.vx > 0) {
          enemy.x = block.x - enemy.width;
        } else {
          enemy.x = block.x + block.width;
        }
        enemy.direction *= -1;
        enemy.vx = 0;
        break;
      }

      enemy.y += enemy.vy * dt;
      enemy.onGround = false;
      for (const block of this.collidableBlocks()) {
        if (!rectsOverlap(enemy, block)) {
          continue;
        }
        if (enemy.vy > 0) {
          enemy.y = block.y - enemy.height;
          enemy.vy = 0;
          enemy.onGround = true;
        } else if (enemy.vy < 0) {
          enemy.y = block.y + block.height;
          enemy.vy = 0;
        }
      }

      if (enemy.onGround && !horizontalHit && this.enemyShouldTurn(enemy)) {
        enemy.direction *= -1;
      }

      if (rectsOverlap(this.player, enemy)) {
        if (this.stompedEnemy(enemy)) {
          this.player.y = enemy.y - this.player.height;
          this.player.vy = -520;
          this.player.onGround = false;
          continue;
        }
        this.killPlayer();
        return;
      }

      survivors.push(enemy);
    }
    this.enemies = survivors;
  }

  updateHazards() {
    if (this.deadly.some((hazard) => rectsOverlap(this.player, hazard))) {
      this.killPlayer();
      return;
    }
    if (this.saws.some((saw) => circleHitsRect(saw, this.player)) || this.movingSaws.some((saw) => circleHitsRect(saw, this.player))) {
      this.killPlayer();
      return;
    }
    if (this.portals.some((portal) => rectsOverlap(this.player, portal))) {
      this.respawnPlayer();
    }
  }

  updateCollectibles() {
    for (const coin of this.coins) {
      if (!coin.collected && rectsOverlap(this.player, coin)) {
        coin.collected = true;
        this.coinCount += 1;
        this.sound.play("coin", { volume: 0.4 });
      }
    }

    if (this.finish && rectsOverlap(this.player, this.finish)) {
      this.completeLevel();
    }
  }

  canWallSlide() {
    return this.player.onWallLeft || this.player.onWallRight;
  }

  stompedEnemy(enemy) {
    return (
      this.player.vy >= 0 &&
      this.player.prevY + this.player.height <= enemy.y + 10 &&
      this.player.y + this.player.height >= enemy.y &&
      this.player.prevX + this.player.width > enemy.x - 6 &&
      this.player.prevX < enemy.x + enemy.width + 6
    );
  }

  enemyShouldTurn(enemy) {
    const probeX = enemy.x + enemy.width / 2 + enemy.direction * (enemy.width / 2 + 2);
    const probeY = enemy.y + enemy.height + 2;
    return !this.collidableBlocks().some((block) => pointInRect(probeX, probeY, block));
  }

  killPlayer() {
    if (!this.player.alive || this.state !== "playing") {
      return;
    }
    this.recordAttemptFrame();
    this.commitAttempt(false);
    this.player.alive = false;
    this.deathTime = CONFIG.deathDuration;
    this.sound.stopAll();
    this.deathParticles = spawnDeathParticles(this.player);
  }

  updateDeath(dt) {
    this.deathTime = Math.max(0, this.deathTime - dt * 1000);
    for (const particle of this.deathParticles) {
      particle.vy += CONFIG.gravity * 0.55 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt * 1000;
    }
    this.deathParticles = this.deathParticles.filter((particle) => particle.life > 0);
    if (this.deathTime <= 0) {
      this.restartLevel();
    }
  }

  respawnPlayer() {
    this.player.x = this.player.respawnX;
    this.player.y = this.player.respawnY;
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
    this.player.onWallLeft = false;
    this.player.onWallRight = false;
  }

  restartLevel() {
    this.sound.stopAll();
    this.scene.restart({ levelNumber: this.levelNumber });
  }

  completeLevel() {
    if (this.state !== "playing") {
      return;
    }
    this.recordAttemptFrame();
    this.commitAttempt(true);
    this.state = "level_complete";
    this.replayTimer = 0;
    this.sound.stopAll();
    this.sound.play("win", { loop: true, volume: 0.6 });
  }

  recordAttemptFrame() {
    if (!this.player.alive) {
      return;
    }
    const frame = { x: this.player.x, y: this.player.y };
    const last = this.attemptFrames[this.attemptFrames.length - 1];
    if (last && Math.abs(last.x - frame.x) < 0.01 && Math.abs(last.y - frame.y) < 0.01) {
      return;
    }
    this.attemptFrames.push(frame);
  }

  commitAttempt(completed) {
    if (this.attemptFrames.length === 0) {
      return;
    }
    this.ghostRuns.push({
      frames: this.attemptFrames.map((frame) => ({ ...frame })),
      completed,
    });
    this.registry.set("ghostRuns", cloneGhostRuns(this.ghostRuns));
    this.attemptFrames = [];
  }

  currentReplayFocus() {
    if (this.ghostRuns.length === 0) {
      return this.player;
    }
    const winning = [...this.ghostRuns].reverse().find((run) => run.completed);
    const run = winning ?? this.ghostRuns[this.ghostRuns.length - 1];
    const visual = ghostVisualState(run, this.replayTimer);
    return visual.frame ? { ...visual.frame, width: this.player.width, height: this.player.height } : this.player;
  }

  updateCameraTarget(target, dt = 1 / 60) {
    if (!target) {
      return;
    }
    const camera = this.cameras.main;
    const targetX = target.x + (target.width ?? this.player.width) / 2;
    const targetY = target.y + (target.height ?? this.player.height) / 2 + this.worldOffsetY();
    const maxX = Math.max(0, this.worldWidth - CONFIG.width);
    const maxY = Math.max(0, this.worldHeight + this.worldOffsetY() - CONFIG.height);
    const desiredX = Phaser.Math.Clamp(targetX - CONFIG.width / 2, 0, maxX);
    const desiredY = Phaser.Math.Clamp(targetY - CONFIG.height / 2, 0, maxY);
    const alpha = Math.min(1, CONFIG.cameraLerp * dt);
    camera.scrollX += (desiredX - camera.scrollX) * alpha;
    camera.scrollY += (desiredY - camera.scrollY) * alpha;
  }

  draw() {
    this.graphics.clear();
    this.graphics.fillStyle(0x1a1d27, 1);
    this.graphics.fillRect(0, 0, this.worldWidth, this.worldHeight + this.worldOffsetY());

    const offsetY = this.worldOffsetY();
    const camera = this.cameras.main;
    const drawRect = (entity, color) => {
      this.graphics.fillStyle(color, 1);
      this.graphics.fillRoundedRect(entity.x, entity.y + offsetY, entity.width, entity.height, 4);
    };

    for (const block of this.solids) {
      if (!this.isDisappearingInactive(block)) {
        drawRect(block, block.color);
      }
    }
    for (const jumpPad of this.jumpPads) {
      drawRect(jumpPad, jumpPad.color);
    }
    for (const block of this.disappearing) {
      if (block.active) {
        drawRect(block, block.triggered ? 0xf2845c : block.color);
      }
    }
    for (const platform of this.movingPlatforms) {
      drawRect(platform, TILE_COLORS.H);
    }
    for (const hazard of this.deadly) {
      drawRect(hazard, hazard.color);
    }
    for (const portal of this.portals) {
      drawRect(portal, portal.color);
    }
    for (const enemy of this.enemies) {
      drawRect(enemy, enemy.color);
    }
    for (const coin of this.coins) {
      if (coin.collected) {
        continue;
      }
      this.graphics.fillStyle(0xf8e058, 1);
      this.graphics.fillEllipse(coin.x + coin.width / 2, coin.y + offsetY + coin.height / 2 + Math.sin(coin.bob) * 2, coin.width * 0.7, coin.height * 0.7);
    }
    for (const saw of this.saws) {
      drawSaw(this.graphics, saw, offsetY);
    }
    for (const saw of this.movingSaws) {
      drawSaw(this.graphics, saw, offsetY);
    }
    if (this.finish) {
      drawRect(this.finish, this.finish.color);
    }

    if (this.state === "level_complete") {
      this.drawGhostReplay(offsetY);
    } else if (this.player.alive) {
      drawRect(this.player, this.player.color);
    }
    for (const particle of this.deathParticles) {
      this.graphics.fillStyle(particle.color, 1);
      this.graphics.fillRect(particle.x, particle.y + offsetY, particle.width, particle.height);
    }

    this.drawUI();
  }

  drawGhostReplay(offsetY) {
    for (const run of this.ghostRuns) {
      const visual = ghostVisualState(run, this.replayTimer);
      if (!visual.frame) {
        continue;
      }
      if (visual.state === "explode") {
        drawGhostExplosion(this.graphics, visual.frame, visual.progress, offsetY, run.completed);
        continue;
      }
      this.graphics.fillStyle(run.completed ? 0x78dcff : 0xf48484, run.completed ? 0.85 : 0.45);
      this.graphics.fillRoundedRect(visual.frame.x, visual.frame.y + offsetY, this.player.width, this.player.height, 4);
    }
  }

  drawUI() {
    this.uiTexts.levelLabel.setText("LEVEL " + this.levelNumber);
    this.uiTexts.coinLabel.setText("COINS " + this.coinCount);
    if (this.state === "level_complete") {
      this.uiTexts.clearTitle.setText("LEVEL CLEAR").setVisible(true);
      this.uiTexts.clearHint.setText("PRESS ENTER FOR NEXT LEVEL").setVisible(true);
      this.uiTexts.attemptLabel.setText(`ATTEMPTS ${this.ghostRuns.length}`).setVisible(true);
    } else {
      this.uiTexts.clearTitle.setVisible(false);
      this.uiTexts.clearHint.setVisible(false);
      this.uiTexts.attemptLabel.setVisible(false);
    }
  }

  isDisappearingInactive(block) {
    if (!block.disappearing) {
      return false;
    }
    const live = this.disappearing.find((item) => item.x === block.x && item.y === block.y);
    return live && !live.active;
  }

  collidableBlocks() {
    return [
      ...this.solids.filter((block) => !this.isDisappearingInactive(block)),
      ...this.jumpPads,
      ...this.disappearing.filter((block) => block.active),
      ...this.movingPlatforms,
    ];
  }

  staticColliders() {
    return [
      ...this.solids.filter((block) => !this.isDisappearingInactive(block)),
      ...this.jumpPads,
      ...this.disappearing.filter((block) => block.active),
    ];
  }

  isOutOfBounds() {
    return (
      this.player.x < 0 ||
      this.player.x + this.player.width > this.worldWidth ||
      this.player.y < 0 ||
      this.player.y + this.player.height > this.worldHeight
    );
  }

  worldOffsetY() {
    return Math.max(0, CONFIG.height - this.worldHeight);
  }
}

function approach(value, target, amount) {
  if (value < target) {
    return Math.min(value + amount, target);
  }
  return Math.max(value - amount, target);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function isRiding(player, platform) {
  const overlap = Math.min(player.prevX + player.width, platform.prevX + platform.width) - Math.max(player.prevX, platform.prevX);
  if (overlap <= 4) {
    return false;
  }
  const footDistance = Math.abs(player.prevY + player.height - platform.prevY);
  return footDistance <= 3 || (player.prevY + player.height <= platform.prevY + 4 && player.vy >= 0);
}

function circleHitsRect(circle, rect) {
  const nearestX = Phaser.Math.Clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = Phaser.Math.Clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function spawnDeathParticles(player) {
  const particles = [];
  const cols = 4;
  const rows = 5;
  const pieceW = player.width / cols;
  const pieceH = player.height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      particles.push({
        x: player.x + col * pieceW,
        y: player.y + row * pieceH,
        width: Math.max(2, pieceW - 1),
        height: Math.max(2, pieceH - 1),
        vx: Phaser.Math.FloatBetween(-220, 220),
        vy: Phaser.Math.FloatBetween(-420, -120),
        life: CONFIG.deathDuration,
        color: 0x7cd4f4,
      });
    }
  }
  return particles;
}

function drawSaw(graphics, saw, offsetY) {
  const points = [];
  const spikes = 14;
  for (let i = 0; i < spikes * 2; i += 1) {
    const angle = saw.angle + (Math.PI / spikes) * i;
    const radius = i % 2 === 0 ? saw.radius : saw.radius * 0.72;
    points.push(new Phaser.Math.Vector2(saw.x + Math.cos(angle) * radius, saw.y + offsetY + Math.sin(angle) * radius));
  }
  graphics.fillStyle(0xdde2e6, 1);
  graphics.fillPoints(points, true);
  graphics.fillStyle(0x7c7e85, 1);
  graphics.fillCircle(saw.x, saw.y + offsetY, saw.radius * 0.2);
}

function cloneGhostRuns(runs) {
  return runs.map((run) => ({
    completed: run.completed,
    frames: run.frames.map((frame) => ({ x: frame.x, y: frame.y })),
  }));
}

function ghostVisualState(run, elapsedMs) {
  if (!run.frames.length) {
    return { state: "hidden", frame: null, progress: 0 };
  }
  const frames = run.frames;
  const maxFrames = frames.length;
  const deathFrames = Math.max(1, Math.round(CONFIG.ghostExplosionDuration / (1000 / 60)));
  const pauseFrames = Math.max(1, Math.round(CONFIG.replayPauseDuration / (1000 / 60)));
  const cycleFrames = run.completed ? maxFrames : maxFrames + deathFrames + pauseFrames;
  const tick = Math.floor((elapsedMs / 1000) * 60) % cycleFrames;
  if (tick < frames.length) {
    return { state: "solid", frame: frames[Math.min(tick, frames.length - 1)], progress: 0 };
  }
  if (run.completed) {
    return { state: "solid", frame: frames[frames.length - 1], progress: 0 };
  }
  const deathTick = tick - frames.length;
  if (deathTick < deathFrames) {
    return { state: "explode", frame: frames[frames.length - 1], progress: deathTick / Math.max(1, deathFrames - 1) };
  }
  return { state: "hidden", frame: null, progress: 1 };
}

function drawGhostExplosion(graphics, frame, progress, offsetY, completed) {
  const cols = 4;
  const rows = 5;
  const pieceW = CONFIG.playerWidth / cols;
  const pieceH = CONFIG.playerHeight / rows;
  graphics.fillStyle(completed ? 0x78dcff : 0xf48484, 1 - progress);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const speedX = (col - (cols - 1) / 2) * 72;
      const speedY = -160 + row * 12;
      const driftX = speedX * progress;
      const driftY = speedY * progress + 0.5 * CONFIG.gravity * progress * progress * 0.00008;
      graphics.fillRect(frame.x + col * pieceW + driftX, frame.y + offsetY + row * pieceH + driftY, Math.max(2, pieceW - 1), Math.max(2, pieceH - 1));
    }
  }
}
