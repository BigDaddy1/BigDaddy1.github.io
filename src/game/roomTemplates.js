export const ROOM_TEMPLATES = Object.freeze([
  { kind: "jump_chain", stages: ["intro", "build", "combo"], minDifficulty: 1, maxDifficulty: 12, minWidth: 7, maxWidth: 10, minGap: 3, maxGap: 7, weight: 7 },
  { kind: "enemy_bridge", stages: ["build", "pressure"], minDifficulty: 1, maxDifficulty: 12, minWidth: 5, maxWidth: 7, minGap: 3, maxGap: 7, weight: 6 },
  { kind: "wall_climb", stages: ["build", "combo", "climax"], minDifficulty: 2, maxDifficulty: 12, minWidth: 4, maxWidth: 6, minGap: 3, maxGap: 6, weight: 7 },
  { kind: "tower_climb", stages: ["build", "combo", "climax"], minDifficulty: 2, maxDifficulty: 12, minWidth: 6, maxWidth: 8, minGap: 3, maxGap: 6, weight: 6 },
  { kind: "moving_bridge", stages: ["build", "pressure", "combo"], minDifficulty: 2, maxDifficulty: 12, minWidth: 6, maxWidth: 9, minGap: 3, maxGap: 7, weight: 5 },
  { kind: "saw_corridor", stages: ["pressure", "climax"], minDifficulty: 3, maxDifficulty: 12, minWidth: 6, maxWidth: 9, minGap: 3, maxGap: 7, weight: 8 },
  { kind: "floor_is_death", stages: ["pressure", "climax"], minDifficulty: 3, maxDifficulty: 12, minWidth: 8, maxWidth: 12, minGap: 3, maxGap: 7, weight: 9 },
  { kind: "landing_trap", stages: ["build", "pressure", "combo"], minDifficulty: 3, maxDifficulty: 12, minWidth: 5, maxWidth: 8, minGap: 3, maxGap: 6, weight: 8 },
]);

export function buildStageSequence(roomCount, difficulty) {
  if (roomCount <= 0) {
    return [];
  }

  const sequence = ["intro"];
  while (sequence.length < roomCount - 2) {
    const progress = sequence.length / Math.max(1, roomCount - 1);
    if (difficulty >= 8) {
      if (progress < 0.2) {
        sequence.push("build");
      } else if (progress < 0.58) {
        sequence.push("pressure");
      } else {
        sequence.push("climax");
      }
    } else if (difficulty >= 5) {
      if (progress < 0.25) {
        sequence.push("build");
      } else if (progress < 0.65) {
        sequence.push("pressure");
      } else {
        sequence.push("combo");
      }
    } else if (progress < 0.35) {
      sequence.push("build");
    } else if (progress < 0.7) {
      sequence.push("pressure");
    } else {
      sequence.push("combo");
    }
  }

  if (sequence.length < roomCount - 1) {
    sequence.push("climax");
  }
  while (sequence.length < roomCount) {
    sequence.push(difficulty >= 8 ? "pressure" : "release");
  }
  return sequence.slice(0, roomCount);
}

export function chooseTemplatesForLevel(roomCount, difficulty, rng) {
  const stages = buildStageSequence(roomCount, difficulty);
  const chosen = [];
  const history = [];

  for (const stage of stages) {
    let candidates = ROOM_TEMPLATES.filter((template) => template.minDifficulty <= difficulty && template.maxDifficulty >= difficulty && template.stages.includes(stage));
    if (candidates.length === 0) {
      candidates = ROOM_TEMPLATES.filter((template) => template.minDifficulty <= difficulty && template.maxDifficulty >= difficulty);
    }
    if (difficulty >= 8) {
      const filtered = candidates.filter((template) => !["flat", "stairs"].includes(template.kind));
      if (filtered.length > 0) {
        candidates = filtered;
      }
    }
    if (history.length > 0) {
      const filtered = candidates.filter((template) => template.kind !== history[history.length - 1]);
      if (filtered.length > 0) {
        candidates = filtered;
      }
    }

    const weights = candidates.map((template) => templateWeight(template, stage, difficulty));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let roll = rng.float() * total;
    let selected = candidates[candidates.length - 1];
    for (let index = 0; index < candidates.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) {
        selected = candidates[index];
        break;
      }
    }

    chosen.push(selected);
    history.push(selected.kind);
  }

  return chosen;
}

function templateWeight(template, stage, difficulty) {
  let weight = template.weight;
  if (difficulty >= 8 && ["floor_is_death", "landing_trap", "saw_corridor", "saw_pillar"].includes(template.kind)) {
    weight += 4;
  }
  if (difficulty >= 10 && ["pressure", "climax"].includes(stage) && ["wall_climb", "tower_climb", "saw_corridor", "floor_is_death", "landing_trap", "saw_pillar"].includes(template.kind)) {
    weight += 3;
  }
  return Math.max(1, weight);
}
