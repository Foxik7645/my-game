export function createLevelConfig(baseWorkers, costs, icons, extras) {
  const defaultWorkers = [3, 5, 9, 15];
  const defaultCosts = [150, 350, 650, 1050];
  const defaultIcons = [96, 112, 128, 144];
  const defaultExtras = { paint: [60, 72, 84, 96] };

  const workersArr = baseWorkers === undefined ? defaultWorkers : baseWorkers;
  const costsArr = costs ?? defaultCosts;
  const iconsArr = icons ?? defaultIcons;
  const extrasObj = { ...defaultExtras, ...(extras || {}) };

  const levels = {};
  for (let i = 0; i < costsArr.length; i++) {
    const level = { icon: iconsArr[i], cost: costsArr[i] };
    if (workersArr) {
      level.workers = workersArr[i];
    }
    for (const [key, arr] of Object.entries(extrasObj)) {
      level[key] = arr[i];
    }
    levels[i + 1] = level;
  }
  return levels;
}

export const DROVOSEKDOM_LEVELS = createLevelConfig();
export const MINEHOUSE_LEVELS = createLevelConfig();
export const FERMERVOM_LEVELS = createLevelConfig();
export const HOUSEEAT_LEVELS = createLevelConfig(
  null,
  [200, 400, 700, 1100],
  [112, 128, 144, 160],
  { cookMs: [60_000, 45_000, 30_000, 20_000], paint: [72, 84, 96, 112] }
);
