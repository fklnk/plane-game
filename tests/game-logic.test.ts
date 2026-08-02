import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAVE,
  BOSS_SEQUENCE_LEGENDARY_SKIN,
  DEVOUR_SWALLOW_LEVELS,
  SHADOW_ENDING_SKIN_REWARDS,
  SPECIALIZATION_UPGRADE_WEIGHT,
  SPECIALIZATION_BASE_REDUCTION,
  SPECIALIZATION_BASE_STAT_BOOST,
  agileCritEffectSpeedMultiplier,
  agileCritRateAttackBonus,
  boostedSpecializationReduction,
  boostedSpecializationStat,
  chooseUnique,
  chooseUniqueWeighted,
  isSpecializationUpgradeId,
  collisionBossDamageScale,
  collisionHullAttackMultiplier,
  dailyLoginOffer,
  devourHealingAmount,
  formatRoundedNumber,
  formatRoundedNumberForDisplay,
  formatTime,
  independentBossHealthAfterDamage,
  loadSave,
  minionHealthDamageMultiplier,
  minionPercentDamageFloor,
  roundHealth,
  reactiveArmorRelease,
  rewardForRun,
  WHEELCHAIR_ACTIVE_SKILLS,
  wheelchairActiveDamageTakenMultiplier,
  UPGRADE_EXPERIENCE_SCALE,
  xpToNextLevel
} from "../src/game-logic";
import {
  BOSS_CAMPAIGN_ENCOUNTERS,
  BOSS_CAMPAIGN_POWER_SCALES,
  bossPassiveDropChoices,
  bossPowerDropChoices,
  FINAL_BOSS_STAT_SCALE,
  FINAL_CAMPAIGN_CLEAR_BONUS,
  INCOMPLETE_TRINITY_STAT_SCALE,
  campaignDifficultyForLevel,
  campaignClearScoreRequirement,
  campaignEncounterAttackScale,
  campaignEncounterPowerScale,
  campaignFinalBossStatScale,
  campaignEnemyRoster,
  chaseRemainingHpRatio,
  finalCampaignReward,
  remainingStoreUnlockCost,
  rollCampaignElite,
  rollCampaignMutation
} from "../src/boss-campaign";

describe("progression", () => {
  it("offers exactly three unique Boss powers and guarantees the defeated Boss signature", () => {
    const choices = bossPowerDropChoices("titan", null, () => 0);
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
    expect(choices).toContain("titan_meteor");
  });

  it("keeps the currently equipped Boss power as one of the three choices", () => {
    const choices = bossPowerDropChoices("mirror", "photon_barrage", () => 0.99);
    expect(choices).toHaveLength(3);
    expect(choices).toContain("mirror_copy");
    expect(choices).toContain("photon_barrage");
  });

  it("offers three unique exclusive passives for the shadow-stolen Boss core", () => {
    const choices = bossPassiveDropChoices(["usurper"], [], () => 0);
    expect(choices).toEqual(["usurper_blight", "usurper_override", "usurper_recycle"]);
    expect(new Set(choices).size).toBe(3);
  });

  it("offers one exclusive passive from each trinity Boss", () => {
    const choices = bossPassiveDropChoices(["titan", "mirror", "usurper"], [], () => 0);
    expect(choices).toEqual(["titan_bulwark", "mirror_echo", "usurper_blight"]);
  });

  it("assigns one unique skin to every failure ending and a separate boss legend", () => {
    const endingSkins = Object.values(SHADOW_ENDING_SKIN_REWARDS);
    expect(Object.keys(SHADOW_ENDING_SKIN_REWARDS)).toHaveLength(5);
    expect(new Set(endingSkins).size).toBe(5);
    expect(endingSkins).not.toContain(BOSS_SEQUENCE_LEGENDARY_SKIN);
    expect(BOSS_SEQUENCE_LEGENDARY_SKIN).toBe("campaign_ace_skin");
  });

  it("experience requirements increase monotonically", () => {
    expect(UPGRADE_EXPERIENCE_SCALE).toBe(1.1);
    expect(xpToNextLevel(1)).toBe(57);
    for (let level = 1; level < 40; level += 1) {
      expect(xpToNextLevel(level + 1)).toBeGreaterThan(xpToNextLevel(level));
    }
  });

  it("uses per-difficulty score gates whose increments never shrink", () => {
    // 噩梦档为设计基准
    expect(
      Array.from({ length: 5 }, (_, wave) => campaignClearScoreRequirement(wave, 5))
    ).toEqual([30000, 52500, 80000, 100000, 120000]);
    expect(
      Array.from({ length: 5 }, (_, wave) => campaignClearScoreRequirement(wave, 3))
    ).toEqual([24000, 42000, 64000, 80000, 96000]);
    // 五档难度:门槛递增,且段间增量不得越来越小
    for (let level = 1; level <= 5; level += 1) {
      const gates = Array.from({ length: 5 }, (_, wave) =>
        campaignClearScoreRequirement(wave, level)
      );
      const deltas = gates.slice(1).map((gate, i) => gate - gates[i]);
      for (let i = 0; i < deltas.length; i += 1) {
        expect(deltas[i]).toBeGreaterThan(0);
        if (i > 0) expect(deltas[i]).toBeGreaterThanOrEqual(deltas[i - 1] * 0.7);
      }
      // 难度越高门槛越高
      if (level > 1) {
        expect(gates[4]).toBeGreaterThan(campaignClearScoreRequirement(4, level - 1));
      }
    }
  });

  it("draws unique options", () => {
    const pool = ["a", "b", "c", "d"].map((id) => ({ id }));
    const result = chooseUnique(pool, 3, () => 0);
    expect(new Set(result.map((item) => item.id)).size).toBe(3);
  });

  it("identifies specialization upgrades by id prefix", () => {
    expect(isSpecializationUpgradeId("power_flamethrower")).toBe(true);
    expect(isSpecializationUpgradeId("agile_lunge")).toBe(true);
    expect(isSpecializationUpgradeId("ram_mass")).toBe(true);
    expect(isSpecializationUpgradeId("laser")).toBe(false);
    expect(isSpecializationUpgradeId("speed")).toBe(false);
  });

  it("weights specialization upgrades 15% higher and keeps picks unique", () => {
    expect(SPECIALIZATION_UPGRADE_WEIGHT).toBe(1.15);
    // 池:1 个专属(权重 1.15) + 1 个普通(权重 1),总权重 2.15
    const pool = [{ id: "power_flamethrower" }, { id: "laser" }];
    // roll = 0.53 → 0.53 * 2.15 = 1.1395 < 1.15,落在专属区间
    expect(chooseUniqueWeighted(pool, 1, () => 0.53)[0].id).toBe("power_flamethrower");
    // roll = 0.54 → 1.161 > 1.15,越过专属落到普通
    expect(chooseUniqueWeighted(pool, 1, () => 0.54)[0].id).toBe("laser");
    // 抽满时两者都在,且不重复
    expect(new Set(chooseUniqueWeighted(pool, 2, () => 0.5).map((i) => i.id)).size).toBe(2);
  });

  it("recovers from corrupt saves", () => {
    expect(loadSave("{broken")).toEqual(DEFAULT_SAVE);
  });

  it("migrates legacy fighter selections and achievement data", () => {
    const migrated = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        selectedShip: "dawn",
        unlockedShips: ["dawn"],
        achievements: { first_blood: "2026-07-27T00:00:00.000Z" }
      })
    );
    expect(migrated.selectedShip).toBe("balanced");
    expect(migrated.unlockedShips).toHaveLength(4);
    expect(migrated.achievements.first_blood).toBe("2026-07-27T00:00:00.000Z");
  });

  it("repairs invalid specialization and skin ownership", () => {
    const migrated = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        selectedSpecialization: "sniper",
        unlockedSkins: ["inferno", "after_storm_skin"],
        equippedSkin: "inferno"
      })
    );
    expect(migrated.selectedSpecialization).toBe("power");
    expect(migrated.unlockedSkins).toEqual(["standard", "after_storm_skin"]);
    expect(migrated.equippedSkin).toBe("standard");
  });

  it("sanitizes corrupt numeric, settings and progression fields", () => {
    const repaired = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        starCores: -99,
        permanentUpgrades: {
          hull: 999,
          firepower: -3,
          engine: 2.9,
          armor: "ten",
          recovery: 4,
          emergency: 2,
          reroll: 99
        },
        settings: {
          musicVolume: 8,
          sfxVolume: -2,
          screenShake: "yes",
          damageNumbers: false,
          quality: "ultra"
        },
        records: {
          campaignWins: -5,
          highestUnlockedLevel: 999,
          endlessBestSeconds: -20,
          endlessBestScore: 12.9,
          bossRushBestMs: -1
        },
        achievements: { valid: "2026-08-01", invalid: 42 },
        dailyLogin: { lastClaimDay: "today", streak: 99, totalClaims: -1 }
      })
    );
    expect(repaired.starCores).toBe(0);
    expect(repaired.permanentUpgrades).toEqual({
      hull: 15,
      firepower: 0,
      engine: 2,
      armor: 0,
      recovery: 4,
      emergency: 2,
      reroll: 6
    });
    expect(repaired.settings).toEqual({
      musicVolume: 1,
      sfxVolume: 0,
      screenShake: true,
      damageNumbers: false,
      quality: "low"
    });
    expect(repaired.records).toEqual({
      campaignWins: 0,
      highestUnlockedLevel: 5,
      endlessBestSeconds: 0,
      endlessBestScore: 12,
      bossRushBestMs: 0
    });
    expect(repaired.achievements).toEqual({ valid: "2026-08-01" });
    expect(repaired.dailyLogin).toEqual({ lastClaimDay: null, streak: 7, totalClaims: 0 });
  });

  it("migrates the legacy assault doctrine to power", () => {
    const migrated = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        selectedSpecialization: "assault"
      })
    );
    expect(migrated.selectedSpecialization).toBe("power");
  });

  it("accepts the wheelchair collision doctrine", () => {
    const migrated = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        selectedSpecialization: "wheelchair"
      })
    );
    expect(migrated.selectedSpecialization).toBe("wheelchair");
  });

  it("formats time and rewards wins", () => {
    expect(formatTime(125)).toBe("02:05");
    expect(roundHealth(74.49, 100)).toBe(74);
    expect(roundHealth(74.5, 100)).toBe(75);
    expect(roundHealth(101.4, 100)).toBe(100);
    expect(rewardForRun("campaign", 5000, true)).toBeGreaterThan(
      rewardForRun("campaign", 5000, false)
    );
  });

  it("rounds visible values to an integer or one decimal place", () => {
    // 底层统一保留 3 位小数,不暴露浮点尾数
    expect(formatRoundedNumber(2.4000000000000004)).toBe("2.400");
    expect(formatRoundedNumber(2.4449)).toBe("2.445");
    expect(formatRoundedNumber(3)).toBe("3.000");
    // 玩家可见值:整数不带小数位,非整数最多一位
    expect(formatRoundedNumberForDisplay(2.4000000000000004)).toBe("2.4");
    expect(formatRoundedNumberForDisplay(2.44)).toBe("2.4");
    expect(formatRoundedNumberForDisplay(2.45)).toBe("2.5");
    expect(formatRoundedNumberForDisplay(3)).toBe("3");
  });

  it("raises specialization base stats by one sixth without changing size", () => {
    expect(SPECIALIZATION_BASE_STAT_BOOST).toBeCloseTo(7 / 6);
    expect(SPECIALIZATION_BASE_REDUCTION).toBeCloseTo(5 / 6);
    expect(boostedSpecializationStat(6)).toBeCloseTo(7);
    expect(boostedSpecializationReduction(1)).toBeCloseTo(5 / 6);
  });

  it("scales collision attack by 16.67% for every 500 gained max health", () => {
    expect(collisionHullAttackMultiplier(0)).toBe(1);
    expect(collisionHullAttackMultiplier(499)).toBe(1);
    expect(collisionHullAttackMultiplier(500)).toBeCloseTo(1 + 0.2 * (5 / 6));
    expect(collisionHullAttackMultiplier(1000)).toBeCloseTo(1 + 0.4 * (5 / 6));
    expect(collisionHullAttackMultiplier(-500)).toBe(1);
  });

  it("uses the strengthened agile crit conversions", () => {
    expect(agileCritRateAttackBonus(0.01)).toBeCloseTo(0.02);
    expect(agileCritRateAttackBonus(0.1)).toBeCloseTo(0.2);
    // 暴击效果 → 移速:每 1% 暴击效果 +0.3% 移速
    expect(agileCritEffectSpeedMultiplier(0.01)).toBeCloseTo(1.003);
    expect(agileCritEffectSpeedMultiplier(1.2)).toBeCloseTo(1.36);
  });

  it("scales boss damage on the collision build by max health tier", () => {
    // 撞击流派任何血量都不再 0.75 减伤;maxHp>400 时再加 25%
    expect(collisionBossDamageScale(0, true)).toBe(1);
    expect(collisionBossDamageScale(400, true)).toBe(1);
    expect(collisionBossDamageScale(500, true)).toBe(1.25);
    expect(collisionBossDamageScale(5000, true)).toBe(1.25);
    expect(collisionBossDamageScale(5000, false)).toBe(1);
  });

  it("maps the three collision active skills to the selected combat values", () => {
    expect(WHEELCHAIR_ACTIVE_SKILLS.breachHorn).toMatchObject({
      cooldownMs: 12000,
      distance: 500,
      ramDamageMultiplier: 3,
      protectionMs: 800
    });
    expect(WHEELCHAIR_ACTIVE_SKILLS.reactiveArmor).toMatchObject({
      cooldownMs: 20000,
      durationMs: 4000,
      damageTakenMultiplier: 0.35,
      releaseMultiplier: 3,
      releaseHealRatio: 0.3
    });
    expect(WHEELCHAIR_ACTIVE_SKILLS.fortressStance).toMatchObject({
      cooldownMs: 24000,
      durationMs: 5000,
      damageTakenMultiplier: 0.5,
      sizeMultiplier: 1.5,
      speedMultiplier: 0.8
    });
  });

  it("uses the strongest active collision defense without multiplicative stacking", () => {
    expect(wheelchairActiveDamageTakenMultiplier(false, false, false)).toBe(1);
    expect(wheelchairActiveDamageTakenMultiplier(false, true, false)).toBe(0.35);
    expect(wheelchairActiveDamageTakenMultiplier(false, true, true)).toBe(0.35);
    expect(wheelchairActiveDamageTakenMultiplier(true, true, true)).toBe(0.3);
  });

  it("releases reactive armor as triple damage and heals thirty percent", () => {
    expect(reactiveArmorRelease(100)).toEqual({ damage: 300, healing: 90 });
    expect(reactiveArmorRelease(-50)).toEqual({ damage: 0, healing: 0 });
  });

  it("damages only the selected trinity Boss and derives the shared bar from all three", () => {
    const health = [1000, 1000, 1000];
    health[1] = independentBossHealthAfterDamage(health[1], 250);
    expect(health).toEqual([1000, 750, 1000]);
    expect(health.reduce((sum, value) => sum + value, 0)).toBe(2750);
    expect(independentBossHealthAfterDamage(250, 500)).toBe(0);
    expect(independentBossHealthAfterDamage(250, -50)).toBe(250);
  });

  it("scales minion damage every 1000 max health with a 5% health floor", () => {
    expect(minionHealthDamageMultiplier(999)).toBe(1);
    expect(minionHealthDamageMultiplier(1000)).toBe(1.2);
    expect(minionHealthDamageMultiplier(2000)).toBe(1.4);
    expect(minionPercentDamageFloor(1000)).toBe(50);
    expect(minionPercentDamageFloor(2500)).toBe(125);
  });

  it("adds all three devour healing sources", () => {
    expect(devourHealingAmount(100, 50, 200)).toBe(10);
    expect(devourHealingAmount(-100, Number.NaN, 250)).toBe(10);
  });

  it("raises devour size, defense and max-health gain without exceeding six health", () => {
    expect(DEVOUR_SWALLOW_LEVELS.map((tier) => tier.maxHealthGain)).toEqual([
      1.5, 2.5, 3.5, 4.5, 6
    ]);
    expect(DEVOUR_SWALLOW_LEVELS.at(-1)?.maxHealthGain).toBe(6);
    expect(DEVOUR_SWALLOW_LEVELS.at(-1)?.sizeGain).toBeGreaterThan(
      DEVOUR_SWALLOW_LEVELS[0].sizeGain
    );
    expect(DEVOUR_SWALLOW_LEVELS.map((tier) => tier.maxSizeMultiplier)).toEqual([
      2, 2.15, 2.3, 2.45, 2.6
    ]);
    expect(DEVOUR_SWALLOW_LEVELS.at(-1)?.maxSizeMultiplier).toBe(
      DEVOUR_SWALLOW_LEVELS[0].maxSizeMultiplier * 1.3
    );
    expect(DEVOUR_SWALLOW_LEVELS.at(-1)?.damageTakenMultiplier).toBe(0.8);
  });

  it("keeps the last selected mode, difficulty and multiplayer variant", () => {
    const migrated = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        lastMode: "boss",
        lastLevel: 5,
        lastVariant: "coop",
        lastShip2: "lightning"
      })
    );
    expect(migrated.lastMode).toBe("boss");
    expect(migrated.lastLevel).toBe(5);
    expect(migrated.lastVariant).toBe("coop");
    expect(migrated.lastShip2).toBe("lightning");
  });

  it("calculates daily login streaks, resets missed days and prevents duplicate claims", () => {
    expect(
      dailyLoginOffer({ lastClaimDay: null, streak: 0, totalClaims: 0 }, 100)
    ).toEqual({ available: true, streak: 1, reward: 80 });
    expect(
      dailyLoginOffer({ lastClaimDay: 99, streak: 3, totalClaims: 3 }, 100)
    ).toEqual({ available: true, streak: 4, reward: 170 });
    expect(
      dailyLoginOffer({ lastClaimDay: 98, streak: 6, totalClaims: 6 }, 100)
    ).toEqual({ available: true, streak: 1, reward: 80 });
    expect(
      dailyLoginOffer({ lastClaimDay: 100, streak: 4, totalClaims: 4 }, 100)
    ).toEqual({ available: false, streak: 4, reward: 0 });
  });
});

describe("nine battle boss campaign", () => {
  it("contains the requested nine encounters in order", () => {
    expect(BOSS_CAMPAIGN_ENCOUNTERS).toHaveLength(9);
    expect(BOSS_CAMPAIGN_ENCOUNTERS.map(({ kind, bossKind }) => [kind, bossKind])).toEqual([
      ["boss", "titan"],
      ["chase", "shadow"],
      ["boss", "mirror"],
      ["chase", "shadow"],
      ["boss", "usurper"],
      ["chase", "shadow"],
      ["trinity", "titan"],
      ["shadow_final", "shadow"],
      ["dark_deity", "dark_deity"]
    ]);
    expect([1, 3, 5].map(chaseRemainingHpRatio)).toEqual([0.5, 0.25, 0.125]);
  });

  it("uses the exact boss and pursuit strength progression", () => {
    expect(BOSS_CAMPAIGN_POWER_SCALES).toEqual([
      1,
      7 / 6,
      4 / 3,
      17 / 12,
      3 / 2,
      19 / 12
    ]);
    expect([0, 1, 2, 3, 4, 5].map(campaignEncounterPowerScale)).toEqual([
      1,
      7 / 6,
      4 / 3,
      17 / 12,
      3 / 2,
      19 / 12
    ]);
  });

  it("reduces the incomplete trinity and both final bosses by one third", () => {
    expect(INCOMPLETE_TRINITY_STAT_SCALE).toBe(2 / 3);
    expect(FINAL_BOSS_STAT_SCALE).toBe(2 / 3);
    expect(campaignEncounterAttackScale(6)).toBe(2 / 3);
    expect(campaignEncounterAttackScale(7)).toBe(2 / 3);
    expect(campaignEncounterAttackScale(8)).toBe(2 / 3);
    expect(campaignFinalBossStatScale(6)).toBe(1);
    expect(campaignFinalBossStatScale(7)).toBe(2 / 3);
    expect(campaignFinalBossStatScale(8)).toBe(2 / 3);
  });

  it("maps normal, hard and nightmare elite/mutation rules", () => {
    expect(campaignDifficultyForLevel(3).id).toBe("normal");
    expect(campaignDifficultyForLevel(4).id).toBe("hard");
    expect(campaignDifficultyForLevel(5).id).toBe("nightmare");
    expect(rollCampaignElite(3, () => 0)).toBe(false);
    expect(rollCampaignElite(4, () => 0.49)).toBe(true);
    expect(rollCampaignElite(4, () => 0.5)).toBe(false);
    expect(rollCampaignElite(5, () => 0.74)).toBe(true);
    expect(rollCampaignElite(5, () => 0.75)).toBe(false);
    expect(rollCampaignMutation(5, () => 0.24)).toBe(true);
    expect(rollCampaignMutation(5, () => 0.25)).toBe(false);
  });

  it("unlocks more minion types after each original boss", () => {
    expect(campaignEnemyRoster(0)).toEqual(["scout", "interceptor"]);
    expect(campaignEnemyRoster(1)).toContain("striker");
    expect(campaignEnemyRoster(2)).toContain("mine_layer");
    expect(campaignEnemyRoster(3)).toEqual([
      "scout",
      "interceptor",
      "striker",
      "suppressor",
      "mine_layer",
      "courier",
      "gunship",
      "bomber"
    ]);
  });

  it("final reward can cover every remaining shop purchase", () => {
    const emptyUpgrades = {
      hull: 0,
      firepower: 0,
      engine: 0,
      armor: 0,
      recovery: 0,
      emergency: 0,
      reroll: 0
    };
    expect(remainingStoreUnlockCost(emptyUpgrades, ["standard"])).toBe(16232);
    expect(FINAL_CAMPAIGN_CLEAR_BONUS).toBe(1888);
    expect(finalCampaignReward(emptyUpgrades, ["standard"])).toBe(18120);
    expect(
      remainingStoreUnlockCost(
        { hull: 15, firepower: 15, engine: 13, armor: 13, recovery: 11, emergency: 8, reroll: 6 },
        ["standard"]
      )
    ).toBe(0);
  });
});
