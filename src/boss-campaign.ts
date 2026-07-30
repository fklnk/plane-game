export type CampaignBossKind = "titan" | "mirror" | "usurper" | "shadow" | "dark_deity";

export type BossCampaignEncounterKind =
  | "boss"
  | "chase"
  | "trinity"
  | "shadow_final"
  | "dark_deity";

export interface BossCampaignEncounter {
  index: number;
  code: string;
  title: string;
  kind: BossCampaignEncounterKind;
  bossKind: CampaignBossKind;
  chaseDamageTarget?: number;
}

export type BossCampaignDifficultyId = "normal" | "hard" | "nightmare";

export interface BossCampaignDifficulty {
  id: BossCampaignDifficultyId;
  name: string;
  description: string;
  eliteChance: number;
  mutationChance: number;
  rewardMultiplier: number;
}

export const BOSS_CAMPAIGN_ENCOUNTERS: BossCampaignEncounter[] = [
  {
    index: 0,
    code: "ACT 01 / TITAN",
    title: "裂渊泰坦",
    kind: "boss",
    bossKind: "titan"
  },
  {
    index: 1,
    code: "ACT 02 / PURSUIT",
    title: "追逐黑影 · 半血拦截",
    kind: "chase",
    bossKind: "shadow",
    chaseDamageTarget: 0.5
  },
  {
    index: 2,
    code: "ACT 03 / MIRROR",
    title: "镜像猎手",
    kind: "boss",
    bossKind: "mirror"
  },
  {
    index: 3,
    code: "ACT 04 / PURSUIT",
    title: "追逐黑影 · 四分之三拦截",
    kind: "chase",
    bossKind: "shadow",
    chaseDamageTarget: 0.75
  },
  {
    index: 4,
    code: "ACT 05 / USURPER",
    title: "技能篡夺者",
    kind: "boss",
    bossKind: "usurper"
  },
  {
    index: 5,
    code: "ACT 06 / PURSUIT",
    title: "追逐黑影 · 八分之七拦截",
    kind: "chase",
    bossKind: "shadow",
    chaseDamageTarget: 0.875
  },
  {
    index: 6,
    code: "ACT 07 / TRINITY",
    title: "不完全三神共斗",
    kind: "trinity",
    bossKind: "titan"
  },
  {
    index: 7,
    code: "ACT 08 / SHADOW",
    title: "力量掠夺者 · 黑影",
    kind: "shadow_final",
    bossKind: "shadow"
  },
  {
    index: 8,
    code: "ACT 09 / TRUE FORM",
    title: "黑暗魔神飞机",
    kind: "dark_deity",
    bossKind: "dark_deity"
  }
];

/**
 * The opening six encounters are three boss-and-pursuit pairs. Each pursuit
 * sits halfway between the boss whose power the Shadow stole and the next tier;
 * the third pursuit continues that half-step beyond Boss 3.
 */
export const BOSS_CAMPAIGN_POWER_SCALES = [
  1,
  7 / 6,
  4 / 3,
  17 / 12,
  3 / 2,
  19 / 12
] as const;

export const INCOMPLETE_TRINITY_STAT_SCALE = 2 / 3;
export const FINAL_BOSS_STAT_SCALE = 2 / 3;
export const FINAL_CAMPAIGN_CLEAR_BONUS = 1888;
export const CAMPAIGN_CLEAR_SCORE_SCALE = 1.25;

/**
 * Ordinary campaign clearing phases use the score pacing from the previous
 * campaign flow, with the requested 25% extension. Boss Rush skips these
 * phases entirely.
 */
export function campaignClearScoreRequirement(waveNumber: number, level: number): number {
  const wave = Math.max(0, Math.min(4, Math.floor(waveNumber)));
  const threatLevel = Math.max(1, Math.min(5, Math.floor(level)));
  const originalRequirement =
    wave === 0
      ? 20000
      : 23000 + wave * 9000 + threatLevel * 1500;
  return Math.round(originalRequirement * CAMPAIGN_CLEAR_SCORE_SCALE);
}

export function campaignEncounterPowerScale(encounterIndex: number): number {
  return BOSS_CAMPAIGN_POWER_SCALES[encounterIndex] ?? 1;
}

export function campaignFinalBossStatScale(encounterIndex: number): number {
  const kind = BOSS_CAMPAIGN_ENCOUNTERS[encounterIndex]?.kind;
  return kind === "shadow_final" || kind === "dark_deity" ? FINAL_BOSS_STAT_SCALE : 1;
}

/**
 * Central multiplier for campaign damage paths. The incomplete trinity and the
 * last two bosses retain two thirds of their pre-balance combat values.
 */
export function campaignEncounterAttackScale(encounterIndex: number): number {
  const kind = BOSS_CAMPAIGN_ENCOUNTERS[encounterIndex]?.kind;
  if (kind === "trinity") return INCOMPLETE_TRINITY_STAT_SCALE;
  if (kind === "shadow_final" || kind === "dark_deity") return FINAL_BOSS_STAT_SCALE;
  return campaignEncounterPowerScale(encounterIndex);
}

export const BOSS_CAMPAIGN_DIFFICULTIES: Record<
  BossCampaignDifficultyId,
  BossCampaignDifficulty
> = {
  normal: {
    id: "normal",
    name: "普通",
    description: "所有敌军与 Boss 均为普通形态，不出现突变。",
    eliteChance: 0,
    mutationChance: 0,
    rewardMultiplier: 1
  },
  hard: {
    id: "hard",
    name: "困难",
    description: "普通与精英敌军各占约 50%，Boss 也有一半概率进入精英形态。",
    eliteChance: 0.5,
    mutationChance: 0,
    rewardMultiplier: 1.55
  },
  nightmare: {
    id: "nightmare",
    name: "噩梦",
    description: "全员精英；25% 小兵与 25% Boss 会额外获得其他单位的突变能力。",
    eliteChance: 1,
    mutationChance: 0.25,
    rewardMultiplier: 2.35
  }
};

export function campaignDifficultyForLevel(level: number): BossCampaignDifficulty {
  if (level >= 5) return BOSS_CAMPAIGN_DIFFICULTIES.nightmare;
  if (level >= 4) return BOSS_CAMPAIGN_DIFFICULTIES.hard;
  return BOSS_CAMPAIGN_DIFFICULTIES.normal;
}

export function rollCampaignElite(level: number, random: () => number = Math.random): boolean {
  return random() < campaignDifficultyForLevel(level).eliteChance;
}

export function rollCampaignMutation(
  level: number,
  random: () => number = Math.random
): boolean {
  return random() < campaignDifficultyForLevel(level).mutationChance;
}

export function chaseRemainingHpRatio(encounterIndex: number): number | null {
  const target = BOSS_CAMPAIGN_ENCOUNTERS[encounterIndex]?.chaseDamageTarget;
  return target === undefined ? null : 1 - target;
}

export function campaignEnemyRoster(bossesDefeated: number): string[] {
  const roster = ["scout", "interceptor"];
  if (bossesDefeated >= 1) roster.push("striker", "suppressor");
  if (bossesDefeated >= 2) roster.push("mine_layer", "courier");
  if (bossesDefeated >= 3) roster.push("gunship", "bomber");
  return roster;
}

export function remainingStoreUnlockCost(
  permanentUpgrades: Record<string, number>,
  unlockedSkins: string[]
): number {
  const caps: Record<string, number> = {
    hull: 12,
    firepower: 12,
    engine: 10,
    armor: 10,
    recovery: 8,
    emergency: 5,
    reroll: 3
  };
  let cost = 0;
  for (const [id, cap] of Object.entries(caps)) {
    for (let level = Math.max(0, permanentUpgrades[id] ?? 0); level < cap; level += 1) {
      cost += 40 + level * 28;
    }
  }
  const skinCosts: Record<string, number> = {
    standard: 0,
    aurora: 180,
    inferno: 300,
    void: 520
  };
  for (const [skin, skinCost] of Object.entries(skinCosts)) {
    if (!unlockedSkins.includes(skin)) cost += skinCost;
  }
  return cost;
}

export function finalCampaignReward(
  permanentUpgrades: Record<string, number>,
  unlockedSkins: string[]
): number {
  return (
    remainingStoreUnlockCost(permanentUpgrades, unlockedSkins) +
    FINAL_CAMPAIGN_CLEAR_BONUS
  );
}
