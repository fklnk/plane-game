// 对局结算：纪录更新、死亡/胜利结算界面、快速重开。
// 独立成模块，避免与 main.ts 的 UI 导航形成循环依赖（导航通过注入提供）。
import { formatTime } from "./game-logic";
import { type RunResult, SHADOW_ENDINGS } from "./data";
import {
  activeScene,
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
  if (result.mode === "roguelike") {
    save.records.roguelikeBestSeconds = Math.max(
      save.records.roguelikeBestSeconds,
      result.seconds
    );
    save.records.roguelikeBestWave = Math.max(
      save.records.roguelikeBestWave,
      result.waves ?? 0
    );
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
                : result.mode === "roguelike"
                  ? "DARK DEITY VANQUISHED"
                  : "MISSION COMPLETE"
            : result.mode === "roguelike"
              ? "ROGUE RUN ARCHIVED"
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
                  : result.mode === "roguelike"
                    ? "黑暗魔神已被击破"
                    : `关卡 ${result.missionLevel} 完成`
              : result.mode === "roguelike"
                ? `构筑崩解于第 ${Math.floor(result.seconds / 60)} 分钟`
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
                : result.mode === "roguelike"
                  ? "15 分钟内击破黑暗魔神。构筑与随机航线已记录，下次用同流派再冲一次纪录。"
                  : "泰坦核心已被摧毁，航道暂时安全。"
            : result.mode === "roguelike"
              ? "本局构筑已清空。保留当前流派、刷新随机种子，4 秒内再次出击。"
              : "星核数据已回收，调整构筑后再次出击。"
        }</p>
        <div class="result-stats">
          <div class="result-stat"><span>SCORE</span><strong>${result.score}</strong></div>
          <div class="result-stat"><span>TIME</span><strong>${formatTime(result.seconds)}</strong></div>
          <div class="result-stat"><span>KILLS</span><strong>${result.kills}</strong></div>
          <div class="result-stat"><span>LEVEL</span><strong>LV.${result.level}</strong></div>
          ${
            result.mode === "roguelike"
              ? `<div class="result-stat"><span>击破首领</span><strong>${result.waves ?? 0}</strong></div>
                 <div class="result-stat"><span>最佳存活</span><strong>${formatTime(
                   save.records.roguelikeBestSeconds
                 )}</strong></div>
                 ${
                   result.victory
                     ? ""
                     : `<div class="result-stat"><span>死因</span><strong>${
                         activeScene?.lastDamageCause ?? "未知威胁"
                       }</strong></div>`
                 }`
              : ""
          }
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
            : result.mode === "roguelike"
              ? "保持当前流派 · 再来一局"
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
  // 即时肉鸽死亡:4 秒内自动重新出击(清空本局构筑、保留流派)
  let rogueTimer: number | undefined;
  if (result.mode === "roguelike" && !result.victory) {
    const againBtn = document.querySelector<HTMLButtonElement>("#again-run");
    let rogueCountdown = 4;
    if (againBtn) againBtn.textContent = `保持当前流派 · 再来一局 (${rogueCountdown}s)`;
    const tick = (): void => {
      rogueCountdown -= 1;
      if (rogueCountdown <= 0) {
        if (rogueTimer !== undefined) clearInterval(rogueTimer);
        againBtn?.click();
        return;
      }
      if (againBtn) againBtn.textContent = `保持当前流派 · 再来一局 (${rogueCountdown}s)`;
    };
    rogueTimer = window.setInterval(tick, 1000);
  }
  document.querySelector("#result-hangar")!.addEventListener("click", () => {
    // 手动离开结算界面时停止自动重开倒计时,避免 interval 悬空继续 tick
    if (rogueTimer !== undefined) clearInterval(rogueTimer);
    navigation?.destroyGame();
    overlayRoot().innerHTML = "";
    navigation?.showHangar();
  });
  document.querySelector("#result-menu")!.addEventListener("click", () => {
    if (rogueTimer !== undefined) clearInterval(rogueTimer);
    navigation?.showMenu();
  });
}
