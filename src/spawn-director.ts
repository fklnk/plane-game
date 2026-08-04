// 敌群导演：小兵/掉落生成、威胁强度与刷兵排期、Boss 降临前的战场清空。
// 以 mixin 形式混入 BattleScene，运行时 this 即场景实例。
import Phaser from "phaser";
import {
  campaignDifficultyForLevel,
  campaignEnemyRoster,
  rollCampaignElite,
  rollCampaignMutation,
  rollMinionMutationKind
} from "./boss-campaign";
import {
  LEVELS,
  type EnemyMutation,
  type EnemyType,
  MINION_MUTATION_COLORS,
  type TemporarySkill,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "./data";
import {
  enemyUpgradeScale,
  isNineBattleMode,
  selectedLevel,
  selectedMode
} from "./runtime-state";
import type { BattleScene } from "./main";

type Constructor<T = object> = new (...args: any[]) => T;

export function SpawnDirectorMixin<TBase extends Constructor<Phaser.Scene>>(Base: TBase) {
  abstract class SpawnDirector extends Base {
    spawnFlightToken(this: BattleScene): void {
      const value = 2 + selectedLevel + this.bossTier;
      const token = this.pickups.get(
        Phaser.Math.Between(80, WORLD_WIDTH - 80),
        -50,
        "starCoreTokenArt"
      ) as Phaser.Physics.Arcade.Image;
      token.enableBody(true, token.x, -50, true, true);
      token
        .setTexture("starCoreTokenArt")
        .clearTint()
        .setDisplaySize(46, 46)
        .setDepth(7)
        .setData({ kind: "token", value })
        .setVelocity(Phaser.Math.Between(-42, 42), Phaser.Math.Between(115, 165))
        .setAngularVelocity(120);
    }

    spawnExperiencePickup(this: BattleScene, x: number, y: number, value: number): void {
      // 小兵/boss 掉落的升级代币减半(玩家升级速度不变,仅掉落实体减半)
      const finalValue = Math.max(1, Math.round(value * 0.5 * (this.xpMultiplier ?? 1)));
      const pickup = this.pickups.get(x, y, "starCoreTokenArt") as Phaser.Physics.Arcade.Image;
      pickup.enableBody(true, x, y, true, true);
      pickup
        .setTexture("starCoreTokenArt")
        .clearTint()
        .setDisplaySize(34, 34)
        .setDepth(6)
        .setData({ kind: "xp", value: finalValue })
        .setAngularVelocity(90)
        .setVelocity(Phaser.Math.Between(-35, 35), 55);
    }

    spawnSkillPickup(
      this: BattleScene,
      x = Phaser.Math.Between(90, WORLD_WIDTH - 90),
      y = -60
    ): void {
      const skills: TemporarySkill[] = [
        "overdrive",
        "prism",
        "singularity",
        "rapidfire",
        "ironclad"
      ];
      const skill = Phaser.Utils.Array.GetRandom(skills);
      // 5 种技能在统一青色基础上做细微差别,不再花里胡哨
      const tints: Record<TemporarySkill, number> = {
        overdrive: 0x2df4ff,
        prism: 0x6effe9,
        singularity: 0x2df4ff,
        rapidfire: 0x9ff7ff,
        ironclad: 0x2df4ff
      };
      const pickup = this.pickups.get(x, y, "skillPickup") as Phaser.Physics.Arcade.Image;
      pickup.enableBody(true, x, y, true, true);
      pickup
        .setTexture("skillPickup")
        .clearTint()
        .setTint(tints[skill])
        .setDisplaySize(54, 54)
        .setDepth(8)
        .setData({ kind: "skill", value: skill })
        .setVelocity(Phaser.Math.Between(-55, 55), Phaser.Math.Between(105, 145))
        .setAngularVelocity(150);
    }

    spawnEnemy(this: BattleScene, time: number, forcedType?: string): Phaser.Physics.Arcade.Image {
      const levelConfig = LEVELS[selectedLevel - 1];
      const scorePressure = Math.min(3.2, (this.score + this.score2) / Math.max(3200, this.nextBossScore));
      const intensity =
        0.78 +
        levelConfig.danger * 0.08 +
        this.elapsedSeconds / 240 +
        scorePressure * 0.32 +
        this.bossTier * 0.09;
      const roll = Math.random();
      let rolledType: EnemyType =
        roll > 0.94
          ? "courier"
          : roll > 0.88 && this.elapsedSeconds > 55
            ? "bomber"
            : roll > 0.8 && this.elapsedSeconds > 38
              ? "gunship"
              : roll > 0.68 && this.elapsedSeconds > 28
                ? "mine_layer"
                : roll > 0.52 && this.elapsedSeconds > 18
                  ? "suppressor"
                  : roll > 0.34 && this.elapsedSeconds > 10
                    ? "striker"
                    : roll > 0.17
                      ? "interceptor"
                      : "scout";
      if (isNineBattleMode() && !forcedType) {
        rolledType = Phaser.Utils.Array.GetRandom(
          campaignEnemyRoster(this.campaignBossesDefeated)
        ) as EnemyType;
      }
      const forcedElite = forcedType?.startsWith("elite_") ?? false;
      const rawType = (forcedType?.replace(/^elite_/, "") ?? rolledType) as EnemyType;
      const validTypes: EnemyType[] = [
        "scout",
        "interceptor",
        "striker",
        "suppressor",
        "mine_layer",
        "gunship",
        "bomber",
        "courier"
      ];
      const type: EnemyType = validTypes.includes(rawType) ? rawType : "scout";
      const eliteChance = Phaser.Math.Clamp(
        0.06 + levelConfig.danger * 0.014 + this.bossTier * 0.025 + this.elapsedSeconds / 1500,
        0.07,
        0.34
      );
      // 精英:调用方强制指定 elite_ 前缀时必为精英,否则按难度/压力概率决定。
      // Boss 召唤等指定兵种的生成同样参与掷骰,因此也可以是精英。
      const eliteVariant =
        forcedElite ||
        (isNineBattleMode() ? rollCampaignElite(selectedLevel) : Math.random() < eliteChance);
      // 突变独立于精英:普通小兵也可以突变,精英同样可以叠加突变
      const mutated = rollCampaignMutation(selectedLevel);
      const mutation: EnemyMutation | null = mutated
        ? rollMinionMutationKind()
        : null;
      const eliteClass = eliteVariant || type === "gunship" || type === "bomber";
      const textures: Record<EnemyType, string> = {
        scout: "enemyScoutArt",
        interceptor: "enemyInterceptorArt",
        striker: "enemyStrikerArt",
        suppressor: "enemySuppressorArt",
        mine_layer: "enemyMineLayerArt",
        gunship: "enemyGunshipArt",
        bomber: "enemyBomberArt",
        courier: "enemyCourierArt"
      };
      const eliteTextures: Record<EnemyType, string> = {
        scout: "enemyEliteScoutArt",
        interceptor: "enemyEliteInterceptorArt",
        striker: "enemyEliteStrikerArt",
        suppressor: "enemyEliteSuppressorArt",
        mine_layer: "enemyEliteMineLayerArt",
        gunship: "enemyEliteArt",
        bomber: "enemyEliteBomberArt",
        courier: "enemyEliteCourierArt"
      };
      const texture = eliteVariant ? eliteTextures[type] : textures[type];
      const enemy = this.enemies.get(Phaser.Math.Between(70, WORLD_WIDTH - 70), -80, texture) as Phaser.Physics.Arcade.Image;
      enemy.enableBody(true, enemy.x, -80, true, true);
      enemy
        .setTexture(texture)
        .setDepth(eliteVariant ? 9 : 7)
        .setActive(true)
        .setVisible(true)
        .setAlpha(1)
        .clearTint()
        .setAngle(
          (!eliteVariant && type === "interceptor") || (eliteVariant && type === "gunship")
            ? 180
            : 0
        );
      const displaySizes: Record<EnemyType, { width: number; height: number }> = {
        scout: { width: 68, height: 76 },
        interceptor: { width: 78, height: 88 },
        striker: { width: 92, height: 104 },
        suppressor: { width: 112, height: 116 },
        mine_layer: { width: 126, height: 132 },
        gunship: { width: 142, height: 154 },
        bomber: { width: 166, height: 174 },
        courier: { width: 86, height: 94 }
      };
      const displaySize = displaySizes[type];
      enemy.setDisplaySize(
        displaySize.width * (eliteVariant ? 1.12 : 1),
        displaySize.height * (eliteVariant ? 1.12 : 1)
      );
      (enemy.body as Phaser.Physics.Arcade.Body).setSize(
        enemy.width * (eliteClass ? 0.66 : 0.58),
        enemy.height * 0.72,
        true
      );
      const baseHp = (
        {
          scout: 36,
          interceptor: 32,
          striker: 60,
          suppressor: 82,
          mine_layer: 115,
          gunship: 185,
          bomber: 270,
          courier: 52
        } as Record<EnemyType, number>
      )[type];
      // 第一波(0-30s)用更陡的难度曲线,之后还原
      const firstWave = this.elapsedSeconds < 30;
      const hp =
        baseHp *
        (firstWave ? 1.25 : 1) *
        (1 + this.elapsedSeconds * (firstWave ? 0.0062 : 0.0035) + scorePressure * (firstWave ? 0.32 : 0.24) + levelConfig.danger * (firstWave ? 0.085 : 0.06)) *
        enemyUpgradeScale() *
        (eliteVariant ? 2.15 : 1) *
        (mutation === "armor" ? 1.55 : mutated ? 1.18 : 1) *
        (this.elapsedSeconds >= 240 ? 2 : 1); // 4 分钟后小兵生命 ×2
      const scoreValue = (
        {
          scout: 90,
          interceptor: 110,
          striker: 170,
          suppressor: 220,
          mine_layer: 300,
          gunship: 420,
          bomber: 600,
          courier: 160
        } as Record<EnemyType, number>
      )[type] * (eliteVariant ? 1.65 : 1);
      const xpValue = (
        {
          scout: 5,
          interceptor: 6,
          striker: 10,
          suppressor: 13,
          mine_layer: 18,
          gunship: 24,
          bomber: 32,
          courier: 9
        } as Record<EnemyType, number>
      )[type] * (eliteVariant ? 1.65 : 1);
      enemy.setData({
        type,
        hp,
        maxHp: hp,
        score: Math.round(scoreValue),
        xp: Math.round(xpValue),
        born: time,
        originX: enemy.x,
        elite: eliteVariant,
        heavy: type === "gunship" || type === "bomber",
        eliteVariant,
        mutated,
        mutation,
        damageScale:
          (eliteVariant ? 1.45 : 1) *
          (mutated ? 1.28 : 1) *
          (this.elapsedSeconds >= 240 ? 2 : 1), // 4 分钟后小兵伤害 ×2
        aiPattern: Phaser.Math.Between(0, 2),
        debugInjected: false,
        ramInjected: false,
        nextFire: time + Phaser.Math.Between(900, 1800)
      });
      const baseSpeed = (
        {
          scout: 150,
          interceptor: 210,
          striker: 155,
          suppressor: 125,
          mine_layer: 95,
          gunship: 105,
          bomber: 82,
          courier: 185
        } as Record<EnemyType, number>
      )[type];
      const cruiseVelocityX = type === "courier" ? Phaser.Math.Between(-55, 55) : 0;
      const cruiseVelocityY =
        baseSpeed *
        Math.min(1.45, intensity) *
        0.666 *   // 0.72 × 0.925(慢 7.5%)
        (eliteVariant ? 0.92 : 1) *
        (mutation === "dash" ? 1.38 : 1);
      enemy
        .setVelocity(cruiseVelocityX, cruiseVelocityY)
        .setData("cruiseVelocityX", cruiseVelocityX)
        .setData("cruiseVelocityY", cruiseVelocityY)
        .setData("supportControlled", false);
      if (eliteVariant) {
        this.floatText(enemy.x, 48, "ELITE", true);
      }
      if (mutated) {
        enemy.setScale(enemy.scaleX * 1.06, enemy.scaleY * 1.06);
        enemy.setTint(MINION_MUTATION_COLORS[mutation!]);
        this.floatText(enemy.x, 76, `MUTATION // ${mutation?.toUpperCase()}`, true);
      }
      return enemy;
    }

    updateEnemies(this: BattleScene, time: number, _dt: number): void {
      const ambientEnemiesEnabled =
        // 普通战役:清兵期(阈值达标后)停止刷兵,等玩家清完剩余小兵再召唤 Boss
        (selectedMode === "campaign" &&
          this.campaignInterludeActive &&
          !this.levelCompleteTriggered) ||
        // 无尽模式:达到阈值后停止刷兵,等玩家清完剩余小兵再打 Boss
        (selectedMode === "endless" && !this.bossActive && !this.levelCompleteTriggered);
      if (ambientEnemiesEnabled && time >= this.nextSpawn) {
        this.spawnEnemy(time);
        const scorePressure = (this.score + this.score2) / 5000;
        const interval = Phaser.Math.Clamp(
          760 - this.elapsedSeconds * 2.2 - scorePressure * 85 - selectedLevel * 28,
          190,
          760
        );
        const campaignSpawnScale = selectedMode === "campaign" ? 1.1 : 1;
        // 开局前 30 秒小怪数量翻倍(仅困难/噩梦,普通难度保持原密度)
        const isNormalDifficulty = campaignDifficultyForLevel(selectedLevel).id === "normal";
        const earlyDensityBoost =
          this.elapsedSeconds < 30 && !isNormalDifficulty ? 0.5 : 1;
        this.nextSpawn =
          time + interval * campaignSpawnScale * earlyDensityBoost;
      }
      this.enemies.children.each((child) => {
        const enemy = child as Phaser.Physics.Arcade.Image;
        if (!enemy.active) return true;
        const type = enemy.getData("type") as EnemyType;
        const age = time - enemy.getData("born");
        const frozenBySupport = time < this.enemyFreezeUntil;
        // 脉冲星轨道炮命中会给单个小兵挂 0.6 秒减速(slowUntil),复用支援缓速的减速分支
        const slowedBySupport =
          !frozenBySupport &&
          (time < this.enemySlowUntil || time < ((enemy.getData("slowUntil") as number) ?? 0));
        if (frozenBySupport || slowedBySupport) {
          if (!enemy.getData("supportControlled")) {
            const body = enemy.body as Phaser.Physics.Arcade.Body;
            enemy
              .setData("supportStoredVelocityX", body.velocity.x)
              .setData("supportStoredVelocityY", body.velocity.y)
              .setData("supportControlled", true);
          }
          const slowLevel = this.airSupportLevels.stasis_wake ?? 1;
          const slowFactor = frozenBySupport ? 0 : Math.max(0.2, 0.35 - slowLevel * 0.03);
          enemy.setVelocity(
            (enemy.getData("supportStoredVelocityX") ?? 0) * slowFactor,
            (enemy.getData("supportStoredVelocityY") ?? enemy.getData("cruiseVelocityY") ?? 0) *
              slowFactor
          );
        } else if (enemy.getData("supportControlled")) {
          enemy
            .setVelocity(
              enemy.getData("supportStoredVelocityX") ?? enemy.getData("cruiseVelocityX") ?? 0,
              enemy.getData("supportStoredVelocityY") ?? enemy.getData("cruiseVelocityY") ?? 0
            )
            .setData("supportControlled", false);
        }
        if (enemy.getData("eliteVariant")) {
          enemy.setAlpha(0.88 + Math.sin(time * 0.008 + enemy.getData("aiPattern")) * 0.12);
        }
        if (!frozenBySupport) {
          if (type === "scout") {
            enemy.x = enemy.getData("originX") + Math.sin(age * 0.003) * 48;
          } else if (type === "interceptor") {
            enemy.x = enemy.getData("originX") + Math.sin(age * 0.006) * 105;
          } else if (type === "striker") {
            enemy.x =
              enemy.getData("originX") +
              Math.sin(age * 0.0048 + enemy.getData("aiPattern")) * 125;
          } else if (type === "suppressor") {
            enemy.x =
              enemy.getData("originX") +
              Math.sin(age * 0.0026 + enemy.getData("aiPattern")) * 165;
          } else if (type === "mine_layer") {
            enemy.x =
              enemy.getData("originX") +
              Math.sin(age * 0.0017 + enemy.getData("aiPattern")) * 120;
          } else if (type === "gunship") {
            enemy.x = Phaser.Math.Clamp(
              enemy.getData("originX") +
                Math.sin(age * 0.0018 + enemy.getData("aiPattern")) * 175,
              90,
              WORLD_WIDTH - 90
            );
          } else if (type === "bomber") {
            enemy.x = Phaser.Math.Clamp(
              enemy.getData("originX") +
                Math.sin(age * 0.00125 + enemy.getData("aiPattern")) * 130,
              100,
              WORLD_WIDTH - 100
            );
          }
        }
        if (
          type !== "courier" &&
          !frozenBySupport &&
          time > enemy.getData("nextFire") &&
          enemy.y > 90 &&
          enemy.y < WORLD_HEIGHT * 0.7
        ) {
          if (type === "bomber" || type === "gunship") {
            this.fireElitePattern(enemy, type);
          } else if (type === "striker" || type === "suppressor" || type === "mine_layer") {
            this.fireMidTierPattern(enemy, type);
          } else {
            this.fireEnemyAtPlayer(
              enemy.x,
              enemy.y + 24,
              (type === "interceptor" ? 11 : 10) * (enemy.getData("damageScale") ?? 1),
              type === "interceptor" ? 350 : 260
            );
          }
          if (enemy.getData("mutated")) {
            this.fireMutationPattern(enemy, enemy.getData("mutation") as EnemyMutation);
          }
          enemy.setData(
            "nextFire",
            time +
              (type === "bomber" || type === "gunship"
                ? Phaser.Math.Between(1150, 1950)
                : type === "mine_layer"
                  ? Phaser.Math.Between(1750, 2250)
                  : type === "suppressor"
                    ? Phaser.Math.Between(1300, 1750)
                    : type === "striker"
                      ? Phaser.Math.Between(1150, 1500)
                : type === "interceptor"
                  ? 1450
                  : 1800) * (enemy.getData("eliteVariant") ? 0.8 : 1)
          );
        }
        if (enemy.y > WORLD_HEIGHT + 100) {
          if (type === "courier") {
            this.destroyEnemy(enemy, true);
            this.showBanner("补给机自毁 · 代币已回收", 650);
          } else {
            enemy.disableBody(true, true);
          }
        }
        return true;
      });
      if (time >= this.nextTaunt && !this.bossActive) {
        const speaker = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).find(
          (enemy) => enemy.active && enemy.y > 110 && enemy.y < WORLD_HEIGHT * 0.55
        );
        if (speaker) {
          this.showTaunt(speaker);
          this.nextTaunt = time + Phaser.Math.Between(3600, 6500);
        }
      }
    }

    // Boss 降临前的战场清空:敌人/敌方弹幕/玩家弹/虹吸链/冻结状态全部复位
    clearWaveForBossArrival(this: BattleScene): void {
      this.clearBossAttackEffects();
      this.enemies.children.each((child) => {
        const enemy = child as Phaser.Physics.Arcade.Image;
        this.tweens.killTweensOf(enemy);
        enemy.setData("freezePausedTweens", undefined);
        if (enemy.active) enemy.disableBody(true, true);
        return true;
      });
      this.enemyBullets.children.each((child) => {
        const bullet = child as Phaser.Physics.Arcade.Image;
        this.tweens.killTweensOf(bullet);
        bullet.setData("freezePausedTweens", undefined);
        if (bullet.active) bullet.disableBody(true, true);
        return true;
      });
      this.clearPlayerBullets();
      this.siphonedEnemies = [];
      this.clearSiphonChains();
      this.enemyFreezeStartedAt = 0;
      this.enemyFreezeUntil = 0;
    }
  }
  return SpawnDirector;
}
