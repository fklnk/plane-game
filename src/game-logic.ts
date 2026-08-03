export type GameMode = "campaign" | "boss" | "endless" | "roguelike";
export type ShipId = "balanced" | "bomber" | "lightning" | "guardian";
export type SpecializationId =
  | "power"
  | "agile"
  | "defender"
  | "vampire"
  | "devour"
  | "wheelchair";
export type SkinId =
  | "standard"
  | "after_storm_skin"
  | "fell_short_skin"
  | "total_eclipse_skin"
  | "hollow_custody_skin"
  | "perfect_vessel_skin"
  | "boss_slayer_skin"
  | "campaign_ace_skin";
export type ShadowEndingId =
  | "destroyed_fallen"
  | "destroyed_consumed"
  | "destroyed_embraced"
  | "kept_fallen"
  | "kept_possessed";

export const SHADOW_ENDING_SKIN_REWARDS: Record<ShadowEndingId, SkinId> = {
  destroyed_fallen: "fell_short_skin",
  destroyed_consumed: "total_eclipse_skin",
  destroyed_embraced: "after_storm_skin",
  kept_fallen: "hollow_custody_skin",
  kept_possessed: "perfect_vessel_skin"
};

export const BOSS_SEQUENCE_LEGENDARY_SKIN: SkinId = "campaign_ace_skin";
export type PlayVariantId = "single" | "coop" | "score_duel";

export const WHEELCHAIR_ACTIVE_SKILLS = {
  breachHorn: {
    cooldownMs: 12000,
    distance: 500,
    ramDamageMultiplier: 3,
    damageTakenMultiplier: 0.3,
    protectionMs: 800
  },
  reactiveArmor: {
    cooldownMs: 20000,
    durationMs: 4000,
    damageTakenMultiplier: 0.35,
    releaseMultiplier: 3,
    releaseHealRatio: 0.3
  },
  fortressStance: {
    cooldownMs: 24000,
    durationMs: 5000,
    damageTakenMultiplier: 0.5,
    sizeMultiplier: 1.5,
    speedMultiplier: 0.8
  }
} as const;

export const DEVOUR_SWALLOW_LEVELS = [
  { sizeThreshold: 0.8, sizeGain: 0.015, maxSizeMultiplier: 2, maxHealthGain: 1.5, damageTakenMultiplier: 1 },
  { sizeThreshold: 0.9, sizeGain: 0.02, maxSizeMultiplier: 2.15, maxHealthGain: 2.5, damageTakenMultiplier: 0.95 },
  { sizeThreshold: 1, sizeGain: 0.025, maxSizeMultiplier: 2.3, maxHealthGain: 3.5, damageTakenMultiplier: 0.9 },
  { sizeThreshold: 1.08, sizeGain: 0.03, maxSizeMultiplier: 2.45, maxHealthGain: 4.5, damageTakenMultiplier: 0.85 },
  { sizeThreshold: 1.15, sizeGain: 0.035, maxSizeMultiplier: 2.6, maxHealthGain: 6, damageTakenMultiplier: 0.8 }
] as const;

export function wheelchairActiveDamageTakenMultiplier(
  breachHornActive: boolean,
  reactiveArmorActive: boolean,
  fortressStanceActive: boolean
): number {
  const multipliers = [
    breachHornActive ? WHEELCHAIR_ACTIVE_SKILLS.breachHorn.damageTakenMultiplier : 1,
    reactiveArmorActive ? WHEELCHAIR_ACTIVE_SKILLS.reactiveArmor.damageTakenMultiplier : 1,
    fortressStanceActive ? WHEELCHAIR_ACTIVE_SKILLS.fortressStance.damageTakenMultiplier : 1
  ];
  // 主动减伤取最强一项，避免同时开启反应装甲和堡垒后出现近乎无敌的乘算。
  return Math.min(...multipliers);
}

export function reactiveArmorRelease(storedPreventedDamage: number): {
  damage: number;
  healing: number;
} {
  const stored = Math.max(0, storedPreventedDamage);
  const damage = stored * WHEELCHAIR_ACTIVE_SKILLS.reactiveArmor.releaseMultiplier;
  return {
    damage,
    healing: damage * WHEELCHAIR_ACTIVE_SKILLS.reactiveArmor.releaseHealRatio
  };
}

export function devourHealingAmount(
  extraMaxHealth: number,
  missingHealth: number,
  swallowedEnemyMaxHealth: number
): number {
  const safe = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
  return (
    safe(extraMaxHealth) * 0.01 +
    safe(missingHealth) * 0.02 +
    safe(swallowedEnemyMaxHealth) * 0.04
  );
}

export function independentBossHealthAfterDamage(currentHealth: number, rawDamage: number): number {
  const health = Math.max(0, Number.isFinite(currentHealth) ? currentHealth : 0);
  const damage = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
  return Math.max(0, health - damage);
}

export interface DailyLoginData {
  lastClaimDay: number | null;
  streak: number;
  totalClaims: number;
}

export interface SaveData {
  version: 1;
  starCores: number;
  unlockedShips: ShipId[];
  selectedShip: ShipId;
  selectedSpecialization: SpecializationId;
  selectedShip2: ShipId;
  selectedSpecialization2: SpecializationId;
  unlockedSkins: SkinId[];
  equippedSkin: SkinId;
  permanentUpgrades: Record<string, number>;
  settings: {
    musicVolume: number;
    sfxVolume: number;
    screenShake: boolean;
    damageNumbers: boolean;
    quality: "low" | "high";
    friendlyFire: boolean;
    /** 自动开火:开启后无需按住 SPACE/ENTER,持续连发(即时肉鸽推荐) */
    autoFire: boolean;
    /** 自定义键位:动作 id → Phaser 键码名(如 "KeyW"/"SPACE"),缺省用默认键 */
    keybindings: Record<string, string>;
  };
  records: {
    campaignWins: number;
    highestUnlockedLevel: number;
    endlessBestSeconds: number;
    endlessBestScore: number;
    bossRushBestMs: number | null;
    roguelikeBestSeconds: number;
    roguelikeBestWave: number;
  };
  achievements: Record<string, string>;
  seenTutorial: boolean;
  lastMode: GameMode;
  lastLevel: number;
  lastVariant: PlayVariantId;
  lastShip2: ShipId;
  dailyLogin: DailyLoginData;
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  starCores: 0,
  unlockedShips: ["balanced", "bomber", "lightning", "guardian"],
  selectedShip: "balanced",
  selectedSpecialization: "power",
  selectedShip2: "balanced",
  selectedSpecialization2: "power",
  unlockedSkins: ["standard"],
  equippedSkin: "standard",
  permanentUpgrades: {
    hull: 0,
    firepower: 0,
    engine: 0,
    armor: 0,
    recovery: 0,
    emergency: 0,
    reroll: 0
  },
  settings: {
    musicVolume: 0.45,
    sfxVolume: 0.65,
    screenShake: true,
    damageNumbers: true,
    quality: "low",
    friendlyFire: true,
    autoFire: false,
    keybindings: {}
  },
  records: {
    campaignWins: 0,
    highestUnlockedLevel: 1,
    endlessBestSeconds: 0,
    endlessBestScore: 0,
    bossRushBestMs: null,
    roguelikeBestSeconds: 0,
    roguelikeBestWave: 0
  },
  achievements: {},
  seenTutorial: false,
  lastMode: "campaign",
  lastLevel: 3,
  lastVariant: "single",
  lastShip2: "guardian",
  dailyLogin: {
    lastClaimDay: null,
    streak: 0,
    totalClaims: 0
  }
};

export const UPGRADE_EXPERIENCE_SCALE = 1.1;

const PERMANENT_UPGRADE_CAPS: Record<string, number> = {
  hull: 15,
  firepower: 15,
  engine: 13,
  armor: 13,
  recovery: 11,
  emergency: 8,
  reroll: 6
};

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(finiteNumber(value, fallback))));
}

function boundedVolume(value: unknown, fallback: number): number {
  return Math.min(1, Math.max(0, finiteNumber(value, fallback)));
}

export function xpToNextLevel(level: number): number {
  const originalRequirement = 30 + level * 18 + Math.pow(level, 1.35) * 4;
  return Math.round(originalRequirement * UPGRADE_EXPERIENCE_SCALE);
}

export function loadSave(raw: string | null): SaveData {
  if (!raw) return structuredClone(DEFAULT_SAVE);
  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return structuredClone(DEFAULT_SAVE);
    const validShips: ShipId[] = ["balanced", "bomber", "lightning", "guardian"];
    const validSpecializations: SpecializationId[] = [
      "power",
      "agile",
      "defender",
      "vampire",
      "devour",
      "wheelchair"
    ];
    const validSkins: SkinId[] = [
      "standard",
      "after_storm_skin",
      "fell_short_skin",
      "total_eclipse_skin",
      "hollow_custody_skin",
      "perfect_vessel_skin",
      "boss_slayer_skin",
      "campaign_ace_skin"
    ];
    const validModes: GameMode[] = ["campaign", "endless", "boss", "roguelike"];
    const validVariants: PlayVariantId[] = ["single", "coop", "score_duel"];
    const selectedShip = validShips.includes(parsed.selectedShip as ShipId)
      ? (parsed.selectedShip as ShipId)
      : "balanced";
    const rawSpecialization = (parsed as { selectedSpecialization?: string }).selectedSpecialization;
    const legacySpecialization = rawSpecialization === "assault" ? "power" : rawSpecialization;
    const selectedSpecialization = validSpecializations.includes(
      legacySpecialization as SpecializationId
    )
      ? (legacySpecialization as SpecializationId)
      : "power";
    const selectedShip2 = validShips.includes(parsed.selectedShip2 as ShipId)
      ? (parsed.selectedShip2 as ShipId)
      : DEFAULT_SAVE.selectedShip2;
    const rawSpecialization2 = (parsed as { selectedSpecialization2?: string })
      .selectedSpecialization2;
    const legacySpecialization2 = rawSpecialization2 === "assault" ? "power" : rawSpecialization2;
    const selectedSpecialization2 = validSpecializations.includes(
      legacySpecialization2 as SpecializationId
    )
      ? (legacySpecialization2 as SpecializationId)
      : DEFAULT_SAVE.selectedSpecialization2;
    const rawUnlockedSkins = Array.isArray(parsed.unlockedSkins)
      ? parsed.unlockedSkins
      : ["standard"];
    const unlockedSkins = validSkins.filter((skin) => rawUnlockedSkins.includes(skin));
    if (!unlockedSkins.includes("standard")) unlockedSkins.unshift("standard");
    const equippedSkin =
      validSkins.includes(parsed.equippedSkin as SkinId) &&
      unlockedSkins.includes(parsed.equippedSkin as SkinId)
        ? (parsed.equippedSkin as SkinId)
        : "standard";
    const rawSettings: Record<string, unknown> =
      parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {};
    const rawRecords: Record<string, unknown> =
      parsed.records && typeof parsed.records === "object" ? parsed.records : {};
    const rawUpgrades: Record<string, unknown> =
      parsed.permanentUpgrades && typeof parsed.permanentUpgrades === "object"
        ? parsed.permanentUpgrades
        : {};
    const permanentUpgrades = Object.fromEntries(
      Object.entries(PERMANENT_UPGRADE_CAPS).map(([id, cap]) => [
        id,
        boundedInteger(rawUpgrades[id], DEFAULT_SAVE.permanentUpgrades[id], 0, cap)
      ])
    );
    const rawAchievements: Record<string, unknown> =
      parsed.achievements && typeof parsed.achievements === "object" && !Array.isArray(parsed.achievements)
        ? parsed.achievements
        : {};
    const achievements = Object.fromEntries(
      Object.entries(rawAchievements).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
    const rawDailyLogin: Record<string, unknown> =
      parsed.dailyLogin && typeof parsed.dailyLogin === "object"
        ? (parsed.dailyLogin as unknown as Record<string, unknown>)
        : {};
    const lastClaimDay =
      rawDailyLogin.lastClaimDay === null
        ? null
        : boundedInteger(rawDailyLogin.lastClaimDay, -1, -1, Number.MAX_SAFE_INTEGER);
    return {
      version: 1,
      starCores: boundedInteger(parsed.starCores, DEFAULT_SAVE.starCores, 0, Number.MAX_SAFE_INTEGER),
      selectedShip,
      selectedSpecialization,
      selectedShip2,
      selectedSpecialization2,
      unlockedSkins,
      equippedSkin,
      unlockedShips: validShips,
      permanentUpgrades,
      settings: {
        musicVolume: boundedVolume(rawSettings.musicVolume, DEFAULT_SAVE.settings.musicVolume),
        sfxVolume: boundedVolume(rawSettings.sfxVolume, DEFAULT_SAVE.settings.sfxVolume),
        screenShake:
          typeof rawSettings.screenShake === "boolean"
            ? rawSettings.screenShake
            : DEFAULT_SAVE.settings.screenShake,
        damageNumbers:
          typeof rawSettings.damageNumbers === "boolean"
            ? rawSettings.damageNumbers
            : DEFAULT_SAVE.settings.damageNumbers,
        quality:
          rawSettings.quality === "low" || rawSettings.quality === "high"
            ? rawSettings.quality
            : DEFAULT_SAVE.settings.quality,
        friendlyFire:
          typeof rawSettings.friendlyFire === "boolean"
            ? rawSettings.friendlyFire
            : DEFAULT_SAVE.settings.friendlyFire,
        autoFire:
          typeof rawSettings.autoFire === "boolean"
            ? rawSettings.autoFire
            : DEFAULT_SAVE.settings.autoFire,
        keybindings:
          rawSettings.keybindings &&
          typeof rawSettings.keybindings === "object" &&
          !Array.isArray(rawSettings.keybindings)
            ? Object.fromEntries(
                Object.entries(rawSettings.keybindings).filter(
                  ([, value]) => typeof value === "string"
                )
              )
            : DEFAULT_SAVE.settings.keybindings
      },
      records: {
        campaignWins: boundedInteger(
          rawRecords.campaignWins,
          DEFAULT_SAVE.records.campaignWins,
          0,
          Number.MAX_SAFE_INTEGER
        ),
        highestUnlockedLevel: boundedInteger(
          rawRecords.highestUnlockedLevel,
          DEFAULT_SAVE.records.highestUnlockedLevel,
          1,
          5
        ),
        endlessBestSeconds: finiteNumber(
          rawRecords.endlessBestSeconds,
          DEFAULT_SAVE.records.endlessBestSeconds
        ) < 0
          ? 0
          : finiteNumber(rawRecords.endlessBestSeconds, DEFAULT_SAVE.records.endlessBestSeconds),
        endlessBestScore: boundedInteger(
          rawRecords.endlessBestScore,
          DEFAULT_SAVE.records.endlessBestScore,
          0,
          Number.MAX_SAFE_INTEGER
        ),
        bossRushBestMs:
          typeof rawRecords.bossRushBestMs === "number" &&
          Number.isFinite(rawRecords.bossRushBestMs)
            ? boundedInteger(
                rawRecords.bossRushBestMs,
                0,
                0,
                Number.MAX_SAFE_INTEGER
              )
            : null,
        roguelikeBestSeconds: finiteNumber(
          rawRecords.roguelikeBestSeconds,
          DEFAULT_SAVE.records.roguelikeBestSeconds
        ) < 0
          ? 0
          : finiteNumber(rawRecords.roguelikeBestSeconds, DEFAULT_SAVE.records.roguelikeBestSeconds),
        roguelikeBestWave: boundedInteger(
          rawRecords.roguelikeBestWave,
          DEFAULT_SAVE.records.roguelikeBestWave,
          0,
          Number.MAX_SAFE_INTEGER
        )
      },
      achievements,
      seenTutorial:
        typeof parsed.seenTutorial === "boolean" ? parsed.seenTutorial : DEFAULT_SAVE.seenTutorial,
      lastMode: validModes.includes(parsed.lastMode as GameMode)
        ? (parsed.lastMode as GameMode)
        : DEFAULT_SAVE.lastMode,
      lastLevel: Math.min(5, Math.max(3, Math.floor(parsed.lastLevel ?? DEFAULT_SAVE.lastLevel))),
      lastVariant: validVariants.includes(parsed.lastVariant as PlayVariantId)
        ? (parsed.lastVariant as PlayVariantId)
        : DEFAULT_SAVE.lastVariant,
      lastShip2: validShips.includes(parsed.lastShip2 as ShipId)
        ? (parsed.lastShip2 as ShipId)
        : DEFAULT_SAVE.lastShip2,
      dailyLogin: {
        lastClaimDay: lastClaimDay === -1 ? null : lastClaimDay,
        streak: boundedInteger(rawDailyLogin.streak, DEFAULT_SAVE.dailyLogin.streak, 0, 7),
        totalClaims: boundedInteger(
          rawDailyLogin.totalClaims,
          DEFAULT_SAVE.dailyLogin.totalClaims,
          0,
          Number.MAX_SAFE_INTEGER
        )
      }
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function localDayIndex(date = new Date()): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  );
}

export function dailyLoginOffer(
  data: DailyLoginData,
  today = localDayIndex()
): { available: boolean; streak: number; reward: number } {
  if (data.lastClaimDay === today) {
    return {
      available: false,
      streak: Math.max(1, data.streak),
      reward: 0
    };
  }
  const streak =
    data.lastClaimDay === today - 1
      ? Math.min(7, Math.max(1, data.streak + 1))
      : 1;
  return {
    available: true,
    streak,
    reward: 80 + (streak - 1) * 30
  };
}

export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60).toString().padStart(2, "0")}:${(whole % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function roundHealth(value: number, maximum = Number.POSITIVE_INFINITY): number {
  return Math.max(0, Math.min(Math.round(maximum), Math.round(value)));
}

export function formatRoundedNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  // 底层保留 3 位小数(不引入额外精度损失),玩家看到的是 1 位四舍五入
  return value.toFixed(3);
}

// 玩家可见格式(1 位四舍五入)
export function formatRoundedNumberForDisplay(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

export const SPECIALIZATION_BASE_STAT_BOOST = 7 / 6;
export const SPECIALIZATION_BASE_REDUCTION = 5 / 6;

export function boostedSpecializationStat(value: number): number {
  return value * SPECIALIZATION_BASE_STAT_BOOST;
}

export function boostedSpecializationReduction(value: number): number {
  return value * SPECIALIZATION_BASE_REDUCTION;
}

export function collisionHullAttackMultiplier(gainedMaxHp: number): number {
  // 每 500 HP 提供 20% 加成 → 削弱 1/6,实际每 500 HP + 约 16.67%
  const tiers = Math.floor(Math.max(0, gainedMaxHp) / 500);
  return 1 + tiers * 0.2 * (5 / 6);
}

export function agileCritRateAttackBonus(critChance: number): number {
  return Math.max(0, critChance) * 2;
}

export function agileCritEffectSpeedMultiplier(critEffect: number): number {
  // 每 1% 暴击效果转化为 0.15% 移速(原 0.3%,削弱一半)
  return 1 + Math.max(0, critEffect) * 0.15;
}

// 撞击流派 maxHp>1000 后,Boss 主动撞玩家不再享受免伤:之前 0.75 减伤会让 Boss
// 撞到玩家时几乎不扣血,被 BUG 报告为"双方不互撞"。同时把 Boss 撞玩家的
// 伤害下限设为玩家最大生命的 8%。
export const WHEELCHAIR_BOSS_BONUS_MAX_HP_THRESHOLD = 400;
export const WHEELCHAIR_BOSS_BONUS_SCALE = 1.25;
export const WHEELCHAIR_BOSS_COLLISION_MAX_HP_PERCENT = 0.08;
export function collisionBossDamageScale(
  maxHp: number,
  collisionSpecialization: boolean
): number {
  // 撞击流派任何血量都不再因 maxHp>1000 享受 25% 减伤,改为 maxHp>400 时
  // 把 Boss 撞玩家的伤害再加 25%,确保 boss 对玩家至少 8% 最大生命。
  if (!collisionSpecialization) return 1;
  if (maxHp > WHEELCHAIR_BOSS_BONUS_MAX_HP_THRESHOLD) return WHEELCHAIR_BOSS_BONUS_SCALE;
  return 1;
}

export function minionHealthDamageMultiplier(maxHp: number): number {
  const tiers = Math.floor(Math.max(0, maxHp) / 1000);
  return 1 + tiers * 0.2;
}

export function minionPercentDamageFloor(maxHp: number): number {
  return Math.max(0, maxHp) * 0.05;
}

export function chooseUnique<T extends { id: string }>(
  pool: T[],
  count: number,
  random: () => number = Math.random
): T[] {
  const copy = [...pool];
  const result: T[] = [];
  while (copy.length && result.length < count) {
    result.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return result;
}

// 流派专属强化的 id 前缀(ram_ 属于撞击流派)
const SPECIALIZATION_UPGRADE_PREFIXES = [
  "power_",
  "agile_",
  "defender_",
  "vampire_",
  "devour_",
  "wheelchair_",
  "ram_"
] as const;

// 专属强化相对普通强化的权重:出现概率比其他强化高 200%(权重 3,不保证必出)。
export const SPECIALIZATION_UPGRADE_WEIGHT = 3;

export function isSpecializationUpgradeId(id: string): boolean {
  return SPECIALIZATION_UPGRADE_PREFIXES.some((prefix) => id.startsWith(prefix));
}

// 带权重的不重复抽取:专属强化权重为 SPECIALIZATION_UPGRADE_WEIGHT,其余为 1
export function chooseUniqueWeighted<T extends { id: string }>(
  pool: T[],
  count: number,
  random: () => number = Math.random
): T[] {
  const copy = [...pool];
  const result: T[] = [];
  while (copy.length && result.length < count) {
    const weights = copy.map((item) =>
      isSpecializationUpgradeId(item.id) ? SPECIALIZATION_UPGRADE_WEIGHT : 1
    );
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = random() * total;
    let picked = copy.length - 1;
    for (let i = 0; i < copy.length; i += 1) {
      roll -= weights[i];
      if (roll < 0) {
        picked = i;
        break;
      }
    }
    result.push(copy.splice(picked, 1)[0]);
  }
  return result;
}

export function rewardForRun(mode: GameMode, score: number, victory: boolean): number {
  const base = mode === "boss" ? 30 : mode === "endless" ? 18 : mode === "roguelike" ? 20 : 24;
  return Math.floor(base + score / 2500 + (victory ? 35 : 0));
}
