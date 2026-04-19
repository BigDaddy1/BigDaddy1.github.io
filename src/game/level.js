import { CONFIG, TILE_COLORS } from "./config.js";

export function buildLevelData(generated) {
  const lines = generated.lines;
  const height = lines.length;
  const width = lines[0]?.length ?? 0;
  const tileSize = CONFIG.tileSize;
  const data = {
    name: generated.name,
    width,
    height,
    lines,
    spawn: { x: tileSize * 2, y: tileSize * 2 },
    finish: null,
    solids: [],
    jumpPads: [],
    disappearing: [],
    deadly: [],
    walls: [],
    portals: [],
    movingPlatforms: [],
    saws: [],
    movingSaws: [],
    enemies: [],
    coins: [],
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = lines[y][x];
      const worldX = x * tileSize;
      const worldY = y * tileSize;
      const rect = { x: worldX, y: worldY, width: tileSize, height: tileSize };

      if (tile === "P") {
        data.spawn = {
          x: worldX + (tileSize - CONFIG.playerWidth) / 2,
          y: worldY - CONFIG.playerHeight,
        };
        continue;
      }
      if (tile === "F") {
        data.finish = { ...rect, color: TILE_COLORS.F };
        continue;
      }
      if (tile === "O") {
        data.coins.push({ ...rect, collected: false, bob: Math.random() * Math.PI * 2 });
        continue;
      }
      if (tile === "E") {
        data.enemies.push({
          x: worldX + 2,
          y: worldY + 4,
          width: tileSize - 4,
          height: tileSize - 4,
          vx: 0,
          vy: 0,
          direction: Math.random() < 0.5 ? -1 : 1,
          onGround: false,
          color: TILE_COLORS.E,
        });
        continue;
      }
      if (tile === "C" || tile === "X" || tile === "Y") {
        const saw = {
          x: worldX + tileSize / 2,
          y: worldY + tileSize / 2,
          radius: CONFIG.sawRadius,
          kind: tile,
          baseX: worldX + tileSize / 2,
          baseY: worldY + tileSize / 2,
          angle: 0,
          speed: tile === "X" || tile === "Y" ? 3.8 : 5.2,
          amplitude: tile === "X" || tile === "Y" ? tileSize * 2.2 : 0,
        };
        if (tile === "C") {
          data.saws.push(saw);
        } else {
          data.movingSaws.push(saw);
        }
        continue;
      }
      if (tile === "H" || tile === "V" || tile === "R") {
        data.movingPlatforms.push({
          x: worldX,
          y: worldY,
          width: tileSize,
          height: tileSize,
          tile,
          baseX: worldX,
          baseY: worldY,
          prevX: worldX,
          prevY: worldY,
          dx: 0,
          dy: 0,
          speed: CONFIG.movingPlatformSpeed,
          amplitude: tile === "R" ? tileSize * 2 : tileSize * 3,
          period: tile === "R" ? 3 : 2.6,
          color: TILE_COLORS.H,
        });
        continue;
      }
      if (tile === "T") {
        data.portals.push({ ...rect, color: TILE_COLORS.T });
      }
      if (tile === "S") {
        data.deadly.push({ ...rect, color: TILE_COLORS.S });
      }
      if (tile === "W") {
        data.walls.push({ ...rect, color: TILE_COLORS.W, tile });
        data.solids.push({ ...rect, color: TILE_COLORS.W, tile });
      } else if (tile === "J") {
        data.jumpPads.push({ ...rect, color: TILE_COLORS.J, tile });
        data.solids.push({ ...rect, color: TILE_COLORS.J, tile });
      } else if (tile === "D") {
        data.disappearing.push({ ...rect, color: TILE_COLORS.D, tile, active: true, timer: 0, triggered: false });
      } else if (tile === "B") {
        data.solids.push({ ...rect, color: TILE_COLORS.B, tile });
      }
    }
  }

  return data;
}
