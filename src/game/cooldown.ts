export interface Cooldown {
  canUse: () => boolean;
  useIfAble: () => boolean;
  mutate: (opts: { rechargeTime?: number; units?: number }) => void;
  reset: () => void;
}

export function makeCooldown(
  initialRechargeTime: number,
  initialUnits = 1,
  getTime: () => number
): Cooldown {
  let rechargeTime = initialRechargeTime;
  let units = initialUnits;
  let timeRemaining = 0;
  let lastTime = 0;

  const updateTime = () => {
    const now = getTime();
    if (now < lastTime) {
      timeRemaining = 0;
    } else {
      timeRemaining -= now - lastTime;
      if (timeRemaining < 0) timeRemaining = 0;
    }
    lastTime = now;
  };

  const canUse = () => {
    updateTime();
    return timeRemaining <= rechargeTime * (units - 1);
  };

  return {
    canUse,
    useIfAble() {
      const usable = canUse();
      if (usable) timeRemaining += rechargeTime;
      return usable;
    },
    mutate(opts) {
      if (opts.rechargeTime !== undefined) {
        timeRemaining -= rechargeTime - opts.rechargeTime;
        if (timeRemaining < 0) timeRemaining = 0;
        rechargeTime = opts.rechargeTime;
      }
      if (opts.units !== undefined) units = opts.units;
    },
    reset() {
      timeRemaining = 0;
      lastTime = 0;
      rechargeTime = initialRechargeTime;
      units = initialUnits;
    },
  };
}

export interface Spawner {
  shouldSpawn: () => boolean;
  mutate: (opts: { chance?: number; cooldownPerSpawn?: number; maxSpawns?: number }) => void;
}

export function makeSpawner(
  opts: { chance: number; cooldownPerSpawn: number; maxSpawns: number },
  getTime: () => number
): Spawner {
  let chance = opts.chance;
  const cooldown = makeCooldown(opts.cooldownPerSpawn, opts.maxSpawns, getTime);
  return {
    shouldSpawn() {
      return Math.random() <= chance && cooldown.useIfAble();
    },
    mutate(newOpts) {
      if (newOpts.chance !== undefined) chance = newOpts.chance;
      cooldown.mutate({
        rechargeTime: newOpts.cooldownPerSpawn,
        units: newOpts.maxSpawns,
      });
    },
  };
}
