const names={helmet:'深空救援',robot:'设施突入',car:'松风原野'};
export function formatRunTime(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
export function resultTitle(s){if(s.world==='car')return s.pauseReason==='help'?'漫游指南':'漫游已暂停';return s.completed?`${names[s.world]||'任务'}完成`:s.dead?'重新整备，再次出发':s.pauseReason==='help'?'操作指南':'游戏已暂停';}
export function resultSummary(s){
 if(s.world==='car')return '松风原野 · 自由漫游\n所有区域开放，随时继续探索';
 const lines=[`${names[s.world]||'世界任务'} · 难度 ${Number(s.difficulty)||1}`,`得分 ${Math.round(Number(s.score)||0)}`];
 const elapsed=s.missionElapsed??s.deliveryTime;if(Number.isFinite(elapsed))lines.push(`有效任务时间 ${formatRunTime(elapsed)}`);
 if(s.world==='helmet'&&Number.isFinite(s.escortHull))lines.push(`曙光号剩余耐久 ${Math.round(s.escortHull)}%`);
 if(s.world==='robot'){lines.push(`已救援伙伴 ${Number(s.rescued)||0} · 队友支援击杀 ${Number(s.supportKills)||0}`);}
 if(s.world==='car'){if(Number.isFinite(s.cargoIntegrity))lines.push(`货物完好度 ${Math.round(s.cargoIntegrity)}%`);if(Number.isFinite(s.distance))lines.push(`行驶里程 ${Math.floor(s.distance)} m`);}
 if(s.completed)lines.push(s.nextDifficultyAvailable?'已解锁下一难度':'可以自由探索或重玩本轮');
 else if(s.dead&&s.checkpointAvailable)lines.push('已保留安全检查点');
 return lines.join('\n');
}
