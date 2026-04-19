import { CONFIG, difficultyForLevel } from "./config.js";
import { chooseTemplatesForLevel } from "./roomTemplates.js";

class RNG {
  constructor(seed) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  float() {
    return this.next();
  }

  int(min, max) {
    return Math.floor(this.float() * (max - min + 1)) + min;
  }

  pick(values) {
    return values[this.int(0, values.length - 1)];
  }
}

function profileForDifficulty(difficulty) {
  const base = {
    rooms: 10,
    maxGap: 8,
    maxRise: 3,
    maxDrop: 3,
    enemyChance: 0.34,
    sawChance: 0.24,
    movingSawChance: 0.1,
    disappearChance: 0.12,
    jumpPadChance: 0.18,
    movingPlatformChance: 0.14,
    wallChance: 0.2,
  };

  const extra = Math.max(0, difficulty - 1);
  return {
    rooms: Math.min(17, base.rooms + Math.floor(extra / 2)),
    maxGap: Math.min(11, base.maxGap + Math.floor(extra / 2)),
    maxRise: Math.min(5, base.maxRise + Math.floor(extra / 4)),
    maxDrop: Math.min(4, base.maxDrop + Math.floor(extra / 4)),
    enemyChance: Math.min(0.78, base.enemyChance + extra * 0.035),
    sawChance: Math.min(0.74, base.sawChance + extra * 0.035),
    movingSawChance: Math.min(0.42, base.movingSawChance + extra * 0.024),
    disappearChance: Math.min(0.38, base.disappearChance + extra * 0.02),
    jumpPadChance: Math.min(0.42, base.jumpPadChance + extra * 0.012),
    movingPlatformChance: Math.min(0.4, base.movingPlatformChance + extra * 0.022),
    wallChance: Math.min(0.42, base.wallChance + extra * 0.022),
  };
}

function createGrid(width, height) {
  return Array.from({ length: height }, () => Array(width).fill("-"));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fillRect(grid, x0, y0, width, height, tile) {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      if (grid[y] && grid[y][x] !== undefined) {
        grid[y][x] = tile;
      }
    }
  }
}

function placePlatform(grid, x0, x1, y, tile) {
  for (let x = x0; x <= x1; x += 1) {
    if (grid[y] && grid[y][x] !== undefined) {
      grid[y][x] = tile;
    }
  }
}

function buildRoomPlans(profile, difficulty, width, rng) {
  const templates = chooseTemplatesForLevel(profile.rooms, difficulty, rng);
  const plans = [];
  let budget = width - 28;

  for (const template of templates) {
    if (budget <= 16) {
      break;
    }
    let roomWidth = rng.int(template.minWidth, template.maxWidth);
    if (difficulty >= 8 && !["maze_room", "floor_is_death", "saw_pillar"].includes(template.kind)) {
      roomWidth = Math.max(template.minWidth, roomWidth - 1);
    }
    if (difficulty >= 10) {
      roomWidth = Math.max(template.minWidth, roomWidth - 1);
    }
    const gapBefore = rng.int(template.minGap, Math.min(profile.maxGap, template.maxGap));
    plans.push({ kind: template.kind, width: roomWidth, gapBefore });
    budget -= roomWidth + gapBefore;
  }

  if (difficulty >= 6) {
    const mustHave = difficulty >= 10 ? ["floor_is_death", "saw_corridor", "wall_climb", "landing_trap"] : ["enemy_bridge", "wall_climb", "saw_corridor"];
    for (const kind of mustHave) {
      if (plans.some((plan) => plan.kind === kind)) {
        continue;
      }
      const insertAt = rng.int(0, Math.max(0, plans.length - 1));
      plans.splice(insertAt, 0, {
        kind,
        width: kind === "wall_climb" ? 5 : kind === "landing_trap" ? 6 : 8,
        gapBefore: difficulty >= 10 ? rng.int(4, Math.min(8, profile.maxGap)) : rng.int(3, Math.min(7, profile.maxGap)),
      });
    }
  }

  return plans;
}

function addBorders(grid, floorTile = "B") {
  const width = grid[0].length;
  const height = grid.length;
  for (let y = 0; y < height; y += 1) {
    grid[y][0] = "B";
    grid[y][width - 1] = "B";
  }
  for (let x = 0; x < width; x += 1) {
    grid[0][x] = "B";
    grid[height - 1][x] = floorTile;
  }
}

function isAiryLevel(levelNumber, difficulty, rng) {
  return levelNumber >= 4 && rng.float() < Math.min(0.1 + difficulty * 0.05, 0.65);
}

export function generateLevel(levelNumber, seed = Math.floor(Math.random() * 0xffffffff)) {
  const rng = new RNG(seed);
  const difficulty = difficultyForLevel(levelNumber);
  const profile = profileForDifficulty(difficulty);
  const width = Math.min(92 + levelNumber * 2, 124);
  const height = CONFIG.worldHeightTiles;
  const grid = createGrid(width, height);
  const airy = isAiryLevel(levelNumber, difficulty, rng);
  addBorders(grid, airy && difficulty >= 6 ? "T" : "B");

  const minRouteY = difficulty >= 8 ? 4 : 6;
  const maxRouteY = difficulty >= 10 ? height - 12 : height - (airy ? 10 : 7);
  const startY = difficulty >= 10 ? height - 10 : difficulty >= 8 ? height - 8 : airy ? height - 7 : height - 4;
  const route = [];

  const start = { kind: "start", x0: 2, x1: 8, y: startY, tile: "B" };
  placePlatform(grid, start.x0, start.x1, start.y, start.tile);
  route.push(start);

  const plans = buildRoomPlans(profile, difficulty, width, rng);
  let current = start;

  for (const plan of plans) {
    const nextX0 = current.x1 + plan.gapBefore + 1;
    const nextX1 = nextX0 + plan.width - 1;
    if (nextX1 >= width - 6) {
      break;
    }

    let nextY = current.y;
    if (plan.kind === "wall_climb") {
      nextY -= rng.int(2, Math.min(6, profile.maxRise + 2));
    } else if (["tower_climb", "jump_chain", "saw_pillar"].includes(plan.kind)) {
      nextY -= rng.int(1, profile.maxRise);
    } else if (["maze_room", "moving_bridge", "landing_trap"].includes(plan.kind)) {
      nextY += rng.int(-2, 1);
    } else if (plan.kind === "floor_is_death") {
      nextY = clamp(current.y - rng.int(1, 2), minRouteY, maxRouteY - 2);
    } else {
      nextY += rng.int(-profile.maxRise, profile.maxDrop);
    }
    nextY = clamp(nextY, minRouteY, maxRouteY);
    if (difficulty >= 10 && ["saw_corridor", "floor_is_death", "landing_trap", "saw_pillar", "wall_climb"].includes(plan.kind)) {
      nextY = clamp(nextY - rng.int(0, 1), minRouteY, maxRouteY);
    }

    const tile = pickSegmentTile(plan.kind, profile, difficulty, rng);
    const segment = { kind: plan.kind, x0: nextX0, x1: nextX1, y: nextY, tile };
    placePlatform(grid, segment.x0, segment.x1, segment.y, tile);
    decorateRoom(grid, current, segment, profile, difficulty, rng);
    route.push(segment);
    current = segment;
  }

  const finish = {
    kind: "finish",
    x0: Math.min(width - 12, current.x1 + rng.int(3, 5)),
    x1: Math.min(width - 6, current.x1 + rng.int(8, 10)),
    y: clamp(current.y + rng.int(-1, 1), minRouteY, maxRouteY),
    tile: "B",
  };
  placePlatform(grid, finish.x0, finish.x1, finish.y, finish.tile);
  route.push(finish);

  const spawnX = Math.floor((start.x0 + start.x1) / 2);
  const finishX = clamp(finish.x0 + 2, 1, width - 2);
  grid[start.y - 1][spawnX] = "P";
  grid[Math.max(1, finish.y - 1)][finishX] = "F";

  if (airy && difficulty >= 6) {
    for (let x = 1; x < width - 1; x += 1) {
      if (grid[height - 1][x] !== "B") {
        grid[height - 1][x] = rng.float() < 0.82 ? "T" : "S";
      }
    }
  }

  cleanupUnreachablePockets(grid, route, spawnX, start.y - 1);
  pruneTrailingSpace(grid, route);

  return {
    name: `generated_${String(levelNumber).padStart(3, "0")}`,
    seed,
    difficulty,
    width: grid[0].length,
    height: grid.length,
    lines: grid.map((row) => row.join("")),
  };
}

function pickSegmentTile(kind, profile, difficulty, rng) {
  if (kind === "moving_bridge" && rng.float() < profile.movingPlatformChance) {
    return rng.float() < 0.55 ? "H" : "V";
  }
  return "B";
}

function decorateRoom(grid, previous, segment, profile, difficulty, rng) {
  switch (segment.kind) {
    case "jump_chain":
      buildJumpChain(grid, previous, segment, rng);
      break;
    case "enemy_bridge":
      buildEnemyBridge(grid, segment, profile, rng);
      break;
    case "wall_climb":
      buildWallClimb(grid, previous, segment, rng);
      break;
    case "tower_climb":
      buildTowerClimb(grid, previous, segment, difficulty, rng);
      break;
    case "moving_bridge":
      buildMovingBridge(grid, previous, segment, rng);
      break;
    case "saw_corridor":
      buildSawCorridor(grid, segment, difficulty, rng);
      break;
    case "floor_is_death":
      buildFloorIsDeath(grid, segment, difficulty, rng);
      break;
    case "landing_trap":
      buildLandingTrap(grid, segment, difficulty, rng);
      break;
    default:
      break;
  }

  maybeAddCoin(grid, segment, difficulty, rng);
}

function buildJumpChain(grid, previous, segment, rng) {
  const steps = Math.max(2, Math.floor((segment.x1 - segment.x0) / 3));
  const width = 2;
  for (let index = 0; index < steps; index += 1) {
    const x = segment.x0 + index * 3;
    const y = segment.y - (index % 2 === 0 ? 0 : 1);
    placePlatform(grid, x, Math.min(segment.x1, x + width), y, "B");
    if (index === steps - 1 && rng.float() < 0.32) {
      const jumpX = Math.min(segment.x1, x + 1);
      grid[y][jumpX] = "J";
    }
  }
  if (previous.x1 + 2 < segment.x0) {
    placePlatform(grid, previous.x1 + 1, segment.x0 - 1, Math.min(previous.y, segment.y + 1), "B");
  }
}

function buildEnemyBridge(grid, segment, profile, rng) {
  if (rng.float() < profile.enemyChance) {
    const x = Math.floor((segment.x0 + segment.x1) / 2);
    grid[Math.max(1, segment.y - 1)][x] = "E";
  }
  if (rng.float() < profile.enemyChance * 0.55) {
    const x = clamp(segment.x1 - 1, segment.x0 + 1, segment.x1);
    grid[Math.max(1, segment.y - 1)][x] = "E";
  }
}

function buildWallClimb(grid, previous, segment, rng) {
  fillRect(grid, segment.x0, Math.min(previous.y, segment.y), 1, Math.abs(previous.y - segment.y) + 1, "W");
  fillRect(grid, segment.x1, Math.min(previous.y - 2, segment.y), 1, Math.abs(previous.y - segment.y) + 2, "W");
  if (segment.x0 - 2 > previous.x1) {
    placePlatform(grid, previous.x1 + 1, segment.x0 - 2, previous.y, "B");
  }
  placePlatform(grid, segment.x0 + 1, segment.x1 - 1, segment.y, "B");
}

function buildTowerClimb(grid, previous, segment, difficulty, rng) {
  const ledges = [];
  let ledgeY = clamp(segment.y + 2, 3, grid.length - 6);
  for (let x = segment.x0; x <= segment.x1; x += 3) {
    ledgeY = clamp(ledgeY - rng.int(0, 1), 3, grid.length - 6);
    ledges.push({ x, y: ledgeY });
  }

  for (let index = 0; index < ledges.length; index += 1) {
    const ledge = ledges[index];
    fillRect(grid, ledge.x, ledge.y - 2, 1, 3, "B");
    placePlatform(grid, ledge.x, Math.min(segment.x1, ledge.x + 1), ledge.y, "B");
    if (difficulty >= 7 && index > 0 && rng.float() < 0.28) {
      grid[Math.min(grid.length - 2, ledge.y + 1)][ledge.x] = "S";
    }
  }
}

function buildMovingBridge(grid, previous, segment, rng) {
  placePlatform(grid, segment.x0, segment.x1, segment.y + 3, "S");
  if (segment.tile !== "H" && segment.tile !== "V") {
    const mid = Math.floor((segment.x0 + segment.x1) / 2);
    grid[Math.max(1, segment.y - 1)][mid] = "O";
  }
}

function buildSawCorridor(grid, segment, difficulty, rng) {
  const topY = Math.max(1, segment.y - 4);
  placePlatform(grid, segment.x0, segment.x1, topY, "B");
  for (let x = segment.x0 + 1; x < segment.x1; x += difficulty >= 8 ? 2 : 3) {
    grid[Math.max(1, segment.y - 1)][x] = rng.float() < 0.45 || difficulty >= 8 ? "X" : "C";
  }
}

function buildFloorIsDeath(grid, segment, difficulty, rng) {
  const floorY = Math.min(grid.length - 2, segment.y + (difficulty >= 8 ? 3 : 4));
  for (let x = segment.x0 - 1; x <= segment.x1 + 1; x += 1) {
    if (grid[floorY] && grid[floorY][x] && grid[floorY][x] !== "B") {
      grid[floorY][x] = rng.float() < 0.5 && difficulty >= 8 ? "X" : "S";
    }
  }
}

function buildLandingTrap(grid, segment, difficulty, rng) {
  const landingX = clamp(Math.floor((segment.x0 + segment.x1) / 2), 1, grid[0].length - 2);
  grid[Math.max(1, segment.y - 1)][landingX] = "E";
  if (difficulty >= 6) {
    grid[Math.max(1, segment.y - 1)][Math.max(1, landingX - 2)] = "C";
  }
  if (difficulty >= 7 && rng.float() < 0.28) {
    grid[segment.y][landingX] = "D";
  }
}

function maybeAddCoin(grid, segment, difficulty, rng) {
  if (rng.float() > Math.max(0.18, 0.55 - difficulty * 0.02)) {
    return;
  }
  const x = clamp(Math.floor((segment.x0 + segment.x1) / 2), 1, grid[0].length - 2);
  const y = clamp(segment.y - 2, 1, grid.length - 3);
  if (grid[y][x] === "-") {
    grid[y][x] = "O";
  }
}

function pruneTrailingSpace(grid, route) {
  const last = route[route.length - 1];
  const trimWidth = Math.min(grid[0].length, last.x1 + 10);
  for (let y = 0; y < grid.length; y += 1) {
    grid[y].length = trimWidth;
  }
}

function cleanupUnreachablePockets(grid, route, spawnX, spawnY) {
  const height = grid.length;
  const width = grid[0].length;
  const routeTiles = new Set();
  for (const segment of route) {
    for (let x = segment.x0; x <= segment.x1; x += 1) {
      routeTiles.add(`${x},${segment.y}`);
    }
  }

  const visited = Array.from({ length: height }, () => Array(width).fill(false));
  const queue = [];
  const tryEnqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }
    if (visited[y][x] || isSolidTile(grid[y][x])) {
      return;
    }
    visited[y][x] = true;
    queue.push([x, y]);
  };

  for (let x = 0; x < width; x += 1) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }
  tryEnqueue(spawnX, spawnY);

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    tryEnqueue(x + 1, y);
    tryEnqueue(x - 1, y);
    tryEnqueue(x, y + 1);
    tryEnqueue(x, y - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (visited[y][x]) {
        continue;
      }
      const tile = grid[y][x];
      if (!isSolidTile(tile)) {
        if (["C", "X", "Y", "E", "O", "S", "T"].includes(tile)) {
          grid[y][x] = "-";
        }
        continue;
      }
      if (routeTiles.has(`${x},${y}`)) {
        continue;
      }
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      const touchesReachable = neighbors.some(([nx, ny]) => visited[ny]?.[nx] && !isSolidTile(grid[ny][nx]));
      const touchesPocket = neighbors.some(([nx, ny]) => !visited[ny]?.[nx] && !isSolidTile(grid[ny][nx]));
      if (!touchesReachable && touchesPocket) {
        grid[y][x] = "-";
      }
    }
  }
}

function isSolidTile(tile) {
  return ["B", "W", "J", "D", "H", "V", "R"].includes(tile);
}
