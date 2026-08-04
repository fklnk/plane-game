// 对局结算：纪录更新、死亡/胜利结算界面、快速重开。
// 独立成模块，避免与 main.ts 的 UI 导航形成循环依赖（导航通过注入提供）。
import { formatTime } from "./game-logic";
import { type RunResult, SHADOW_ENDINGS } from "./data";
import {
  persist,
  playVariant,
  save,
  selectedLevel,
  setSelectedLevel,
  sfx
} from "./runtime-state";

// #overlay-root 由 main.ts 在注入 app-shell 后创建,故惰性查询
function overlayRoot(): HTMLDivElement {
  return document.querySelector<HTMLDivElement>("#overlay-root")!;
}

// 由 main.ts 注入的页面导航函数
export interface SettlementNavigation {
  destroyGame: () => void;
  startRun: () => void;
  showMenu: () => void;
  showHangar: () => void;
}
let navigation: SettlementNavigation | null = null;
export function setSettlementNavigation(nav: SettlementNavigation): void {
  navigation = nav;
}

export function finishRun(result: RunResult): void {
  if (result.mode === "campaign" && result.victory) {
    save.records.campaignWins += 1;
    save.records.highestUnlockedLevel = Math.max(
      save.records.highestUnlockedLevel,
      Math.min(5, result.missionLevel + 1)
    );
  }
  if (result.mode === "endless") {
    save.records.endlessBestSeconds = Math.max(save.records.endlessBestSeconds, result.seconds);
    save.records.endlessBestScore = Math.max(save.records.endlessBestScore, result.score);
  }
  if (result.mode === "boss" && result.victory) {
    const milliseconds = Math.round(result.seconds * 1000);
    save.records.bossRushBestMs =
      save.records.bossRushBestMs === null
        ? milliseconds
        : Math.min(save.records.bossRushBestMs, milliseconds);
  }
  save.starCores += result.reward;
  if (playVariant === "coop" && result.victory) {
    if (!save.achievements.coop_wing) save.achievements.coop_wing = new Date().toISOString();
  }
  persist();
  sfx(result.victory ? "victory" : "hurt");
  const shadow = result.shadowEnding ? SHADOW_ENDINGS[result.shadowEnding] : null;
  overlayRoot().innerHTML = `
    <div class="overlay${shadow ? " shadow-ending-overlay" : ""}">
      <div class="overlay-panel${shadow ? " shadow-ending-panel" : ""}">
        <div class="eyebrow">${
          shadow
            ? shadow.code
            : result.victory
            ? result.mode === "campaign"
              ? "CAMPAIGN COMPLETE"
              : result.mode === "boss"
                ? "BOSS SEQUENCE ARCHIVED"
                : "MISSION COMPLETE"
            : "INFINITE FLIGHT ARCHIVED"
        }</div>
        <h2>${
          shadow
            ? shadow.title
            : playVariant === "score_duel"
            ? result.score >= (result.score2 ?? 0)
              ? "P1 赢得空域"
              : "P2 赢得空域"
            : result.victory
              ? result.mode === "campaign"
                ? "星渊征途完成"
                : result.mode === "boss"
                  ? "九渊试炼完成"
                  : `关卡 ${result.missionLevel} 完成`
              : "本次永夜航线已封存"
        }</h2>
        <p>${
          shadow
            ? shadow.detail
            : result.victory
            ? result.mode === "campaign"
              ? "带有小怪增援的九场 Boss 战与最终真身均已击破，本局数据已经永久保存。"
              : result.mode === "boss"
                ? "九场战斗与最终真身均已击破，终局核心和全部战斗数据已永久回收到机库。"
                : "泰坦核心已被摧毁，航道暂时安全。"
            : "星核数据已回收，调整构筑后再次出击。"
        }</p>
        <div class="result-stats">
          <div class="result-stat"><span>SCORE</span><strong>${result.score}</strong></div>
          <div class="result-stat"><span>TIME</span><strong>${formatTime(result.seconds)}</strong></div>
          <div class="result-stat"><span>KILLS</span><strong>${result.kills}</strong></div>
          <div class="result-stat"><span>LEVEL</span><strong>LV.${result.level}</strong></div>
          <div class="result-stat"><span>游戏代币</span><strong>◆ +${result.reward}</strong></div>
          <div class="result-stat"><span>战斗掉落</span><strong>${result.combatTokens}</strong></div>
          <div class="result-stat"><span>${
            result.mode === "boss" || result.mode === "campaign" ? "完成战斗" : "击破泰坦"
          }</span><strong>${result.bosses}</strong></div>
          <div class="result-stat"><span>MODE</span><strong>${result.mode.toUpperCase()}</strong></div>
          ${
            playVariant === "single"
              ? ""
              : `<div class="result-stat"><span>P1 SCORE</span><strong>${result.score}</strong></div>
                 <div class="result-stat"><span>P2 SCORE</span><strong>${result.score2 ?? 0}</strong></div>`
          }
        </div>
        <button class="primary-button" id="again-run">${
          result.mode === "campaign" && result.victory && result.missionLevel < 5
            ? "提高威胁等级"
            : "再次出击"
        }</button>
        <div class="overlay-actions">
          <button class="secondary-button" id="result-hangar">机库</button>
          <button class="secondary-button" id="result-menu">主菜单</button>
        </div>
      </div>
    </div>
  `;
  document.querySelector("#again-run")!.addEventListener("click", () => {
    if (result.mode === "campaign" && result.victory && result.missionLevel < 5) {
      setSelectedLevel(result.missionLevel + 1);
      save.lastLevel = selectedLevel;
      persist();
    }
    navigation?.destroyGame();
    navigation?.startRun();
  });
  document.querySelector("#result-hangar")!.addEventListener("click", () => {
    navigation?.destroyGame();
    overlayRoot().innerHTML = "";
    navigation?.showHangar();
  });
  document.querySelector("#result-menu")!.addEventListener("click", () => {
    navigation?.showMenu();
  });
}
