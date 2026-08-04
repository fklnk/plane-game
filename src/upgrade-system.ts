// 升级系统：升级选择队列、流派融合出池规则。
// 抽卡逻辑为接收 scene 的纯函数（由 showUpgrade 传入运行期配置）；
// 升级队列以 mixin 形式混入 BattleScene。
import Phaser from "phaser";
import { xpToNextLevel } from "./game-logic";
import { UPGRADES, type UpgradeDefinition } from "./data";
import type { BattleScene } from "./main";

type Constructor<T = object> = new (...args: any[]) => T;

// 由 showUpgrade 从闭包局部变量传入的运行期配置（出池边界与等级读取方式）
export interface UpgradePoolConfig {
  collisionUpgradeIds: ReadonlySet<string>;
  airSupportIds: ReadonlySet<string>;
  levelOf: (owner: 1 | 2, id: string) => number;
  fusionRequirements: Record<string, readonly string[]>;
}

// 每个玩家按自己的专精/等级独立出池（满级、互斥、当前流派不可用的强化不进候选）
export function buildPoolFor(
  scene: BattleScene,
  owner: 1 | 2,
  config: UpgradePoolConfig
): UpgradeDefinition[] {
  const spec = scene.specOf(owner);
  const ul = scene.upgradesOf(owner);
  return UPGRADES.filter(
    (upgrade) =>
      config.levelOf(owner, upgrade.id) <
        // 数值档位上限:agile_lunge / agile_shadow_clone / power_flamethrower 为 4 档,
        // 其余强化 5 档。此前 power_flamethrower 走默认 5,但 POWER_FLAME 各数组只有 4 项,
        // Lv.5 会与 Lv.4 完全相同(死等级)。
        (upgrade.id === "agile_lunge" ||
        upgrade.id === "agile_shadow_clone" ||
        upgrade.id === "power_flamethrower"
          ? 4
          : 5) &&
      (spec === "wheelchair"
        ? config.collisionUpgradeIds.has(upgrade.id) ||
          config.airSupportIds.has(upgrade.id) ||
          upgrade.id === "wheelchair_fusion"
        : !upgrade.id.startsWith("ram_")) &&
      (!upgrade.id.startsWith("power_") || spec === "power") &&
      (!upgrade.id.startsWith("agile_") || spec === "agile") &&
      (!upgrade.id.startsWith("defender_") || spec === "defender") &&
      (!upgrade.id.startsWith("vampire_") || spec === "vampire") &&
      (!upgrade.id.startsWith("devour_") || spec === "devour") &&
      (!upgrade.id.startsWith("wheelchair_") || spec === "wheelchair") &&
      // 融合技出池:
      // - 万象影袭(敏捷):已拥有任一基础技能(突刺/影分身)即出现
      // - 其余所有流派:需集齐两个基础强化(基础技能全部 ≥1 级)才解锁融合技
      (!config.fusionRequirements[upgrade.id] ||
        (() => {
          const requirements = config.fusionRequirements[upgrade.id]!;
          return upgrade.id === "agile_shadow_lunge"
            ? requirements.some((id) => config.levelOf(owner, id) > 0)
            : requirements.every((id) => config.levelOf(owner, id) > 0);
        })()) &&
      // 基础技能出池(非敏捷流派):
      // - 未集齐两个基础技能:基础技能照常出(可继续升级)
      // - 集齐两个基础技能后:后续只出融合技,两个基础技能不再出现(敏捷由下方独立规则控制)
      (() => {
        for (const [fusionId, requirements] of Object.entries(
          config.fusionRequirements
        )) {
          if (fusionId === "agile_shadow_lunge") continue;
          if (requirements.includes(upgrade.id)) {
            if (requirements.every((id) => config.levelOf(owner, id) > 0)) {
              return false;
            }
          }
        }
        return true;
      })() &&
      // 敏捷进阶规则:
      // - 未选任何基础技能:出突刺 + 影分身,万象影袭不出
      // - 选完突刺/影分身任意一个:基础技能全部不再出现,后续专属只出融合技(首抽即 Lv.2)
      // - 拥有万象影袭后,P2 的影分身同样不再单独出(由融合技等级统一成长)
      (!upgrade.id.startsWith("agile_") ||
        spec !== "agile" ||
        (() => {
          const lunge = ul.agile_lunge ?? 0;
          const clone = ul.agile_shadow_clone ?? 0;
          if (upgrade.id === "agile_shadow_lunge") return lunge > 0 || clone > 0;
          if (upgrade.id === "agile_lunge") return lunge === 0 && clone === 0;
          if (upgrade.id === "agile_shadow_clone") return lunge === 0 && clone === 0;
          return true;
        })())
  );
}

export function UpgradeSystemMixin<TBase extends Constructor<Phaser.Scene>>(Base: TBase) {
  abstract class UpgradeSystem extends Base {
    collectXp(this: BattleScene, value: number): void {
      if (this.level >= 100) {
        this.score += value * 2;
        return;
      }
      this.xp += value;
      this.score += value * 2;
      while (this.xp >= this.xpNeeded) {
        this.xp -= this.xpNeeded;
        this.level = Math.min(100, this.level + 1);
        this.xpNeeded = xpToNextLevel(this.level);
        if (this.level < 100) {
          // 升级选择队列:弹窗忙时先排队,由 flushLevelUpQueue 逐个弹出
          this.pendingLevelUps += 1;
          this.flushLevelUpQueue();
        } else {
          this.showBanner("LV.100 · 流派完全体", 1500);
        }
        // 注意:此处不 break,一次性吸收大量经验可连续升级;三选一由
        // pendingLevelUps 队列逐个弹出(isModal/upgradePanelOpen 时先排队)。
      }
    }

    levelUp(this: BattleScene): void {
      this.flushLevelUpQueue();
    }

    // 弹窗非忙时才真正弹三选一;一次只弹一个,弹窗关闭后下一帧再弹下一个。
    // 修复:同时吸收大量经验时等级增加但三选一被 isModal 弹窗状态吞掉的问题。
    flushLevelUpQueue(this: BattleScene): void {
      if (
        this.pendingLevelUps <= 0 ||
        this.ended ||
        this.isModal ||
        this.upgradePanelOpen ||
        this.levelUpScheduled
      ) {
        return;
      }
      this.pendingLevelUps -= 1;
      this.levelUpScheduled = true;
      this.time.delayedCall(20, () => {
        this.levelUpScheduled = false;
        if (this.ended) return;
        if (this.isModal || this.upgradePanelOpen) {
          // 仍被其他弹窗占用:放回队列稍后再弹
          this.pendingLevelUps += 1;
          return;
        }
        if (showUpgrade) showUpgrade(this);
      });
    }
  }
  return UpgradeSystem;
}

// 由 main.ts 的 showUpgrade 注入,避免本模块与 main 的 UI 层循环依赖
export let showUpgrade: ((scene: BattleScene) => void) | null = null;
export function setShowUpgrade(fn: (scene: BattleScene) => void): void {
  showUpgrade = fn;
}
