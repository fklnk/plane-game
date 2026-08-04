// 即时肉鸽流程导演：15 分钟状态机、构筑排期、三条随机航线门(红/蓝/绿)、
// Boss/终局排期。以 mixin 形式混入 BattleScene，运行时 this 即场景实例。
import Phaser from "phaser";
import { roundHealth } from "./game-logic";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./data";
import { selectedMode, setAdaptiveMusic, sfx } from "./runtime-state";
import type { BattleScene } from "./main";

type Constructor<T = object> = new (...args: any[]) => T;

export function RoguelikeDirectorMixin<TBase extends Constructor<Phaser.Scene>>(Base: TBase) {
  abstract class RoguelikeDirector extends Base {
    // === 即时肉鸽:15 分钟流程状态机 ===
    // 节奏:0-5s 直接开打 → 15s 首次构筑(流派核心保底)→ 每 30-45s 构筑 →
    // 每 60-90s 红/蓝/绿三扇随机航线门 → 每 3 分钟首领 → 15 分钟黑暗魔神终局。
    // 肉鸽专用时钟 rogueClock 只在非弹窗/非 Boss 战期间累加(Boss 战与升级界面期间冻结)。
    updateRoguelike(this: BattleScene, time: number, dt: number): void {
      if (selectedMode !== "roguelike" || this.ended) return;
      if (
        !this.isModal &&
        !this.bossActive &&
        !this.rogueFinalPending &&
        !this.upgradePanelOpen
      ) {
        this.rogueClock += dt * 1000;
      }
      // 15s 首次构筑:流派核心保底,必须明显改变攻击方式
      if (
        !this.rogueFirstConstructDone &&
        this.rogueClock >= 15000 &&
        !this.isModal &&
        !this.bossActive
      ) {
        this.rogueFirstConstructDone = true;
        this.rogueStage = 1;
        this.openRogueConstruct("core");
        return;
      }
      // 每 30-45s 构筑三选一(升级/精英模块/临时能力)
      if (
        this.rogueFirstConstructDone &&
        !this.isModal &&
        !this.bossActive &&
        !this.rogueBossPending &&
        this.rogueClock >= this.nextRogueConstructAt
      ) {
        this.rogueStage += 1;
        const kind =
          this.rogueConstructKindQueue.length > 0
            ? this.rogueConstructKindQueue.shift()!
            : "utility";
        this.nextRogueConstructAt = this.rogueClock + this.rogueRng.int(30000, 45000);
        this.openRogueConstruct(kind);
        return;
      }
      // 每 60-90s 三条随机航线门(红/蓝/绿),玩家亲自移动进门选择
      if (
        this.rogueGates.length === 0 &&
        !this.isModal &&
        !this.bossActive &&
        !this.rogueBossPending &&
        this.rogueClock >= this.nextRogueGateAt
      ) {
        this.nextRogueGateAt = this.rogueClock + this.rogueRng.int(60000, 90000);
        this.spawnRogueGates(time);
      }
      if (this.rogueGates.length > 0) {
        if (time >= this.rogueGateUntil) this.clearRogueGates();
        else this.checkRogueGateCollision();
      }
      // 首领战:每 3 分钟一次;15 分钟终局黑暗魔神
      if (!this.bossActive && !this.isModal && !this.rogueBossPending && !this.rogueFinalPending) {
        if (this.rogueClock >= 900000 && !this.rogueExtended) {
          // 15 分钟终局
          this.rogueFinalPending = true;
          this.rogueBossPending = true;
          this.nextSpawn = this.time.now + 999999;
          this.clearRogueGates();
          this.showBanner("◆ 15 分钟 · 黑暗魔神终局", 1800);
          sfx("boss");
          this.time.delayedCall(1600, () => {
            if (this.ended) return;
            this.rogueBossPending = false;
            this.playRogueDeityArrival();
          });
        } else if (this.rogueClock >= this.nextRogueBossAt) {
          this.rogueBossPending = true;
          this.nextSpawn = this.time.now + 999999;
          this.clearRogueGates();
          this.rogueBossCount += 1;
          this.showBanner(`◆ 第 ${this.rogueBossCount} 次首领降临 · 主动权柄 + 专属被动`, 1800);
          sfx("boss");
          this.time.delayedCall(1600, () => {
            if (this.ended) return;
            this.rogueBossPending = false;
            this.playBossArrivalCG();
          });
        }
      }
    }

    // 首领击破奖励链结束后调用:黑影掠过演出 + 重抽次数 + 下次首领排期
    resumeRogueAfterBoss(this: BattleScene): void {
      if (selectedMode !== "roguelike" || this.ended) return;
      this.nextSpawn = this.time.now + 600;
      this.rogueBossPending = false;
      this.showBanner("黑影掠过 · 掠走首领核心 · 专属被动已刻入机体", 1600);
      // 重抽次数:每个 Boss 恢复一次,最多四次
      this.rerolls = Math.min(4, this.rerolls + 1);
      if (this.rogueDeityDefeated) {
        if (this.rogueExtended) {
          // 已选择继续无尽:不再弹选择,正常排期下一场首领
          this.nextRogueBossAt = this.rogueClock + 180000;
          this.showBanner("无尽延展 · 首领每 3 分钟降临 · 构筑继续成长", 1500);
          return;
        }
        // 黑暗魔神击破 → 结算或继续无尽
        this.showRogueVictoryChoice();
        return;
      }
      // 从击破奖励结束算起,下一场首领在 3 分钟后
      this.nextRogueBossAt = this.rogueClock + 180000;
    }

    spawnRogueGates(this: BattleScene, time: number): void {
      this.rogueGateUntil = time + 12000;
      const kinds = this.rogueRng.shuffle<"red" | "blue" | "green">(["red", "blue", "green"]);
      const xs = [WORLD_WIDTH * 0.22, WORLD_WIDTH * 0.5, WORLD_WIDTH * 0.78];
      this.rogueGates = kinds.map((kind, index) =>
        this.buildRogueGate(kind, xs[index], 300, index)
      );
    }

    buildRogueGate(
      this: BattleScene,
      kind: "red" | "blue" | "green",
      x: number,
      y: number,
      index: number
    ): Phaser.GameObjects.Container {
      const colors = { red: 0xff3d5a, blue: 0x3d8bff, green: 0x43ff9a } as const;
      const names = {
        red: "赤红航线 · 强敌与攻击",
        blue: "深蓝航线 · 异常事件",
        green: "翠绿航线 · 修复护盾"
      } as const;
      const color = colors[kind];
      const glow = this.add.circle(0, 0, 84, color, 0.14);
      const ring = this.add
        .circle(0, 0, 60, 0x000000, 0.4)
        .setStrokeStyle(5, color, 0.95);
      const core = this.add
        .circle(0, 0, 28, color, 0.85)
        .setStrokeStyle(3, 0xffffff, 0.7);
      const label = this.add
        .text(0, 96, names[kind], {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: "15px",
          color: "#eaffff",
          backgroundColor: "#0a1622cc",
          padding: { x: 8, y: 4 }
        })
        .setOrigin(0.5);
      const container = this.add.container(x, y, [glow, ring, core, label]).setDepth(60);
      container.setData("kind", kind);
      container.setData("index", index);
      this.tweens.add({
        targets: [glow, ring, core],
        alpha: 0.5,
        duration: 520,
        yoyo: true,
        repeat: -1
      });
      return container;
    }

    clearRogueGates(this: BattleScene): void {
      this.rogueGates.forEach((gate) => {
        // 门的脉冲 tween 是 repeat:-1,必须随门销毁一起清理,否则常驻运行
        this.tweens.killTweensOf(gate.list);
        gate.destroy();
      });
      this.rogueGates = [];
      this.rogueGateUntil = 0;
    }

    checkRogueGateCollision(this: BattleScene): void {
      const targets: Array<{ x: number; y: number }> = [{ x: this.player.x, y: this.player.y }];
      if (this.player2?.active) targets.push({ x: this.player2.x, y: this.player2.y });
      for (let i = 0; i < this.rogueGates.length; i++) {
        const gate = this.rogueGates[i];
        for (const target of targets) {
          if (Math.hypot(gate.x - target.x, gate.y - target.y) < 72) {
            const kind = gate.getData("kind") as "red" | "blue" | "green";
            this.tweens.killTweensOf(gate.list);
            gate.destroy();
            this.rogueGates.splice(i, 1);
            this.rogueGateUntil = 0;
            this.enterRogueGate(kind, gate.x, gate.y);
            return;
          }
        }
      }
    }

    enterRogueGate(this: BattleScene, kind: "red" | "blue" | "green", x: number, y: number): void {
      this.burst(x, y, 0xffffff, 1.7);
      this.cameras.main.flash(120, 200, 255, 255);
      if (kind === "red") {
        // 红门:敌人强化,必得攻击奖励
        this.showBanner("赤红航线 · 强敌迫近 · 攻击奖励锁定", 1300);
        this.spawnEnemy(this.time.now, "elite_gunship");
        this.time.delayedCall(450, () => {
          if (!this.ended) this.spawnEnemy(this.time.now, "elite_bomber");
        });
        this.time.delayedCall(900, () => this.openRogueConstruct("attack"));
      } else if (kind === "blue") {
        // 蓝门:异常事件,高随机高收益(小概率风险)
        const roll = this.rogueRng.int(0, 5);
        if (roll <= 1) {
          // 经验爆发
          this.spawnExperiencePickup(x, y - 70, 40);
          this.spawnExperiencePickup(x + 56, y - 24, 40);
          this.spawnExperiencePickup(x - 56, y - 24, 40);
          this.showBanner("深蓝航线 · 经验爆发", 1300);
        } else if (roll === 2) {
          // 模块注入:随机构筑
          this.showBanner("深蓝航线 · 模块注入", 1300);
          this.time.delayedCall(700, () => this.openRogueConstruct("utility"));
        } else if (roll === 3) {
          // 星渊遗物:代币
          const granted = this.grantRunTokens(60);
          this.showBanner(`深蓝航线 · 星渊遗物 ◆ +${granted}`, 1300);
        } else if (roll === 4) {
          // 修复爆发
          this.healPlayer(this.stats.maxHp * 0.25, "深蓝航线 · 治愈回响");
          this.showBanner("深蓝航线 · 治愈回响 +25%", 1300);
        } else {
          // 危险回响:损失生命换后续构筑
          this.stats.hp = roundHealth(this.stats.hp - this.stats.maxHp * 0.08, this.stats.maxHp);
          this.floatText(x, y, "危险回响 · 损失 8% 生命", true);
          this.cameras.main.flash(160, 255, 40, 60);
          this.showBanner("深蓝航线 · 危险回响 · 受损后强制构筑", 1400);
          this.time.delayedCall(800, () => this.openRogueConstruct("utility"));
        }
      } else {
        // 绿门:修复、护盾、经验、稳定强化
        this.healPlayer(this.stats.maxHp * 0.3, "翠绿航线 · 修复");
        this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 2500);
        this.spawnExperiencePickup(x, y - 70, 25);
        this.showBanner("翠绿航线 · 修复 30% + 护盾 2.5s + 经验", 1400);
        this.time.delayedCall(800, () => this.openRogueConstruct("survival"));
      }
    }

    // 15 分钟终局演出:黑暗魔神真身降临(不走三首领轮换)
    playRogueDeityArrival(this: BattleScene): void {
      if (this.ended || this.bossActive) return;
      this.clearWaveForBossArrival();
      this.isModal = true;
      this.physics.world.pause();
      setAdaptiveMusic(3);
      const topBar = this.add
        .rectangle(WORLD_WIDTH / 2, 54, WORLD_WIDTH, 108, 0x000000, 0.94)
        .setDepth(110);
      const bottomBar = this.add
        .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT - 54, WORLD_WIDTH, 108, 0x000000, 0.94)
        .setDepth(110);
      const warning = this.add
        .text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, "⚠ 黑暗魔神终局", {
          fontFamily: "Consolas, monospace",
          fontSize: "30px",
          fontStyle: "bold",
          color: "#ff4d6d",
          backgroundColor: "#18030dcc",
          padding: { x: 24, y: 16 }
        })
        .setOrigin(0.5)
        .setDepth(112);
      const subtitle = this.add
        .text(
          WORLD_WIDTH / 2,
          WORLD_HEIGHT / 2 + 62,
          "15 分钟已至 · 三枚首领印记全部点亮 · 真身降临",
          {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: "18px",
            color: "#f5d9e7"
          }
        )
        .setOrigin(0.5)
        .setDepth(112);
      this.cameras.main.shake(800, 0.014);
      this.cameras.main.flash(130, 255, 40, 110);
      sfx("boss");
      this.time.delayedCall(1900, () => {
        [topBar, bottomBar, warning, subtitle].forEach((item) => item.destroy());
        this.isModal = false;
        this.physics.world.resume();
        this.spawnBoss("dark_deity");
      });
    }
  }
  return RoguelikeDirector;
}
