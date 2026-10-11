import {createContextRecovery} from './context-recovery.js?v=journey-39';
import {createIdleWorldSnap} from './idle-world-snap.js?v=journey-39';
import {resultSummary, resultTitle, formatRunTime} from './game-session-ui.js?v=journey-39';
import {createGameAudio} from './game-audio.js?v=journey-39';
import { createTitleDecode } from './title-decode.js?v=journey-39';
import { initialQuality } from './journey-quality.js?v=journey-39';
import { createScrollFx } from './scroll-fx.js?v=journey-39';
const audio=createGameAudio();
const $=s=>document.querySelector(s);let world=null,ready=false,light=false,failed=false,queued=false,lastP=0,inGame=false,savedY=0,returnFocus=null,reduced=false;
let recovering=false,hostGeneration=0,worldFactory=null;
let savedQuality;try{savedQuality=globalThis.localStorage;}catch{}
let quality=initialQuality(savedQuality,matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0);
let latestState={};let worldSnap=null;let currentMode='showcase',currentWorld='helmet',gamePaused=false,gameDead=false,lastInstruction='',pauseWasVisible=false;
const coarse=matchMedia('(pointer: coarse)').matches;
for(const title of document.querySelectorAll('.frame h1,.frame h2')){let i=0;const label=title.textContent.trim();const split=node=>{for(const child of [...node.childNodes]){if(child.nodeType===3){const frag=document.createDocumentFragment();for(const ch of child.textContent){const span=document.createElement('span');span.className='ch';span.style.setProperty('--i',i++);span.textContent=ch;frag.append(span);}child.replaceWith(frag);}else if(child.nodeType===1&&child.tagName!=='BR')split(child);}};split(title);title.setAttribute('aria-label',label);}
const titleDecode=createTitleDecode();
window.addEventListener('pagehide',()=>titleDecode.dispose(),{once:true});
const modelNames={helmet:'01 / 深空救援',robot:'02 / 设施突入',car:'03 / 玩具公园'};
document.body.classList.add('transit-mode');
// Loading is a single monospace line: a character bar that fills while the grains are counted.
let loadPct=0,loadText='BOOT',loadShown=0,loadRaf=0;
function drawLoad(){loadRaf=0;loadShown+=(loadPct-loadShown)*.18;if(Math.abs(loadPct-loadShown)<.4)loadShown=loadPct;const narrow=innerWidth<560,n=narrow?16:24,f=Math.round(loadShown/100*n),grains=String(Math.round(loadShown/100*4800)).padStart(4,'0');
 $('#load-line').textContent=`HEYBOX / ${loadText.padEnd(10)}${narrow?'\n':'  '}[${'■'.repeat(f)}${'·'.repeat(n-f)}]  ${String(Math.round(loadShown)).padStart(3)}%  ${grains} / 4800`;if(loadShown!==loadPct)loadRaf=requestAnimationFrame(drawLoad);}
function status(text,n,code){$('#load-status').textContent=text;if(code)loadText=code;if(n!==undefined){loadPct=n;$('#load-bar').style.width=n+'%';}if(!loadRaf)loadRaf=requestAnimationFrame(drawLoad);}
function enter(){if(!ready&&!light)return;const loading=$('#loading');if(!loading.classList.contains('done'))setTimeout(()=>{loading.classList.add('done');world?.startIntro?.({instant:reduced});},reduced||light?0:450);document.body.style.overflowY='';world?.setPaused(worldPaused());update();}
function gameVisibility(mode){
 const active=mode==='travel'||mode==='game'||mode==='return';
 if(active&&!inGame){worldSnap?.holdUntilUserScroll?.();worldSnap?.cancel();savedY=scrollY;returnFocus=document.activeElement;inGame=true;document.body.style.position='fixed';document.body.style.top=-savedY+'px';document.body.style.width='100%';document.body.style.overflowY='hidden';document.body.classList.add('exploring');$('#journey').inert=true;$('#play-hud').hidden=false;$('#exit-game').focus({preventScroll:true});}
 if(mode==='showcase'&&inGame){worldSnap?.cancel({cooldown:900});releaseControls();inGame=false;document.body.classList.remove('exploring');$('#journey').inert=false;$('#play-hud').hidden=true;Object.assign(document.body.style,{position:'',top:'',width:'',overflowY:''});const previous=document.documentElement.style.scrollBehavior;document.documentElement.style.scrollBehavior='auto';if(worldSnap?.restorePosition)worldSnap.restorePosition(savedY);else window.scrollTo({top:savedY,behavior:'instant'});document.documentElement.style.scrollBehavior=previous;returnFocus?.focus?.({preventScroll:true});update();}
 $('#travel-screen').hidden=!['travel','return'].includes(mode);document.body.classList.toggle('traveling',['travel','return'].includes(mode));$('#restart-game').disabled=mode!=='game';$('#touch-pad').style.visibility=mode==='game'?'visible':'hidden';
}
function formatScore(score){if(score===undefined||score===null)return '';if(typeof score!=='object')return typeof score==='number'?'得分 '+score:String(score);const labels={score:'得分',hits:'命中',shield:'护盾',health:'护甲',distance:'距离',speed:'速度',beacons:'已唤醒',activated:'已唤醒',total:'总计',lap:'圈数'};return Object.entries(score).filter(([k,v])=>v!==undefined&&v!==null).map(([k,v])=>(labels[k]||k)+' '+v).join('   ·   ');}
function state(s){
 latestState=s;drawHover(s);drawTravel(s);renderAim(s);
 if(s.mode){if(s.mode==='travel'&&currentMode!=='travel'){$('#play-score').textContent='';$('#play-mission').textContent='';$('#ability-status').textContent='';}currentMode=s.mode;gameVisibility(s.mode);}if(s.world){currentWorld=s.world;$('#travel-world').textContent=(modelNames[s.world]||'').split('/').pop().trim();}if(s.instruction)lastInstruction=s.instruction;
 $('#touch-aim').hidden=s.world!=='robot';if(s.world){const configs={helmet:[['开火','fire'],['冲刺','ShiftLeft'],['',''],['',''],['',''],['','']],robot:[['开火','fire'],['疾跑','ShiftLeft'],['互动','KeyE'],['换弹','KeyR'],['跳跃','Space'],['抛掷','KeyQ']],car:[['手刹','Space'],['油门','KeyW'],['鸣笛','KeyH'],['复位','KeyR'],['视角','KeyC'],['车灯','KeyE']]};['primary','sprint','skill','alt','rise','fall'].forEach((id,i)=>{const b=$('#touch-'+id),[label,key]=configs[s.world][i];b.textContent=label;b.dataset.control=key;b.dataset.gameAction='';b.hidden=!label;});$('#model-name').textContent=modelNames[s.world]||s.world;$('#toy-keycaps').innerHTML=s.world==='helmet'?'<span><kbd>W A S D</kbd> 移动</span><span><kbd>SPACE</kbd> 射击</span><span><kbd>SHIFT</kbd> 冲刺</span>':'<span><kbd>W A S D</kbd> 驾驶</span><span><kbd>SPACE</kbd> 漂移</span><span><kbd>R</kbd> 复位</span><span><kbd>H</kbd> 鸣笛</span>';$('#toy-keycaps').setAttribute('aria-label',s.world==='helmet'?'飞行操作':'驾驶操作');$('#play-title').textContent=(modelNames[s.world]||s.world).split('/').pop().trim();}
 $('#play-label').textContent=s.mode==='game'&&s.world==='robot'?'难度 '+(s.difficulty||1)+' / 3 · '+(s.difficultyName||'标准'):s.world==='car'?'HEYBOX / TOY PARK':s.world==='helmet'?'HEYBOX / TOY SPACE':'HEYBOX / GAME WORLD';renderSquad(s);if(s.instruction){$('#model-instruction').textContent=s.instruction;$('#play-instruction').textContent=coarse&&s.mode==='game'?({helmet:'左侧方向键移动 · 拖动画面也能移动并射击 · 右侧开火 / 冲刺',robot:'拖动画面转向 · 按住「举枪」瞄准 · 左侧移动 / 右侧开火',car:'自由驾驶 · 手刹漂移 · 鸣笛 / 车灯 · 复位脱困'}[s.world]||s.instruction):s.instruction;}
 if(s.statusText!==undefined){$('#model-feedback').textContent=s.statusText;$('#play-status').textContent=s.statusText;}
 if(s.world==='car')$('#play-score').textContent=`${Math.round(Math.abs(s.speed||0))} km/h${s.location?'  ·  '+s.location:''}`;
 if(s.world==='helmet'&&s.score!==undefined)$('#play-score').textContent=`${'❤'.repeat(Math.max(0,s.hearts||0))}${'♡'.repeat(Math.max(0,(s.maxHearts||3)-(s.hearts||0)))}   ·   得分 ${s.score}`;else if(s.world!=='car'&&s.score!==undefined){const hp=s.health??s.shield,cap=s.maxHealth??s.maxShield;const value=s.world==='car'?`${Math.round(Math.abs(s.speed||0))} km/h   ·   已行驶 ${Math.floor(s.distance||0)} m   ·   得分 ${s.score}`:`得分 ${s.score}${hp!==undefined?'   ·   '+(s.world==='robot'?'生命 ':s.health!==undefined?'机体 ':'护盾 ')+Math.round(hp)+(cap?' / '+cap:''):''}`;$('#play-score').textContent=value;}
 const abilities=[];const cooldown=(n)=>Number(n)>0?Math.ceil(n)+'s':'就绪';
 if(s.world==='helmet'){if(s.escorting)abilities.push('曙光号 '+Math.round(s.escortHull)+'%');if(s.tripleShot>0)abilities.push('三连发 '+s.tripleShot+'s');abilities.push('冲刺 / '+(s.dashReady?'就绪':'冷却'));}else{if(s.weapon)abilities.push(String(s.weapon));if(s.weaponFeedback)abilities.push(s.weaponFeedback);if(s.gear)abilities.push('挡位 '+s.gear);if(s.ammo!==undefined)abilities.push('弹药 '+s.ammo+(s.reserve!==undefined?' / '+s.reserve:''));if(s.world==='robot'&&s.shield!==undefined)abilities.push('护盾 '+Math.round(s.shield)+' / '+(s.maxShield??25));if(s.world==='robot'&&s.enemyMaxHealth)abilities.push('敌我基础生命 '+s.enemyMaxHealth);if(s.reloading)abilities.push('正在换弹');if(s.escortHull!==undefined)abilities.push('曙光号 '+Math.round(s.escortHull)+'%');if(s.carrying)abilities.push('携带 '+(typeof s.carrying==='string'?({crate:'补给箱',barrel:'能量桶',cell:'能源电池'}[s.carrying]||s.carrying):'物件'));if(s.friendlies!==undefined)abilities.push('友军 '+s.friendlies);if(s.enemies!==undefined)abilities.push('敌军 '+s.enemies);if(s.checkpoints!==undefined)abilities.push('检查点 '+s.checkpoints);if(s.combo!==undefined)abilities.push('连击 '+s.combo);if(s.skillCooldown!==undefined)abilities.push('技能 / '+cooldown(s.skillCooldown));if(s.boostCooldown!==undefined)abilities.push('推进 / '+cooldown(s.boostCooldown));if(s.location)abilities.push(String(s.location));if(s.destinationName)abilities.push('导航 · '+s.destinationName);}
 $('#ability-status').hidden=s.world==='car';$('#play-mission').hidden=s.world==='car';$('#ability-status').textContent=abilities.join('\n');if(s.mission!==undefined)$('#play-mission').textContent=s.mission;
 if(s.weaponIndex!==undefined)activeWeaponIndex=Number(s.weaponIndex)||1;
 const weapons=Array.isArray(s.weapons)?s.weapons:(s.world==='helmet'?['脉冲激光','散射等离子','追踪导弹','冲击波']:['爆能枪','近战锤']);$('#weapon-rack').hidden=s.mode!=='game'||s.world!=='robot';document.querySelectorAll('[data-weapon]').forEach((button,i)=>{button.hidden=i>=weapons.length;const name=typeof weapons[i]==='object'?(weapons[i].name||weapons[i].label):weapons[i];button.textContent=(i+1)+' / '+(name||'武器');button.classList.toggle('active',Number(s.weaponIndex)===i+1||s.weapon===name);});drawMap(s);drawCombat(s);renderPause(s);const prompt=(s.world==='robot'&&!s.pointerLocked&&!coarse?(s.pointerLockAvailable===false?'按住右键拖动视角 · 左键开火':'点击画面控制视角 · Esc 释放并暂停'):null)||s.contextPrompt||s.interactionPrompt||s.prompt||(s.world==='helmet'?[s.targetLabel,s.weaponFeedback].filter(Boolean).join(' · '):'');$('#context-prompt').hidden=s.mode!=='game'||gamePaused||gameDead||!prompt;$('#context-prompt').textContent=prompt;
 const error=s.modelStatus==='error'||s.modelStatus==='failed';$('#retry-model').hidden=!error;$('#retry-game-model').hidden=!(error&&inGame);
 if(error&&!ready)status('入口模型稍后自动载入');renderSession(s);

}
function renderPause(s){
 const completed=!!s.completed,visible=s.mode==='game'&&(!!s.paused||!!s.dead);
 $('#next-difficulty').hidden=!completed||!s.nextDifficultyAvailable;
 $('#next-difficulty').textContent='挑战下一难度 · '+(Number(s.difficulty||1)+1);
 gamePaused=!!s.paused||!!s.awaitingControl;gameDead=!!s.dead;
 $('#pause-panel').hidden=!visible;document.body.classList.toggle('game-paused',visible);
 $('#pause-game').disabled=s.mode!=='game'||!!s.awaitingControl;$('#help-game').disabled=s.mode!=='game';
 $('#pause-game').textContent=gamePaused?'继续 / ESC':'暂停 / ESC';
 $('#resume-game').hidden=gameDead||(completed&&s.freeExploreAvailable===false);
 $('#retry-checkpoint').hidden=!s.checkpointAvailable||!gameDead;$('#pause-restart').textContent=s.world==='car'?'重置小车与游乐区':'重新开始';
 if(visible){
  releaseControls();$('#resume-game').textContent=completed?'继续自由探索':'继续游玩';
  $('#pause-title').textContent=s.world==='car'?'歇一会儿。':resultTitle(s);
  $('#pause-reason').textContent=s.world==='car'?'小车停好了。继续逛逛，或重置小车和所有可推动的玩具。':completed?'行动记录已保存。返回旅程、自由探索，或选择下一挑战。':gameDead?(s.checkpointAvailable?'可从最近安全检查点重试，也可以重新开始本轮。':'可以重新开始本轮，或返回旅程。'):['blur','hidden'].includes(s.pauseReason)?'窗口失去焦点，任务与计时已暂停。':'任务与计时已暂停，准备好后继续。';
  $('#pause-controls').textContent=s.world==='helmet'&&!(completed||gameDead)?'方向键 / WASD 移动\nSPACE 或左键 射击\nSHIFT 冲刺（短暂无敌）':s.world==='car'?'W / S 前进与倒车   A / D 转向\nSPACE 手刹漂移   R 复位\nH 鸣笛   E 车灯':(completed||gameDead)?resultSummary(s):lastInstruction.split(' · ').join('\n');
  $('#pause-tip').textContent={helmet:'先救起 5 名漂流的宇航员，再击退三波紫色敌机，最后护送曙光号入港。吃到星星可以三连发，红心能补一格生命。',robot:'左键开火，右键或 Z 举枪，R 换弹，E 互动，空格跳跃。H-01 是医疗兵；蓝色标记指向当前任务。',car:'相连的玩具区域都可以自由探索。加速冲上坡道，推开木箱，撞翻路锥和保龄球。卡住时按 R，回到安全位置。'}[s.world]||'';
  if(!pauseWasVisible)(gameDead?(!$('#retry-checkpoint').hidden?$('#retry-checkpoint'):$('#pause-restart')):$('#resume-game').hidden?(!$('#next-difficulty').hidden?$('#next-difficulty'):$('#pause-restart')):$('#resume-game')).focus({preventScroll:true});
 }else if(pauseWasVisible&&s.mode==='game'&&!s.awaitingControl)$('#pause-game').focus({preventScroll:true});
 pauseWasVisible=visible;
}
function renderAim(s){const valid=s.mode==='game'&&s.world==='robot'&&!s.paused&&!s.dead&&!s.awaitingControl,blend=Number(s.aimBlend??(s.aiming?1:0));document.body.classList.toggle('fps-aiming',valid&&blend>.08);const panel=$('#aim-status');panel.hidden=!valid||!(s.aiming||blend>.05||s.muzzleBlocked);if(!panel.hidden){panel.textContent=(s.aimLabel||(s.aiming?'举枪瞄准':'恢复腰射'))+(s.aiming&&Number(s.aimMagnification)>1?' · '+Number(s.aimMagnification).toFixed(1)+'×':'');panel.classList.toggle('blocked',!!s.muzzleBlocked);}const button=$('#touch-aim');button.setAttribute('aria-pressed',String(valid&&!!s.aiming));button.classList.toggle('held',valid&&!!s.aiming);button.textContent=valid&&s.aiming?'瞄准中':'举枪';}
function drawTravel(s){document.body.classList.toggle('arriving',!!s.arriving);document.body.dataset.entryWorld=s.world||currentWorld;const label=$('#travel-kind');if(label)label.textContent=s.lifecycle==='return'?'RETURN / JOURNEY':({helmet:'FLIGHT / DEEP SPACE',robot:'ACCESS / FACILITY',car:'DRIVE / TOY PARK'}[s.world]||'ENTER / WORLD');const veil=$('#portal-veil');if(!veil)return;veil.style.transition=['travel','return'].includes(s.mode)?'none':'opacity .22s ease-out';veil.style.opacity=String(['travel','return'].includes(s.mode)?Math.max(0,Math.min(1,s.travel?.veil||0)):0);}
function drawHover(s){const el=$('#model-hover'),beacon=$('#entry-beacon');if(!el||(s.mode==='showcase'&&!('hover' in s)))return;const h=s.hover,active=s.mode==='showcase'&&h?.target;el.hidden=!active;
 const b=s.mode==='showcase'&&!active&&s.beacon;beacon?.classList.toggle('on',!!b);if(b){beacon.style.left=(b.x+1)*50+'%';beacon.style.top=(1-b.y)*50+'%';beacon.dataset.world=b.id;}
 if(!active)return;const phases={helmet:['引擎点火','航向锁定','驶入深空'],robot:['扫描身份','设施解锁','开启舱门'],car:['车灯亮起','引擎轻鸣','开进公园']};
 el.dataset.world=h.target;el.style.left=(h.x+1)*50+'%';el.style.top=(1-h.y)*50+'%';el.querySelector('.fill')?.setAttribute('stroke-dashoffset',(100-Math.min(1,h.progress||0)*100).toFixed(1));
 el.querySelector('span').textContent=(phases[h.target]||['正在靠近','正在连接','准备进入'])[h.progress<.34?0:h.progress<.75?1:2];}

function drawCombat(s){const c=$('#combat-overlay');c.hidden=s.mode!=='game'||s.world!=='robot'||!!s.paused||!!s.dead||!!s.awaitingControl;if(c.hidden)return;const w=innerWidth,h=innerHeight;if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;const ctx=c.getContext('2d');ctx.clearRect(0,0,w,h);const p=v=>[(v.x+1)*w/2,(1-v.y)*h/2];ctx.strokeStyle='#d0efffc9';ctx.lineWidth=1.2;if(s.world==='robot'){const cx=w/2,cy=h/2,g=s.reticleSpread??(s.aiming?3:7);ctx.globalAlpha=s.reticle==='hidden'?0:Math.max(0,1-Number(s.aimBlend??(s.aiming?1:0)));ctx.beginPath();ctx.moveTo(cx-g-6,cy);ctx.lineTo(cx-g,cy);ctx.moveTo(cx+g,cy);ctx.lineTo(cx+g+6,cy);ctx.moveTo(cx,cy-g-6);ctx.lineTo(cx,cy-g);ctx.moveTo(cx,cy+g);ctx.lineTo(cx,cy+g+6);ctx.stroke();if(s.hitIndicator){ctx.strokeStyle='#fff';ctx.beginPath();for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.moveTo(cx+a*9,cy+b*9);ctx.lineTo(cx+a*15,cy+b*15);}ctx.stroke();}ctx.globalAlpha=1;if(s.targetHostile&&Number.isFinite(s.targetHealth)&&s.targetMaxHealth){ctx.fillStyle='#08111fe8';ctx.fillRect(cx-42,cy+31,84,4);ctx.fillStyle='#efb7ad';ctx.fillRect(cx-42,cy+31,84*Math.max(0,Math.min(1,s.targetHealth/s.targetMaxHealth)),4);ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillStyle='#f2d5cf';ctx.fillText('敌人 '+s.targetHealth+' / '+s.targetMaxHealth,cx,cy+49);ctx.textAlign='start';}if(s.reloading){ctx.strokeStyle='#a2e1ff';ctx.beginPath();ctx.arc(cx,cy,22,-Math.PI/2,-Math.PI/2+Math.PI*2*(s.reloadProgress||0));ctx.stroke();}if(Number.isFinite(s.damageDirection)){ctx.strokeStyle='#ff9e8e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,52,s.damageDirection-Math.PI/2-.25,s.damageDirection-Math.PI/2+.25);ctx.stroke();}const hurt=Number(s.damageFlash||(s.hurt ? .5 : 0));if(hurt>0){ctx.strokeStyle=`rgba(228,112,99,${Math.min(.7,hurt)})`;ctx.lineWidth=6;ctx.strokeRect(3,3,w-6,h-6);}}if(s.lead?.visible){const [x,y]=p(s.lead);ctx.beginPath();ctx.moveTo(x,y-6);ctx.lineTo(x+6,y);ctx.lineTo(x,y+6);ctx.lineTo(x-6,y);ctx.closePath();ctx.stroke();if(s.target?.visible){const t=p(s.target);ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(t[0],t[1]);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);}}if(s.hitIndicator&&s.reticle?.visible){const [x,y]=p(s.reticle);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.beginPath();ctx.moveTo(x+a*9,y+b*9);ctx.lineTo(x+a*15,y+b*15);ctx.stroke();}}}
// Toy park map keeps a north-up heading and the original world projection.
let driveMapFollow = false;
let driveMapCollapsed = coarse;
function driveMapTransform(s, follow = driveMapFollow) {
  const size = 288, inset = 24;
  const suppliedBounds = Number(s.map?.bounds || Number(s.mapSize) / 2 || 560);
  const bounds = Number.isFinite(suppliedBounds) && suppliedBounds > 0 ? suppliedBounds : 560;
  const halfSpan = follow ? Math.min(bounds*.48, 90) : bounds;
  const centre = follow ? s.position : {x: 0, z: 0};
  const scale = (size / 2 - inset) / halfSpan;
  // Keep a right-handed map: +X east, -Z north. A left steering input
  // must turn the map arrow counterclockwise, just as the car turns in 3D.
  return {
    size, bounds, halfSpan, scale,
    project(p) {
      return {x: size / 2 + (Number(p.x ?? p[0]) - centre.x) * scale,
              y: size / 2 + (Number(p.z ?? p[1]) - centre.z) * scale};
    },
    contains(p, margin = 12) {
      return p.x >= margin && p.x <= size - margin && p.y >= margin && p.y <= size - margin;
    }
  };
}
function drawMap(s){
 const map=$('#drive-map'),panel=$('#drive-map-panel');
 const visible=s.mode==='game'&&s.world==='car'&&s.position&&Number.isFinite(s.position.x)&&Number.isFinite(s.position.z);
 map.hidden=!visible||driveMapCollapsed;panel.hidden=!visible;panel.classList.toggle('is-collapsed',driveMapCollapsed);$('#drive-map-toggle').setAttribute('aria-expanded',String(!driveMapCollapsed));$('#drive-map-toggle').setAttribute('aria-label',driveMapCollapsed?'展开公园地图':'收起公园地图');$('#drive-map-toggle').textContent=driveMapCollapsed?'+':'−';if(!visible){map._driveMapView=null;return;}
 const ctx=map.getContext('2d');if(!ctx)return;
 const view=driveMapTransform(s),{size,project,contains}=view,ratio=Math.min(2,Math.max(1,devicePixelRatio||1));
 if(map.width!==Math.round(size*ratio)||map.height!==Math.round(size*ratio))map.width=map.height=Math.round(size*ratio);
 ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,size,size);
 ctx.fillStyle='#efbd88';ctx.fillRect(0,0,size,size);ctx.lineJoin='round';ctx.lineCap='round';
 const roads=s.map?.roads||s.mapRoads||[];
 function roadLine(road,color,width){const pts=road.points||road;if(!Array.isArray(pts)||pts.length<2)return;ctx.beginPath();pts.forEach((point,i)=>{const q=project(point);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
 for(const road of roads)roadLine(road,'#c98858',6);for(const road of roads)roadLine(road,'#fff1d3',3.5);
 ctx.font='500 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 const used=[];
 for(const spot of s.landmarks||[]){const q=project(spot);if(!contains(q,22))continue;ctx.fillStyle='#965337';ctx.beginPath();ctx.arc(q.x,q.y,3,0,Math.PI*2);ctx.fill();if(used.every(p=>Math.hypot(p.x-q.x,p.y-q.y)>34)){const label=spot.name||'';const w=ctx.measureText(label).width+10;ctx.fillStyle='#fff3d9e8';ctx.fillRect(q.x-w/2,q.y+7,w,16);ctx.fillStyle='#633c2c';ctx.fillText(label,q.x,q.y+15);used.push(q);}}
 const q=project(s.position),x=Math.max(16,Math.min(size-16,q.x)),y=Math.max(16,Math.min(size-16,q.y));
 const angle=Number.isFinite(s.mapHeading)?s.mapHeading:Math.PI-(Number(s.heading)||0);
 ctx.save();ctx.translate(x,y);ctx.fillStyle='#f9f4e7';ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(8,9);ctx.lineTo(0,5);ctx.lineTo(-8,9);ctx.closePath();ctx.fillStyle='#df3e28';ctx.fill();ctx.strokeStyle='#fff6e7';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
 ctx.fillStyle='#fff3d9db';ctx.fillRect(8,8,27,32);ctx.fillStyle='#633c2c';ctx.font='600 11px system-ui';ctx.fillText('N',21,19);ctx.beginPath();ctx.moveTo(21,26);ctx.lineTo(17,34);ctx.lineTo(25,34);ctx.closePath();ctx.fill();
 const metres=driveMapFollow?25:50,bar=metres*view.scale;ctx.strokeStyle='#8b5337';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(13,size-18);ctx.lineTo(13+bar,size-18);ctx.stroke();ctx.font='9px system-ui';ctx.textAlign='left';ctx.fillText(metres+' m',13,size-29);
 const degrees=((angle*180/Math.PI)%360+360)%360,compass=['北','东北','东','东南','南','西南','西','西北'][Math.round(degrees/45)%8];
 $('#drive-map-heading').textContent='朝'+compass+' · '+(s.location||'自由漫游');$('#drive-map-route').textContent='连接道路';$('#drive-map-zoom').textContent=driveMapFollow?'全图':'跟随';$('#drive-map-zoom').setAttribute('aria-pressed',String(driveMapFollow));map.setAttribute('aria-label','公园地图，北向上。红色箭头是你，当前朝'+compass+'。所有道路自由探索。');map._driveMapView=view;
}

document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>world?.action('weapon',Number(b.dataset.weapon)));
let activeWeaponIndex=1;const heldControls=new Map();function releaseControls(){for(const key of new Set(heldControls.values())){if(key==='fire'||key==='aim')world?.action(key,false);else world?.action('control',{key,pressed:false});}heldControls.clear();}
document.querySelectorAll('[data-control]').forEach(b=>{b.addEventListener('pointerdown',e=>{if(!inGame||gameDead)return;if(latestState.awaitingControl){e.preventDefault();world?.action('takeControl');return;}if(gamePaused)return;e.preventDefault();const action=b.dataset.gameAction;if(action){world?.action(action==='cycleweapon'?'weapon':action,action==='cycleweapon'?(activeWeaponIndex%4)+1:undefined);return;}b.setPointerCapture(e.pointerId);heldControls.set(e.pointerId,b.dataset.control);if(['fire','aim'].includes(b.dataset.control))world?.action(b.dataset.control,true);else world?.action('control',{key:b.dataset.control,pressed:true});});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>{const key=heldControls.get(e.pointerId);heldControls.delete(e.pointerId);if(key&&![...heldControls.values()].includes(key)){if(key==='fire'||key==='aim')world?.action(key,false);else world?.action('control',{key,pressed:false});}});});
window.addEventListener('blur',releaseControls);
$('#retry-game-model').onclick=()=>world?.action('retry');$('#exit-game').onclick=()=>{if(recovering)cancelRecoveryVisit();else world?.action('exit');};$('#restart-game').onclick=()=>{releaseControls();world?.action('restart');};
function togglePause(){if(recovering){cancelRecoveryVisit();return;}if(['travel','return'].includes(currentMode)){world?.action('exit');return;}if(currentMode!=='game')return;releaseControls();world?.action(gamePaused?'resume':'pause','manual');}
$('#pause-game').onclick=togglePause;$('#help-game').onclick=()=>{if(currentMode==='game'){releaseControls();world?.action('pause','help');}};$('#resume-game').onclick=()=>world?.action(latestState.completed?'explore':'resume');$('#retry-checkpoint').onclick=()=>{releaseControls();world?.action('retryCheckpoint');};$('#pause-restart').onclick=()=>{releaseControls();world?.action('restart');};$('#pause-exit').onclick=()=>{if(recovering)cancelRecoveryVisit();else world?.action('exit');};$('#next-difficulty').onclick=()=>{releaseControls();world?.action('nextDifficulty');};
window.addEventListener('keydown',e=>{if(!inGame||e.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;if(['Escape','KeyP'].includes(e.code)||e.key==='Escape'){if(e.repeat)return;if((e.code==='Escape'||e.key==='Escape')&&document.pointerLockElement)return;e.preventDefault();togglePause();}else if(e.code==='KeyH'&&currentMode==='game'&&currentWorld!=='car'){e.preventDefault();releaseControls();world?.action('pause','help');}if(e.key==='Tab'&&!$('#pause-panel').hidden){const list=[...$('#pause-panel').querySelectorAll('button:not([hidden])')],first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});

$('#retry-model').onclick=()=>world?.action('retry');document.querySelectorAll('[data-action]').forEach(b=>{b.onclick=()=>{if(light||recovering)return;world?.action('enter',b.dataset.action);};b.addEventListener('keydown',event=>{if(event.repeat&&['Enter','NumpadEnter','Space'].includes(event.code))event.preventDefault();});});
function renderFailure(error){recovering=false;hostGeneration++;const old=world;world=null;try{old?.dispose();}catch{}console.error('HEYBOX runtime:',error);failed=true;light=true;releaseControls();if(inGame){try{world?.action('exit');}catch{}finally{gameVisibility('showcase');}}document.body.classList.add('light');$('#runtime-notice').hidden=false;$('#runtime-notice').textContent='此设备的 3D 画面暂未启动，已自动显示静态页面。刷新页面可重试。';$('#render-mode').textContent='STATIC VIEW';enter();}
const timeout=setTimeout(()=>{if(!ready&&!failed){light=true;document.body.classList.add('light');$('#runtime-notice').hidden=false;$('#runtime-notice').textContent='3D 资源仍在载入，就绪后会自动切换。';enter();}},20000);
function cancelRecoveryVisit(){
 recovery.cancelResume();releaseControls();gameVisibility('showcase');currentMode='showcase';latestState={mode:'showcase',world:currentWorld};
 $('#runtime-notice').hidden=false;$('#runtime-notice').textContent='已返回章节 · 图形恢复后可重新进入';
}
const recovery=createContextRecovery({
 create:async(snapshot,token)=>{const host=await createHost(snapshot,token);if(!token.register(host))return host;world=host;await host.recoveryReady;return host;},
 status:(phase,host)=>{
  if(phase==='lost'||phase==='rebuilding'){recovering=true;releaseControls();audio.setPaused(true);worldSnap?.cancel();$('#runtime-notice').hidden=false;$('#runtime-notice').textContent=phase==='lost'?'图形连接中断 · 正在恢复，可按 Esc 返回章节':'正在重建图形与安全检查点 · 可按 Esc 返回章节';}
  if(phase==='ready'){recovering=false;world=host;ready=true;light=false;failed=false;document.body.classList.remove('light');$('#runtime-notice').hidden=true;host.setPaused(document.hidden);state(host.getState());clearTimeout(timeout);status('世界已展开',100,'READY');enter();if(!inGame)update();}
 },
 fallback:(error,snapshot)=>{renderFailure(error);$('#runtime-notice').textContent='图形恢复未完成，已返回原章节静态页面。刷新页面可重新尝试。';}
});
async function createHost(snapshot=null,token=null){
 const generation=++hostGeneration;const current=()=>generation===hostGeneration&&(!token||token.current());
 const host=await worldFactory($('#world'),{audio,recoverySnapshot:snapshot,signal:token?.signal,
  onFrame:s=>{if(!current())return;drawCombat(s);drawHover(s);drawTravel(s);renderAim(s);},
  onReady:()=>{if(!current()||recovering)return;ready=true;light=false;failed=false;clearTimeout(timeout);document.body.classList.remove('light');$('#runtime-notice').hidden=true;status('世界已展开',100,'READY');enter();requestAnimationFrame(()=>{if(!current()||performance.getEntriesByName('heybox-first-frame').length)return;performance.mark('heybox-first-frame');if(new URLSearchParams(location.search).has('measure'))console.info('HEYBOX first frame:',Math.round(performance.now()),'ms');});},
  onState:s=>{if(current()&&!recovering)state(s);},
  onContextLost:(saved,source)=>{if(current())recovery.lost(source,saved);},
  onError:error=>{if(!current())return;if(recovering)recovery.fail(error);else renderFailure(error);}
 });
 if(!current()){host.dispose();return host;}
 host.setReducedMotion(reduced);host.setQuality?.(quality);if($('#loading').classList.contains('done'))host.startIntro?.({instant:true});host.setScrollState?.(worldSnap?.getState?.()||{stable:false,scrolling:false,snapping:false,velocity:0});host.setPaused(worldPaused());return host;
}
async function boot(){
 try{
  document.body.style.overflowY='hidden';status('点亮引擎',25,'LINK');
  // The module graph is preloaded by HTML. Reuse it instead of fetching every file twice.
  worldFactory=(await import('./open-adventure.js?v=journey-39')).createWorld;
  status('连接游戏世界',88,'GRAINS');world=await createHost();update();
 }catch(e){clearTimeout(timeout);renderFailure(e);}
}
function update(){queued=false;if(inGame)return;const total=Math.max(1,document.documentElement.scrollHeight-innerHeight),frames=[...document.querySelectorAll('.frame')],measurements=frames.map(s=>({rect:s.getBoundingClientRect(),height:s.offsetHeight})),navLinks=[...document.querySelectorAll('.side-nav a')],navTops=navLinks.map(a=>$(a.getAttribute('href')).getBoundingClientRect().top);$('.scroll-meter i').style.width=Math.max(0,Math.min(1,scrollY/total))*100+'%';let active=0,p=0;frames.forEach((s,i)=>{const r=measurements[i].rect,h=innerHeight,v=Math.max(0,Math.min(1,(r.bottom-h*.55)/(h*.2),(h*.55-r.top)/(h*.25))),copy=s.querySelector('.copy');copy.style.setProperty('--opacity',v);copy.style.visibility=v<.03?'hidden':'visible';if(r.top<=h*.2){active=i;const span=s.classList.contains('finale')?Math.max(1,Math.min(measurements[i].height-h*.8,total-(r.top+scrollY)+h*.2)):measurements[i].height;const t=Math.max(0,Math.min(1,(-r.top+h*.2)/span));p=Number(s.dataset.p)+(Number(s.dataset.end)-Number(s.dataset.p))*t;}});lastP=p;world?.setProgress(p);let nav=0;navTops.forEach((top,i)=>{if(top<innerHeight*.4)nav=i;});navLinks.forEach((a,i)=>a.classList.toggle('active',i===nav));const frame=frames[active];frames.forEach(f=>f.classList.toggle('lit',f===frame));titleDecode.settings(quality,reduced);titleDecode.show(frame);const phase=(frame.querySelector('h1,h2')?.getAttribute('aria-label')||frame.querySelector('h1,h2')?.textContent||'').trim();$('#chapter-status').textContent=phase;$('#journey-phase').textContent=phase;$('#journey-percent').textContent=String(Math.round(p*100)).padStart(2,'0')+'%';document.body.classList.toggle('transit-mode',!frame.classList.contains('landing')&&!frame.classList.contains('finale'));document.body.style.setProperty('--journey-progress',p);document.body.classList.toggle('at-top',p<.015);}
window.addEventListener('scroll',()=>{if(recovering&&!inGame&&Math.abs(scrollY-savedY)>2)recovery.cancelResume();if(!queued){queued=true;requestAnimationFrame(update);}},{passive:true});window.addEventListener('resize',update);window.addEventListener('pointermove',e=>{if(!inGame)world?.setPointer(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);},{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseControls();world?.setPaused(worldPaused());});window.addEventListener('pagehide',()=>{hostGeneration++;recovery.dispose();world?.dispose();world=null;},{once:true});
$('#world').addEventListener('webglcontextrestored',()=>{if(world?.isContextAvailable?.())recovery.restored();});
for(const type of ['wheel','touchstart'])window.addEventListener(type,()=>{if(recovering)cancelRecoveryVisit();},{passive:true});
// Enter starts the world whose chapter is on screen, unless focus is already on a control.
window.addEventListener('keydown',event=>{if(inGame||light||recovering||event.repeat||!['Enter','NumpadEnter'].includes(event.code)||event.target?.closest?.('a,button,input,textarea,select,[contenteditable]'))return;const frame=[...document.querySelectorAll('.frame.landing')].find(s=>{const r=s.getBoundingClientRect();return r.top<=innerHeight*.35&&r.bottom>=innerHeight*.6;}),button=frame?.querySelector('[data-action]');if(!button||frame.querySelector('.copy').style.visibility==='hidden')return;event.preventDefault();button.click();});
window.addEventListener('keydown',event=>{if(recovering&&['Escape','PageDown','PageUp','Home','End','ArrowDown','ArrowUp','Space'].includes(event.code)){cancelRecoveryVisit();}});
document.addEventListener('click',event=>{if(recovering&&event.target?.closest?.('a[href^="#"]'))cancelRecoveryVisit();});
boot();requestAnimationFrame(update);

// Sound is always on: the first trusted gesture anywhere unlocks it, and there is no mute control.
async function unlockSound(){try{await audio.unlock();}catch{}}
for(const type of ['pointerdown','pointerup','click','touchend'])document.addEventListener(type,unlockSound,{passive:true,capture:true});document.addEventListener('keydown',e=>{if(!e.repeat)unlockSound();},{capture:true});
document.addEventListener('visibilitychange',()=>audio.setPaused(document.hidden||gamePaused||recovering||failed));window.addEventListener('pagehide',()=>audio.dispose(),{once:true});

// Map controls remain separate from driving input.
$('#drive-map-toggle').onclick=()=>{
 if(currentMode!=='game'||currentWorld!=='car'||gamePaused||gameDead)return;
 driveMapCollapsed=!driveMapCollapsed;drawMap(latestState);
};
$('#drive-map').title='红色箭头是你 · 北向上 · 所有道路自由探索';
$('#drive-map-zoom').onclick = () => {
  if (currentMode !== 'game' || currentWorld !== 'car' || gamePaused || gameDead) return;
  driveMapFollow = !driveMapFollow;
  drawMap(latestState);
};
// The panel is a HUD surface, never a steering drag or a canvas click.
for (const type of ['pointerdown', 'pointermove', 'click']) $('#drive-map-panel').addEventListener(type, e => e.stopPropagation());
// Let native button activation work without Space also applying the handbrake.
for (const type of ['keydown', 'keyup']) $('#drive-map-panel').addEventListener(type, e => {
  if (e.target?.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
    if (type === 'keyup' && e.code === 'Space') world?.action('control', {key: e.code, pressed: false});
    e.stopPropagation();
  }
});


function renderSquad(s){const panel=$('#squad-status');panel.hidden=s.mode!=='game'||s.world!=='robot'||!Array.isArray(s.allies);if(panel.hidden)return;const labels={waiting:'等待救援',follow:'跟随',following:'跟随',combat:'交火',attack:'交火',engage:'交火',support:'支援',repair:'补充护盾',recharge:'补充护盾',scan:'侦察',idle:'警戒',regroup:'归队',reposition:'寻找射界'};panel.textContent=s.allies.map(a=>(a.name||a.id)+(a.role?' / '+a.role:'')+' · '+(a.rescued?(labels[a.state]||a.state||'跟随'):'等待救援')+(a.kills?' · 击杀 '+a.kills:'')).join('\n')+'\n支援命中伤害 '+Math.round(s.supportDamage||0)+' · 护盾补充 '+Math.round(s.supportShieldRestored||0);}

worldSnap=createIdleWorldSnap({getEnabled:()=>ready&&!light&&!failed&&!inGame&&$('#loading').classList.contains('done'),getReducedMotion:()=>reduced,onState:s=>world?.setScrollState?.(s)});window.addEventListener('pagehide',()=>worldSnap?.dispose(),{once:true});

// Local expedition record: no account, network analytics or official rewards.
const visitRecords={};try{const stored=JSON.parse(localStorage.getItem('heybox-expedition-v1')||'{}');for(const id of ['helmet','robot','car']){const v=stored[id];if(v&&Number.isFinite(v.difficulty))visitRecords[id]={difficulty:Math.max(1,Math.min(3,v.difficulty)),score:Math.max(0,Number(v.score)||0)};}}catch{}
const completedSessionKeys=new Set();
function renderSession(s){
 const hint=$('#control-hint');hint.hidden=s.mode!=='game'||!s.awaitingControl||!!s.arriving||!!s.paused;
 if(!hint.hidden)hint.textContent=s.world==='car'?'公园已就绪 · 按 W 或方向键开始自由驾驶':s.world==='helmet'?'小飞船就位 · 按方向键或空格出发':s.pointerLockAvailable===false?'安全观察中 · 点击或拖动画面接管视角，Esc 可返回菜单':'安全观察中 · 点击画面接管视角 · 接管前不计时、不受伤';
 document.body.classList.toggle('awaiting-control',!hint.hidden);document.body.classList.toggle('roaming',s.mode==='game'&&(s.world==='car'||s.world==='helmet'));document.body.classList.toggle('toy-space',s.mode==='game'&&s.world==='helmet');
 if(s.mode==='return'||s.lifecycle==='return'||s.returning)$('#travel-world').textContent='返回原来的旅程';
 const key=[s.world,s.sessionId??'legacy',s.difficulty??1].join(':');
 if(s.completed&&s.world!=='car'&&s.mode==='game'&&!completedSessionKeys.has(key)){
  completedSessionKeys.add(key);const old=visitRecords[s.world]||{};
  visitRecords[s.world]={difficulty:Math.max(old.difficulty||0,Number(s.difficulty)||1),score:Math.max(old.score||0,Number(s.score)||0)};
  try{localStorage.setItem('heybox-expedition-v1',JSON.stringify(visitRecords));}catch{}
 }
 const info=[];if(s.stageLabel)info.push(s.stageLabel);if(Number.isFinite(s.cargoIntegrity))info.push('货物完好 '+Math.round(s.cargoIntegrity)+'%');if(s.routeChoiceLabel||s.routeMode)info.push(s.routeChoiceLabel||(s.routeMode==='short'?'最短路线':'安全路线'));const elapsed=s.missionElapsed??s.deliveryTime;if(Number.isFinite(elapsed))info.push('任务 '+formatRunTime(elapsed));
 const strip=$('#session-detail');strip.hidden=s.world==='car'||s.mode!=='game'||!info.length||!!s.awaitingControl;strip.textContent=info.join(' · ');
}

function renderQuality(){titleDecode.settings(quality,reduced);document.body.dataset.quality=quality;}
renderQuality();

function worldPaused(){return document.hidden||failed;}
const scrollFx=createScrollFx({isPaused:()=>inGame});
window.addEventListener('pagehide',()=>scrollFx.dispose(),{once:true});
