export type GameMode = "campaign" | "boss" | "endless";
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
  | "aurora"
  | "inferno"
  | "void"
  | "after_storm_skin"
  | "fell_short_skin"
  | "boss_slayer_skin"
  | "campaign_ace_skin";
export type PlayVariantId = "single" | "coop" | "score_duel";

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
  unlockedSkins: SkinId[];
  equippedSkin: SkinId;
  permanentUpgrades: Record<string, number>;
  settings: {
    musicVolume: number;
    sfxVolume: number;
    screenShake: boolean;
    damageNumbers: boolean;
    quality: "low" | "high";
  };
  records: {
    campaignWins: number;
    highestUnlockedLevel: number;
    endlessBestSeconds: number;
    endlessBestScore: number;
    bossRushBestMs: number | null;
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
    quality: "low"
  },
  records: {
    campaignWins: 0,
    highestUnlockedLevel: 1,
    endlessBestSeconds: 0,
    endlessBestScore: 0,
    bossRushBestMs: null
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
      "aurora",
      "inferno",
      "void",
      "after_storm_skin",
      "fell_short_skin",
      "boss_slayer_skin",
      "campaign_ace_skin"
    ];
    const validModes: GameMode[] = ["campaign", "endless", "boss"];
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
    const unlockedSkins = validSkins.filter((skin) =>
      (parsed.unlockedSkins ?? ["standard"]).includes(skin)
    );
    if (!unlockedSkins.includes("standard")) unlockedSkins.unshift("standard");
    const equippedSkin =
      validSkins.includes(parsed.equippedSkin as SkinId) &&
      unlockedSkins.includes(parsed.equippedSkin as SkinId)
        ? (parsed.equippedSkin as SkinId)
        : "standard";
    return {
      ...structuredClone(DEFAULT_SAVE),
      ...parsed,
      settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings ?? {}) },
      records: { ...DEFAULT_SAVE.records, ...(parsed.records ?? {}) },
      permanentUpgrades: {
        ...DEFAULT_SAVE.permanentUpgrades,
        ...(parsed.permanentUpgrades ?? {})
      },
      selectedShip,
      selectedSpecialization,
      unlockedSkins,
      equippedSkin,
      unlockedShips: validShips,
      achievements: { ...(parsed.achievements ?? {}) },
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
        ...DEFAULT_SAVE.dailyLogin,
        ...(parsed.dailyLogin ?? {})
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
  const tiers = Math.floor(Math.max(0, gainedMaxHp) / 500);
  return 1 + tiers * 0.2;
}

export function agileCritRateAttackBonus(critChance: number): number {
  return Math.max(0, critChance) * 2;
}

export function agileCritEffectSpeedMultiplier(critEffect: number): number {
  // 减半:原本 +100% 移速,现在 +50%
  return 1 + Math.max(0, critEffect) * 0.5;
}

export function collisionBossDamageScale(
  maxHp: number,
  collisionSpecialization: boolean
): number {
  return collisionSpecialization && maxHp > 1000 ? 0.75 : 1;
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

export function rewardForRun(mode: GameMode, score: number, victory: boolean): number {
  const base = mode === "boss" ? 30 : mode === "endless" ? 18 : 24;
  return Math.floor(base + score / 2500 + (victory ? 35 : 0));
}
