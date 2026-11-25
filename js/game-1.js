
function keepAnyBossAwayFromPlayer(boss){
  if(!boss || typeof player==='undefined' || !player) return;
  const minDistance=120;
  const px=Number(player.x ?? canvas.width/2), py=Number(player.y ?? canvas.height-120);
  let bx=Number(boss.x ?? canvas.width/2), by=Number(boss.y ?? 120);
  let dx=bx-px, dy=by-py, d=Math.hypot(dx,dy);
  if(d<minDistance){
    if(d<0.001){dx=0;dy=-1;d=1;}
    bx=px+dx/d*minDistance; by=py+dy/d*minDistance;
    const m=50;
    boss.x=Math.max(m,Math.min(canvas.width-m,bx));
    boss.y=Math.max(m,Math.min(canvas.height-m,by));
    if(Math.hypot(boss.x-px,boss.y-py)<minDistance){
      boss.x=Math.max(m,Math.min(canvas.width-m,canvas.width/2));
      boss.y=m+20;
    }
  }
}


/* === 真ボス瞬間移動：プレイヤーと重ならない位置へ補正 === */
function keepBossAwayFromPlayer(boss){
  if(!boss || typeof player==='undefined' || !player) return;
  const minDistance=120;
  const px=Number(player.x ?? canvas.width/2), py=Number(player.y ?? canvas.height-120);
  let bx=Number(boss.x ?? canvas.width/2), by=Number(boss.y ?? 120);
  let dx=bx-px, dy=by-py, d=Math.hypot(dx,dy);
  if(d<minDistance){
    if(d<0.001){dx=0;dy=-1;d=1;}
    bx=px+dx/d*minDistance; by=py+dy/d*minDistance;
    const m=50;
    boss.x=Math.max(m,Math.min(canvas.width-m,bx));
    boss.y=Math.max(m,Math.min(canvas.height-m,by));
    if(Math.hypot(boss.x-px,boss.y-py)<minDistance){
      boss.x=Math.max(m,Math.min(canvas.width-m,canvas.width/2));
      boss.y=m+20;
    }
  }
}


/* === ラスボス拘束技：鎖を主人公へ飛ばし、鎖ヒット時のみ拘束 === */
let finalBossChains = [];
let finalBossChainCooldown = 0;

function spawnFinalBossChain(){
  // v143: player が未初期化/TDZ中でもラスボス処理で例外を起こさない
  if(typeof player === 'undefined' || !player || !bossActive) return;
  const bx = Number(bossActive.x ?? canvas.width/2);
  const by = Number(bossActive.y ?? 120);
  const px = Number(player.x ?? canvas.width/2);
  const py = Number(player.y ?? canvas.height-120);
  const dx = px-bx, dy = py-by;
  const len = Math.hypot(dx,dy) || 1;
  finalBossChains.push({
    x: bx, y: by,
    vx: dx/len*6.5, vy: dy/len*6.5,
    life: 180, hit:false
  });
}

function updateFinalBossChains(){
  if(typeof player === 'undefined' || !player) return;
  for(let i=finalBossChains.length-1;i>=0;i--){
    const c=finalBossChains[i];
    c.x+=c.vx; c.y+=c.vy; c.life--;
    const px=Number(player?.x||0), py=Number(player?.y||0);
    if(!c.hit && Math.hypot(c.x-px,c.y-py) < 28){
      c.hit=true;
      // 鎖に実際に接触した時だけ拘束を開始（鎖自体はダメージなし）
      // 鎖はダメージなし。接触した瞬間だけ既存の拘束状態を開始する。
      if(typeof player !== 'undefined' && player && !player.bossBind){
        player.bossBind = true;
        player.bossBindCount = 0;
        player.bossBindRequired = (typeof BOSS_ABILITY_CONFIG !== 'undefined' && BOSS_ABILITY_CONFIG.bind)
          ? BOSS_ABILITY_CONFIG.bind.required : 15;
        if(typeof bossActive !== 'undefined' && bossActive){
          bossActive.bindState = 'active';
          bossActive.bindT = 0;
          bossActive.frozen = true;
          bossActive.timers = bossActive.timers || {};
          bossActive.timers.bind = (typeof BOSS_ABILITY_CONFIG !== 'undefined' && BOSS_ABILITY_CONFIG.bind)
            ? BOSS_ABILITY_CONFIG.bind.interval : 12000;
        }
        if(typeof showBossBind === 'function') showBossBind();
        if(typeof spawnRing === 'function') spawnRing(player.x,player.y,'rgba(255,20,147,0.95)',95,500);
        if(typeof spawnSpark === 'function') spawnSpark(player.x,player.y,'#ff1493',24);
        if(typeof addShake === 'function') addShake(8);
      }
      finalBossChains.splice(i,1);
      continue;
    }
    if(c.life<=0 || c.x<-50 || c.x>canvas.width+50 || c.y<-50 || c.y>canvas.height+50){
      finalBossChains.splice(i,1);
    }
  }
}

function drawFinalBossChains(ctx){
  ctx.save();
  ctx.lineWidth=6;
  ctx.strokeStyle='rgba(210,210,225,.95)';
  for(const c of finalBossChains){
    const tailX=c.x-c.vx*4, tailY=c.y-c.vy*4;
    ctx.beginPath();
    ctx.moveTo(tailX,tailY);
    ctx.lineTo(c.x,c.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x,c.y,9,0,Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}


// ---------- セーブデータ & 実績システム（新規ゲームは全実績0から開始） ----------
const DEFAULT_SAVE = {
  totalPlayTime: 0,    // 累計プレイ時間（秒）
  lastRunScore: 0,     // 前回ゲームオーバー時のスコア
  totalDamage: 0,      // 累計ダメージ（スコア）
  totalKills: 0,       // 累計討伐数（ボス含む）
  totalMinionKills: 0, // 雑魚敵の累計討伐数（ボスは含まない）
  maxWeaponSlots: 7,   // 通常時の武器最大所持枠
  finalBossDefeated: false, // ラスボス撃破後は武器枠無制限
  achievements: {
    octopus: 0,        // 互換用キー。表示は累計モンスター討伐数
    rose: 0,           // 🌹
    paw: 0,            // 🐾
    anger: 0,          // 💢
    katachan: 0,       // かたちゃん (目標 10)
    kingKatachan: 0    // 王者かたちゃん (従来表示用)
  },
  trueBossUnlocked: false
};

let saveData = (()=>{
  try{
    const raw = JSON.parse(localStorage.getItem('katachan_save_v4') || 'null');
    return {
      ...DEFAULT_SAVE,
      ...(raw || {}),
      // 旧セーブの maxWeaponSlots=3 は今回の仕様では通常時7枠へ移行
      maxWeaponSlots: 7,
      finalBossDefeated: !!(raw && raw.finalBossDefeated),
      totalMinionKills: Math.max(0, Number(raw && raw.totalMinionKills) || 0),
      trueBossUnlocked: !!(raw && raw.trueBossUnlocked),
      achievements: {...DEFAULT_SAVE.achievements, ...((raw && raw.achievements) || {})}
    };
  }catch(e){
    return {...DEFAULT_SAVE, achievements:{...DEFAULT_SAVE.achievements}};
  }
})();

function saveGame() {
  localStorage.setItem('katachan_save_v4', JSON.stringify(saveData));
}

// 真のボスモード解放条件：雑魚10万体・かたちゃん100体・ラスボス10体。
const TRUE_BOSS_REQUIREMENTS = { minions:100000, katachan:100, finalBoss:10 };
function isTrueBossUnlocked(){
  return Number(saveData.totalMinionKills||0) >= TRUE_BOSS_REQUIREMENTS.minions
    && Number(saveData.achievements.katachan||0) >= TRUE_BOSS_REQUIREMENTS.katachan
    && Number(saveData.achievements.kingKatachan||0) >= TRUE_BOSS_REQUIREMENTS.finalBoss;
}
function refreshTrueBossUnlock(){
  const unlocked = isTrueBossUnlocked();
  if(unlocked && !saveData.trueBossUnlocked){
    saveData.trueBossUnlocked = true;
    saveGame();
  } else if(unlocked) {
    saveData.trueBossUnlocked = true;
  }
  return !!saveData.trueBossUnlocked;
}
refreshTrueBossUnlock();

let runScore = 0;
// 複数レベル分のレベルアップ選択を順番に処理するための保留数
let pendingLevelUps = 0;
// ラスボス撃破後、このプレイ中だけ武器枠を無制限にする
let weaponSlotsUnlimitedThisRun = false;

function addScore(amount){
  const n = Number(amount);
  if(!Number.isFinite(n) || n <= 0) return;
  // SCOREは今回のプレイ分だけ。累計ダメージは従来どおり保存。
  runScore = Math.max(0, Number(runScore)||0) + n;
  saveData.totalDamage = Math.max(0, Number(saveData.totalDamage)||0) + n;
}

// 通常時は7枠。ラスボス撃破後、同じプレイを続けている間だけ無制限。
function weaponSlotLimit(){
  return weaponSlotsUnlimitedThisRun ? Infinity : 7;
}

(function(){
"use strict";

// ---------- Canvas setup ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreVal = document.getElementById('score-val');
const statTime = document.getElementById('stat-time');
const achMinions = document.getElementById('ach-minions');
const statDamage = document.getElementById('stat-damage');
const achKatachan = document.getElementById('ach-katachan');
const achKing = document.getElementById('ach-king');
function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// ---------- Stage / boss backgrounds (tiled pattern) ----------
const STAGE_BG_B64 = 'assets/images/d3e84245383450908c232256.jpg';
const BOSS_BG_B64 = null; // boss background is drawn as a full-screen cover image
const BOSS_BG_PHASE3_IMAGE_B64 = 'assets/images/f943e190de10e42bbd6cd2c4.jpg';
const BOSS_BG_PHASE2_IMAGE_B64 = 'assets/images/403201d93b48b91d16418b8e.png';
const BOSS_BG_IMAGE_B64 = 'assets/images/3e1b5153245e1070e4104c1f.png';
const BG_TILE_SIZE = 320;
let stageBgPattern = null;
let bossBgPattern = null;
let bossBgImage = null;
let bossBgPhase2Image = null;
let bossBgPhase3Image = null;
function loadBgPattern(b64src, onReady){
  if(!b64src) return;
  const img = new Image();
  img.onload = ()=>{
    try{
      const off = document.createElement('canvas');
      off.width = BG_TILE_SIZE; off.height = BG_TILE_SIZE;
      const octx = off.getContext('2d');
      octx.drawImage(img, 0, 0, BG_TILE_SIZE, BG_TILE_SIZE);
      onReady(ctx.createPattern(off, 'repeat'));
    } catch(e){ /* pattern API unavailable in this environment; grid fallback stays in use */ }
  };
  img.src = b64src;
}
loadBgPattern(STAGE_BG_B64, (p)=>{ stageBgPattern = p; });
loadBgPattern(BOSS_BG_B64, (p)=>{ bossBgPattern = p; });
if(BOSS_BG_IMAGE_B64){
  const img = new Image();
  img.onload = ()=>{ bossBgImage = img; };
  img.src = BOSS_BG_IMAGE_B64;
}
if(BOSS_BG_PHASE2_IMAGE_B64){
  const img = new Image();
  img.onload = ()=>{ bossBgPhase2Image = img; };
  img.src = BOSS_BG_PHASE2_IMAGE_B64;
}
if(BOSS_BG_PHASE3_IMAGE_B64){
  const img = new Image();
  img.onload = ()=>{ bossBgPhase3Image = img; };
  img.src = BOSS_BG_PHASE3_IMAGE_B64;
}

// ---------- Player characters (boy has 5 evolution tiers, changes every 10 levels) ----------
const CHARACTERS = {
  boy: {
    label: '男の子',
    icon: '👦',
    defs: [
      { b64:'assets/images/7a3f99909c45f807bbad1558.png', w:58, h:82 },
      { b64:'assets/images/6bc2f0300e61a73cf7d21aa0.png', w:81, h:82 },
      { b64:'assets/images/25960ea106cf4cb22d1cbda4.png', w:88, h:82 },
      { b64:'assets/images/d0debc4db204a4e65c17d5d6.png', w:85, h:82 },
      { b64:'assets/images/f4860f674f9c2a40fc330d2a.png', w:82, h:82 }
    ],
  },
  girl: {
    label: '女の子',
    icon: '👧',
    defs: [
      { b64:'assets/images/d1ef23b1fc4965255d59b810.png', w:60, h:68 },
      { b64:'assets/images/a8cfc36d520b0ea3c9946f58.png', w:72, h:71 },
      { b64:'assets/images/3c47dfc4993b9f4eea042603.png', w:82, h:81 },
    ],
  },
};
let selectedCharacter = 'girl';
Object.keys(CHARACTERS).forEach(key=>{
  const ch = CHARACTERS[key];
  ch.sprites = ch.defs.map(def=>{
    const img = new Image();
    const entry = { img, w:def.w, h:def.h, loaded:false };
    img.onload = ()=>{ entry.w = entry.w || img.naturalWidth; entry.h = entry.h || img.naturalHeight; entry.loaded = true; };
    img.src = def.b64;
    return entry;
  });
});
function currentPlayerSprite(){
  const ch = CHARACTERS[selectedCharacter] || CHARACTERS.girl;
  const tier = Math.min(ch.sprites.length-1, Math.floor((player.level-1)/10));
  return ch.sprites[tier];
}

// ---------- Boss sprites ----------
const BOSS_SPRITE_DEFS = {
  behemoth:  { b64:'assets/images/39e79332021230b67cc167f2.png', w:235, h:260 },
  lich:      { b64:'assets/images/a440a1f4ceaa8956f9dd7376.png', w:243, h:260 },
  dragon:    { b64:'assets/images/606d78cbc5f4ec347cfe8723.png', w:260, h:237 },
  demonking: { b64:'assets/images/3106680ec690df99febdf974.png', w:260, h:249 },
};
BOSS_SPRITE_DEFS.trueking = {
  b64:'assets/images/5f83e77b849af54ab72bda9c.png', w:1814, h:1635
};
const BOSS_SPRITES = {};
Object.keys(BOSS_SPRITE_DEFS).forEach(key=>{
  const def = BOSS_SPRITE_DEFS[key];
  const img = new Image();
  const entry = { img, w:def.w, h:def.h, loaded:false };
  img.onload = ()=>{ entry.w = entry.w || img.naturalWidth; entry.h = entry.h || img.naturalHeight; entry.loaded = true; };
  img.src = def.b64;
  BOSS_SPRITES[key] = entry;
});
const TRUE_BOSS_SPRITE = (()=>{
  const def = BOSS_SPRITE_DEFS.trueking;
  if(!def) return null;
  const img = new Image();
  const entry = { img, w:def.w, h:def.h, loaded:false };
  img.onload = ()=>{ entry.w = entry.w || img.naturalWidth; entry.h = entry.h || img.naturalHeight; entry.loaded = true; };
  img.onerror = ()=>{ entry.loaded = false; };
  img.src = def.b64;
  // BOSS_SPRITES側にも同じ参照を入れて、既存処理との互換性を維持。
  BOSS_SPRITES.trueking = entry;
  return entry;
})();
const TRUE_BOSS_ROLE_SPRITES = {};
const TRUE_BOSS_ROLE_DEFS = {
  kata: { normal: {b64:'assets/images/7bf7b6a2bb76ae7f99c275f3.png', w:1254, h:1254}, hit: {b64:'assets/images/ca580e240ab180540fd38759.png', w:715, h:1212} },
  sui:  { normal: {b64:'assets/images/17dc90944864c0292f75fb65.png', w:1254, h:1254}, hit: {b64:'assets/images/d01f747dad9d9c6d525f69a6.png', w:1020, h:1287} }
};
Object.keys(TRUE_BOSS_ROLE_DEFS).forEach(role=>{
  TRUE_BOSS_ROLE_SPRITES[role] = {};
  Object.keys(TRUE_BOSS_ROLE_DEFS[role]).forEach(stateKey=>{
    const def = TRUE_BOSS_ROLE_DEFS[role][stateKey];
    const img = new Image();
    const entry = {img, w:def.w, h:def.h, loaded:false};
    img.onload = ()=>{ entry.loaded=true; };
    img.src = def.b64;
    TRUE_BOSS_ROLE_SPRITES[role][stateKey] = entry;
  });
});
const TRUE_BOSS_TEDDY_SPRITES = {
  sui: {img:null, w:1254, h:1254, loaded:false},
  kata: {img:null, w:1254, h:1254, loaded:false}
};
(function(){
  const defs={sui:'assets/images/5e3e2a0c09e918a33be796a5.png',kata:'assets/images/128d7beaeaa9eec1c3149508.png'};
  Object.keys(defs).forEach(role=>{
    const img=new Image(), entry=TRUE_BOSS_TEDDY_SPRITES[role];
    entry.img=img;
    img.onload=()=>{entry.loaded=true;};
    img.onerror=()=>{entry.loaded=false;};
    img.src=defs[role];
  });
})();
// くまぬい用とは別管理にし、ガチャチケの効果時間中だけこの衣装を表示する。
const TRUE_BOSS_GACHA_SPRITES = {
  sui: {img:null, w:1254, h:1254, loaded:false},
  kata: {img:null, w:1254, h:1254, loaded:false}
};
(function(){
  const defs={sui:'assets/images/3bd35ce647e1dcd3ee8f1ee8.png',kata:'assets/images/7b42a0c2f8d5d85df42ab8a8.png'};
  Object.keys(defs).forEach(role=>{
    const img=new Image(), entry=TRUE_BOSS_GACHA_SPRITES[role];
    entry.img=img;
    img.onload=()=>{entry.loaded=true;};
    img.onerror=()=>{entry.loaded=false;};
    img.src=defs[role];
  });
})();

// ---------- Boss appearance cut-in images (full banner art, shown 5s on spawn) ----------
const BOSS_CUTIN_DEFS = {
  behemoth:  'assets/images/d89bed37765ef31383138812.jpg',
  lich:      'assets/images/602ea874b6bfea31468c3c69.jpg',
  dragon:    'assets/images/91d8646a7470d6e63fa0964d.jpg',
  demonking: 'assets/images/a45e4ddbe798b536884c8de2.jpg',
  trueking: 'assets/images/0e3e56390633873d222e839f.png',
  truebossfinal: 'assets/images/acfa1a2ae44d703f1986a10c.png',
};
const BOSS_CUTIN_DURATION = 5000;

// ---------- Regular enemy sprites ----------
const ENEMY_SPRITE_DEFS = {
  slime: { b64:'assets/images/43ec0d342895183be70774d7.png', w:140, h:126 },
  bat:   { b64:'assets/images/8215d9d77d507d98b787b179.png', w:140, h:135 },
  orc:   { b64:'assets/images/61593b535ddab5039a5b7c80.png', w:131, h:140 },
  ghost: { b64:'assets/images/5d597cafb89bf828a4ae71c3.png', w:127, h:140 },
  ogre:  { b64:'assets/images/e37bfa71f94838c9ffcb02a1.png', w:140, h:137 },
};
// ---------- Last boss phase 2 sprite (user-provided image) ----------
const BOSS_PHASE2_SPRITE = { img:new Image(), w:2048, h:2048, loaded:false };
BOSS_PHASE2_SPRITE.img.onload = ()=>{ BOSS_PHASE2_SPRITE.loaded=true; };
BOSS_PHASE2_SPRITE.img.src = 'assets/images/fda4729db9354f31c0455b3a.png';
// 第三形態ラスボス：ユーザー提供画像
const BOSS_PHASE3_SPRITE = { img:new Image(), w:2048, h:2048, loaded:false };
BOSS_PHASE3_SPRITE.img.onload = ()=>{ BOSS_PHASE3_SPRITE.loaded=true; };
BOSS_PHASE3_SPRITE.img.src = 'assets/images/8dbb351afbb8a0b7cd49935f.png';

// ===== END LAST BOSS PHASE 2 SPRITE =====

// ---------- Last boss phase 1 minion sprites (user-provided images) ----------
const BOSS_PHASE1_MINION_SPRITE_DEFS = {
  boss_phase1_1: {b64:'assets/images/bfef2a7db8b9ca0ebabd19fe.png', w:487, h:640},
  boss_phase1_2: {b64:'assets/images/9de4c9363f9aad555d632eaa.png', w:413, h:640},
  boss_phase1_3: {b64:'assets/images/2d3d4d7b27063144e4bacf29.png', w:387, h:640},
  boss_phase1_4: {b64:'assets/images/5c42709bf5f955d6d3707989.png', w:497, h:640},
  boss_phase1_5: {b64:'assets/images/b0915cd4e0c975d6babc0a41.png', w:398, h:640}
};
const ENEMY_SPRITES = {};
Object.keys(ENEMY_SPRITE_DEFS).forEach(key=>{
  const def = ENEMY_SPRITE_DEFS[key];
  const img = new Image();
  const entry = { img, w:def.w, h:def.h, loaded:false };
  img.onload = ()=>{ entry.w = entry.w || img.naturalWidth; entry.h = entry.h || img.naturalHeight; entry.loaded = true; };
  img.src = def.b64;
  ENEMY_SPRITES[key] = entry;
});

// ---------- True boss minion sprites (user-provided images) ----------
// 真ボス戦の雑魚モンスター専用。6枚をランダムに使用する。
const TRUE_BOSS_MINION_SPRITE_DEFS = {
  trueboss_minion_1: {b64:'assets/images/3e3f5375eff4e2b3bf1859f7.png', w:1254, h:1254},
  trueboss_minion_2: {b64:'assets/images/58893f07266cd24748615b26.png', w:1254, h:1254},
  trueboss_minion_3: {b64:'assets/images/4037458a8d8d550dcb9a4911.png', w:1254, h:1254},
  trueboss_minion_4: {b64:'assets/images/ff830cedaba0fc8359406840.png', w:1254, h:1254},
  trueboss_minion_5: {b64:'assets/images/79c654619463eb8d8c934e9c.png', w:1254, h:1254},
  trueboss_minion_6: {b64:'assets/images/aa2e151854578ccba50d085a.png', w:1254, h:1254}
};

Object.keys(TRUE_BOSS_MINION_SPRITE_DEFS).forEach(key=>{
  const def = TRUE_BOSS_MINION_SPRITE_DEFS[key];
  const img = new Image();
  const entry = { img, w:def.w, h:def.h, loaded:false };
  img.onload = ()=>{ entry.w = entry.w || img.naturalWidth; entry.h = entry.h || img.naturalHeight; entry.loaded = true; };
  img.src = def.b64;
  ENEMY_SPRITES[key] = entry;
});
Object.keys(BOSS_PHASE1_MINION_SPRITE_DEFS).forEach(key=>{
  const def = BOSS_PHASE1_MINION_SPRITE_DEFS[key];
  const img = new Image();
  const entry = { img, w:def.w, h:def.h, loaded:false };
  img.onload = ()=>{ entry.w = entry.w || img.naturalWidth; entry.h = entry.h || img.naturalHeight; entry.loaded = true; };
  img.src = def.b64;
  ENEMY_SPRITES[key] = entry;
});

// 真ボス雑魚敵は、実際に登録されている6枚だけを使う。
const TRUE_BOSS_MINION_KEYS = Object.keys(TRUE_BOSS_MINION_SPRITE_DEFS);
function randomTrueBossMinionSpriteKey(){
  return TRUE_BOSS_MINION_KEYS.length ? TRUE_BOSS_MINION_KEYS[Math.floor(Math.random()*TRUE_BOSS_MINION_KEYS.length)] : null;
}

const BOSS_PHASE3_MINION_SPRITE_DEFS = {
  boss_phase3_minion_1: {b64:'assets/images/95d5b6e44d1920d29184cbba.png', w:2048, h:2048},
  boss_phase3_minion_2: {b64:'assets/images/9cc7d634bbd3f03d31c77d7b.png', w:2048, h:2048},
  boss_phase3_minion_3: {b64:'assets/images/086b1748c4b2109c67e3fa0f.png', w:2048, h:2048},
  boss_phase3_minion_4: {b64:'assets/images/eef17f49b5bc738540cd134a.png', w:2048, h:2048},
  boss_phase3_minion_5: {b64:'assets/images/665028ab90a8d8011d70e861.png', w:2048, h:2048}
};

// ---------- Last boss phase 2 minion sprites (user-provided images) ----------
const BOSS_PHASE2_MINION_SPRITE_DEFS = {
  boss_phase2_minion_1: {b64:'assets/images/29b3bd43efd61763fef5d1b9.png', w:1361, h:173},
  boss_phase2_minion_2: {b64:'assets/images/b2ea6f6998db884a1b63b778.png', w:1443, h:156},
  boss_phase2_minion_3: {b64:'assets/images/9791307aebd481a26578c054.png', w:1223, h:275},
  boss_phase2_minion_4: {b64:'assets/images/a34820c792be2b82eab23ad7.png', w:1471, h:208},
  boss_phase2_minion_5: {b64:'assets/images/6410f4cf9e3643a192eb9d13.png', w:1502, h:200}
};


Object.keys(BOSS_PHASE2_MINION_SPRITE_DEFS).forEach(key=>{
  const def = BOSS_PHASE2_MINION_SPRITE_DEFS[key];
  const img = new Image();
  const entry = { img, w:def.w, h:def.h, loaded:false };
  img.onload = ()=>{ entry.w = entry.w || img.naturalWidth; entry.h = entry.h || img.naturalHeight; entry.loaded = true; };
  img.src = def.b64;
  ENEMY_SPRITES[key] = entry;
});
Object.keys(BOSS_PHASE3_MINION_SPRITE_DEFS).forEach(key=>{
  const def = BOSS_PHASE3_MINION_SPRITE_DEFS[key];
  const img = new Image();
  const entry = { img, w:def.w, h:def.h, loaded:false };
  img.onload = ()=>{ entry.w = entry.w || img.naturalWidth; entry.h = entry.h || img.naturalHeight; entry.loaded = true; };
  img.src = def.b64;
  ENEMY_SPRITES[key] = entry;
});

// ===== SPECIAL WEAPON COMPANION SPRITES (easy to remove later) =====
// Attachment 1: cucumber. Attachment 3: hedgehog.
const SPECIAL_WEAPON_COMPANION_DEFS = {
  cucumber: { b64:'assets/images/34a6df881fae52741e8feb5f.png', w:1254, h:1254 },
  harvesthedgehog: { b64:'assets/images/fdfc9f960e6006a2ae801418.png', w:2048, h:2048 },
  hedgehog: { b64:'assets/images/ac5696334c82dc87030dea5b.png', w:1254, h:1254 },
  spikearmor: { b64:'assets/images/ac5696334c82dc87030dea5b.png', w:1254, h:1254 },
};
const SPECIAL_WEAPON_COMPANIONS = {};
Object.keys(SPECIAL_WEAPON_COMPANION_DEFS).forEach(key=>{
  const def = SPECIAL_WEAPON_COMPANION_DEFS[key];
  const img = new Image();
  const entry = { img, w:def.w, h:def.h, loaded:false };
  img.onload = ()=>{ entry.w = entry.w || img.naturalWidth; entry.h = entry.h || img.naturalHeight; entry.loaded = true; };
  img.src = def.b64;
  SPECIAL_WEAPON_COMPANIONS[key] = entry;
});
// ===== END SPECIAL WEAPON COMPANION SPRITES =====

// ---------- Audio engine (attached BGM) ----------
let musicEnabled = true;
let currentTrack = null;
const bgmAudio = document.getElementById('bgm-audio');
if(bgmAudio){
  bgmAudio.volume = 0.16;
}
const bossPhase1Bgm = document.getElementById('boss-phase1-bgm');
if(bossPhase1Bgm){ bossPhase1Bgm.volume = 0.18; }
const bossPhase2Bgm = document.getElementById('boss-phase2-bgm');
if(bossPhase2Bgm){ bossPhase2Bgm.volume = 0.18; }
const bossPhase3Bgm = document.getElementById('boss-phase3-bgm');
if(bossPhase3Bgm){ bossPhase3Bgm.volume = 0.18; }
const trueBossBgm = document.getElementById('trueboss-bgm');
if(trueBossBgm){ trueBossBgm.volume = 0.18; trueBossBgm.loop = true; }
const bulletHellBgm = document.getElementById('bullethell-bgm');
if(bulletHellBgm){ bulletHellBgm.volume = 0.20; bulletHellBgm.loop = true; }
function ensureAudio(){
  if(window.storySceneActive) return;
  if(bgmAudio && musicEnabled){
    const p = bgmAudio.play();
    if(p && typeof p.catch==='function') p.catch(()=>{});
  }
}
function startTrack(track){
  if(window.storySceneActive) return;
  currentTrack = track;
  if(!bgmAudio) return;
  bgmAudio.loop = true;
  if(musicEnabled){
    const p = bgmAudio.play();
    if(p && typeof p.catch==='function') p.catch(()=>{});
  }
}
function startBossPhase1Track(){
  currentTrack = 'boss-phase1';
  if(bgmAudio) bgmAudio.pause();
  if(bossPhase2Bgm){ bossPhase2Bgm.pause(); bossPhase2Bgm.currentTime = 0; }
  if(bossPhase1Bgm && musicEnabled){
    bossPhase1Bgm.currentTime = 0;
    bossPhase1Bgm.loop = true;
    const p = bossPhase1Bgm.play();
    if(p && typeof p.catch==='function') p.catch(()=>{});
  }
}
function stopBossPhase1Track(){
  if(bossPhase1Bgm){ bossPhase1Bgm.pause(); bossPhase1Bgm.currentTime = 0; }
  if(currentTrack === 'boss-phase1') currentTrack = null;
}
function startBossPhase2Track(){
  currentTrack = 'boss-phase2';
  if(bgmAudio) bgmAudio.pause();
  if(bossPhase1Bgm){ bossPhase1Bgm.pause(); bossPhase1Bgm.currentTime = 0; }
  if(bossPhase2Bgm && musicEnabled){
    bossPhase2Bgm.currentTime = 0;
    bossPhase2Bgm.loop = true;
    const p = bossPhase2Bgm.play();
    if(p && typeof p.catch==='function') p.catch(()=>{});
  }
}
function stopBossPhase2Track(){
  if(bossPhase2Bgm){ bossPhase2Bgm.pause(); bossPhase2Bgm.currentTime = 0; }
  if(currentTrack === 'boss-phase2') currentTrack = null;
}
function startBossPhase3Track(){
  currentTrack = 'boss-phase3';
  if(bgmAudio) bgmAudio.pause();
  if(bossPhase1Bgm){ bossPhase1Bgm.pause(); bossPhase1Bgm.currentTime = 0; }
  if(bossPhase2Bgm){ bossPhase2Bgm.pause(); bossPhase2Bgm.currentTime = 0; }
  if(bossPhase3Bgm && musicEnabled){
    bossPhase3Bgm.currentTime = 0;
    bossPhase3Bgm.loop = true;
    const p = bossPhase3Bgm.play();
    if(p && typeof p.catch==='function') p.catch(()=>{});
  }
}
function stopBossPhase3Track(){
  if(bossPhase3Bgm){ bossPhase3Bgm.pause(); bossPhase3Bgm.currentTime = 0; }
  if(currentTrack === 'boss-phase3') currentTrack = null;
}
function startTrueBossTrack(){
  currentTrack = 'trueboss';
  if(bgmAudio) bgmAudio.pause();
  if(bossPhase1Bgm) bossPhase1Bgm.pause();
  if(bossPhase2Bgm) bossPhase2Bgm.pause();
  if(bossPhase3Bgm) bossPhase3Bgm.pause();
  if(bulletHellBgm) bulletHellBgm.pause();
  if(trueBossBgm && musicEnabled){
    trueBossBgm.currentTime = 0;
    trueBossBgm.loop = true;
    const p = trueBossBgm.play();
    if(p && typeof p.catch==='function') p.catch(()=>{});
  }
}
function stopTrueBossTrack(){
  if(trueBossBgm){ trueBossBgm.pause(); trueBossBgm.currentTime = 0; }
  if(currentTrack === 'trueboss') currentTrack = null;
}
function startBulletHellTrack(){
  if(bulletHellBgm){
    if(bgmAudio) bgmAudio.pause();
    if(bossPhase1Bgm) bossPhase1Bgm.pause();
    if(bossPhase2Bgm) bossPhase2Bgm.pause();
    if(bossPhase3Bgm) bossPhase3Bgm.pause();
    if(trueBossBgm) trueBossBgm.pause();
    currentTrack = 'bullethell';
    bulletHellBgm.currentTime = 0;
    bulletHellBgm.loop = true;
    if(musicEnabled){
      const p = bulletHellBgm.play();
      if(p && typeof p.catch==='function') p.catch(()=>{});
    }
  }
}
function stopBulletHellTrack(){
  if(bulletHellBgm){ bulletHellBgm.pause(); bulletHellBgm.currentTime = 0; }
  if(currentTrack === 'bullethell') currentTrack = null;
}
function stopTrack(){
  currentTrack = null;
  if(bgmAudio){
    bgmAudio.pause();
    bgmAudio.currentTime = 0;
  }
  if(bossPhase1Bgm){
    bossPhase1Bgm.pause();
    bossPhase1Bgm.currentTime = 0;
  }
  if(bossPhase2Bgm){
    bossPhase2Bgm.pause();
    bossPhase2Bgm.currentTime = 0;
  }
  if(bossPhase3Bgm){
    bossPhase3Bgm.pause();
    bossPhase3Bgm.currentTime = 0;
  }
  if(trueBossBgm){
    trueBossBgm.pause();
    trueBossBgm.currentTime = 0;
  }
  if(bulletHellBgm){
    bulletHellBgm.pause();
    bulletHellBgm.currentTime = 0;
  }
}
function toggleMusic(){
  musicEnabled = !musicEnabled;
  if(currentTrack === 'boss-phase1'){
    if(musicEnabled && bossPhase1Bgm){
      const p = bossPhase1Bgm.play();
      if(p && typeof p.catch==='function') p.catch(()=>{});
    } else if(bossPhase1Bgm){
      bossPhase1Bgm.pause();
    }
  } else if(currentTrack === 'boss-phase2'){
    if(musicEnabled && bossPhase2Bgm){
      const p = bossPhase2Bgm.play();
      if(p && typeof p.catch==='function') p.catch(()=>{});
    } else if(bossPhase2Bgm){
      bossPhase2Bgm.pause();
    }
  } else if(currentTrack === 'boss-phase3'){
    if(musicEnabled && bossPhase3Bgm){
      const p = bossPhase3Bgm.play();
      if(p && typeof p.catch==='function') p.catch(()=>{});
    } else if(bossPhase3Bgm){
      bossPhase3Bgm.pause();
    }
  } else if(currentTrack === 'trueboss'){
    if(musicEnabled && trueBossBgm){
      const p = trueBossBgm.play();
      if(p && typeof p.catch==='function') p.catch(()=>{});
    } else if(trueBossBgm){
      trueBossBgm.pause();
    }
  } else if(currentTrack === 'bullethell'){
    if(musicEnabled && bulletHellBgm){
      const p = bulletHellBgm.play();
      if(p && typeof p.catch==='function') p.catch(()=>{});
    } else if(bulletHellBgm){
      bulletHellBgm.pause();
    }
  } else if(bgmAudio){
    if(musicEnabled){
      const p = bgmAudio.play();
      if(p && typeof p.catch==='function') p.catch(()=>{});
    } else {
      bgmAudio.pause();
    }
  }
  const btn = document.getElementById('music-toggle-btn');
  if(btn) btn.textContent = musicEnabled ? '🔊' : '🔇';
}

// ---------- Weapon definitions ----------
const WEAPONS = {
  sword:  { name:'ソード',  icon:'🗡️', maxLevel:5, desc:'近くの敵を斬る' },
  whip:   { name:'ムチ',    icon:'🪢', maxLevel:5, desc:'横一列を薙ぎ払う' },
  wand:   { name:'魔法の杖', icon:'✨', maxLevel:5, desc:'敵を追尾する弾' },
  axe:    { name:'斧',      icon:'🪓', maxLevel:5, desc:'弧を描いて飛ぶ' },
  knife:  { name:'ナイフ',  icon:'🔪', maxLevel:5, desc:'高速の直線弾' },
  garlic: { name:'電磁破', icon:'📡', maxLevel:5, desc:'周囲に継続ダメージ' },
  shield: { name:'シールド', icon:'🛡️', maxLevel:5, desc:'自分を周回し敵を弾く' },
  orb:    { name:'オーブ',  icon:'🔮', maxLevel:5, desc:'広く周回する魔法弾' },
  bomb:      { name:'爆弾',        icon:'💣', maxLevel:5, desc:'着弾地点で爆発する' },
  crossbow:  { name:'クロスボウ',  icon:'🏹', maxLevel:5, desc:'扇状に矢を連射' },
  lightning: { name:'雷撃',        icon:'⚡', maxLevel:5, desc:'近くの敵に落雷' },
  holywater: { name:'水風船',        icon:'🎈', maxLevel:5, desc:'着弾地点に聖域を展開' },
  boomerang: { name:'ブーメラン',  icon:'🔄', maxLevel:5, desc:'往復してヒットする' },
  spikearmor:{ name:'きゅーまる', icon:'🦔', maxLevel:5, desc:'触れた敵に反撃ダメージ' },
  spear:    { name:'槍',        icon:'🔱', maxLevel:5, desc:'前方を貫通突き' },
  icestaff: { name:'氷の杖',    icon:'❄️', maxLevel:5, desc:'命中した敵を凍結・鈍足化' },
  chakram:  { name:'チャクラム', icon:'💫', maxLevel:5, desc:'高貫通の回転刃' },
  totem:    { name:'トーテム',  icon:'🗿', maxLevel:5, desc:'その場に設置し周囲を攻撃' },
  scythe:      { name:'大鎌',        icon:'⚰️', maxLevel:5, desc:'周囲の敵をまとめて刈り取る' },
  machinegun:  { name:'マシンガン',   icon:'🔫', maxLevel:5, desc:'高速連射の弾幕' },
  meteor:      { name:'メテオ',      icon:'☄️', maxLevel:5, desc:'敵の頭上に隕石を落とす' },
  chainsickle: { name:'鎖鎌',        icon:'⛓️', maxLevel:5, desc:'命中した敵を引き寄せる' },
  blessingbell:{ name:'祝福の鈴',    icon:'🔔', maxLevel:5, desc:'周囲を癒しつつ攻撃する' },
  blackhole:   { name:'ブラックホール', icon:'🕳️', maxLevel:5, desc:'敵を吸い込む渦を作る' },
  gravitybomb: { name:'グラビティボム', icon:'💣🕳️', maxLevel:5, desc:'爆発とブラックホールで敵を吸い込む' },
  cucumber:    { name:'キュウリ', icon:'🥒', maxLevel:5, desc:'時間経過で経験値を生み出す' },
};
const EVOLUTIONS = [
  { mats:['sword','shield'], result:'excalibur', name:'エクスカリバー', icon:'⚔️', desc:'全方位の大斬撃' },
  { mats:['whip','axe'],     result:'stormwhip',  name:'ストームウィップ', icon:'🌪️', desc:'薙ぎ払い+旋回斧' },
  { mats:['wand','orb'],     result:'comet',      name:'アーケインコメット', icon:'☄️', desc:'追尾彗星を連射' },
  { mats:['knife','garlic'], result:'toxicblade', name:'トキシックブレード', icon:'☠️', desc:'毒付き高速ナイフ' },
  { mats:['crossbow','boomerang'], result:'eternalbow', name:'エターナルボウ', icon:'🏹', desc:'貫通する矢の雨' },
  { mats:['lightning','holywater'], result:'thunderzone', name:'サンダーサンクチュアリ', icon:'⛈️', desc:'聖なる雷の領域' },
  { mats:['bomb','spikearmor'], result:'demolition', name:'デモリッションプレート', icon:'🛠️', desc:'爆発する反撃装甲' },
  { mats:['bomb','blackhole'], result:'gravitybomb', name:'グラビティボム', icon:'💣🕳️', desc:'ボムとブラックホールが融合した重力爆弾' },
  { mats:['spear','chakram'], result:'gungnir', name:'グングニル', icon:'🔱', desc:'極大貫通の神槍' },
  { mats:['icestaff','totem'], result:'blizzardshrine', name:'ブリザードシュライン', icon:'🧊', desc:'広範囲の氷結領域' },
  { mats:['scythe','machinegun'], result:'judgmentwaltz', name:'断罪のワルツ', icon:'💃', desc:'大鎌の一閃+高速弾幕' },
  { mats:['chainsickle','blackhole'], result:'abysschain', name:'深淵の鎖', icon:'⛓️', desc:'敵を吸い込み続ける鎖' },
  { mats:['meteor','blessingbell'], result:'celestialblessing', name:'天空の祝福', icon:'🌠', desc:'隕石雨+広域回復' },
  { mats:['cucumber','spikearmor'], result:'harvesthedgehog', name:'それいけ<br>きゅーまる', icon:'🥒🦔', desc:'時間経過で経験値を生み、レベルに応じて遠くの経験値を自動回収' },
  { mats:['celestialblessing','harvesthedgehog'], result:'heavenharvest', name:'天穹の収穫祭', icon:'🌠🦔', desc:'天空の祝福とそれいけきゅーまるが融合した究極の支援', tier2:true },
  { mats:['judgmentwaltz','gravitybomb'], result:'judgmentgravity', name:'断罪重力崩壊', icon:'💃🕳️', desc:'高速弾幕と重力爆発を融合した究極攻撃', tier2:true },
  // ---- Tier 2: fuse two already-evolved weapons into an ultimate form ----
  { mats:['excalibur','gungnir'], result:'godslayer', name:'ゴッドスレイヤー', icon:'⚡', desc:'全方位斬撃+極大貫通突きの神威', tier2:true },
  { mats:['stormwhip','eternalbow'], result:'galearcher', name:'暴風の弓聖', icon:'🏹', desc:'全方位に矢の嵐を放つ', tier2:true },
  { mats:['comet','blizzardshrine'], result:'frozencomet', name:'極寒の彗星群', icon:'☄️', desc:'凍結彗星+氷結領域', tier2:true },
  { mats:['toxicblade','demolition'], result:'apocalypse', name:'破滅の猛毒兵器', icon:'☣️', desc:'猛毒弾幕+大爆発反撃', tier2:true },
  { mats:['thunderzone','abysschain'], result:'voidstorm', name:'虚空の雷嵐', icon:'🌌', desc:'吸引の渦+連続雷撃', tier2:true },
];
const EVO_STATS = {
  excalibur: {dmg:110, cd:600, range:160},
  stormwhip: {dmg:52, cd:750, range:170},
  comet: {dmg:50, cd:700, range:99999},
  toxicblade: {dmg:30, cd:150, range:99999, poison:10},
  eternalbow: {dmg:22, cd:220, speed:520, count:9},
  thunderzone: {dmg:44, cd:1050, boltCount:4, radius:200, duration:2000},
  demolition: {dmg:80, radius:145, cd:99999},
  gungnir: {dmg:145, cd:700, range:240, width:60},
  blizzardshrine: {dmg:24, cd:1900, radius:185, duration:5600, tick:400, slow:0.35, slowDur:2200},
  judgmentwaltz: {dmg:68, cd:750, range:160, mgCount:4, mgSpeed:580, mgDmg:20},
  abysschain: {dmg:28, cd:1600, radius:230, duration:2800, tick:320, pull:150},
  celestialblessing: {dmg:58, cd:1200, radius:100, delay:550, count:4, heal:16, healRadius:120},
  harvesthedgehog: {dmg:0, cd:3000, xp:1},
  heavenharvest: {dmg:72, cd:1000, radius:150, heal:22, xp:2},
  judgmentgravity: {dmg:95, cd:1100, radius:210, pull:160},
  godslayer: {dmg:190, cd:520, range:280, width:78, ringDmg:150, ringRange:190},
  galearcher: {dmg:42, cd:150, speed:600, count:13},
  frozencomet: {dmg:80, cd:500, range:99999, slow:0.5, slowDur:2600, zoneRadius:200, zoneDuration:4000, zoneTick:320, zoneDmg:30},
  apocalypse: {dmg:60, cd:110, poison:26, retDmg:180, retRadius:180},
  voidstorm: {dmg:82, cd:850, boltCount:6, radius:290, duration:3600, tick:260, pull:190},
  lastbosspower: {dmg:95, cd:800, range:210},
};
const EVO_ICONS = {excalibur:'⚔️',stormwhip:'🌪️',comet:'☄️',toxicblade:'☠️',eternalbow:'🏹',thunderzone:'⛈️',demolition:'🛠️',gungnir:'🔱',blizzardshrine:'🧊',godslayer:'⚡',galearcher:'🏹',frozencomet:'☄️',apocalypse:'☣️',judgmentwaltz:'💃',abysschain:'⛓️',celestialblessing:'🌠',harvesthedgehog:'🥒🦔',heavenharvest:'🌠🦔',judgmentgravity:'💃🕳️',voidstorm:'🌌',lastbosspower:'💗'};
const TRUE_BOSS_SPECIAL_WEAPONS = {
  teddy:   {name:'くまぬい', icon:'🧸', chargeMs:9000, attackDown:0.35, debuffMs:8500},
  tower:   {name:'タワー', icon:'🗼', chargeMs:8500, damageRatio:0.08},
  bouquet: {name:'ハートブーケ', icon:'💐', chargeMs:12000, damageRatio:0.18},
  ticket:  {name:'ガチャチケ', icon:'🎫', chargeMs:10000, defenseUp:1.55, debuffMs:8500}
};


function weaponDisplay(id){
  if(WEAPONS[id]) return {name:WEAPONS[id].name, icon:WEAPONS[id].icon};
  const evo = EVOLUTIONS.find(e=>e.result===id);
  if(evo) return {name:evo.name, icon:evo.icon};
  return {name:id, icon:'❓'};
}

// ---------- Difficulty ----------
const DIFFICULTIES = {
  normal: { label:'ノーマル', desc:'標準的な難易度', hpMul:1.0, dmgMul:1.0, spawnMul:1.0, scaleMul:1.0, xpMul:1, bossKillGrowth:1.3 },
  listener: { label:'雑魚リスナーモード', desc:'ノーマルと同じ基本難易度・ステージ成長1倍', hpMul:1.0, dmgMul:1.0, spawnMul:1.0, scaleMul:1.0, xpMul:1, bossKillGrowth:1.3 },
  trueboss: { label:'真のボスモード', desc:'解放条件達成者のみ選択可能。10分後に「かたちゃん＆すいちゃん」が2体同時出現。形態進化なし。', hpMul:2.0, dmgMul:1.7, spawnMul:1.0, scaleMul:1.0, xpMul:1.2, bossKillGrowth:1.45 },
};
let difficulty = 'normal';
let bossKillMultiplier = 1;
const STAGE_LENGTH = 60; // seconds per stage
function currentStage(){ return Math.floor(elapsed/STAGE_LENGTH) + 1; }

// ---------- Game state ----------
let state = 'START'; // START, PLAYING, LEVELUP, GAMEOVER
let specialClearSequenceActive = false; // 最終ボス撃破後の特別アイテム演出中
let trueBossSpecialPauseT = 0; // 真ボス第1戦：必殺技チャージ完了時の操作猶予（ms）
// 1秒ごとにプレイ時間を加算して自動保存。state宣言後に配置して初期化順序を保証する。
setInterval(() => {
  if (state === 'PLAYING') {
    saveData.totalPlayTime++;
    saveGame();
  }
}, 1000);
let elapsed = 0, killCount = 0;
let player, enemies, projectiles, gems, hearts, particles, zones, powerups, enemyBolts, meteors;
let camX=0, camY=0;
let moveDir = {x:0,y:0}; // input vector -1..1
let facing = {x:1,y:0};
let spawnTimer = 0;
let lastFrame = 0;
let shakeMag = 0;
let screenFlashTimer = 0;
function addShake(mag){ shakeMag = Math.min(24, Math.max(shakeMag, mag)); }
function triggerScreenFlash(ms){ screenFlashTimer = Math.max(screenFlashTimer, ms); }

// ---------- Boss state ----------
let bossActive = null;
let trueBossPair = [];
// 真ボス第1戦の瞬間移動は2体が交互に行う。
let trueBossTeleportTurn = 'kata';
let bossCount = 0;
// 回復アイテム（ハート）を実際に拾った累計数。ラスボス強化判定に使用。
let collectedHeartCount = 0;
let finalBossHeartCount = 0;
let finalBossHeartMultiplier = 1;
let finalBossHeartAttackMultiplier = 1;
let nextBossTime = 60;
let bossArenaCenter = null;
const BOSS_ARENA_RADIUS = 1280;
const BOSS_INTERVAL = 60;
const BOSS_TYPES = [
  {key:'behemoth', name:'やだやだかたちゃん',     hp:480, speed:38, dmg:20, r:42, color:'#ff5e5e', xp:40, abilities:['charge']},
  {key:'lich',     name:'なきむしかたちゃん', hp:400, speed:58, dmg:15, r:34, color:'#7fffea', xp:35, abilities:['magic']},
  {key:'dragon',   name:'ぷんぷんかたちゃん',         hp:700, speed:46, dmg:26, r:48, color:'#ffb020', xp:55, abilities:['breath']},
];
const SUPER_BOSS_TIME = 600; // 10 minutes
const SUPER_BOSS = {key:'demonking', name:'王者かたちゃん', hp:18000, speed:56, dmg:58, r:64, color:'#3a0a20', xp:400, novaInterval:3200, novaRadius:150, novaDmg:32, abilities:['charge','magic','breath','teleport','bind']};
const TRUE_BOSS = {key:'trueking', name:'かたちゃん＆すいちゃん', hp:50000, speed:62, dmg:95, r:72, color:'#12000b', xp:1000, novaInterval:2200, novaRadius:210, novaDmg:58, abilities:['charge','magic','breath','teleport','bind']};
let superBossSpawned = false;
let trueBossFinalSpawned = false;
// 最終ラスボス専用：特殊攻撃中だけ弾幕回避ミニゲームへ切り替える。
const bulletHell = {active:false, warning:false, warningT:0, elapsed:0, bullets:[], item:null, x:0, y:0, speed:340, invT:0, spawnedItem:false, savedX:0, savedY:0, pointerX:null, pointerY:null, pointerActive:false, waveIndex:0, lastWaveT:-9999, level:1, rare:false};
let bulletHellKeys = Object.create(null);

// ---------- Boss special ability config ----------
const BOSS_ABILITY_CONFIG = {
  charge:   { interval:4500, telegraph:500, dashDur:500, dashSpeedMul:6.5, dmgMul:1.6 },
  magic:    { interval:3000, speed:260, dmgMul:0.9, r:11 },
  breath:   { interval:5200, telegraph:500, activeDur:900, tickInterval:200, dmgMul:0.55, length:260, halfAngle:0.34 },
  teleport: { interval:6000, minDist:180, maxDist:260 },
  bind:     { interval:12000, telegraph:700, required:15 },
  bullethell:{ interval:17000, warning:1400, duration:18000, itemDelay:9000 },
};
function angleDiff(a,b){ return Math.abs(((a-b+Math.PI)%(Math.PI*2))-Math.PI); }

const collection = () => (saveData.collection ||= {});
const titles = () => (saveData.titles ||= {});
const titleDefs = [["start", "旅の始まり", "初プレイ", "hp", 1, 0], ["small", "小さな勇気", "累計雑魚100体", "atk", 1, 0], ["first", "はじめの一歩", "初ボス撃破", "hp", 2, 0], ["chest1", "宝物みつけた！", "宝箱1個", "xp", 1, 0], ["weapons", "武器コレクター", "武器5種類所持", "atk", 2, 0], ["runs5", "まだまだこれから", "累計5回プレイ", "hp", 2, 0], ["runs", "冒険の達人", "累計10回プレイ", "speed", 3, 1], ["album5", "みんなに会いたい", "図鑑5種類", "hp", 2, 0], ["chest10", "宝探し名人", "宝箱10個", "xp", 3, 1], ["lv20", "一人前の冒険者", "Lv.20到達", "atk", 3, 1], ["kills1k", "戦いの達人", "累計雑魚1000体", "atk", 3, 1], ["album10", "思い出の収集家", "図鑑10種類", "hp", 4, 1], ["maxweapon", "武器マスター", "武器1つ最大レベル", "atk", 4, 1], ["lv50", "熟練の冒険者", "Lv.50到達", "xp", 5, 2], ["final", "かたちゃんマスター", "ラスボス撃破", "atk", 5, 2], ["perfect", "完璧な守り", "通常ボス戦ノーダメージ", "def", 5, 2], ["chest50", "宝箱ハンター", "宝箱50個", "xp", 5, 2], ["special20", "必殺技の使い手", "必殺技20回", "atk", 5, 2], ["time30", "終わらない冒険", "30分生存", "hp", 5, 2], ["kills", "百戦錬磨", "累計雑魚10000体", "xp", 7, 2], ["costumes", "変身マスター", "全くまぬい・ガチャ衣装発見", "speed", 5, 2], ["lv100", "限界突破", "Lv.100到達", "xp", 8, 3], ["album", "思い出コレクター", "図鑑コンプリート", "hp", 10, 3], ["chest100", "宝箱の伝説", "宝箱100個", "xp", 8, 3], ["true", "奇跡を起こす者", "真ボス初撃破", "atk", 10, 3], ["both", "二人との思い出", "男女両モードでラスボス撃破", "hp", 8, 3], ["final10", "不屈の勇者", "ラスボス10回撃破", "def", 8, 3], ["true5", "奇跡のその先へ", "真ボス5回撃破", "atk", 15, 4], ["kills50k", "永遠の冒険者", "累計雑魚50000体", "hp", 12, 4], ["all", "伝説のコレクター", "他の全称号獲得", "all", 5, 4]];
const ranks=['ブロンズ','シルバー','ゴールド','プラチナ','レジェンド'];
const rankColors=['#b78053','#a5b4c5','#ffd66b','#69dce0','#d6a2ff'];
const statNames={hp:'最大HP',atk:'攻撃力',def:'被ダメージ',speed:'移動速度',xp:'XP獲得量',all:'全主要能力'};
function rewardText(d){return statNames[d[3]]+' '+(d[3]==='def'?'−':'+')+d[4]+'%';}
function titleStats(){const a={hp:0,atk:0,def:0,speed:0,xp:0};for(const d of titleDefs)if(titles()[d[0]]){if(d[3]==='all')for(const k in a)a[k]+=d[4];else a[d[3]]+=d[4];}a.def=Math.min(40,a.def);return a;}
const titleQueue=[];let titleShowing=false;
function showTitleNotice(){if(titleShowing||!titleQueue.length)return;titleShowing=true;const d=titleQueue.shift();const el=document.createElement('div');el.setAttribute('role','status');el.style.cssText='position:fixed;top:12%;left:50%;transform:translateX(-50%);z-index:99999;pointer-events:none;background:#262039;color:white;border:2px solid '+(d.notice?d.color:rankColors[d[5]])+';border-radius:16px;padding:14px 24px;text-align:center;max-width:85vw;box-shadow:0 3px 12px #0006';if(d.images){const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:center;gap:12px';d.images.forEach((src,i)=>{if(i)row.append('→');const img=document.createElement('img');img.src=src;img.style.cssText='width:82px;height:82px;object-fit:contain';row.append(img);});el.append(row);}for(const [v,c] of (d.notice?[[d.heading,d.color],[d.name,'white'],[d.detail,'#9be9ac']]:[['🏆 称号獲得！ '+ranks[d[5]],rankColors[d[5]]],[d[1],'white'],[d[2],'#eee'],['永久強化 '+rewardText(d)+'（次回から）','#9be9ac']])){const p=document.createElement('div');p.textContent=v;p.style.color=c;p.style.margin='4px';el.append(p);}document.body.append(el);setTimeout(()=>{el.remove();titleShowing=false;showTitleNotice();},2800);}
function unlockTitle(id){if(titles()[id])return;const d=titleDefs.find(x=>x[0]===id);if(!d)return;titles()[id]=true;saveGame();titleQueue.push(d);showTitleNotice();if(id!=='all'&&titleDefs.every(x=>x[0]==='all'||titles()[x[0]]))unlockTitle('all');}
function titleCounters(){return saveData.titleCounters ||= {};}
function countTitle(k){const c=titleCounters();c[k]=(Number(c[k])||0)+1;saveGame();}
function checkTitles(){const c=titleCounters(),runs=Number(saveData.playCount)||0,kills=Number(saveData.totalMinionKills)||0,boss=c.boss||0,chest=c.chest||0,final=c.final||0,truewins=c.truewins||0,special=c.special||0,album=albumEntries().filter(a=>collection()[a[0]]).length,level=player.level,weapons=player.weapons.length,maxweapon=player.weapons.some(w=>WEAPONS[w.id]&&w.level>=WEAPONS[w.id].maxLevel),time=elapsed,costumes=['katateddy','katagacha','suiteddy','suigacha'].every(k=>collection()[k]),both=c.girl&&c.boy;
if(runs>=1)unlockTitle("start");
if(kills>=100)unlockTitle("small");
if(boss>=1)unlockTitle("first");
if(chest>=1)unlockTitle("chest1");
if(weapons>=5)unlockTitle("weapons");
if(runs>=5)unlockTitle("runs5");
if(runs>=10)unlockTitle("runs");
if(album>=5)unlockTitle("album5");
if(chest>=10)unlockTitle("chest10");
if(level>=20)unlockTitle("lv20");
if(kills>=1000)unlockTitle("kills1k");
if(album>=10)unlockTitle("album10");
if(maxweapon)unlockTitle("maxweapon");
if(level>=50)unlockTitle("lv50");
if(final>=1)unlockTitle("final");
if(chest>=50)unlockTitle("chest50");
if(special>=20)unlockTitle("special20");
if(time>=1800)unlockTitle("time30");
if(kills>=10000)unlockTitle("kills");
if(costumes)unlockTitle("costumes");
if(level>=100)unlockTitle("lv100");
if(album===albumEntries().length)unlockTitle("album");
if(chest>=100)unlockTitle("chest100");
if(truewins>=1)unlockTitle("true");
if(both)unlockTitle("both");
if(final>=10)unlockTitle("final10");
if(truewins>=5)unlockTitle("true5");
if(kills>=50000)unlockTitle("kills50k");
}

function albumEntries(){return [...BOSS_TYPES.map(b=>[b.key,b.name,BOSS_SPRITES[b.key]]),['demonking','王者かたちゃん',BOSS_SPRITES.demonking],['phase2','王者かたちゃん【覚醒】',BOSS_PHASE2_SPRITE],['phase3','王者かたちゃん【真の姿】',BOSS_PHASE3_SPRITE],...['kata','sui'].flatMap(r=>{const n=r==='kata'?'かたちゃん':'すいちゃん';return [[r+'normal',n,TRUE_BOSS_ROLE_SPRITES[r].normal],[r+'hit',n+' 別の姿',TRUE_BOSS_ROLE_SPRITES[r].hit],[r+'teddy',n+' くまぬい衣装',TRUE_BOSS_TEDDY_SPRITES[r]],[r+'gacha',n+' ガチャ衣装',TRUE_BOSS_GACHA_SPRITES[r]]];}),['truefinal','真ボス最終形態',TRUE_BOSS_FINAL_SPRITE]];}
function discover(id){if(collection()[id])return;collection()[id]=true;if(albumEntries().every(a=>collection()[a[0]]))unlockTitle('album');saveGame();}
function showCollection(){const panel=document.getElementById('collection-panel');panel.replaceChildren();const entries=albumEntries();const head=document.createElement('h2');head.textContent='図鑑 '+entries.filter(a=>collection()[a[0]]).length+'/'+entries.length;panel.append(head);const grid=document.createElement('div');grid.className='album-grid';for(const [id,name,sprite] of entries){const tile=document.createElement('div');if(collection()[id]){const img=document.createElement('img');img.src=sprite.img.src;tile.append(img);tile.append(document.createTextNode(name));}else{tile.textContent='？？？';}grid.append(tile);}panel.append(grid);const th=document.createElement('h2');th.textContent='称号・永久強化 '+titleDefs.filter(d=>titles()[d[0]]).length+'/'+titleDefs.length;panel.append(th);const summary=document.createElement('p');summary.textContent='合計（次回開始時）：'+Object.entries(titleStats()).map(([k,v])=>statNames[k]+(k==='def'?' −':' +')+v+'%').join(' / ');panel.append(summary);for(const d of titleDefs){const [id,name,cond]=d;const line=document.createElement('p');line.style.cssText='border-left:4px solid '+rankColors[d[5]]+';padding:8px;text-align:left';line.textContent=(titles()[id]?'✓ 獲得済み ':'🔒 未獲得 ')+ranks[d[5]]+' ｜ '+name+' ｜ '+cond+' ｜ '+rewardText(d);panel.append(line);}document.getElementById('collection-screen').classList.remove('hidden');}
function newPlayer(){
  return {
    x:0, y:0, hp:130, maxHp:130, speed:190, radius:16,
    level:1, xp:0, xpNext:7, regenTimer:0,
    weapons:[], // {id, level}
    invTimer:0, hitFlash:0, damageEvents:0, chestAtk:0, chestSpeed:0, chestInv:0,
    pickupRadius:70,
    atkMul:1, defMul:1, cdMul:1, luck:0,
    // ステータスアップ取得回数（各ステータス最大5回）
    statUpgradeCounts:{hp:0, speed:0, atk:0, def:0, atkspeed:0, pickup:0, luck:0},
    // 一度MAXまで育てて進化素材として消費した武器は、同一プレイ中は新規候補に戻さない。
    retiredWeaponIds:new Set(),
    ultimateGauge:0, daisukiCharging:false, daisukiChargeT:0, reviveCharges:0,
    trueBossSpecials:{teddy:0,tower:0,bouquet:0,ticket:0},
    trueBossSpecialActive:false,
    bossBind:false, bossBindCount:0, bossBindRequired:15,
  };
}

function resetGame(){
  specialClearSequenceActive = false;
  player = newPlayer();
  const t=titleStats(); player.maxHp=Math.round(player.maxHp*(1+t.hp/100));player.hp=player.maxHp;player.atkMul*=1+t.atk/100;player.defMul*=1-t.def/100;player.speed*=1+t.speed/100;player.titleXp=1+t.xp/100;
  if(typeof bossBindHud!=='undefined' && bossBindHud) bossBindHud.classList.add('hidden');
  enemies = []; projectiles = []; gems = []; hearts = []; particles = []; zones = []; powerups = []; enemyBolts = []; meteors = [];
  elapsed = 0; killCount = 0; spawnTimer = 0;
  runScore = 0;
  pendingLevelUps = 0;
  // 新しいプレイでは必ず7枠に戻す。ラスボス撃破後の無制限状態は持ち越さない。
  weaponSlotsUnlimitedThisRun = false;
  camX = 0; camY = 0;
  bossActive = null; trueBossPair = []; bossCount = 0; nextBossTime = 60;
  bossArenaCenter = null;
  trueBossSpecialPauseT = 0;
  const specialPauseNotice = document.getElementById('trueboss-special-pause-notice');
  if(specialPauseNotice) specialPauseNotice.style.display='none';
  superBossSpawned = false;
  trueBossFinalSpawned = false;
  shakeMag = 0; screenFlashTimer = 0;
  bossKillMultiplier = 1;
  collectedHeartCount = 0;
  finalBossHeartCount = 0;
  finalBossHeartMultiplier = 1;
  finalBossHeartAttackMultiplier = 1;
  player.trueBossSpecials = {teddy:0,tower:0,bouquet:0,ticket:0};
  player.trueBossSpecialActive = false;

  // ゲームオーバー後にタイトルへ戻って再スタートした際、
  // 前回の弾幕回避ミニゲームの状態が残って「続きから」になる不具合を防止。
  // bulletHell は通常プレイとは別管理なので、通常の敵・経験値等のリセットだけでは
  // active / warning / 弾 / 経過時間などが残ってしまう。
  if(typeof bulletHell!=='undefined'){
    bulletHell.active = false;
    bulletHell.warning = false;
    bulletHell.warningT = 0;
    bulletHell.elapsed = 0;
    bulletHell.bullets = [];
    bulletHell.item = null;
    bulletHell.x = 0;
    bulletHell.y = 0;
    bulletHell.invT = 0;
    bulletHell.spawnedItem = false;
    bulletHell.savedX = 0;
    bulletHell.savedY = 0;
    bulletHell.pointerX = null;
    bulletHell.pointerY = null;
    bulletHell.pointerActive = false;
    bulletHell.waveIndex = 0;
    bulletHell.lastWaveT = -9999;
    bulletHell.level = 1;
    bulletHell.rare = false;
    bulletHell.returnTrack = null;
  }
  if(typeof bulletHellKeys!=='undefined') bulletHellKeys = Object.create(null);
  if(typeof bossCutInTimer!=='undefined' && bossCutInTimer){ clearTimeout(bossCutInTimer); bossCutInTimer=null; }
}

// ---------- Utility ----------
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function dist(ax,ay,bx,by){ return Math.sqrt(dist2(ax,ay,bx,by)); }
function rand(a,b){ return a+Math.random()*(b-a); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

function findWeapon(id){ return player.weapons.find(w=>w.id===id); }

// ---------- Weapon stats ----------
const weaponRanks=[['ノーマル','#aaaaaa',1,50],['アンコモン','#35a567',1.1,28],['レア','#488be0',1.25,15],['エピック','#a56ce0',1.5,6],['レジェンド','#d9a126',2,1]];
function rollWeaponRank(){let r=Math.random()*100;for(let i=0;i<weaponRanks.length;i++){r-=weaponRanks[i][3];if(r<0)return i;}return 4;}
function rankOf(w){return weaponRanks[w?.rarity||0];}
function rankedStats(s,w){if(!s)return s;const m=rankOf(w)[2];if(m===1)return s;const out={...s};for(const k of ['dmg','mgDmg','ringDmg','zoneDmg','retDmg','poison','heal','xp'])if(typeof out[k]==='number')out[k]=Math.round(out[k]*m*100)/100;return out;}
function acquireWeapon(id,timer){const w={id,level:1,timer,rarity:rollWeaponRank()};player.weapons.push(w);if(w.rarity>=2){const r=rankOf(w);titleQueue.push({notice:true,color:r[1],heading:'💎 武器獲得！ '+r[0],name:weaponDisplay(id).name,detail:'武器効果 ×'+r[2]});showTitleNotice();}return w;}
function weaponStats(id,level){return rankedStats(baseWeaponStats(id,level),findWeapon(id));}
function baseWeaponStats(id, level){
  switch(id){
    case 'sword': return { dmg:8+level*5, cd:950-level*70, range:95, hits:1+Math.floor(level/2) };
    case 'whip':  return { dmg:6+level*4, cd:1150-level*90, w:150+level*14, h:60 };
    case 'wand':  return { dmg:10+level*5, cd:1050-level*85, speed:270, count:1+Math.floor(level/3), pierce:1 };
    case 'axe':   return { dmg:14+level*6, cd:1350-level*95, speed:230, count:1+Math.floor(level/2) };
    case 'knife': return { dmg:5+level*2.5, cd:400-level*32, speed:430, pierce:1 };
    case 'garlic':return { dmg:4+level*2, radius:58+level*13, tick:480 };
    case 'shield':return { dmg:8+level*4, radius:74, count:1+Math.floor(level/2), rot:2.0 };
    case 'orb':   return { dmg:6+level*3.2, radius:112, count:1+Math.floor(level/2), rot:1.2 };
    case 'bomb':      return { dmg:16+level*8, cd:1500-level*90, radius:66+level*10, speed:150 };
    case 'crossbow':  return { dmg:8+level*3.5, cd:950-level*60, speed:400, count:2+Math.floor(level/2), pierce:2 };
    case 'lightning': return { dmg:14+level*6, cd:1050-level*65, count:1+Math.floor(level/2) };
    case 'holywater': return { dmg:4+level*2, cd:1700-level*90, radius:64+level*9, duration:3000, flight:650, speed:130 };
    case 'boomerang': return { dmg:9+level*4.5, cd:1150-level*70, speed:280, range:200+level*22 };
    case 'spikearmor':return { dmg:9+level*5, cd:99999 };
    case 'spear':     return { dmg:11+level*5.5, cd:1000-level*65, range:135, width:38 };
    case 'icestaff':  return { dmg:8+level*4, cd:1150-level*70, speed:210, pierce:1, slow:0.5, slowDur:1800 };
    case 'chakram':   return { dmg:18+level*8, cd:1450-level*95, speed:250, pierce:99 };
    case 'totem':     return { dmg:6+level*3.4, cd:2100-level*100, radius:70+level*10, duration:6000, tick:450 };
    case 'scythe':      return { dmg:22+level*10, cd:1300-level*80, range:120 };
    case 'machinegun':  return { dmg:3+level*1.3, cd:150-level*10, speed:520, pierce:1 };
    case 'meteor':      return { dmg:30+level*14, cd:1900-level*110, radius:70+level*10, delay:700, count:1+Math.floor(level/3) };
    case 'chainsickle': return { dmg:14+level*6, cd:1200-level*70, speed:380, pierce:4, pull:40 };
    case 'blessingbell':return { dmg:4+level*2, heal:2+level*1, radius:80+level*10, tick:1200, cd:99999 };
    case 'blackhole':   return { dmg:6+level*3, cd:2600-level*130, radius:130+level*12, duration:3000, tick:400, pull:70+level*8 };
    case 'gravitybomb': return { dmg:28+level*10, cd:2200-level*110, radius:120+level*10, duration:3000, tick:350, pull:110+level*8 };
    case 'cucumber': return { dmg:0, cd:7000-level*300, xp:1+Math.floor(level/2) };
  }
}

function spawnParticle(x,y,color,life,size,vx,vy){
  particles.push({type:'bit', x,y,color,life,maxLife:life,size,vx:vx||0,vy:vy||0});
}
function spawnSlash(x,y,r,color,angle,width){
  particles.push({type:'slash', x,y,r,life:220,maxLife:220,color, angle:angle==null?rand(0,Math.PI*2):angle, width: width==null?1.9:width});
}
function spawnRing(x,y,color,maxR,life){
  particles.push({type:'ring', x,y,color, maxR, life: life||300, maxLife: life||300});
}
function spawnSpark(x,y,color,count){
  count = count||6;
  for(let i=0;i<count;i++){
    const a = rand(0,Math.PI*2), sp = rand(70,220);
    particles.push({type:'spark', x,y,color, angle:a, len:rand(8,18), life:220, maxLife:220, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp});
  }
}
function spawnText(x,y,text,color,size){
  particles.push({type:'text', x,y:y-10, text, color, life:600, maxLife:600, size:size||13, vy:-55});
}
function spawnTrail(x,y,color,size){
  particles.push({type:'trail', x,y,color, life:180, maxLife:180, size:size||4});
}

// ---------- Firing logic ----------
function fireWeapon(inst){
  const id = inst.id;
  if(EVO_STATS[id]){ fireEvolved(inst); return; }
  const s = weaponStats(id, inst.level);
  if(id==='cucumber'){ gainXp(s.xp||1); spawnText(player.x,player.y-35,'🥒 +'+(s.xp||1)+'XP','#9fef7a',13); return; }

  if(id==='sword'){
    const targets = nearestEnemies(player.x,player.y,s.range,s.hits);
    if(targets.length){
      const ang = Math.atan2(targets[0].y-player.y, targets[0].x-player.x);
      spawnSlash(player.x+Math.cos(ang)*40, player.y+Math.sin(ang)*40, 46, '#ffe066', ang, 2.6);
      spawnRing(player.x,player.y,'rgba(255,224,102,0.5)', s.range*0.55, 180);
    }
    targets.forEach(e=>{ damageEnemy(e, s.dmg); });
  }
  else if(id==='whip'){
    inst.dir = (inst.dir||1) * -1;
    const dirX = inst.dir;
    let hitAny=false;
    enemies.forEach(e=>{
      const rx = e.x-player.x, ry=e.y-player.y;
      if(Math.sign(rx||dirX)===dirX && Math.abs(rx)<s.w && Math.abs(ry)<s.h){ damageEnemy(e, s.dmg); hitAny=true; }
    });
    spawnSlash(player.x+dirX*(s.w*0.45), player.y, s.w*0.5, '#a0e0ff', dirX>0?0:Math.PI, 1.1);
    for(let i=0;i<4;i++) spawnTrail(player.x+dirX*rand(20,s.w*0.8), player.y+rand(-s.h*0.4,s.h*0.4), '#c8f0ff', rand(3,6));
  }
  else if(id==='wand'){
    const targets = nearestEnemies(player.x,player.y,99999,s.count);
    spawnRing(player.x,player.y,'rgba(127,209,255,0.55)',26,180);
    targets.forEach(e=>{
      const a = Math.atan2(e.y-player.y, e.x-player.x);
      projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*s.speed, vy:Math.sin(a)*s.speed, dmg:s.dmg, pierce:s.pierce, life:2000, color:'#7fd1ff', r:6, homing:e, glow:true});
    });
  }
  else if(id==='axe'){
    spawnRing(player.x,player.y,'rgba(255,176,96,0.5)',24,160);
    for(let i=0;i<s.count;i++){
      const a = rand(0,Math.PI*2);
      projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*s.speed, vy:Math.sin(a)*s.speed, dmg:s.dmg, pierce:99, life:1600, color:'#ffb060', r:9, isAxe:true, t:0, spin:rand(-8,8)});
    }
  }
  else if(id==='knife'){
    const a = Math.atan2(facing.y, facing.x);
    spawnSlash(player.x+Math.cos(a)*18, player.y+Math.sin(a)*18, 16, '#ffffff', a, 1.2);
    projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*s.speed, vy:Math.sin(a)*s.speed, dmg:s.dmg, pierce:s.pierce, life:1200, color:'#ffffff', r:5, glow:true});
  }
  else if(id==='garlic'){
    enemies.forEach(e=>{ if(dist(e.x,e.y,player.x,player.y) < s.radius) damageEnemy(e, s.dmg, null, true); });
    spawnRing(player.x,player.y,'rgba(160,255,160,0.5)', s.radius, 420);
  }
  else if(id==='bomb'){
    const a = rand(0,Math.PI*2);
    projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*s.speed, vy:Math.sin(a)*s.speed, dmg:s.dmg, pierce:0, life:800, color:'#ff8f4d', r:10, isBomb:true, radius:s.radius, t:0});
    spawnRing(player.x,player.y,'rgba(255,143,77,0.4)',22,150);
  }
  else if(id==='crossbow'){
    const targets = nearestEnemies(player.x,player.y,99999,1);
    const baseAngle = targets.length ? Math.atan2(targets[0].y-player.y, targets[0].x-player.x) : Math.atan2(facing.y,facing.x);
    const spread = 0.55;
    for(let i=0;i<s.count;i++){
      const t = s.count===1 ? 0 : (i/(s.count-1)-0.5);
      const a = baseAngle + t*spread;
      projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*s.speed, vy:Math.sin(a)*s.speed, dmg:s.dmg, pierce:s.pierce, life:1000, color:'#ffe9a8', r:5, glow:true});
    }
    spawnRing(player.x,player.y,'rgba(255,233,168,0.5)',22,150);
  }
  else if(id==='lightning'){
    const targets = nearestEnemies(player.x,player.y,440,s.count);
    targets.forEach(e=>{
      damageEnemy(e, s.dmg);
      particles.push({type:'bolt', x:e.x, y:e.y, life:220, maxLife:220, color:'#fff275'});
    });
    if(targets.length) addShake(3);
  }
  else if(id==='holywater'){
    const a = rand(0,Math.PI*2);
    projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*s.speed, vy:Math.sin(a)*s.speed, dmg:s.dmg, pierce:0, life:s.flight, color:'#fff3b0', r:8, isHolyWater:true, radius:s.radius, duration:s.duration});
  }
  else if(id==='boomerang'){
    const a = Math.atan2(facing.y, facing.x);
    projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*s.speed, vy:Math.sin(a)*s.speed, dmg:s.dmg, pierce:99, life:1800, color:'#ffd166', r:7, isBoomerang:true, range:s.range, traveled:0, returning:false, glow:true});
  }
  else if(id==='spear'){
    const targets = nearestEnemies(player.x,player.y,99999,1);
    const ang = targets.length ? Math.atan2(targets[0].y-player.y, targets[0].x-player.x) : Math.atan2(facing.y,facing.x);
    thrustHit(player.x,player.y,ang,s.range,s.width).forEach(e=>damageEnemy(e,s.dmg));
    spawnSlash(player.x+Math.cos(ang)*s.range*0.5, player.y+Math.sin(ang)*s.range*0.5, s.range*0.5, '#d8d8ff', ang, 3.0);
  }
  else if(id==='icestaff'){
    const targets = nearestEnemies(player.x,player.y,99999,1);
    const a = targets.length ? Math.atan2(targets[0].y-player.y, targets[0].x-player.x) : Math.atan2(facing.y,facing.x);
    spawnRing(player.x,player.y,'rgba(168,232,255,0.5)',22,160);
    projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*s.speed, vy:Math.sin(a)*s.speed, dmg:s.dmg, pierce:s.pierce, life:1400, color:'#a8e8ff', r:6, glow:true, chill:{mul:s.slow,dur:s.slowDur}});
  }
  else if(id==='chakram'){
    const targets = nearestEnemies(player.x,player.y,99999,1);
    const a = targets.length ? Math.atan2(targets[0].y-player.y, targets[0].x-player.x) : Math.atan2(facing.y,facing.x);
    projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*s.speed, vy:Math.sin(a)*s.speed, dmg:s.dmg, pierce:s.pierce, life:1400, color:'#ff9ee6', r:12, isChakram:true, glow:true});
    spawnRing(player.x,player.y,'rgba(255,158,230,0.5)',20,160);
  }
  else if(id==='totem'){
    zones.push({x:player.x,y:player.y,radius:s.radius,dmgPerTick:s.dmg,tickTimer:0,tickInterval:s.tick,duration:s.duration,color:'rgba(180,255,210,0.3)', isTotem:true});
    spawnRing(player.x,player.y,'rgba(180,255,210,0.6)',s.radius,300);
  }
  else if(id==='scythe'){
    const hits = enemies.filter(e=>dist(e.x,e.y,player.x,player.y)<s.range);
    hits.forEach(e=>damageEnemy(e,s.dmg));
    const ang = hits.length ? Math.atan2(hits[0].y-player.y,hits[0].x-player.x) : Math.atan2(facing.y,facing.x);
    spawnSlash(player.x,player.y,s.range,'#8a2be2', ang, 5.5);
    spawnRing(player.x,player.y,'rgba(138,43,226,0.35)', s.range, 260);
  }
  else if(id==='machinegun'){
    const targets = nearestEnemies(player.x,player.y,99999,1);
    const a = targets.length ? Math.atan2(targets[0].y-player.y, targets[0].x-player.x) : Math.atan2(facing.y,facing.x);
    const spread = rand(-0.05,0.05);
    projectiles.push({x:player.x,y:player.y, vx:Math.cos(a+spread)*s.speed, vy:Math.sin(a+spread)*s.speed, dmg:s.dmg, pierce:s.pierce, life:700, color:'#ffd24d', r:4});
  }
  else if(id==='meteor'){
    for(let i=0;i<s.count;i++){
      const target = nearestEnemies(player.x,player.y,99999,1)[0];
      const tx = target ? target.x+rand(-40,40) : player.x+rand(-150,150);
      const ty = target ? target.y+rand(-40,40) : player.y+rand(-150,150);
      meteors.push({x:tx,y:ty,radius:s.radius,dmg:s.dmg,timer:s.delay,maxTimer:s.delay});
    }
  }
  else if(id==='chainsickle'){
    const targets = nearestEnemies(player.x,player.y,99999,1);
    const a = targets.length ? Math.atan2(targets[0].y-player.y, targets[0].x-player.x) : Math.atan2(facing.y,facing.x);
    projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*s.speed, vy:Math.sin(a)*s.speed, dmg:s.dmg, pierce:s.pierce, life:1000, color:'#c0c0c0', r:6, pull:s.pull, glow:true});
  }
  else if(id==='gravitybomb'){ const targets=nearestEnemies(player.x,player.y,s.radius,99); targets.forEach(e=>damageEnemy(e,s.dmg)); zones.push({x:player.x,y:player.y,radius:s.radius,dmgPerTick:s.dmg*0.5,tickTimer:0,tickInterval:s.tick,duration:s.duration,color:'rgba(255,79,163,0.35)',pull:s.pull,isVortex:true,blackHoleLike:true}); spawnRing(player.x,player.y,'#ff4fa3',s.radius,500); }
  else if(id==='blackhole'){
    const a = rand(0,Math.PI*2);
    projectiles.push({x:player.x,y:player.y, vx:Math.cos(a)*140, vy:Math.sin(a)*140, dmg:s.dmg, pierce:0, life:550, color:'#ff4fa3', r:9, isBlackHole:true, radius:s.radius, duration:s.duration, pull:s.pull, tick:s.tick});
  }
}

function thrustHit(px,py,ang,range,width){
  const hits = [];
  const cosA = Math.cos(-ang), sinA = Math.sin(-ang);
  enemies.forEach(e=>{
    const dx = e.x-px, dy = e.y-py;
    const lx = dx*cosA - dy*sinA;
    const ly = dx*sinA + dy*cosA;
    if(lx>0 && lx<range && Math.abs(ly)<width/2) hits.push(e);
  });
  return hits;
}

function fireEvolved(inst){
  const s = rankedStats(EVO_STATS[inst.id],inst);
  if(inst.id==='excalibur'){
    enemies.forEach(e=>{ if(dist(e.x,e.y,player.x,player.y)<s.range) damageEnemy(e,s.dmg); });
    spawnRing(player.x,player.y,'rgba(255,215,0,0.6)', s.range, 260);
    spawnSpark(player.x,player.y,'#ffe066',14);
    addShake(5);
  } else if(inst.id==='stormwhip'){
    inst.dir = (inst.dir||1)*-1;
    enemies.forEach(e=>{
      const rx=e.x-player.x, ry=e.y-player.y;
      if(Math.sign(rx||inst.dir)===inst.dir && Math.abs(rx)<180 && Math.abs(ry)<70) damageEnemy(e,s.dmg);
    });
    for(let i=0;i<3;i++){ const a=rand(0,Math.PI*2); projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*220,vy:Math.sin(a)*220,dmg:s.dmg,pierce:99,life:1500,color:'#c9a0ff',r:9,isAxe:true,t:0,spin:rand(-8,8)}); }
    spawnSlash(player.x+inst.dir*70,player.y,80,'#c9a0ff', inst.dir>0?0:Math.PI, 2.2);
    addShake(3);
  } else if(inst.id==='comet'){
    const targets = nearestEnemies(player.x,player.y,99999,5);
    spawnRing(player.x,player.y,'rgba(255,143,216,0.55)',30,200);
    targets.forEach(e=>{ const a=Math.atan2(e.y-player.y,e.x-player.x); projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*300,vy:Math.sin(a)*300,dmg:s.dmg,pierce:2,life:2000,color:'#ff8fd8',r:7,homing:e,glow:true}); });
  } else if(inst.id==='toxicblade'){
    const a = Math.atan2(facing.y,facing.x);
    spawnSlash(player.x+Math.cos(a)*18,player.y+Math.sin(a)*18,20,'#7bff6a',a,1.4);
    projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*480,vy:Math.sin(a)*480,dmg:s.dmg,pierce:2,life:1200,color:'#7bff6a',r:5,poison:s.poison,glow:true});
  } else if(inst.id==='eternalbow'){
    spawnRing(player.x,player.y,'rgba(255,233,168,0.55)',26,160);
    for(let i=0;i<s.count;i++){
      const a = (i/s.count)*Math.PI*2;
      projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*s.speed,vy:Math.sin(a)*s.speed,dmg:s.dmg,pierce:99,life:900,color:'#ffe9a8',r:5,glow:true});
    }
  } else if(inst.id==='thunderzone'){
    const targets = nearestEnemies(player.x,player.y,460,s.boltCount);
    targets.forEach(e=>{ damageEnemy(e, s.dmg); particles.push({type:'bolt', x:e.x, y:e.y, life:220, maxLife:220, color:'#fff9c4'}); });
    zones.push({x:player.x,y:player.y,radius:s.radius,dmgPerTick:s.dmg*0.4,tickTimer:0,tickInterval:400,duration:s.duration,color:'rgba(200,220,255,0.28)'});
    addShake(3);
  } else if(inst.id==='demolition'){
    // passive weapon: retaliation is handled on contact, nothing to fire actively
  } else if(inst.id==='gungnir'){
    const targets = nearestEnemies(player.x,player.y,99999,1);
    const ang = targets.length ? Math.atan2(targets[0].y-player.y, targets[0].x-player.x) : Math.atan2(facing.y,facing.x);
    thrustHit(player.x,player.y,ang,s.range,s.width).forEach(e=>damageEnemy(e,s.dmg));
    spawnSlash(player.x+Math.cos(ang)*s.range*0.5, player.y+Math.sin(ang)*s.range*0.5, s.range*0.5, '#ffe27a', ang, 4.2);
    spawnSpark(player.x+Math.cos(ang)*s.range, player.y+Math.sin(ang)*s.range, '#ffe27a', 8);
    addShake(4);
  } else if(inst.id==='blizzardshrine'){
    zones.push({x:player.x,y:player.y,radius:s.radius,dmgPerTick:s.dmg,tickTimer:0,tickInterval:s.tick,duration:s.duration,color:'rgba(170,230,255,0.32)', isTotem:true, slow:s.slow, slowDur:s.slowDur});
    spawnRing(player.x,player.y,'rgba(170,230,255,0.6)', s.radius, 320);
  } else if(inst.id==='godslayer'){
    enemies.forEach(e=>{ if(dist(e.x,e.y,player.x,player.y)<s.ringRange) damageEnemy(e,s.ringDmg); });
    spawnRing(player.x,player.y,'rgba(255,90,90,0.55)', s.ringRange, 280);
    const targets = nearestEnemies(player.x,player.y,99999,1);
    const ang = targets.length ? Math.atan2(targets[0].y-player.y, targets[0].x-player.x) : Math.atan2(facing.y,facing.x);
    thrustHit(player.x,player.y,ang,s.range,s.width).forEach(e=>damageEnemy(e,s.dmg));
    spawnSlash(player.x+Math.cos(ang)*s.range*0.5, player.y+Math.sin(ang)*s.range*0.5, s.range*0.5, '#ff5050', ang, 4.6);
    spawnSpark(player.x,player.y,'#ffe066',14);
    addShake(6);
  } else if(inst.id==='galearcher'){
    spawnRing(player.x,player.y,'rgba(200,230,255,0.55)',28,160);
    for(let i=0;i<s.count;i++){
      const a=(i/s.count)*Math.PI*2;
      projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*s.speed,vy:Math.sin(a)*s.speed,dmg:s.dmg,pierce:99,life:900,color:'#dff3ff',r:5,glow:true});
    }
  } else if(inst.id==='frozencomet'){
    const targets = nearestEnemies(player.x,player.y,s.range,5);
    targets.forEach(e=>{
      const a=Math.atan2(e.y-player.y,e.x-player.x);
      projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*300,vy:Math.sin(a)*300,dmg:s.dmg,pierce:2,life:2000,color:'#aeeeff',r:8,homing:e,glow:true,chill:{mul:s.slow,dur:s.slowDur}});
    });
    zones.push({x:player.x,y:player.y,radius:s.zoneRadius,dmgPerTick:s.zoneDmg,tickTimer:0,tickInterval:s.zoneTick,duration:s.zoneDuration,color:'rgba(170,230,255,0.3)', isTotem:true, slow:s.slow, slowDur:s.slowDur});
  } else if(inst.id==='apocalypse'){
    const a = Math.atan2(facing.y,facing.x);
    for(let i=-1;i<=1;i++){
      const aa = a + i*0.18;
      spawnSlash(player.x+Math.cos(aa)*18,player.y+Math.sin(aa)*18,16,'#7bff6a',aa,1.1);
      projectiles.push({x:player.x,y:player.y,vx:Math.cos(aa)*500,vy:Math.sin(aa)*500,dmg:s.dmg,pierce:3,life:1000,color:'#7bff6a',r:5,poison:s.poison,glow:true});
    }
  } else if(inst.id==='judgmentwaltz'){
    const hits = enemies.filter(e=>dist(e.x,e.y,player.x,player.y)<s.range);
    hits.forEach(e=>damageEnemy(e,s.dmg));
    spawnRing(player.x,player.y,'rgba(138,43,226,0.4)', s.range, 260);
    const targets = nearestEnemies(player.x,player.y,99999,s.mgCount);
    targets.forEach(e=>{
      const a=Math.atan2(e.y-player.y,e.x-player.x);
      projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*s.mgSpeed,vy:Math.sin(a)*s.mgSpeed,dmg:s.mgDmg,pierce:1,life:700,color:'#ffd24d',r:4});
    });
  } else if(inst.id==='abysschain'){
    zones.push({x:player.x,y:player.y,radius:s.radius,dmgPerTick:s.dmg,tickTimer:0,tickInterval:s.tick,duration:s.duration,color:'rgba(60,0,90,0.35)', isVortex:true, pull:s.pull});
    spawnRing(player.x,player.y,'rgba(60,0,90,0.6)', s.radius, 380);
  } else if(inst.id==='celestialblessing'){
    for(let i=0;i<s.count;i++){
      const target = nearestEnemies(player.x,player.y,99999,1)[0];
      const tx = target ? target.x+rand(-40,40) : player.x+rand(-150,150);
      const ty = target ? target.y+rand(-40,40) : player.y+rand(-150,150);
      meteors.push({x:tx,y:ty,radius:s.radius,dmg:s.dmg,timer:s.delay,maxTimer:s.delay});
    }
    player.hp = Math.min(player.maxHp, player.hp+s.heal);
    spawnRing(player.x,player.y,'rgba(255,220,240,0.5)', s.healRadius, 350);
    spawnText(player.x,player.y-30,'+'+s.heal,'#ffd6f0',14);
  } else if(inst.id==='harvesthedgehog'){
    // それいけきゅーまる：時間経過で経験値を生み、レベルに応じて広い範囲から経験値を回収
    const xpGain = Math.max(1, (s.xp + inst.level));
    gainXp(xpGain);
    const pickupRadius = 120 + inst.level * 55;
    let collected = 0;
    gems.forEach(g=>{
      if(dist(g.x,g.y,player.x,player.y) <= pickupRadius){
        gainXp(Math.max(1, Number(g.val)||1));
        g.collected = true;
        collected++;
      }
    });
    gems = gems.filter(g=>!g.collected);
    spawnRing(player.x,player.y,'rgba(180,255,120,0.38)',pickupRadius,320);
    spawnText(player.x,player.y-38,'きゅうまる +'+xpGain+'XP','#b8ff7a',13);
  } else if(inst.id==='heavenharvest'){
    // 天空の祝福＋それいけきゅーまる：隕石、回復、経験値生成＋広域回収
    for(let i=0;i<4;i++){
      const target = nearestEnemies(player.x,player.y,99999,1)[0];
      const tx = target ? target.x+rand(-55,55) : player.x+rand(-180,180);
      const ty = target ? target.y+rand(-55,55) : player.y+rand(-180,180);
      meteors.push({x:tx,y:ty,radius:s.radius,dmg:s.dmg,timer:420,maxTimer:420});
    }
    player.hp = Math.min(player.maxHp, player.hp+s.heal);
    const xpGain = Math.max(2, (s.xp + inst.level));
    gainXp(xpGain);
    const pickupRadius = 220 + inst.level * 65;
    gems.forEach(g=>{
      if(dist(g.x,g.y,player.x,player.y) <= pickupRadius){
        gainXp(Math.max(1, Number(g.val)||1));
        g.collected = true;
      }
    });
    gems = gems.filter(g=>!g.collected);
    spawnRing(player.x,player.y,'rgba(255,225,120,0.5)',pickupRadius,420);
    spawnRing(player.x,player.y,'rgba(255,220,240,0.55)',s.heal*4,360);
    spawnText(player.x,player.y-42,'天穹の収穫祭 +'+xpGain+'XP','#ffe68a',15);
  } else if(inst.id==='judgmentgravity'){
    // 断罪のワルツ＋グラビティボム：弾幕＋広範囲重力爆発
    enemies.forEach(e=>{ if(dist(e.x,e.y,player.x,player.y)<s.radius) damageEnemy(e,s.dmg); });
    const targets = nearestEnemies(player.x,player.y,99999,7);
    targets.forEach(e=>{
      const a=Math.atan2(e.y-player.y,e.x-player.x);
      projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*620,vy:Math.sin(a)*620,dmg:s.dmg*0.35,pierce:3,life:900,color:'#ffd24d',r:5});
    });
    zones.push({x:player.x,y:player.y,radius:s.radius,dmgPerTick:s.dmg*0.55,tickTimer:0,tickInterval:260,duration:1800,color:'rgba(100,0,150,0.34)',isVortex:true,pull:s.pull});
    spawnRing(player.x,player.y,'rgba(150,70,255,0.68)',s.radius,500);
    addShake(7);
  } else if(inst.id==='voidstorm'){
    const targets = nearestEnemies(player.x,player.y,460,s.boltCount);
    targets.forEach(e=>{ damageEnemy(e,s.dmg); particles.push({type:'bolt', x:e.x, y:e.y, life:220, maxLife:220, color:'#c9a0ff'}); });
    zones.push({x:player.x,y:player.y,radius:s.radius,dmgPerTick:s.dmg*0.6,tickTimer:0,tickInterval:s.tick,duration:s.duration,color:'rgba(90,0,130,0.32)', isVortex:true, pull:s.pull});
    addShake(4);
  } else if(inst.id==='lastbosspower'){
    enemies.forEach(e=>{ if(dist(e.x,e.y,player.x,player.y)<s.range) damageEnemy(e,s.dmg,null,false,null,false,'lastbosspower'); });
    spawnRing(player.x,player.y,'rgba(255,105,180,0.55)', s.range, 320);
    spawnSpark(player.x,player.y,'#ff69b4',12);
  }
}

function nearestEnemies(x,y,range,count){
  return enemies.filter(e=>dist(e.x,e.y,x,y)<range)
    .sort((a,b)=>dist2(a.x,a.y,x,y)-dist2(b.x,b.y,x,y))
    .slice(0,count);
}

function explodeBomb(p){
  spawnRing(p.x,p.y,'rgba(255,140,60,0.7)', p.radius, 320);
  spawnSpark(p.x,p.y,'#ffb060',12);
  addShake(4);
  enemies.forEach(e=>{ if(dist(e.x,e.y,p.x,p.y)<p.radius) damageEnemy(e, p.dmg); });
}
function createHolyZone(p){
  zones.push({x:p.x,y:p.y,radius:p.radius,dmgPerTick:p.dmg,tickTimer:0,tickInterval:400,duration:p.duration,color:'rgba(255,240,150,0.32)'});
  spawnRing(p.x,p.y,'rgba(255,240,150,0.6)', p.radius, 300);
}
function createBlackHoleZone(p){
  zones.push({x:p.x,y:p.y,radius:p.radius,dmgPerTick:p.dmg,tickTimer:0,tickInterval:p.tick,duration:p.duration,color:'rgba(255,79,163,0.35)', isVortex:true, blackHoleLike:true, pull:p.pull});
  spawnRing(p.x,p.y,'rgba(255,79,163,0.6)', p.radius, 340);
}

function updateMeteors(dt){
  meteors.forEach(m=>{
    m.timer -= dt*1000;
    if(m.timer<=0 && !m.exploded){
      m.exploded = true;
      enemies.forEach(e=>{ if(dist(e.x,e.y,m.x,m.y)<m.radius) damageEnemy(e,m.dmg); });
      spawnRing(m.x,m.y,'rgba(255,120,40,0.7)', m.radius, 320);
      spawnSpark(m.x,m.y,'#ff8c3c',12);
      addShake(3);
    }
  });
  meteors = meteors.filter(m=>!m.exploded);
}


// ---------- Final reward sequence ----------
function startFinalRewardSequence(x,y){
  specialClearSequenceActive = true;
  enemies = [];
  enemyBolts = [];
  projectiles = [];
  meteors = [];
  zones = [];
  bossActive = null;
  trueBossPair = [];
  bossArenaCenter = null;
  powerups = [];
  stopBossPhase1Track();
  stopBossPhase2Track();
  stopBossPhase3Track();
  stopTrueBossTrack();
  resetTrueBossSpecialWeapons();
  powerups.push({x:Number(x)||player.x,y:Number(y)||player.y,type:'thankyou'});
  triggerScreenFlash(700);
  addShake(12);
  spawnText(player.x,player.y-48,'特別なアイテムが現れた！','#ff8fd5',20);
}

function showThankYouScene(){
  state = 'STORY_SCENE';
  const overlay = document.createElement('div');
  overlay.id = 'final-thankyou-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;';
  const img = document.createElement('img');
  img.alt = 'ありがとう';
  img.src = window.__finalThankYouSceneImage;
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
  overlay.appendChild(img);
  document.body.appendChild(overlay);
  setTimeout(()=>{
    overlay.remove();
    showEnding();
  },3600);
}

// ---------- Damage / death ----------
function damageEnemy(e, dmg, poison, silent, chill, rawDmg, sourceId){
  let actualDmg = rawDmg ? dmg : dmg * (player.atkMul||1)*(player.chestAtk>0?1.3:1);
  if(e.isTrueBoss && e.trueBossDefenseDownT>0) actualDmg *= (e.trueBossDefenseMul||1);
  if(Number.isFinite(actualDmg) && actualDmg > 0) addScore(actualDmg);
  e.hp -= actualDmg;
  e.flash = 100;
  // 真ボスは形態進化せず、ボス戦用武器が命中した瞬間に専用イラストを切り替える。
  if(e.isTrueBoss && sourceId==='lastbosspower' && e.hp>0){
    e.artState = (e.artState===1 ? 0 : 1);
    e.artFlash = 420;
  }
  if(poison){ e.poisonT = 3000; e.poisonDmg = poison; }
  if(chill){ e.chillT = chill.dur; e.chillMul = chill.mul; }
  if(!silent){
    spawnSpark(e.x,e.y, poison?'#7bff6a':(chill?'#a8e8ff':'#fff5c0'), 4);
    spawnText(e.x+rand(-6,6), e.y-e.r, Math.round(actualDmg).toString(), poison?'#9dff8f':(chill?'#bfe9ff':'#ffe066'));
  }
  if(e.hp<=0 && !e.dead){
    // ---- super boss phase transition (instead of dying) ----
    if(e.isSuperBoss && !e.isTrueBoss && !e.isTrueBossFinal && e.phase < 3){
      e.phase++;
      if(e.phase===2){
        stopBossPhase1Track();
        startBossPhase2Track();
        // 第二形態開始時、画面内の雑魚を添付5枚のセリフ画像へ即時切り替え。
        applyBossPhase2MinionSprites();
       } else if(e.phase===3){
        stopBossPhase2Track();
        startBossPhase3Track();
        // 第三形態開始時、指定された5枚の画像へ即時切り替え。
        applyBossPhase3MinionSprites();
      }
      const hpMult = e.phase===2 ? 1.3 : 1.7;
      const dmgMult = e.phase===2 ? 1.25 : 1.55;
      e.maxHp = e.phaseBaseHp * hpMult;
      e.hp = e.maxHp;
      e.dmg = e.phaseBaseDmg * dmgMult;
      e.r = e.baseR * (e.phase===2 ? 1.08 : 1.16);
      e.name = e.phase===2 ? ((e.baseName||SUPER_BOSS.name)+'【覚醒】') : ((e.baseName||SUPER_BOSS.name)+'【真の姿】');
      e.poisonT = 0; e.chillT = 0; e.chillMul = 1;
      if(e.abilities) e.abilities.forEach(ab=>{ e.timers[ab] = 1500; });
      if(e.chargeState!==undefined) e.chargeState = 'idle';
      if(e.breathState!==undefined) e.breathState = 'idle';
      e.frozen = false; e.dashing = false;
      const phaseColor = e.phase===2 ? '#ff2846' : '#ffd700';
      spawnRing(e.x,e.y, phaseColor, e.r*5, 600);
      spawnSpark(e.x,e.y, phaseColor, 20);
      addShake(13);
      triggerScreenFlash(350);
      showBossAnnounce(e.name, true);
      return;
    }
    e.dead = true;
    if(e.isBoss){countTitle('boss');unlockTitle('first');}
    if(e.isTrueBossFinal){countTitle('truewins');unlockTitle('true');}
    else if(e.isSuperBoss&&!e.isTrueBoss){countTitle('final');titleCounters()[selectedCharacter]=true;unlockTitle('final');}
    else if(e.isBoss&&!e.isTrueBoss&&e.noHitStart===player.damageEvents)unlockTitle('perfect');
    if(e.isSuperBoss && !e.isTrueBoss){
      stopBossPhase1Track();
      stopBossPhase2Track();
    }
    killCount++;
    saveData.totalKills = Math.max(0, Number(saveData.totalKills) || 0) + 1;
    if(!e.isBoss){
      saveData.totalMinionKills = Math.max(0, Number(saveData.totalMinionKills) || 0) + 1;
    }
    if(saveData.totalMinionKills>=10000)unlockTitle('kills');
    if(!e.isBoss&&Math.random()<.005)powerups.push({x:e.x,y:e.y,type:'chest'});
    saveData.achievements.octopus = saveData.totalKills;
    refreshTrueBossUnlock();
    saveGame();
    const gemVal = e.xpVal;
    const luckMul = 1 + (player.luck||0)*0.2;
    gems.push({x:e.x,y:e.y,val:gemVal});
    if(Math.random()<0.06*luckMul) hearts.push({x:e.x+rand(-10,10),y:e.y+rand(-10,10)});
    if(Math.random()<0.012*luckMul) powerups.push({x:e.x+rand(-10,10), y:e.y+rand(-10,10), type:'magnet'});
    else if(Math.random()<0.008*luckMul) powerups.push({x:e.x+rand(-10,10), y:e.y+rand(-10,10), type:'nuke'});
    else if(Math.random()<0.0006*luckMul) powerups.push({x:e.x+rand(-10,10), y:e.y+rand(-10,10), type:'revive'});
    spawnRing(e.x,e.y, e.color, e.r*2.4, 260);
    spawnSpark(e.x,e.y, e.color, 10);
    for(let i=0;i<7;i++){ const a=rand(0,Math.PI*2), sp=rand(30,120); spawnParticle(e.x,e.y,e.color,380,rand(2,5),Math.cos(a)*sp,Math.sin(a)*sp); }
    addShake(1.6);
    if(e.isBoss){
      for(let i=0;i<5;i++) gems.push({x:e.x+rand(-30,30), y:e.y+rand(-30,30), val:Math.ceil(gemVal/4)});
      hearts.push({x:e.x, y:e.y});
      spawnRing(e.x,e.y,'#ffd700', e.r*4.5, 520);
      spawnSpark(e.x,e.y,'#ffd700',18);
      addShake(11);
      if(e.isTrueBossFinal){
        bossKillMultiplier *= DIFFICULTIES[difficulty].bossKillGrowth;
        stopBossPhase1Track();
        stopBossPhase2Track();
        stopBossPhase3Track();
        stopTrueBossTrack();
        saveData.achievements.kingKatachan = Math.max(0, Number(saveData.achievements.kingKatachan)||0) + 1;
        weaponSlotsUnlimitedThisRun = true;
        saveGame();
        startFinalRewardSequence(e.x,e.y);
      } else if(e.isTrueBoss){
        // 真ボスは2体同時。片方を倒しても戦闘継続し、2体とも倒した時だけ撃破扱い。
        const alivePair = trueBossPair.filter(b=>b && !b.dead && b.hp>0);
        if(bossActive===e) bossActive = alivePair[0] || null;
        if(alivePair.length===0){
          // かたちゃん＆すいちゃん撃破後は終了せず、次の別ボスへ進む。
          stopBossPhase1Track();
          stopTrueBossTrack();
          trueBossFinalSpawned = false;
          bossActive = null;
          bossArenaCenter = null;
          resetTrueBossSpecialWeapons();
          triggerScreenFlash(500);
          showBossCutIn('truebossfinal', spawnTrueBossFinalActual);
        } else {
          spawnText(e.x,e.y-e.r-34,'あと1体！','#ffd700',16);
        }
      } else if(e.isSuperBoss){
        bossKillMultiplier *= DIFFICULTIES[difficulty].bossKillGrowth;
        stopBossPhase1Track();
        stopBossPhase2Track();
        // ラスボス撃破を「王者かたちゃん」にカウント
        saveData.achievements.kingKatachan = Math.max(0, Number(saveData.achievements.kingKatachan)||0) + 1;
        weaponSlotsUnlimitedThisRun = true;
        saveGame();
        startFinalRewardSequence(e.x,e.y);
      } else {
        bossKillMultiplier *= DIFFICULTIES[difficulty].bossKillGrowth;
        // 通常ボス撃破を「かたちゃん」にカウント
        saveData.achievements.katachan = Math.max(0, Number(saveData.achievements.katachan)||0) + 1;
        saveGame();

        // 通常ボスは撃破後も60秒ごとに再出現できるよう、
        // 現在のボス参照を確実に解除する。
        if(bossActive===e) bossActive = null;
      }
    }
  }
}

// ---------- Enemy spawning ----------
const ENEMY_TYPES = [
  {key:'slime', hp:20, speed:65, dmg:6, r:14, color:'#5ad16f', xp:2, minT:0},
  {key:'bat',   hp:12, speed:120, dmg:4, r:11, color:'#c48bff', xp:2, minT:0},
  {key:'orc',   hp:60, speed:48, dmg:12, r:19, color:'#e05656', xp:5, minT:45},
  {key:'ghost', hp:36, speed:78, dmg:8, r:15, color:'#8fd6ff', xp:4, minT:80},
  {key:'ogre',  hp:140,speed:40, dmg:18, r:26, color:'#a05a2c', xp:12, minT:150},
];

function spawnEnemy(){
  const avail = ENEMY_TYPES.filter(t=>elapsed>=t.minT);
  const t = pick(avail);
  const inLastBossFirstPhase = !!(bossActive && bossActive.isSuperBoss && !bossActive.isTrueBossFinal && bossActive.phase===1 && !bossActive.dead);
  const inLastBossSecondPhase = !!(bossActive && bossActive.isSuperBoss && !bossActive.isTrueBossFinal && bossActive.phase===2 && !bossActive.dead);
  const inLastBossThirdPhase = !!(bossActive && bossActive.isSuperBoss && !bossActive.isTrueBossFinal && bossActive.phase===3 && !bossActive.dead);
  const inTrueBossBattle = !!(bossActive && (bossActive.isTrueBoss || bossActive.isTrueBossFinal) && !bossActive.dead);
  const trueBossMinionSpriteKey = inTrueBossBattle ? randomTrueBossMinionSpriteKey() : null;
  const bossPhase1SpriteKey = inLastBossFirstPhase ? ('boss_phase1_'+(1+Math.floor(Math.random()*5))) : null;
  const bossPhase2SpriteKey = inLastBossSecondPhase ? ('boss_phase2_minion_'+(1+Math.floor(Math.random()*5))) : null;
  const bossPhase3SpriteKey = inLastBossThirdPhase ? ('boss_phase3_minion_'+(1+Math.floor(Math.random()*5))) : null;
  const bossMinionSpriteKey = trueBossMinionSpriteKey || bossPhase1SpriteKey || bossPhase2SpriteKey || bossPhase3SpriteKey;
  const diff = DIFFICULTIES[difficulty];
  const stage = currentStage();
  const stageGrowth = (stage-1)*diff.scaleMul;
  const hpScale = (1 + (elapsed/115)*diff.scaleMul + stageGrowth*0.22) * bossKillMultiplier;
  const dmgScale = Math.min(1 + (elapsed/115)*diff.scaleMul*0.85 + stageGrowth*0.16, 2.8) * bossKillMultiplier;
  const speedScale = Math.min(1 + stageGrowth*0.06, 1.7);
  const ang = rand(0,Math.PI*2);
  const dist0 = Math.max(canvas.width,canvas.height)/2 + 80;
  enemies.push({
    x: player.x+Math.cos(ang)*dist0, y: player.y+Math.sin(ang)*dist0,
    hp: t.hp*hpScale*diff.hpMul, maxHp:t.hp*hpScale*diff.hpMul, speed:t.speed*speedScale, dmg:t.dmg*dmgScale*diff.dmgMul,
    r:t.r, color:t.color, xpVal:t.xp, dead:false, flash:0, hitTimer:0,
    poisonT:0, poisonDmg:0, chillT:0, chillMul:1, key:t.key, spriteKey:bossMinionSpriteKey, angle:0,
  });
  // 真ボス戦の雑魚は通常移動＋接触ダメージのみ。
  // 雑魚専用の突進攻撃は付与しない。
  const spawned = enemies[enemies.length-1];
  if(inTrueBossBattle && spawned && !spawned.isBoss){
    spawned.isTrueBossMinion = true;
    // 表示の20%縮小に合わせ、接触・被弾判定の半径も20%縮小。
    spawned.trueBossOriginalRadius = spawned.r;
    spawned.r *= 0.8;
  }
}

function initBossAbilities(boss, abilities){
  boss.abilities = abilities || [];
  boss.timers = {};
  boss.frozen = false;
  let stagger = 0;
  boss.abilities.forEach(ab=>{
    const cfg = BOSS_ABILITY_CONFIG[ab];
    boss.timers[ab] = 1200 + stagger;
    stagger += 700;
    if(ab==='charge') boss.chargeState='idle';
    if(ab==='breath') boss.breathState='idle';
    if(ab==='bind') boss.bindState='idle';
  });
}

function spawnBossActual(t){
  bossCount++;
  const diff = DIFFICULTIES[difficulty];
  const scaleT = (1 + (bossCount-1)*0.4) * bossKillMultiplier;
  const dmgScaleT = Math.min(1 + (bossCount-1)*0.4, 2.6) * bossKillMultiplier;
  const ang = rand(0,Math.PI*2);
  const dist0 = Math.max(canvas.width,canvas.height)/2 + 160;
  const boss = {
    x: player.x+Math.cos(ang)*dist0, y: player.y+Math.sin(ang)*dist0,
    hp: t.hp*scaleT*diff.hpMul, maxHp:t.hp*scaleT*diff.hpMul, speed:t.speed, dmg:t.dmg*dmgScaleT*diff.dmgMul,
    r:t.r, color:t.color, xpVal:Math.ceil(t.xp*scaleT), dead:false, flash:0, hitTimer:0,
    poisonT:0, poisonDmg:0, chillT:0, chillMul:1, key:t.key, angle:0,
    isBoss:true, name:t.name,
  };
  boss.noHitStart=player.damageEvents||0;
  initBossAbilities(boss, t.abilities);
  enemies.push(boss);
  bossActive = boss;
}
function triggerBossSpawn(){
  const t = pick(BOSS_TYPES);
  showBossCutIn(t.key, ()=> spawnBossActual(t));
}

function applyBossPhase1MinionSprites(){
  if(!(bossActive && bossActive.isSuperBoss && !bossActive.isTrueBossFinal && bossActive.phase===1 && !bossActive.dead)) return;
  enemies.forEach(e=>{
    if(!e.isBoss && !e.dead){
      if(!e.spriteKey || e.spriteKey.indexOf('boss_phase1_')!==0){
        e.spriteKey = 'boss_phase1_'+(1+Math.floor(Math.random()*5));
      }
    }
  });
}

function applyBossPhase2MinionSprites(){
  if(!(bossActive && bossActive.isSuperBoss && !bossActive.isTrueBossFinal && bossActive.phase===2 && !bossActive.dead)) return;
  // 最終ボス第2形態の雑魚は、第1形態とまったく同じ5枚を使用する。
  enemies.forEach(e=>{
    if(!e.isBoss && !e.dead){
      if(!e.spriteKey || e.spriteKey.indexOf('boss_phase1_')!==0){
        e.spriteKey = 'boss_phase1_'+(1+Math.floor(Math.random()*5));
      }
    }
  });
}

// ラスボス第三形態中は、今回添付された5枚を雑魚敵として使用。
function applyBossPhase3MinionSprites(){
  if(!(bossActive && bossActive.isSuperBoss && !bossActive.isTrueBossFinal && bossActive.phase===3 && !bossActive.dead)) return;
  enemies.forEach(e=>{
    if(!e.isBoss && !e.dead){
      if(!e.spriteKey || e.spriteKey.indexOf('boss_phase3_minion_')!==0){
        e.spriteKey = 'boss_phase3_minion_'+(1+Math.floor(Math.random()*5));
      }
    }
  });
}

function applyTrueBossMinionSprites(){
  if(!(bossActive && (bossActive.isTrueBoss || bossActive.isTrueBossFinal) && !bossActive.dead)) return;
  enemies.forEach(e=>{
    if(!e.isBoss && !e.dead){
      if(!e.spriteKey || e.spriteKey.indexOf('trueboss_minion_')!==0){
        e.spriteKey = randomTrueBossMinionSpriteKey();
      }
      // 真ボス戦の雑魚は突進攻撃を持たない。
      // 接触した場合の通常の接触ダメージは updateEnemies() 側で維持する。
      if(!e.isTrueBossMinion){
        e.isTrueBossMinion = true;
        e.trueBossOriginalRadius = e.r;
        e.r *= 0.8;
      }
      if(e.abilities && e.abilities.includes('charge')){
        e.abilities = e.abilities.filter(ab=>ab!=='charge');
        if(e.timers) delete e.timers.charge;
        e.chargeState = undefined;
        e.chargeT = undefined;
        e.chargeDir = undefined;
        e.chargeHit = false;
        e.dashing = false;
      }
    }
  });
}

function restoreNormalMinionSprites(){
  enemies.forEach(e=>{
    if(!e.isBoss && !e.dead && e.spriteKey && (e.spriteKey.indexOf('boss_phase1_')===0 || e.spriteKey.indexOf('boss_phase2_minion_')===0 || e.spriteKey.indexOf('boss_phase3_minion_')===0 || e.spriteKey.indexOf('trueboss_minion_')===0)){
      e.spriteKey = e.key;
    }
    if(!e.isBoss && e.isTrueBossMinion){
      if(Number.isFinite(e.trueBossOriginalRadius)) e.r = e.trueBossOriginalRadius;
      delete e.trueBossOriginalRadius;
      e.isTrueBossMinion = false;
      e.abilities = [];
      e.chargeState = undefined;
      e.chargeT = undefined;
      e.chargeDir = undefined;
      e.chargeHit = false;
      e.dashing = false;
    }
  });
}

function spawnSuperBossActual(){
  superBossSpawned = true;
  const diff = DIFFICULTIES[difficulty];
  const t = SUPER_BOSS;
  const ang = rand(0,Math.PI*2);
  const dist0 = Math.max(canvas.width,canvas.height)/2 + 220;
  // ラスボス出現時点で、それまでに実際に拾ったハート数を確定。
  // ハート1個につきHPを2%、攻撃力を0.1%加算する。
  finalBossHeartCount = collectedHeartCount;
  finalBossHeartMultiplier = 1 + finalBossHeartCount * 0.02;
  finalBossHeartAttackMultiplier = 1 + finalBossHeartCount * 0.001;
  const baseHp = t.hp*diff.hpMul*bossKillMultiplier*finalBossHeartMultiplier;
  const baseDmg = t.dmg*diff.dmgMul*bossKillMultiplier*finalBossHeartAttackMultiplier;
  const boss = {
    x: player.x+Math.cos(ang)*dist0, y: player.y+Math.sin(ang)*dist0,
    hp: baseHp, maxHp:baseHp, speed:t.speed, dmg:baseDmg,
    r:t.r, baseR:t.r, color:t.color, xpVal:t.xp, dead:false, flash:0, hitTimer:0,
    poisonT:0, poisonDmg:0, chillT:0, chillMul:1, key:t.key, angle:0,
    isBoss:true, isSuperBoss:true, name:t.name, novaTimer:2500,
    phase:1, phaseBaseHp:baseHp, phaseBaseDmg:baseDmg,
    heartStrengthMul:finalBossHeartAttackMultiplier,
  };
  initBossAbilities(boss, t.abilities);
  enemies.push(boss);
  bossActive = boss;
  // ラスボス第一形態では添付の「かたちゃん.mp3」を専用BGMとして再生。
  startBossPhase1Track();
  // 第一形態開始時点ですでに画面内にいる雑魚も、直ちに指定画像へ切り替える。
  applyBossPhase1MinionSprites();
  addShake(14);
  bossArenaCenter = {x: player.x, y: player.y};

  // ---- last-boss-fight player setup ----
  player.hp = player.maxHp; // full heal
  player.hitFlash = 0;
  player.ultimateGauge = 0;
}
function spawnTrueBossActual(){
  superBossSpawned = true;
  const diff = DIFFICULTIES[difficulty];
  const t = TRUE_BOSS;
  const centerX = player.x, centerY = player.y;
  finalBossHeartCount = collectedHeartCount;
  finalBossHeartMultiplier = 1 + finalBossHeartCount * 0.02;
  finalBossHeartAttackMultiplier = 1 + finalBossHeartCount * 0.001;
  // 真ボスは「かたちゃん」と「すいちゃん」の2体同時。形態進化はしない。
  const eachHp = (t.hp * 0.62) * diff.hpMul * bossKillMultiplier * finalBossHeartMultiplier;
  const eachDmg = t.dmg * diff.dmgMul * bossKillMultiplier * finalBossHeartAttackMultiplier;
  const roles = [
    {role:'kata', name:'かたちゃん'},
    {role:'sui', name:'すいちゃん'}
  ];
  trueBossTeleportTurn = 'kata';
  trueBossPair = roles.map((r,i)=>{
    const side = i===0 ? -1 : 1;
    const boss = {
      x:centerX + side*220, y:centerY + (i===0?-35:35),
      hp:eachHp, maxHp:eachHp, speed:t.speed, dmg:eachDmg,
      r:t.r, baseR:t.r, color:i===0?'#7aa9ff':'#ffd15a', xpVal:Math.ceil(t.xp*0.7),
      dead:false, flash:0, hitTimer:0, poisonT:0, poisonDmg:0, chillT:0, chillMul:1,
      key:t.key, angle:0, isBoss:true, isSuperBoss:true, isTrueBoss:true,
      isTrueBossPair:true, trueBossRole:r.role, name:r.name, baseName:r.name,
      // 真ボス第1戦の2体は完全に同じ攻撃パターン。
      // 瞬間移動のみを使用し、接触した時だけ体当たりダメージを与える。
      trueBossTeleportOnly: true,
      novaTimer: Infinity,
      novaInterval: Infinity,
      novaRadius:t.novaRadius, novaDmg:t.novaDmg, artState:0, artFlash:0,
      trueBossTeddyActive:false,
      trueBossGachaActive:false,
      trueBossAttackDownT:0, trueBossAttackMul:1, trueBossDefenseDownT:0, trueBossDefenseMul:1
    };
    initBossAbilities(boss, ['teleport']);
    // 先にかたちゃん、少し遅れてすいちゃん。以後は交互に瞬間移動する。
    boss.timers.teleport = i===0 ? 2200 : 5200;
    enemies.push(boss);
    return boss;
  });
  bossActive = trueBossPair[0];
  startTrueBossTrack();
  // 真ボス戦の雑魚を今回指定された6枚へ切り替える。
  applyTrueBossMinionSprites();
  addShake(18);
  triggerScreenFlash(700);
  bossArenaCenter = {x:centerX, y:centerY};
  player.hp = player.maxHp;
  player.hitFlash = 0;
  setupTrueBossSpecialWeapons();
  player.ultimateGauge = 0;
}

// 真ボス第2戦：かたちゃん＆すいちゃん撃破後に登場する別ボス。
const TRUE_BOSS_FINAL_SPRITE = (()=>{
  const img = new Image();
  const entry = {img, w:1254, h:1254, loaded:false};
  img.onload = ()=>{ entry.w = entry.w || img.naturalWidth; entry.h = entry.h || img.naturalHeight; entry.loaded = true; };
  img.src = 'assets/images/87200a5ff8626b71727eee3a.png';
  return entry;
})();

const TRUE_BOSS_FINAL = {
  key:'dragon', name:'膝シーソーかたちゃん＆すいちゃん', hp:90000, speed:54, dmg:120, r:58, color:'#ff7a18', xp:1800,
  // 第2戦は弾幕ゲームへ飛ばす技だけ。その他のボス攻撃は持たせない。
  novaInterval:Infinity, novaRadius:0, novaDmg:0, abilities:['bullethell']
};
function spawnTrueBossFinalActual(){
  if(trueBossFinalSpawned) return;
  trueBossFinalSpawned = true;
  const diff = DIFFICULTIES[difficulty];
  const t = TRUE_BOSS_FINAL;
  finalBossHeartCount = collectedHeartCount;
  finalBossHeartMultiplier = 1 + finalBossHeartCount * 0.02;
  finalBossHeartAttackMultiplier = 1 + finalBossHeartCount * 0.001;
  const hp = t.hp * diff.hpMul * bossKillMultiplier * finalBossHeartMultiplier;
  const dmg = t.dmg * diff.dmgMul * bossKillMultiplier * finalBossHeartAttackMultiplier;
  const ang = rand(0, Math.PI*2);
  const dist0 = Math.max(canvas.width, canvas.height)/2 + 260;
  const boss = {
    x:player.x+Math.cos(ang)*dist0, y:player.y+Math.sin(ang)*dist0,
    hp, maxHp:hp, speed:t.speed, dmg, r:t.r, baseR:t.r, color:t.color, xpVal:t.xp,
    dead:false, flash:0, hitTimer:0, poisonT:0, poisonDmg:0, chillT:0, chillMul:1,
    key:t.key, angle:0, isBoss:true, isSuperBoss:true, isTrueBossFinal:true,
    // 真のラスボス第2戦は「弾幕ゲームへ飛ばす特殊攻撃」だけを使用。
    // 通常攻撃・ノヴァ・突進・魔法・ブレス・瞬間移動・拘束は使用しない。
    trueBossFinalBulletHellOnly:true,
    name:t.name, baseName:t.name, novaTimer:Infinity, novaInterval:Infinity,
    novaRadius:t.novaRadius, novaDmg:t.novaDmg, phase:3, heartStrengthMul:finalBossHeartAttackMultiplier,
    trueBossTeddyActive:false,
    trueBossGachaActive:false,
    trueBossAttackDownT:0, trueBossAttackMul:1, trueBossDefenseDownT:0, trueBossDefenseMul:1
  };
  initBossAbilities(boss, t.abilities);
  enemies.push(boss);
  bossActive = boss;
  applyTrueBossMinionSprites();
  startTrueBossTrack();
  addShake(20);
  triggerScreenFlash(800);
  bossArenaCenter = {x:player.x, y:player.y};
  player.hp = player.maxHp;
  player.hitFlash = 0;
  setupTrueBossSpecialWeapons();
  player.ultimateGauge = 0;
  showBossAnnounce(t.name, true);
}



// Boss damage safety: prevent a malformed boss damage value from turning HP/position into NaN.
function applyBossDamageToPlayer(e, base, mul=1, invMs=600, flashMs=260){
  if(!player) return false;
  const raw = Number(base);
  const m = Number(mul);
  const def = Number(player.defMul);
  const damage = Math.max(0, Number.isFinite(raw) ? raw : 0) * (Number.isFinite(m) ? m : 1) * (Number.isFinite(def) ? def : 1);
  if(player.invTimer>0 || player.chestInv>0 || damage<=0) return false;
  player.damageEvents++;
  player.hp = Math.max(0, (Number.isFinite(Number(player.hp)) ? Number(player.hp) : player.maxHp) - damage);
  player.invTimer = invMs;
  player.hitFlash = flashMs;
  if(!Number.isFinite(player.x)) player.x = canvas.width/2;
  if(!Number.isFinite(player.y)) player.y = canvas.height-120;
  return true;
}
function trueBossAttackDamage(e, base){
  if(e && e.isTrueBoss && e.trueBossAttackDownT>0) return base*(e.trueBossAttackMul||1);
  return base;
}
function setupTrueBossSpecialWeapons(){
  player.trueBossSpecials = {teddy:0,tower:0,bouquet:0,ticket:0};
  player.trueBossSpecialReadyNotified = {teddy:false,tower:false,bouquet:false,ticket:false};
  trueBossSpecialPauseT = 0;
  player.trueBossSpecialActive = true;
  updateTrueBossSpecialHud();
if(typeof bossActive!=='undefined' && bossActive) keepBossAwayFromPlayer(bossActive);
if(typeof activeBoss!=='undefined' && activeBoss) keepAnyBossAwayFromPlayer(activeBoss);
if(typeof normalBoss!=='undefined' && normalBoss) keepAnyBossAwayFromPlayer(normalBoss);
}
function resetTrueBossSpecialWeapons(){
  if(!player) return;
  player.trueBossSpecials = {teddy:0,tower:0,bouquet:0,ticket:0};
  player.trueBossSpecialActive = false;
  updateTrueBossSpecialHud();
}
function getTrueBossTargets(){
  return enemies.filter(e=>e && e.isTrueBoss && !e.dead && e.hp>0);
}
// 真ボス専用の華やかな必殺技演出。演出は描画のみでダメージ判定には影響しない。
// 添付画像を真ボス必殺技の描画に使用
const TRUE_BOSS_ATTACK_ART = {};
for(const [id,src] of Object.entries({
  tower:'assets/images/2c083c38324befaa8d11826c.png',
  bouquet:'assets/images/58ad6cbbd2ba294c9ff23cf4.png'
})){
  const img=new Image(); img.src=src; TRUE_BOSS_ATTACK_ART[id]=img;
}
const trueBossImpactAnimations=[];
function addTrueBossImpactAnimation(kind,target){
  if(!target) return;
  if(trueBossImpactAnimations.length>=16) trueBossImpactAnimations.splice(0,trueBossImpactAnimations.length-15);
  trueBossImpactAnimations.push({kind,x:target.x,y:target.y,r:Math.max(30,target.r||30),age:0,
    duration:kind==='tower'?2.15:kind==='bouquet'?1.65:0.95});
}
function addDaisukiBeamCelebration(source,target){
  if(!source||!target)return;
  trueBossImpactAnimations.push({kind:'daisuki',x:target.x,y:target.y,
    x1:source.x,y1:source.y,r:Math.max(35,target.r||35),age:0,duration:1.3});
}
function updateTrueBossImpactAnimations(dt){
  for(let i=trueBossImpactAnimations.length-1;i>=0;i--){
    const a=trueBossImpactAnimations[i];a.age+=dt;
    if(a.age>=a.duration) trueBossImpactAnimations.splice(i,1);
  }
}
function drawTrueBossImpactAnimations(){
  const TAU=Math.PI*2;
  function star(x,y,r,points=5){
    ctx.beginPath();
    for(let j=0;j<points*2;j++){
      const ang=j*Math.PI/points-Math.PI/2,rr=j%2?r*.43:r;
      const px=x+Math.cos(ang)*rr,py=y+Math.sin(ang)*rr;
      if(j===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.closePath();ctx.fill();
  }
  for(const a of trueBossImpactAnimations){
    const x=a.x-camX,y=a.y-camY,r=a.r,t=a.age;
    if(a.kind==='daisuki'){
      const sx=a.x1-camX,sy=a.y1-camY,progress=Math.min(1,t/a.duration);
      const TAU=Math.PI*2,fade=Math.min(1,(1-progress)*3);
      ctx.save();ctx.globalAlpha=fade;ctx.lineCap='round';
      const grad=ctx.createLinearGradient(sx,sy,x,y);
      grad.addColorStop(0,'#ff92e0');grad.addColorStop(.5,'#fff0fb');grad.addColorStop(1,'#ff6dbb');
      ctx.shadowColor='#ff5ed5';ctx.shadowBlur=10;
      ctx.strokeStyle='#ff72ce';ctx.lineWidth=34*(1-progress*.45);
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(x,y);ctx.stroke();
      ctx.strokeStyle=grad;ctx.lineWidth=16*(1-progress*.4);
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(x,y);ctx.stroke();
      ctx.shadowBlur=0;
      const dx=x-sx,dy=y-sy,len=Math.max(1,Math.hypot(dx,dy));
      for(let j=0;j<10;j++){
        const u=(j/10+progress*.65)%1,off=Math.sin(j*2.4+progress*16)*22;
        const px=sx+dx*u-dy/len*off,py=sy+dy*u+dx/len*off;
        ctx.globalAlpha=fade*(.45+.55*Math.sin(j*5+progress*20)**2);
        ctx.font=(16+j%4*5)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(j%3===0?'💗':j%3===1?'✨':'🌸',px,py);
      }
      ctx.globalAlpha=fade;
      for(let j=0;j<3;j++){
        const radius=18+progress*(95+j*42);
        ctx.strokeStyle=j%2?'#fff5fd':'#ff77cb';ctx.lineWidth=Math.max(1,7-progress*5-j);
        ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.stroke();
      }
      for(let j=0;j<8;j++){
        const ang=j*TAU/8+progress*.6,rad=20+progress*(a.r+100)+(j%4)*10;
        ctx.font=(18+j%3*7)+'px sans-serif';
        ctx.fillText(j%2?'💖':'✦',x+Math.cos(ang)*rad,y+Math.sin(ang)*rad);
      }
      ctx.restore();continue;
    }
    if(a.kind==='teddy'||a.kind==='ticket'){
      const p=Math.min(1,t/a.duration),fade=1-p;
      const color=a.kind==='teddy'?'#9bdcff':'#ffe08a';
      ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle=color;
      for(let j=0;j<2;j++){
        ctx.lineWidth=j?2:4;
        ctx.beginPath();ctx.arc(x,y,r*(1.0+j*.4)+p*24,0,TAU);ctx.stroke();
      }
      for(let j=0;j<8;j++){
        const ang=j*TAU/8+t*(j%2?1:-1),rr=r*.75+p*75+(j%3)*9;
        const px=x+Math.cos(ang)*rr,py=y+Math.sin(ang)*rr;
        ctx.fillStyle=j%3===0?'#ffffff':color;
        ctx.beginPath();ctx.arc(px,py,3+j%3,0,TAU);ctx.fill();
      }
      ctx.restore();continue;
    }
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    const glow=a.kind==='tower'?'#c4a7ff':a.kind==='bouquet'?'#ff80c7':a.kind==='teddy'?'#9bdcff':'#ffe08a';
    const progress=Math.min(1,t/a.duration);
    // ゆっくり消える魔法陣と二重の光輪。
    ctx.globalAlpha=.7*(1-progress);
    ctx.strokeStyle=glow;ctx.shadowColor=glow;ctx.shadowBlur=22;
    for(let j=0;j<2;j++){
      ctx.lineWidth=j===0?5:2;
      ctx.beginPath();ctx.arc(x,y,r*(1.05+j*.35)+Math.sin(t*7+j)*9,0,TAU);ctx.stroke();
    }
    ctx.shadowBlur=0;
    // 星と光粒を円周上に舞わせる（決定論的で毎フレームちらつかない）。
    for(let j=0;j<22;j++){
      const ang=j*2.39996+t*(j%2?1:-1)*1.5;
      const rad=r*.65+(j%5)*r*.16+progress*55;
      const px=x+Math.cos(ang)*rad,py=y+Math.sin(ang)*rad;
      ctx.globalAlpha=(.45+.45*Math.sin(t*9+j)**2)*(1-progress);
      ctx.fillStyle=j%3===0?'#ffffff':glow;
      star(px,py,3+(j%4)*1.6,4);
    }
    ctx.globalAlpha=1;ctx.shadowColor=glow;ctx.shadowBlur=15;
    if(a.kind==='tower'){
      // 10本が連続落下、着弾ごとに金紫の衝撃波と火花。
      const spacing=Math.min(26,Math.max(13,r*.34));
      for(let i=0;i<10;i++){
        const q=(t-i*.13)/.46;if(q<0||q>1.6)continue;
        const ox=(i-4.5)*spacing,iy=y+Math.sin(i*2.4)*Math.min(18,r*.25);
        if(q<1){
          const ease=1-Math.pow(1-q,3),yy=iy-Math.max(220,r*3.6)*(1-ease);
          ctx.globalAlpha=Math.min(1,q*6);
          const art=TRUE_BOSS_ATTACK_ART.tower;
          if(art.complete && art.naturalWidth){
            const w=65,h=65*art.naturalHeight/art.naturalWidth;
            ctx.drawImage(art,x+ox-w/2,yy-h/2,w,h);
          }else{ctx.font='bold 46px sans-serif';ctx.fillText('🗼',x+ox,yy);}
          ctx.strokeStyle='#fff2c4';ctx.lineWidth=3;
          ctx.beginPath();ctx.moveTo(x+ox,yy-80);ctx.lineTo(x+ox,yy-32);ctx.stroke();
        }else{
          const p=(q-1)/.6;ctx.globalAlpha=1-p;
          ctx.strokeStyle=i%2?'#ffe2a5':'#d7b8ff';ctx.lineWidth=6*(1-p)+1;
          ctx.beginPath();ctx.ellipse(x+ox,iy,12+p*75,7+p*35,0,0,TAU);ctx.stroke();
          for(let j=0;j<7;j++){
            const ang=j*TAU/7+i;ctx.fillStyle='#fff8d8';
            star(x+ox+Math.cos(ang)*(14+p*60),iy+Math.sin(ang)*(10+p*45),5*(1-p)+2,4);
          }
        }
      }
    }else if(a.kind==='bouquet'){
      const q=Math.min(1,t/.68),ease=1-Math.pow(1-q,3);
      const sx=x-Math.max(170,r*3),sy=y-Math.max(150,r*2.8);
      if(q<1){
        const bx=sx+(x-sx)*ease,by=sy+(y-sy)*ease;
        ctx.globalAlpha=1;
        const art=TRUE_BOSS_ATTACK_ART.bouquet;
        if(art.complete && art.naturalWidth){
          const w=112,h=112*art.naturalHeight/art.naturalWidth;
          ctx.save();ctx.translate(bx,by);ctx.rotate(-.22*(1-q));ctx.drawImage(art,-w/2,-h/2,w,h);ctx.restore();
        }else{ctx.font='bold 72px sans-serif';ctx.fillText('💐',bx,by);}
        for(let j=0;j<5;j++){
          const p=j/5,tx=sx+(bx-sx)*p,ty=sy+(by-sy)*p;
          ctx.globalAlpha=.25+.6*p;ctx.font=`${15+j%4*5}px sans-serif`;
          ctx.fillText(j%3?'🌸':'💗',tx+Math.sin(j*2.2)*24,ty+Math.cos(j*2.5)*24);
        }
      }else{
        const p=Math.min(1,(t-.68)/.97);ctx.globalAlpha=1-p;
        for(let k=0;k<3;k++){
          const f=Math.max(0,Math.min(1,p*1.45-k*.2));
          ctx.strokeStyle=k%2?'#ffffff':'#ff8ac9';ctx.lineWidth=(9-k*2)*(1-f)+1;
          ctx.beginPath();ctx.arc(x,y,12+f*(r+120),0,TAU);ctx.stroke();
        }
        for(let j=0;j<9;j++){
          const ang=j*TAU/9,rr=18+p*(r+110)+(j%3)*13;
          ctx.font=`${22+j%3*6}px sans-serif`;
          ctx.fillText(j%3===0?'💖':j%3===1?'🌸':'💕',x+Math.cos(ang)*rr,y+Math.sin(ang)*rr);
        }
        const art=TRUE_BOSS_ATTACK_ART.bouquet;
        if(art.complete && art.naturalWidth){
          const w=100*(1+p*.45),h=w*art.naturalHeight/art.naturalWidth;
          ctx.drawImage(art,x-w/2,y-h/2,w,h);
        }else{ctx.font='bold 66px sans-serif';ctx.fillText('💖',x,y);}
      }
    }else if(a.kind==='teddy'||a.kind==='ticket'){
      const p=Math.min(1,t/a.duration);
      ctx.globalAlpha=1-p*.8;
      ctx.font=`bold ${Math.round(54+22*Math.sin(Math.min(1,p*2)*Math.PI))}px sans-serif`;
      ctx.fillText(a.kind==='teddy'?'🧸':'🎫',x,y-15-p*30);
      for(let j=0;j<14;j++){
        const ang=j*TAU/14+t*.8,rr=20+p*(r+90);
        ctx.font=`${20+j%3*4}px sans-serif`;
        ctx.fillText(a.kind==='teddy'?(j%2?'🩵':'✨'):(j%2?'🌟':'🎀'),x+Math.cos(ang)*rr,y+Math.sin(ang)*rr);
      }
    }
    ctx.restore();
  }
}
function activateTrueBossSpecial(id){
  if(state!=='PLAYING' || !player.trueBossSpecialActive || !TRUE_BOSS_SPECIAL_WEAPONS[id]) return;
  const def = TRUE_BOSS_SPECIAL_WEAPONS[id];
  if((player.trueBossSpecials[id]||0) < 100) return;
  const targets = getTrueBossTargets();
  if(!targets.length) return;
  player.trueBossSpecials[id] = 0;countTitle('special');checkTitles();
  if(player.trueBossSpecialReadyNotified) player.trueBossSpecialReadyNotified[id] = false;

  // 全必殺技は距離に関係なく生存中の真ボス全員が対象。
  // 発動時に対象本人を強調して、効果範囲が誤解されないようにする。
  const effectLabels={teddy:'🧸 攻撃力 -65%（8.5秒）',tower:'🗼 最大HPの8%ダメージ',bouquet:'💐 最大HPの18%ダメージ',ticket:'🎫 被ダメージ ×1.55（8.5秒）'};
  const effectColors={teddy:'#91d7ff',tower:'#c7b5ff',bouquet:'#ff98cf',ticket:'#ffd36e'};
  targets.forEach(e=>{
    spawnRing(e.x,e.y,effectColors[id],Math.max(70,(e.r||30)*2.8),650);
    spawnSpark(e.x,e.y,effectColors[id],14);
    spawnText(e.x,e.y-(e.r||30)-65,'🎯 '+effectLabels[id],effectColors[id],16);
  });
  if(id==='teddy'){
    targets.forEach(e=>{ addTrueBossImpactAnimation('teddy',e);
      e.trueBossAttackDownT = def.debuffMs;
      e.trueBossAttackMul = def.attackDown;
      e.trueBossTeddyActive = true;
      e.artState = e.artState===1 ? 0 : 1;
      e.artFlash = 700;
      spawnText(e.x,e.y-e.r-34,'🧸 攻撃力DOWN！','#9fd8ff',15);
    });
    spawnRing(player.x,player.y,'rgba(130,190,255,.72)',180,520);
    spawnSpark(player.x,player.y,'#9fd8ff',20);
  } else if(id==='tower'){
    targets.forEach(e=>{ addTrueBossImpactAnimation('tower',e); damageEnemy(e,e.maxHp*def.damageRatio,null,false,null,true,'trueboss-tower'); });
    spawnRing(player.x,player.y,'rgba(170,150,255,.75)',210,520);
    spawnText(player.x,player.y-48,'🗼 タワー！','#c9b7ff',18);
  } else if(id==='bouquet'){
    targets.forEach(e=>{ addTrueBossImpactAnimation('bouquet',e); damageEnemy(e,e.maxHp*def.damageRatio,null,false,null,true,'trueboss-bouquet'); });
    spawnRing(player.x,player.y,'rgba(255,120,190,.78)',250,620);
    spawnSpark(player.x,player.y,'#ff9bd0',30);
    spawnText(player.x,player.y-48,'💐 ハートブーケ！','#ffb3da',19);
  } else if(id==='ticket'){
    targets.forEach(e=>{ addTrueBossImpactAnimation('ticket',e);
      e.trueBossDefenseDownT = def.debuffMs;
      e.trueBossDefenseMul = def.defenseUp;
      e.trueBossGachaActive = true;
      e.artState = e.artState===1 ? 0 : 1;
      e.artFlash = 700;
      spawnText(e.x,e.y-e.r-34,'🎫 防御DOWN！','#ffd36e',15);
    });
    spawnRing(player.x,player.y,'rgba(255,210,90,.75)',180,520);
    spawnSpark(player.x,player.y,'#ffd36e',20);
  }
  updateTrueBossSpecialHud();
}
function updateTrueBossSpecials(dt){
  if(!player || !player.trueBossSpecialActive) return;
  // ゲージは真ボス戦中なら弾幕中も止めずにチャージする。
  // 特にガチャチケが途中で止まることがないよう、chargeMsを必ず数値化する。
  const activeBoss = getTrueBossTargets().length>0;
  if(activeBoss){
    Object.keys(TRUE_BOSS_SPECIAL_WEAPONS).forEach(id=>{
      const def = TRUE_BOSS_SPECIAL_WEAPONS[id];
      const chargeMs = Math.max(1, Number(def.chargeMs)||1);
      player.trueBossSpecials[id] = Math.min(100, (Number(player.trueBossSpecials[id])||0) + dt*100000/chargeMs);
    });
  }
  // 真ボス第1戦（かたちゃん＆すいちゃん）では、必殺技ゲージが満タンになるたび
  // 2.5秒だけ敵と敵弾を止め、移動しながら落ち着いてボタンを押せるようにする。
  const isFirstTrueBossFight = trueBossPair && trueBossPair.some(b=>b && !b.dead && b.hp>0);
  if(isFirstTrueBossFight && trueBossSpecialPauseT<=0){
    for(const id of Object.keys(TRUE_BOSS_SPECIAL_WEAPONS)){
      const ready = (Number(player.trueBossSpecials?.[id])||0) >= 100;
      const notified = !!player.trueBossSpecialReadyNotified?.[id];
      if(ready && !notified){
        if(!player.trueBossSpecialReadyNotified) player.trueBossSpecialReadyNotified = {};
        player.trueBossSpecialReadyNotified[id] = true;
        trueBossSpecialPauseT = 2500;
        break;
      }
    }
  }
  const pauseNotice = document.getElementById('trueboss-special-pause-notice');
  if(pauseNotice) pauseNotice.style.display = trueBossSpecialPauseT>0 ? 'block' : 'none';

  getTrueBossTargets().forEach(e=>{
    if(e.trueBossAttackDownT>0){
      e.trueBossAttackDownT -= dt*1000;
      if(e.trueBossAttackDownT<=0){ e.trueBossAttackDownT=0; e.trueBossAttackMul=1; e.trueBossTeddyActive=false; if(!e.trueBossGachaActive) e.artState=0; }
    }
    if(e.trueBossDefenseDownT>0){
      e.trueBossDefenseDownT -= dt*1000;
      if(e.trueBossDefenseDownT<=0){ e.trueBossDefenseDownT=0; e.trueBossDefenseMul=1; e.trueBossGachaActive=false; if(!e.trueBossTeddyActive) e.artState=0; }
    }
  });
  updateTrueBossSpecialHud();
}
function updateTrueBossSpecialHud(){
  const hud=document.getElementById('trueboss-special-hud');
  if(!hud || !player) return;
  const show=!!(player.trueBossSpecialActive && state==='PLAYING' && getTrueBossTargets().length);
  hud.classList.toggle('show',show);
  Object.keys(TRUE_BOSS_SPECIAL_WEAPONS).forEach(id=>{
    const fill=document.getElementById('tb-fill-'+id);
    const btn=document.getElementById('tb-btn-'+id);
    const value=clamp(player.trueBossSpecials?.[id]||0,0,100);
    if(fill) fill.style.width=value+'%';
    if(btn){
      btn.disabled=!show || value<100;
      btn.classList.toggle('ready',show && value>=100);
      btn.textContent=value>=100?'起動！':Math.floor(value)+'%';
    }
  });
}

function triggerTrueBossSpawn(){
  superBossSpawned = true;
  showBossCutIn('trueking', spawnTrueBossActual);
}

function triggerSuperBossSpawn(){
  superBossSpawned = true; // guard against re-trigger while cut-in plays
  showBossCutIn('demonking', spawnSuperBossActual);
}

// ---------- Input: joystick + keyboard ----------
const joyZone = document.getElementById('joystick-zone');
const joyBase = document.getElementById('joy-base');
const joyThumb = document.getElementById('joy-thumb');
let joyActive=false, joyId=null, joyOrigin={x:0,y:0};

function setJoyVisible(v,x,y){
  joyBase.style.display = v?'block':'none';
  joyThumb.style.display = v?'block':'none';
  if(v){
    joyBase.style.left=(x-50)+'px'; joyBase.style.top=(y-50)+'px';
    joyThumb.style.left=(x-23)+'px'; joyThumb.style.top=(y-23)+'px';
  }
}
function updateThumb(x,y){
  joyThumb.style.left=(x-23)+'px'; joyThumb.style.top=(y-23)+'px';
}
joyZone.addEventListener('touchstart', e=>{
  if(joyActive) return;
  const t = e.changedTouches[0];
  joyActive=true; joyId=t.identifier; joyOrigin={x:t.clientX,y:t.clientY};
  setJoyVisible(true,t.clientX,t.clientY);
}, {passive:true});
joyZone.addEventListener('touchmove', e=>{
  for(const t of e.changedTouches){
    if(t.identifier!==joyId) continue;
    let dx=t.clientX-joyOrigin.x, dy=t.clientY-joyOrigin.y;
    const d=Math.hypot(dx,dy), max=50;
    if(d>max){ dx=dx/d*max; dy=dy/d*max; }
    updateThumb(joyOrigin.x+dx, joyOrigin.y+dy);
    moveDir.x = dx/max; moveDir.y = dy/max;
  }
}, {passive:true});
function joyEnd(e){
  for(const t of e.changedTouches){
    if(t.identifier!==joyId) continue;
    joyActive=false; joyId=null; moveDir.x=0; moveDir.y=0;
    setJoyVisible(false,0,0);
  }
}
joyZone.addEventListener('touchend', joyEnd, {passive:true});
joyZone.addEventListener('touchcancel', joyEnd, {passive:true});

// keyboard fallback (desktop testing)
const keys = {};
window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()]=true; });
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });
function keyboardVec(){
  let x=0,y=0;
  if(keys['w']||keys['arrowup']) y-=1;
  if(keys['s']||keys['arrowdown']) y+=1;
  if(keys['a']||keys['arrowleft']) x-=1;
  if(keys['d']||keys['arrowright']) x+=1;
  return {x,y};
}

// ---------- HUD ----------
const hpFill = document.getElementById('hp-fill');
const xpFill = document.getElementById('xp-fill');
const lvText = document.getElementById('lv-text');
const stageText = document.getElementById('stage-text');
const diffText = document.getElementById('diff-text');
const timeText = document.getElementById('time-text');
const killText = document.getElementById('kill-text');
const weaponRow = document.getElementById('weapon-row');
const hud = document.getElementById('hud');
const bossHud = document.getElementById('boss-hud');
const bossNameEl = document.getElementById('boss-name');
const bossHpFill = document.getElementById('boss-hp-fill');
const ultimateHud = document.getElementById('ultimate-hud');
const ultimateFill = document.getElementById('ultimate-fill');
const trueBossSpecialHud = document.getElementById('trueboss-special-hud');
const trueBossSpecialButtons = {};
Object.keys(TRUE_BOSS_SPECIAL_WEAPONS).forEach(id=>{
  trueBossSpecialButtons[id]=document.getElementById('tb-btn-'+id);
  if(trueBossSpecialButtons[id]) trueBossSpecialButtons[id].onclick=()=>activateTrueBossSpecial(id);
});

const reviveHud = document.getElementById('revive-hud');
const reviveCountEl = document.getElementById('revive-count');
const bossAnnounce = document.getElementById('boss-announce');
const bossAnnounceBox = document.getElementById('boss-announce-box');
let bossAnnounceTimer1=null, bossAnnounceTimer2=null;
const bossBindHud=document.getElementById('boss-bind-hud');
const bossBindCountEl=document.getElementById('boss-bind-count');
function showBossBind(){ bossBindHud.classList.remove('hidden'); updateBossBindHud(); }
function updateBossBindHud(){
  if(!player || !player.bossBind){ bossBindHud.classList.add('hidden'); return; }
  bossBindCountEl.textContent=(player.bossBindCount||0)+' / '+(player.bossBindRequired||15);
}
function bossBindPress(){
  if(state!=='PLAYING' || !player || !player.bossBind) return;
  player.bossBindCount=(player.bossBindCount||0)+1;
  spawnText(player.x,player.y-40,'1!','#ff69b4',18);
  spawnSpark(player.x,player.y,'#ff69b4',5);
  updateBossBindHud();
  if(player.bossBindCount >= (player.bossBindRequired||15)){
    player.bossBind=false;
    bossBindHud.classList.add('hidden');
    if(bossActive && bossActive.bindState==='active'){ bossActive.bindState='idle'; bossActive.timers.bind=BOSS_ABILITY_CONFIG.bind.interval; bossActive.frozen=false; }
    spawnText(player.x,player.y-55,'拘束解除！','#ffd700',24);
    spawnRing(player.x,player.y,'rgba(255,215,0,.9)',120,450);
    spawnSpark(player.x,player.y,'#ffd700',18);
  }
}
window.addEventListener('keydown', e=>{
  bulletHellKeys[e.key]=true;
  if(bulletHell.active && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','A','d','D','w','W','s','S',' '].includes(e.key)) e.preventDefault();
  if(e.key==='1' && !e.repeat) bossBindPress();
});
window.addEventListener('keyup', e=>{ bulletHellKeys[e.key]=false; });
window.addEventListener('blur', ()=>{ bulletHellKeys=Object.create(null); });
canvas.addEventListener('pointerdown', e=>{
  if(!bulletHell.active) return;
  bulletHell.pointerActive=true;
  const r=canvas.getBoundingClientRect();
  bulletHell.pointerX=(e.clientX-r.left)*(canvas.width/r.width);
  bulletHell.pointerY=(e.clientY-r.top)*(canvas.height/r.height);
  try{canvas.setPointerCapture(e.pointerId);}catch(_){ }
});
canvas.addEventListener('pointermove', e=>{
  if(!bulletHell.active || !bulletHell.pointerActive) return;
  const r=canvas.getBoundingClientRect();
  bulletHell.pointerX=(e.clientX-r.left)*(canvas.width/r.width);
  bulletHell.pointerY=(e.clientY-r.top)*(canvas.height/r.height);
});
canvas.addEventListener('pointerup', e=>{ bulletHell.pointerActive=false; try{canvas.releasePointerCapture(e.pointerId);}catch(_){ } });
canvas.addEventListener('pointercancel', ()=>{ bulletHell.pointerActive=false; });

function showBossAnnounce(name, isSuper){
  if(isSuper){
    bossAnnounceBox.textContent = '☠️☠️ 災厄降臨：'+name+' ☠️☠️\n❤️ 回復アイテム獲得数：'+finalBossHeartCount+'個\nHP倍率：×'+finalBossHeartMultiplier.toFixed(3)+'　攻撃×'+finalBossHeartAttackMultiplier.toFixed(3);
  } else {
    bossAnnounceBox.textContent = '⚠ ボス出現：'+name+' ⚠';
  }
  bossAnnounceBox.style.color = isSuper ? '#ff4d6a' : '#ffd700';
  bossAnnounceBox.style.borderColor = isSuper ? '#ff4d6a' : '#ffd700';
  bossAnnounce.classList.remove('hidden');
  bossAnnounce.style.opacity = '1';
  if(bossAnnounceTimer1) clearTimeout(bossAnnounceTimer1);
  if(bossAnnounceTimer2) clearTimeout(bossAnnounceTimer2);
  const dur = isSuper ? 3600 : 2200;
  bossAnnounceTimer1 = setTimeout(()=>{ bossAnnounce.style.opacity='0'; }, dur);
  bossAnnounceTimer2 = setTimeout(()=>{ bossAnnounce.classList.add('hidden'); }, dur+400);
}

// キャラクター進化専用テロップ。ボス登場テロップとは別処理にして、
// キャラクター進化時に誤って「ボス出現」が表示されないようにする。
function showCharacterEvolutionAnnounce(){
 const ch=CHARACTERS[selectedCharacter]||CHARACTERS.girl;
 const tier=Math.floor((player.level-1)/10);
 if(tier<1||tier>=ch.defs.length)return;
 titleQueue.push({notice:true,color:'#ffd98b',heading:'✨ キャラクター進化！',name:ch.label+' 第'+(tier+1)+'形態 / Lv.'+player.level,detail:'HP +10 / 攻撃 +5% / 移動速度 +5 / 防御・攻撃速度強化',images:[ch.defs[tier-1].b64,ch.defs[tier].b64]});showTitleNotice();
}

// 見た目のキャラクター進化と同時に、能力値も少しだけ強化する。
// Lv11 / Lv21 / Lv31 / Lv41 の各ティア切り替え時に1回だけ適用する。
function applyCharacterEvolutionBonus(){
  player.maxHp += 10;
  player.hp = Math.min(player.maxHp, player.hp + 10);
  player.speed += 5;
  player.atkMul = Math.min(4, (player.atkMul||1) * 1.05);
  player.defMul = Math.max(0.3, (player.defMul||1) * 0.97);
  player.cdMul = Math.max(0.45, (player.cdMul||1) * 0.97);
  spawnText(player.x, player.y - 46, '進化ボーナス！ HP+10 / 攻撃+5% / 移動速度+5', '#ff9ee6', 13);
}

function showRecordsSummary(isResult){
  const screen = document.getElementById(isResult ? 'gameover-screen' : 'difficulty-screen');
  const panel = document.getElementById('records-summary');
  const button = document.getElementById(isResult ? 'retry-btn' : 'evo-tree-link-diff');
  screen.insertBefore(panel, button);
  document.getElementById('score-label').textContent = isResult ? 'SCORE:' : '前回 SCORE:';
  scoreVal.textContent = Math.floor(Number(isResult ? runScore : saveData.lastRunScore)||0).toLocaleString('ja-JP');
  statTime.textContent = Math.floor((Number(saveData.totalPlayTime)||0)/60);
  statDamage.textContent = Math.floor(Number(saveData.totalDamage)||0).toLocaleString('ja-JP');
  achKatachan.textContent = Math.floor(Number(saveData.achievements.katachan)||0).toLocaleString('ja-JP');
  if(achMinions) achMinions.textContent = Math.floor(Number(saveData.totalMinionKills)||0).toLocaleString('ja-JP');
  achKing.textContent = Math.floor(Number(saveData.achievements.kingKatachan)||0).toLocaleString('ja-JP');
}

function updateHud(){
  hpFill.style.width = clamp(player.hp/player.maxHp*100,0,100)+'%';
  xpFill.style.width = clamp(player.xp/player.xpNext*100,0,100)+'%';
  lvText.textContent = 'Lv.'+player.level;
  stageText.textContent = 'Stage '+currentStage() + (bossKillMultiplier>1.001 ? ' (x'+bossKillMultiplier.toFixed(2)+')' : '');
  diffText.textContent = DIFFICULTIES[difficulty].label;
  const m = Math.floor(elapsed/60), s = Math.floor(elapsed%60);
  timeText.textContent = String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  killText.textContent = '討伐: '+killCount;
  weaponRow.innerHTML = '';
  player.weapons.forEach(w=>{
    const def = WEAPONS[w.id] || {icon:EVO_ICONS[w.id]};
    const div = document.createElement('div');
    div.className='w-icon';
    div.innerHTML = (def.icon||'❓') + (w.level?`<span>${w.level}</span>`:'');
    weaponRow.appendChild(div);
  });
  if(bossActive && bossActive.hp>0){
    bossHud.classList.remove('hidden');
    if(bossActive.isTrueBoss){
      const alive = trueBossPair.filter(b=>b && !b.dead && b.hp>0);
      const avg = alive.length ? alive.reduce((sum,b)=>sum + clamp(b.hp/b.maxHp,0,1),0)/alive.length : 0;
      bossHpFill.style.width = (avg*100)+'%';
      bossNameEl.textContent = 'かたちゃん＆すいちゃん　'+alive.map(b=>b.name+' '+Math.max(0,Math.ceil(b.hp))+'/'+Math.ceil(b.maxHp)).join('　｜　')+'　❤️'+finalBossHeartCount+'　HP×'+finalBossHeartMultiplier.toFixed(3)+'　攻撃×'+finalBossHeartAttackMultiplier.toFixed(3);
    } else if(bossActive.isSuperBoss){
      bossHpFill.style.width = clamp(bossActive.hp/bossActive.maxHp*100,0,100)+'%';
      bossNameEl.textContent = bossActive.name+'  '+Math.max(0,Math.ceil(bossActive.hp))+'/'+Math.ceil(bossActive.maxHp)+'　❤️'+finalBossHeartCount+'　HP×'+finalBossHeartMultiplier.toFixed(3)+'　攻撃×'+finalBossHeartAttackMultiplier.toFixed(3);
    } else {
      bossHpFill.style.width = clamp(bossActive.hp/bossActive.maxHp*100,0,100)+'%';
      bossNameEl.textContent = bossActive.name+'  '+Math.max(0,Math.ceil(bossActive.hp))+'/'+Math.ceil(bossActive.maxHp);
    }
  } else {
    bossHud.classList.add('hidden');
  }
  if(bossActive && bossActive.isSuperBoss && !player.trueBossSpecialActive){
    ultimateHud.classList.remove('hidden');
    ultimateFill.style.width = clamp(player.ultimateGauge||0,0,100)+'%';
  } else {
    ultimateHud.classList.add('hidden');
  }
  updateTrueBossSpecialHud();
  if(player.reviveCharges>0){
    reviveHud.classList.remove('hidden');
    reviveCountEl.textContent = player.reviveCharges;
  } else {
    reviveHud.classList.add('hidden');
  }
}

// ---------- Level up card logic ----------
function weaponMaxed(w, id){
  if(WEAPONS[id]) return w.level >= WEAPONS[id].maxLevel;
  return true; // evolved (tier1) weapons are always considered "ready" for tier2 fusion
}

const EVOLUTION_ONLY_IDS = new Set(['gravitybomb']);

function buildLevelUpOptions(){
  const options = [];
  const evolveOptions = [];
  // upgrade existing
  player.weapons.forEach(w=>{
    const def = WEAPONS[w.id];
    // グラビティボムは進化でのみ獲得する武器。レベルアップ候補には出さない。
    if(EVOLUTION_ONLY_IDS.has(w.id)) return;
    if(def && w.level < def.maxLevel){
      options.push({type:'upgrade', id:w.id, name:def.name, icon:def.icon, desc:'Lv.'+w.level+' → '+(w.level+1)+' ｜ '+rankOf(w)[0]+' ×'+rankOf(w)[2]});
    }
  });
  // acquire new (bonus last-boss weapon can still push beyond this cap directly)
  if(player.weapons.length < weaponSlotLimit()){
    Object.keys(WEAPONS).forEach(id=>{
      if(!EVOLUTION_ONLY_IDS.has(id) && !findWeapon(id) && !player.retiredWeaponIds?.has(id)) options.push({type:'new', id, name:WEAPONS[id].name, icon:WEAPONS[id].icon, desc:WEAPONS[id].desc+' ｜取得時レアリティ抽選'});
    });
  }
  // evolutions (tier1: base+base, tier2: evolved+evolved)
  EVOLUTIONS.forEach(evo=>{
    const w1 = findWeapon(evo.mats[0]), w2 = findWeapon(evo.mats[1]);
    if(w1 && w2 && weaponMaxed(w1, evo.mats[0]) && weaponMaxed(w2, evo.mats[1]) && !findWeapon(evo.result)){
      const entry = {type:'evolve', id:evo.result, mats:evo.mats, name:evo.name, icon:evo.icon, desc:(evo.tier2?'覚醒進化: ':'進化: ')+evo.desc, evo:true};
      options.push(entry);
      evolveOptions.push(entry);
    }
  });
  // fallback generic (base stats)
  // 各ステータスアップは1項目につき最大5回まで取得可能
  const genericOptions = [];
  const statDefs = [
    {type:'hp', name:'最大HP+20', icon:'❤️', desc:'最大HPと現在HPが増える'},
    {type:'speed', name:'速度アップ', icon:'👟', desc:'移動速度が上がる'},
    {type:'atk', name:'攻撃力アップ', icon:'💪', desc:'与えるダメージが増加する'},
    {type:'def', name:'防御力アップ', icon:'🛡️', desc:'受けるダメージが減少する'},
    {type:'atkspeed', name:'攻撃速度アップ', icon:'⏱️', desc:'武器のクールダウンが短縮される'},
    {type:'pickup', name:'回収範囲アップ', icon:'🧲', desc:'アイテムを引き寄せる範囲が広がる'},
    {type:'luck', name:'幸運アップ', icon:'🍀', desc:'レアアイテムのドロップ率が上がる'}
  ];
  statDefs.forEach(def=>{
    const count = player.statUpgradeCounts?.[def.type] || 0;
    if(count < 5){
      genericOptions.push({...def, desc:def.desc+' ('+(count+1)+'/5)'});
    }
  });
  options.push(...genericOptions);

  // evolutions take priority: fill as many of the 3 slots as possible with eligible evolutions
  const shuffledEvolves = evolveOptions.slice();
  for(let i=shuffledEvolves.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shuffledEvolves[i],shuffledEvolves[j]]=[shuffledEvolves[j],shuffledEvolves[i]]; }
  let result = shuffledEvolves.slice(0,3);
  if(result.length<3){
    const others = options.filter(o=>o.type!=='evolve');
    for(let i=others.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [others[i],others[j]]=[others[j],others[i]]; }
    result = result.concat(others.slice(0, 3-result.length));
  }
  return result;
}

function applyOption(opt){
  if(opt.type==='upgrade'){
    // 念のためUI側で除外されても、グラビティボムはレベルアップさせない。
    if(EVOLUTION_ONLY_IDS.has(opt.id)) return;
    const w = findWeapon(opt.id);
    if(w) w.level++;
  }
  else if(opt.type==='new'){ acquireWeapon(opt.id,400); }
  else if(opt.type==='evolve'){
    // 進化で消費したMAX武器は、このプレイ中は新規武器候補へ戻さない。
    if(!player.retiredWeaponIds) player.retiredWeaponIds = new Set();
    opt.mats.forEach(id=>player.retiredWeaponIds.add(id));
    const rarity=Math.max(0,...player.weapons.filter(w=>opt.mats.includes(w.id)).map(w=>w.rarity||0));
    player.weapons = player.weapons.filter(w=>!opt.mats.includes(w.id));
    player.weapons.push({id:opt.id, level:0, timer:300,rarity});
  }
  else if(['hp','speed','atk','def','atkspeed','pickup','luck'].includes(opt.type)){
    const counts = player.statUpgradeCounts || (player.statUpgradeCounts={hp:0,speed:0,atk:0,def:0,atkspeed:0,pickup:0,luck:0});
    if((counts[opt.type]||0) >= 5) return;
    if(opt.type==='hp') player.maxHp+=20, player.hp+=20;
    else if(opt.type==='speed') player.speed+=18;
    else if(opt.type==='atk') player.atkMul = Math.min(4, player.atkMul*1.12);
    else if(opt.type==='def') player.defMul = Math.max(0.3, player.defMul*0.88);
    else if(opt.type==='atkspeed') player.cdMul = Math.max(0.45, player.cdMul*0.9);
    else if(opt.type==='pickup') player.pickupRadius += 18;
    else if(opt.type==='luck') player.luck += 1;
    counts[opt.type] = (counts[opt.type]||0) + 1;
  }
}

function showLevelUp(){
  // 直接呼ばれた場合（デバッグ等）でも1回分の選択を保証。
  if(pendingLevelUps <= 0) pendingLevelUps = 1;
  pendingLevelUps--;

  const options = buildLevelUpOptions();
  const screen = document.getElementById('levelup-screen');
  const owned=document.getElementById('owned-weapons');owned.replaceChildren();for(const w of player.weapons){const d=weaponDisplay(w.id);const el=document.createElement('span');el.textContent=d.icon+' '+d.name+' '+(w.level===0?'進化済': 'Lv.'+w.level);const r=rankOf(w);el.textContent+=' ｜'+r[0]+' ×'+r[2];el.style.color=r[1];el.style.borderColor=r[1];owned.append(el);} 
  const row = document.getElementById('levelup-cards');
  row.innerHTML='';

  // 候補が完全になくなった場合は「スコアアップ」を必ず出す。
  const finalOptions = options.length ? options : [{
    type:'score',
    name:'スコアアップ',
    icon:'🏆',
    amount:1000,
    desc:'+1,000 SCORE'
  }];

  const title = screen.querySelector('h1');
  const sub = screen.querySelector('.sub');
  if(title) title.textContent = 'レベルアップ！';
  if(sub){
    const currentLevel = player.level;
    const remaining = pendingLevelUps;
    sub.textContent = remaining > 0
      ? `Lv.${currentLevel}のボーナスを選択（残り${remaining}回）`
      : `Lv.${currentLevel}のボーナスを選択`;
  }

  finalOptions.forEach(opt=>{
    const c = document.createElement('div');
    c.className='card'+(opt.evo?' evo':'');
    c.innerHTML = `<div class="icon">${opt.icon}</div><div class="name">${opt.name}</div><div class="desc">${opt.desc}</div>`;
    c.onclick = ()=>{
      if(opt.type==='score'){
        addScore(opt.amount || 1000);
      } else {
        applyOption(opt);checkTitles();
      }
      screen.classList.add('hidden');
      if(pendingLevelUps > 0){
        state='LEVELUP';
        showLevelUp();
      } else {
        state='PLAYING';
        lastFrame=performance.now();
        requestAnimationFrame(loop);
      }
    };
    row.appendChild(c);
  });
  state='LEVELUP';
  screen.classList.remove('hidden');
}

// ---------- Start screen ----------
function showStart(){
  resetGame();
  state='START';
  hud.classList.add('hidden');
  document.getElementById('evo-tree-btn').classList.add('hidden');
  document.getElementById('title-btn').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('ending-screen').classList.add('hidden');
  document.getElementById('cutscene-screen').classList.add('hidden');
  document.getElementById('opening-screen')?.classList.add('hidden');
  document.getElementById('bosscutin-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.add('hidden');
  // プレイ中・選択途中のどこから戻っても画面が重ならないようにする。
  ['difficulty-screen','character-screen','weapon-screen','levelup-screen','pause-screen'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.classList.add('hidden');
  });
  stopTrack();
  difficulty = 'normal';
  showDifficultyScreen();
}

function showDifficultyScreen(){
  const screen = document.getElementById('difficulty-screen');
  const row = document.getElementById('difficulty-cards');
  if(!screen || !row){ showCharacterSelect(); return; }
  document.getElementById('opening-screen')?.classList.add('hidden');
  document.getElementById('character-screen').classList.add('hidden');
  row.innerHTML='';
  Object.keys(DIFFICULTIES).forEach(key=>{
    const d=DIFFICULTIES[key];
    const locked = key==='trueboss' && !refreshTrueBossUnlock();
    const c=document.createElement('div');
    c.className='card'+(key===difficulty?' evo':'')+(locked?' locked':'');
    const icon = key==='listener' ? '👾' : (key==='trueboss' ? '👑' : '⚔️');
    const unlockInfo = locked
      ? `🔒 解放条件：雑魚 ${Number(saveData.totalMinionKills||0).toLocaleString('ja-JP')} / 100,000　かたちゃん ${Number(saveData.achievements.katachan||0)} / 100　ラスボス ${Number(saveData.achievements.kingKatachan||0)} / 10`
      : '';
    c.innerHTML=`<div class="icon">${icon}</div><div class="name">${d.label}${locked?' 🔒':''}</div>${locked?`<div class="desc">${unlockInfo}</div>`:''}`;
    if(!locked){
      c.onclick=()=>{ difficulty=key; screen.classList.add('hidden'); showCharacterSelect(); };
    } else {
      c.onclick=()=>{};
      c.style.opacity='0.55'; c.style.cursor='not-allowed';
    }
    row.appendChild(c);
  });
  showRecordsSummary(false);
  screen.classList.remove('hidden');
}

function showCharacterSelect(){
  const screen = document.getElementById('character-screen');
  const row = document.getElementById('character-cards');
  const title = screen.querySelector('h1');
  if(title) title.textContent = DIFFICULTIES[difficulty].label;
  row.innerHTML='';
  Object.keys(CHARACTERS).forEach(key=>{
    const ch = CHARACTERS[key];
    const c = document.createElement('div');
    c.className='card'+(key===selectedCharacter?' evo':'');
    c.innerHTML = `<div class="icon">${ch.icon}</div><div class="name">${ch.label}</div>`;
    c.onclick = ()=>{
      selectedCharacter = key;
      // オープニング中はゲームBGMを開始しない。武器選択時に開始する。
      stopTrack();
      screen.classList.add('hidden');
      if(key==='girl' && !window.__girlOpeningPlayed){
        window.__girlOpeningPlayed=true;
        openStoryScene('story/girl-opening.html', ()=>{ showWeaponSelect(); });
      } else if(key==='boy' && !window.__boyOpeningPlayed){
        window.__boyOpeningPlayed=true;
        openStoryScene('story/boy-opening.html', ()=>{ showWeaponSelect(); });
      } else {
        showWeaponSelect();
      }
    };
    row.appendChild(c);
  });
  screen.classList.remove('hidden');
}

function showWeaponSelect(){
  const row = document.getElementById('start-cards');
  row.innerHTML='';
  // purely passive/support weapons are weak as a lone starting pick; offer them only via level-up
  const STARTER_EXCLUDE = ['spikearmor','totem','gravitybomb'];
  const ids = Object.keys(WEAPONS).filter(id=>!STARTER_EXCLUDE.includes(id));
  const shuffled = ids.sort(()=>Math.random()-0.5).slice(0,3);
  shuffled.forEach(id=>{
    const def = WEAPONS[id];
    const c = document.createElement('div');
    c.className='card';
    c.innerHTML = `<div class="icon">${def.icon}</div><div class="name">${def.name}</div><div class="desc">${def.desc}</div>`;
    c.onclick = ()=>{
      // 念のため武器選択でもBGM再生を確実に開始
      startTrack('main');
      acquireWeapon(id,300);
      saveData.playCount=(Number(saveData.playCount)||0)+1;if(saveData.playCount>=10)unlockTitle('runs');saveGame();
      document.getElementById('start-screen').classList.add('hidden');
      hud.classList.remove('hidden');
      document.getElementById('evo-tree-btn').classList.remove('hidden');
      document.getElementById('title-btn').classList.remove('hidden');
      state='PLAYING';
      checkTitles();
      lastFrame=performance.now();
      requestAnimationFrame(loop);
    };
    row.appendChild(c);
  });
  document.getElementById('start-screen').classList.remove('hidden');
}

// ---------- Evolution tree viewer ----------
let stateBeforeEvoTree = null;
function renderEvoTree(){
  const content = document.getElementById('evo-tree-content');
  content.innerHTML = '';
  function buildRow(evo){
    const m1 = weaponDisplay(evo.mats[0]), m2 = weaponDisplay(evo.mats[1]), res = weaponDisplay(evo.result);
    let status = '🔒 未解放', rowClass = '';
    if(findWeapon(evo.result)){ status = '✅ 習得済み'; rowClass = 'evo-owned'; }
    else {
      const w1 = findWeapon(evo.mats[0]), w2 = findWeapon(evo.mats[1]);
      if(w1 && w2 && weaponMaxed(w1, evo.mats[0]) && weaponMaxed(w2, evo.mats[1])){ status = '🔓 今すぐ進化可能！'; rowClass = 'evo-ready'; }
    }
    const div = document.createElement('div');
    div.className = 'evo-row'+(rowClass?' '+rowClass:'');
    div.innerHTML = `<div class="evo-mats">${m1.icon} ${m1.name} ＋ ${m2.icon} ${m2.name}</div>
      <div class="evo-arrow">↓</div>
      <div class="evo-result">${res.icon} ${res.name}</div>
      <div class="evo-desc">${evo.desc}</div>
      <div class="evo-status">${status}</div>`;
    content.appendChild(div);
  }
  const t1 = document.createElement('div');
  t1.className = 'evo-section-title';
  t1.textContent = '◆ 通常進化（武器レベルMAX同士）';
  content.appendChild(t1);
  EVOLUTIONS.filter(e=>!e.tier2).forEach(buildRow);
  const t2 = document.createElement('div');
  t2.className = 'evo-section-title';
  t2.textContent = '◆ 覚醒進化（進化武器同士でさらに融合）';
  content.appendChild(t2);
  EVOLUTIONS.filter(e=>e.tier2).forEach(buildRow);
}
function openEvoTree(){
  stateBeforeEvoTree = state;
  state = 'PAUSED';
  renderEvoTree();
  document.getElementById('evo-tree-screen').classList.remove('hidden');
}
function closeEvoTree(){
  document.getElementById('evo-tree-screen').classList.add('hidden');
  if(stateBeforeEvoTree==='PLAYING'){
    state = 'PLAYING';
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  } else if(stateBeforeEvoTree){
    state = stateBeforeEvoTree;
  }
}
document.getElementById('evo-tree-btn').onclick = openEvoTree;
document.getElementById('evo-tree-close').onclick = closeEvoTree;
document.getElementById('evo-tree-link-diff').onclick = openEvoTree;
document.getElementById('collection-open').onclick=showCollection;document.getElementById('collection-close').onclick=()=>document.getElementById('collection-screen').classList.add('hidden');
document.getElementById('evo-tree-link-start').onclick = openEvoTree;
document.getElementById('evo-tree-link-go').onclick = openEvoTree;

document.getElementById('music-toggle-btn').onclick = toggleMusic;
document.getElementById('title-btn').onclick = ()=>{
  // ブラウザの確認ダイアログが抑止されてもホームに戻れるようにする。
  if(openingTimer){ clearTimeout(openingTimer); openingTimer=null; }
  if(typeof bossCutInTimer!=='undefined' && bossCutInTimer){ clearTimeout(bossCutInTimer); bossCutInTimer=null; }
  // ストーリーiframeが残っている場合はコールバックを実行せず閉じる。
  if(typeof window.cancelStoryScene==='function') window.cancelStoryScene();
  stopTrack();
  showStart();
};

// ---------- Ending ----------
function showEnding(){
  saveGame();
  state = 'STORY_SCENE';
  stopTrack();
  const endingFile = selectedCharacter === 'girl' ? 'story/girl-ending.html' : 'story/boy-ending.html';
  openStoryScene(endingFile, ()=>{
    specialClearSequenceActive = false;
    spawnTimer = 0;
    restoreNormalMinionSprites();
    state='PLAYING';
    lastFrame=performance.now();
    requestAnimationFrame(loop);
    startTrack('main');
  });
}

document.getElementById('ending-continue-btn').onclick = ()=>{
  document.getElementById('ending-screen').classList.add('hidden');
  specialClearSequenceActive = false;
  spawnTimer = 0;
  restoreNormalMinionSprites();
  state='PLAYING';
  lastFrame=performance.now();
  requestAnimationFrame(loop);
  startTrack('main');
};
document.getElementById('ending-title-btn').onclick = ()=>{
  document.getElementById('ending-screen').classList.add('hidden');
  showStart();
};

// ---------- Boss appearance cut-in (unified for regular bosses & final boss) ----------
let bossCutInTimer = null;
function showBossCutIn(key, onDone){
  state = 'CUTIN';
  const screen = document.getElementById('bosscutin-screen');
  const art = document.getElementById('bosscutin-art');
  art.innerHTML = '';
  const img = document.createElement('img');
  img.src = BOSS_CUTIN_DEFS[key];
  art.appendChild(img);
  screen.classList.remove('hidden');
  setTimeout(()=>{ img.classList.add('show'); }, 30);
  function finish(){
    if(bossCutInTimer){ clearTimeout(bossCutInTimer); bossCutInTimer = null; }
    screen.classList.add('hidden');
    state = 'PLAYING';
    lastFrame = performance.now();
    requestAnimationFrame(loop);
    onDone();
  }
  document.getElementById('bosscutin-skip').onclick = finish;
  bossCutInTimer = setTimeout(finish, BOSS_CUTIN_DURATION);
}

// ---------- Game over ----------
function gameOver(){
  // 拘束中にHPが0になった場合、拘束HUDや拘束状態がゲームオーバー画面の上に残らないよう完全解除。
  if(typeof player!=='undefined' && player){
    player.bossBind=false;
    player.bossBindCount=0;
  }
  if(typeof bossBindHud!=='undefined' && bossBindHud) bossBindHud.classList.add('hidden');
  if(typeof bossActive!=='undefined' && bossActive){
    bossActive.bindState='idle';
    bossActive.frozen=false;
  }
  saveData.lastRunScore = Math.floor(Number(runScore)||0);
  saveGame();
  state='GAMEOVER';
  const bossMulText = bossKillMultiplier>1.001 ? `　強化倍率 x${bossKillMultiplier.toFixed(2)}` : '';
  document.getElementById('go-stats').textContent =
    `難易度 ${DIFFICULTIES[difficulty].label}　Stage ${currentStage()}　レベル ${player.level}　討伐数 ${killCount}　生存時間 ${Math.floor(elapsed)}秒${bossMulText}`;
  showRecordsSummary(true);
  document.getElementById('gameover-screen').classList.remove('hidden');
}
document.getElementById('retry-btn').onclick = showStart;

// ---------- Main update ----------
function updatePlayer(dt){
  if(player.bossBind){
    if(player.invTimer>0) player.invTimer -= dt*1000;
    if(player.hitFlash>0) player.hitFlash -= dt*1000;
    updateBossBindHud();
    return;
  }
  let vx=moveDir.x, vy=moveDir.y;
  const kb = keyboardVec();
  if(kb.x||kb.y){ vx=kb.x; vy=kb.y; }
  const len = Math.hypot(vx,vy);
  if(len>0.05){
    vx/=Math.max(len,1); vy/=Math.max(len,1);
    player.x += vx*player.speed*dt*(player.chestSpeed>0?1.2:1);
    player.y += vy*player.speed*dt*(player.chestSpeed>0?1.2:1);
    facing.x = vx; facing.y = vy;
  }
  if(bossArenaCenter){
    const adx = player.x-bossArenaCenter.x, ady = player.y-bossArenaCenter.y;
    const ad = Math.hypot(adx,ady);
    const maxD = BOSS_ARENA_RADIUS - player.radius;
    if(ad > maxD){
      const aang = Math.atan2(ady,adx);
      player.x = bossArenaCenter.x + Math.cos(aang)*maxD;
      player.y = bossArenaCenter.y + Math.sin(aang)*maxD;
    }
  }
  if(player.invTimer>0) player.invTimer -= dt*1000;
  if(player.hitFlash>0) player.hitFlash -= dt*1000;
  player.regenTimer = (player.regenTimer||0) + dt;
  if(player.regenTimer>=1){
    player.regenTimer -= 1;
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp*0.006);
  }

  updateTrueBossSpecials(dt);

  // weapons firing
  player.weapons.forEach(w=>{
    w.timer = (w.timer||0) - dt*1000;
    if(w.timer<=0){
      fireWeapon(w);
      let cd;
      if(EVO_STATS[w.id]) cd = EVO_STATS[w.id].cd;
      else cd = weaponStats(w.id, w.level).cd;
      w.timer = Math.max(80, cd*player.cdMul);
    }
  });
  if(player.trueBossSpecialActive){
    player.daisukiCharging = false;
    player.ultimateGauge = 0;
  } else if(bossActive && bossActive.isSuperBoss){
    if(!player.daisukiCharging){
      player.ultimateGauge = Math.min(100, (player.ultimateGauge||0) + dt*(100/14));
      if(player.ultimateGauge>=100){
        player.daisukiCharging = true;
        player.daisukiChargeT = 900;
        player.ultimateGauge = 100;
        particles.push({type:'daisukiCharge', life:900, maxLife:900});
      }
    } else {
      player.daisukiChargeT -= dt*1000;
      if(player.daisukiChargeT<=0){
        fireDaisukiBeam();
        player.daisukiCharging = false;
        player.ultimateGauge = 0;
      }
    }
  } else {
    player.daisukiCharging = false;
  }

  // garlic-type auras need continuous tick even without explicit "cd" reset issue - handled above via weaponStats cd fallback (garlic has no cd field -> tick used)
}

function fireDaisukiBeam(){
  if(!bossActive) return;
  const dmg = (500 + elapsed*1.2) * (player.atkMul||1);
  damageEnemy(bossActive, dmg, null, false, null, true);
  enemies.forEach(e=>{ if(e!==bossActive && dist(e.x,e.y,player.x,player.y)<240) damageEnemy(e, dmg*0.3, null, false, null, true); });
  particles.push({type:'beam', x1:player.x, y1:player.y, x2:bossActive.x, y2:bossActive.y, life:650, maxLife:650, color:'#ff69b4'});
  addDaisukiBeamCelebration(player,bossActive);
  spawnRing(player.x,player.y,'rgba(255,105,180,0.9)', 90, 500);
  spawnRing(bossActive.x,bossActive.y,'rgba(255,105,180,0.95)', 170, 650);
  spawnSpark(bossActive.x,bossActive.y,'#ff69b4',12);
  spawnText(player.x,player.y-50,'だいすきビーム！','#ff69b4',20);
  triggerScreenFlash(650);
  addShake(18);
}

function updateBossCharge(e, dt){
  const cfg = BOSS_ABILITY_CONFIG.charge;
  if(e.chargeState==='idle'){
    e.timers.charge -= dt*1000;
    if(e.timers.charge<=0){
      e.chargeState='telegraph'; e.chargeT=cfg.telegraph;
      e.chargeDir = Math.atan2(player.y-e.y, player.x-e.x);
      e.frozen = true;
    }
  } else if(e.chargeState==='telegraph'){
    e.chargeT -= dt*1000;
    e.frozen = true;
    if(e.chargeT<=0){ e.chargeState='dashing'; e.chargeT=cfg.dashDur; e.chargeHit=false; e.frozen=false; }
  } else if(e.chargeState==='dashing'){
    e.chargeT -= dt*1000;
    e.dashing = true;
    e.x += Math.cos(e.chargeDir)*e.speed*cfg.dashSpeedMul*dt;
    e.y += Math.sin(e.chargeDir)*e.speed*cfg.dashSpeedMul*dt;
    if(!e.chargeHit && dist(e.x,e.y,player.x,player.y) < e.r+player.radius+10 && player.invTimer<=0){
      applyBossDamageToPlayer(e,trueBossAttackDamage(e,e.dmg),cfg.dmgMul,600,260);
      player.invTimer = 600; player.hitFlash = 260;
      spawnSpark(player.x,player.y,'#ff8a3c',8); addShake(9);
      e.chargeHit = true;
    }
    if(e.chargeT<=0){ e.chargeState='idle'; e.timers.charge=cfg.interval; e.dashing=false; }
  }
}

function updateBossMagic(e, dt){
  const cfg = BOSS_ABILITY_CONFIG.magic;
  e.timers.magic -= dt*1000;
  if(e.timers.magic<=0){
    e.timers.magic = cfg.interval;
    const a = Math.atan2(player.y-e.y, player.x-e.x);
    enemyBolts.push({x:e.x,y:e.y,vx:Math.cos(a)*cfg.speed,vy:Math.sin(a)*cfg.speed,dmg:trueBossAttackDamage(e,e.dmg)*cfg.dmgMul,r:cfg.r,life:2500,color:'#7fffea'});
    spawnRing(e.x,e.y,'rgba(127,255,234,0.55)',24,220);
    spawnSpark(e.x,e.y,'#7fffea',6);
  }
}

function updateBossBreath(e, dt){
  const cfg = BOSS_ABILITY_CONFIG.breath;
  if(e.breathState==='idle'){
    e.timers.breath -= dt*1000;
    if(e.timers.breath<=0){ e.breathState='telegraph'; e.breathT=cfg.telegraph; e.breathDir=Math.atan2(player.y-e.y, player.x-e.x); e.frozen=true; }
  } else if(e.breathState==='telegraph'){
    e.breathT -= dt*1000; e.frozen=true;
    if(e.breathT<=0){ e.breathState='active'; e.breathT=cfg.activeDur; e.breathTick=0; }
  } else if(e.breathState==='active'){
    e.breathT -= dt*1000; e.frozen=true;
    e.breathTick = (e.breathTick||0) - dt*1000;
    if(e.breathTick<=0){
      e.breathTick = cfg.tickInterval;
      const toP = Math.atan2(player.y-e.y, player.x-e.x);
      const d = dist(e.x,e.y,player.x,player.y);
      if(angleDiff(toP,e.breathDir) < cfg.halfAngle && d < cfg.length && player.invTimer<=0){
        applyBossDamageToPlayer(e,trueBossAttackDamage(e,e.dmg),cfg.dmgMul,600,260);
        player.invTimer = 500; player.hitFlash = 200;
        spawnSpark(player.x,player.y,'#ff9d4d',6);
      }
      spawnRing(e.x+Math.cos(e.breathDir)*cfg.length*0.5, e.y+Math.sin(e.breathDir)*cfg.length*0.5, 'rgba(255,140,60,0.3)', cfg.length*0.4, 180);
    }
    if(e.breathT<=0){ e.breathState='idle'; e.timers.breath=cfg.interval; e.frozen=false; }
  }
}

function updateBossBind(e, dt){
  const cfg = BOSS_ABILITY_CONFIG.bind;
  // v143: player 未初期化時は拘束処理を行わず安全に抜ける
  if(typeof player === 'undefined' || !player) return;
  if(!e.isSuperBoss) return;

  // 拘束技はタイマーで直接拘束しない。
  // ラスボスが鎖を飛ばし、鎖が主人公に接触した場合だけ拘束する。
  if(player.bossBind){
    e.frozen = true;
  } else {
    e.frozen = false;
    e.timers.bind = Math.max(0, (e.timers.bind ?? cfg.interval) - dt*1000);
    if(e.timers.bind <= 0){
      spawnFinalBossChain();
      e.timers.bind = cfg.interval;
    }
  }
  updateFinalBossChains();
}


function updateBossTeleport(e, dt){
  const cfg = BOSS_ABILITY_CONFIG.teleport;

  // 真ボス第1戦は「かたちゃん → すいちゃん → かたちゃん…」の順番で
  // 主人公の近くへ瞬間移動してくる。2体が同時に飛ばないようにする。
  if(e.isTrueBossPair){
    if(e.trueBossRole !== trueBossTeleportTurn) return;
  }

  e.timers.teleport -= dt*1000;
  if(e.timers.teleport<=0){
    e.timers.teleport = cfg.interval;
    spawnRing(e.x,e.y,'rgba(160,60,255,0.6)',70,320);
    spawnSpark(e.x,e.y,'#c78bff',14);

    // 主人公を狙って、そのすぐ近くへ出現する。
    // ランダム方向への通常テレポートではなく、主人公を中心にした近距離へ移動。
    const ang = Math.atan2(player.y-e.y, player.x-e.x) + rand(-0.28,0.28);
    const dd = rand(Math.max(90,cfg.minDist*0.55), Math.max(130,cfg.maxDist*0.72));
    e.x = player.x - Math.cos(ang)*dd;
    e.y = player.y - Math.sin(ang)*dd;
    spawnRing(e.x,e.y,'rgba(160,60,255,0.6)',70,320);
    spawnSpark(e.x,e.y,'#c78bff',14);
    addShake(5);

    // 真ボス第1戦だけ交互に切り替える。
    if(e.isTrueBossPair){
      trueBossTeleportTurn = (e.trueBossRole==='kata') ? 'sui' : 'kata';
      const next = trueBossPair.find(b=>b && !b.dead && b.hp>0 && b.trueBossRole===trueBossTeleportTurn);
      if(next) next.timers.teleport = cfg.interval;
    }
  }
}

function syncBulletHellHpHud(){
  const hud=document.getElementById('bullethell-hp-hud');
  if(!hud) return;
  const visible=state==='PLAYING' && !!(bulletHell && (bulletHell.active || bulletHell.warning));
  hud.style.display=visible?'block':'none';
  if(!visible) return;
  const max=Math.max(1,Number(player.maxHp)||1);
  const hp=Math.max(0,Math.min(max,Number(player.hp)||0));
  document.getElementById('bullethell-hp-text').textContent='HP '+Math.ceil(hp)+' / '+Math.ceil(max);
  const fill=document.getElementById('bullethell-hp-fill');
  fill.style.width=(hp/max*100)+'%';
  fill.style.background=hp/max<=.25?'#ff5252':'#58dc83';
}
function updateBulletHellOverlay(){
  syncBulletHellHpHud();
  // 弾幕ゲームはCanvas描画で表示するため、専用DOMオーバーレイは不要。
  // 旧バージョンから残った呼び出しでもゲームループを止めないため安全な更新処理にする。
  const el = document.getElementById('bullethell-overlay');
  if(el){
    const visible = !!(bulletHell && (bulletHell.active || bulletHell.warning));
    el.style.display = visible ? 'block' : 'none';
  }
}

function startBulletHellAttack(boss){
  if(bulletHell.active||bulletHell.warning||state!=='PLAYING') return;
  bulletHell.warning=true; bulletHell.warningT=BOSS_ABILITY_CONFIG.bullethell.warning; bulletHell.messageT=1000;
  bulletHell.savedX=player.x; bulletHell.savedY=player.y; bulletHell.bullets=[]; bulletHell.item=null; bulletHell.elapsed=0; bulletHell.spawnedItem=false; bulletHell.waveIndex=0; bulletHell.lastWaveT=-9999;
  boss.frozen=true; triggerScreenFlash(450); addShake(10); spawnText(player.x,player.y-70,'特殊攻撃！','#ff4fd8',24);
}
function rollBulletHellLevel(){
  const rare = Math.random() < 0.01;
  bulletHell.rare = rare;
  bulletHell.level = rare ? 11 : (1 + Math.floor(Math.random()*10));
  return bulletHell.level;
}
function bulletHellScale(){
  const lv=Math.max(1,Math.min(11,bulletHell.level||1));
  return {density:1+(lv-1)*0.085,speed:0.92+(lv-1)*0.055,radius:1+Math.max(0,lv-6)*0.025,extraRows:lv>=8?1:0};
}
function startBulletHellAttack(boss){
  if(bulletHell.active||bulletHell.warning||state!=='PLAYING') return;
  bulletHell.warning=true; bulletHell.warningT=BOSS_ABILITY_CONFIG.bullethell.warning;
  bulletHell.savedX=player.x; bulletHell.savedY=player.y; bulletHell.bullets=[]; bulletHell.item=null; bulletHell.elapsed=0; bulletHell.spawnedItem=false; bulletHell.waveIndex=0; bulletHell.lastWaveT=-9999;
  rollBulletHellLevel();
  boss.frozen=true; triggerScreenFlash(450); addShake(10); spawnText(player.x,player.y-70,'特殊攻撃！ Lv.'+bulletHell.level+(bulletHell.rare?' RARE!!':''),'#ff4fd8',24);
}
function enterBulletHell(){
  bulletHell.returnTrack = currentTrack || 'boss-phase3';
  bulletHell.warning=false; bulletHell.active=true; bulletHell.elapsed=0; bulletHell.bullets=[]; bulletHell.item=null; bulletHell.spawnedItem=false; bulletHell.invT=1100; bulletHell.pointerActive=false; bulletHell.waveIndex=0; bulletHell.lastWaveT=-9999;
  if(!bulletHell.level || bulletHell.level<1) rollBulletHellLevel();
  bulletHell.x=canvas.width/2; bulletHell.y=canvas.height*0.72; player.invTimer=Math.max(player.invTimer||0,1200); updateBulletHellOverlay(); startBulletHellTrack(); spawnBulletHellWave();
}
function spawnBulletHellBullet(initial=false,index=0){
  const w=canvas.width, lanes=6, sc=bulletHellScale();
  const gap=((bulletHell.waveIndex+2)%lanes), lane=Math.max(0,Math.min(lanes-1,index)); if(lane===gap) return;
  const x=(lane+0.5)*(w/lanes), sp=(initial?125:145)*sc.speed;
  bulletHell.bullets.push({x,y:-18,vx:0,vy:sp,r:8*sc.radius,life:7000,color:lane%2===0?'#ff8bdc':'#78dfff',kind:'lane'});
}
function addBullet(x,y,vx,vy,opts={}){bulletHell.bullets.push({x,y,vx,vy,r:opts.r||7,life:opts.life||7600,color:opts.color||'#ff8bdc',kind:opts.kind||'normal'});}
function spawnLanePattern(){
  const w=canvas.width,lanes=6,sc=bulletHellScale(),lv=bulletHell.level||1,gap=(bulletHell.waveIndex*2+1)%lanes,sp=150*sc.speed;
  const rows=1+Math.min(3,Math.floor((lv-1)/3))+sc.extraRows;
  for(let row=0;row<rows;row++){const y=-20-row*(92-Math.min(22,lv*1.5));for(let lane=0;lane<lanes;lane++){if(lane===gap)continue;const x=(lane+0.5)*(w/lanes);addBullet(x,y,0,sp,{r:8*sc.radius,life:6200,color:lane%2?'#78dfff':'#ff8bdc',kind:'lane'});}}
}
function spawnSpiralPattern(){
  const cx=canvas.width/2,cy=canvas.height*0.20,sc=bulletHellScale(),lv=bulletHell.level||1,arms=2+(lv>=9?1:0)+(lv===11?1:0),count=8+Math.floor((lv-1)*1.4),speed=108*sc.speed,base=bulletHell.waveIndex*0.34;
  for(let arm=0;arm<arms;arm++)for(let i=0;i<count;i++){const a=base+arm*(Math.PI*2/arms)+i*0.16;addBullet(cx,cy,Math.cos(a)*speed,Math.sin(a)*speed,{r:(7+(lv>=8?0.8:0))*sc.radius,life:7200,color:arm%2?'#78dfff':'#ff8bdc',kind:'spiral'});}
}
function spawnFanPattern(){
  const cx=canvas.width/2,y=-18,sc=bulletHellScale(),lv=bulletHell.level||1,count=6+Math.floor((lv-1)*1.0)+(lv>=7?1:0)+(lv===11?3:0),spread=0.82+(lv>=7?0.10:0)+(lv>=10?0.08:0),speed=175*sc.speed;
  for(let i=0;i<count;i++){const a=-spread/2+spread*(i/(count-1));addBullet(cx,y,Math.sin(a)*speed,Math.cos(a)*speed,{r:(8+(lv>=8?1:0))*sc.radius,life:6200,color:'#ffd75b',kind:'fan'});}
}
function spawnCrossPattern(){
  const w=canvas.width,h=canvas.height,sc=bulletHellScale(),lv=bulletHell.level||1,lines=4+Math.floor((lv-1)/2.2)+(lv>=7?1:0),sp=138*sc.speed;
  for(let i=1;i<=lines;i++){const y=h*(i/(lines+1));addBullet(-18,y,sp,0,{r:7*sc.radius,life:6500,color:'#c78bff',kind:'cross'});addBullet(w+18,y,-sp,0,{r:7*sc.radius,life:6500,color:'#c78bff',kind:'cross'});}
  for(let i=1;i<=lines;i++){const x=w*(i/(lines+1));addBullet(x,-18,0,sp,{r:7*sc.radius,life:6500,color:'#78dfff',kind:'cross'});}
}
function spawnComboPattern(levelOverride){
  const lv=levelOverride||bulletHell.level||1; spawnFanPattern(); spawnSpiralPattern(); if(lv>=4)spawnLanePattern(); if(lv>=6)spawnCrossPattern();
  if(lv>=9){const cx=canvas.width/2,cy=canvas.height*0.20,sc=bulletHellScale(),count=8+Math.floor(lv*1.2),speed=84*sc.speed,base=bulletHell.waveIndex*0.34+Math.PI/2;for(let i=0;i<count;i++){const a=base-i*0.19;addBullet(cx,cy,Math.cos(a)*speed,Math.sin(a)*speed,{r:6.5*sc.radius,life:7200,color:'#fff0a6',kind:'spiral2'});}}
}
function spawnBulletHellWave(){
  const lv=bulletHell.level||1,phase=bulletHell.waveIndex%4;
  if(lv<=2){if(phase===0){spawnLanePattern();spawnFanPattern();}else if(phase===1){spawnSpiralPattern();spawnCrossPattern();}else if(phase===2){spawnFanPattern();spawnSpiralPattern();}else{spawnLanePattern();spawnCrossPattern();}}
  else if(lv<=4){if(phase===0){spawnLanePattern();spawnFanPattern();spawnSpiralPattern();}else if(phase===1){spawnSpiralPattern();spawnCrossPattern();}else if(phase===2){spawnFanPattern();spawnCrossPattern();}else{spawnLanePattern();spawnSpiralPattern();}}
  else if(lv<=6){if(phase===0)spawnComboPattern(lv);else if(phase===1){spawnSpiralPattern();spawnCrossPattern();spawnFanPattern();}else if(phase===2){spawnLanePattern();spawnSpiralPattern();spawnCrossPattern();}else{spawnFanPattern();spawnLanePattern();spawnSpiralPattern();}}
  else if(lv<=8){if(phase===0)spawnComboPattern(lv);else if(phase===1){spawnCrossPattern();spawnSpiralPattern();spawnFanPattern();}else if(phase===2){spawnLanePattern();spawnFanPattern();spawnSpiralPattern();}else{spawnCrossPattern();spawnLanePattern();spawnSpiralPattern();}}
  else if(lv<=10){spawnComboPattern(lv);if(phase===1)spawnCrossPattern();if(phase===2)spawnLanePattern();if(phase===3)spawnCrossPattern();}
  else{spawnComboPattern(11);spawnCrossPattern();spawnLanePattern();spawnFanPattern();}
  bulletHell.waveIndex++;
}
function updateBulletHell(dt){
  const cfg=BOSS_ABILITY_CONFIG.bullethell;if(bulletHell.messageT>0)bulletHell.messageT-=dt*1000;if(bulletHell.warning){bulletHell.warningT-=dt*1000;if(bulletHell.warningT<=0){bulletHell.warningT=0;enterBulletHell();}updateBulletHellOverlay();return;}if(!bulletHell.active){updateBulletHellOverlay();return;}
  bulletHell.elapsed+=dt*1000;if(bulletHell.invT>0)bulletHell.invT-=dt*1000;let dx=0,dy=0;
  if(bulletHellKeys.ArrowLeft||bulletHellKeys.a||bulletHellKeys.A)dx--;if(bulletHellKeys.ArrowRight||bulletHellKeys.d||bulletHellKeys.D)dx++;if(bulletHellKeys.ArrowUp||bulletHellKeys.w||bulletHellKeys.W)dy--;if(bulletHellKeys.ArrowDown||bulletHellKeys.s||bulletHellKeys.S)dy++;
  if(dx||dy){const m=Math.hypot(dx,dy);bulletHell.x+=dx/m*bulletHell.speed*dt;bulletHell.y+=dy/m*bulletHell.speed*dt;}
  if(bulletHell.pointerActive&&Number.isFinite(bulletHell.pointerX)&&Number.isFinite(bulletHell.pointerY)){const px=bulletHell.pointerX,py=bulletHell.pointerY,dd=Math.hypot(px-bulletHell.x,py-bulletHell.y);if(dd>2){const step=Math.min(dd,bulletHell.speed*dt);bulletHell.x+=(px-bulletHell.x)/dd*step;bulletHell.y+=(py-bulletHell.y)/dd*step;}}
  const margin=28;bulletHell.x=clamp(bulletHell.x,margin,canvas.width-margin);bulletHell.y=clamp(bulletHell.y,margin,canvas.height-margin);
  if(!bulletHell.spawnedItem&&bulletHell.elapsed>=cfg.itemDelay){bulletHell.spawnedItem=true;bulletHell.item={x:canvas.width/2,y:canvas.height/2,r:34,pulse:0};for(let i=0;i<18;i++)spawnSpark(canvas.width/2+camX,canvas.height/2+camY,'#ffe66d',5);}
  const lv=bulletHell.level||1,waveInterval=Math.max(1050,2100-(lv-1)*100);
  if(bulletHell.elapsed>=800&&bulletHell.elapsed-bulletHell.lastWaveT>=waveInterval&&!bulletHell.spawnedItem){bulletHell.lastWaveT=bulletHell.elapsed;spawnBulletHellWave();}
  for(const b of bulletHell.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt*1000;if(player.chestInv<=0&&bulletHell.invT<=0&&dist(b.x,b.y,bulletHell.x,bulletHell.y)<b.r+12){player.damageEvents++;player.hp-=Math.max(1,trueBossAttackDamage(enemies.find(e=>e.isTrueBossFinal&&!e.dead),(TRUE_BOSS_FINAL.dmg||120)*finalBossHeartAttackMultiplier)*0.28)*(player.defMul||1);bulletHell.invT=520;player.hitFlash=180;addShake(3);}}
  bulletHell.bullets=bulletHell.bullets.filter(b=>b.life>0&&b.x>-60&&b.x<canvas.width+60&&b.y>-60&&b.y<canvas.height+60);
  if(bulletHell.item){bulletHell.item.pulse+=dt*7;if(dist(bulletHell.x,bulletHell.y,bulletHell.item.x,bulletHell.item.y)<bulletHell.item.r+18){exitBulletHell();return;}}
  if(bulletHell.elapsed>=cfg.duration&&!bulletHell.item){bulletHell.item={x:canvas.width/2,y:canvas.height/2,r:34,pulse:0};bulletHell.spawnedItem=true;for(let i=0;i<24;i++)spawnSpark(bulletHell.item.x,bulletHell.item.y,'#ffe66d',6);}
}
function exitBulletHell(){
  const returnTrack = bulletHell.returnTrack || 'boss-phase3';
  stopBulletHellTrack();
  bulletHell.active=false;bulletHell.warning=false;bulletHell.messageT=0;updateBulletHellOverlay();bulletHell.bullets=[];bulletHell.item=null;bulletHell.elapsed=0;bulletHell.pointerActive=false;bulletHell.pointerX=null;bulletHell.pointerY=null;player.x=bulletHell.savedX;player.y=bulletHell.savedY;player.invTimer=1200;
  const boss=enemies.find(e=>e.isTrueBossFinal&&!e.dead);if(boss){boss.frozen=false;boss.timers=boss.timers||{};boss.timers.bullethell=BOSS_ABILITY_CONFIG.bullethell.interval;}
  if(returnTrack==='trueboss') startTrueBossTrack(); else if(returnTrack==='boss-phase3') startBossPhase3Track(); else if(returnTrack==='boss-phase2') startBossPhase2Track(); else if(returnTrack==='boss-phase1') startBossPhase1Track(); else startTrack('main');
  triggerScreenFlash(550);addShake(8);spawnText(player.x,player.y-55,'ステージへ帰還！','#ffe66d',22);
}
// 弾幕ゲーム背景：v103_bullethell_trueboss_final_cutin_fixed.html と完全一致
const BULLETHELL_BG_IMAGE_B64 = 'assets/images/7812b7723f075554a51e6d0e.jpg';

// 弾幕ゲーム上部に表示する追加イメージ（添付画像）
const BULLETHELL_TOP_IMAGE_B64 = 'assets/images/87200a5ff8626b71727eee3a.png';

// 弾幕回避ゲームの脱出アイテム画像（添付画像）
const BULLETHELL_ESCAPE_ITEM_IMAGE_B64 = 'assets/images/cfc92cf84ff0b58bbdcad05c.png';
let bulletHellEscapeItemImage = null;
(function loadBulletHellEscapeItemImage(){
  const img = new Image();
  img.onload = ()=>{ bulletHellEscapeItemImage = img; };
  img.src = BULLETHELL_ESCAPE_ITEM_IMAGE_B64;
})();

let bulletHellTopImage = null;
(function loadBulletHellTopImage(){
  const img = new Image();
  img.onload = ()=>{ bulletHellTopImage = img; };
  img.src = BULLETHELL_TOP_IMAGE_B64;
})();

let bulletHellBgImage = null;
(function loadBulletHellBackground(){
  const img = new Image();
  img.onload = ()=>{ bulletHellBgImage = img; };
  img.src = BULLETHELL_BG_IMAGE_B64;
})();

function renderBulletHell(){
  const cfg=BOSS_ABILITY_CONFIG.bullethell;
  ctx.clearRect(0,0,canvas.width,canvas.height);
drawFinalBossChains(ctx);

  // v103_bullethell_trueboss_final_cutin_fixed系の背景をベースに使用。
  // 元画像の構図を崩さないようcontain相当で中央配置する。
  ctx.fillStyle='#000';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  if(bulletHellBgImage && bulletHellBgImage.complete){
    const iw=bulletHellBgImage.naturalWidth||bulletHellBgImage.width;
    const ih=bulletHellBgImage.naturalHeight||bulletHellBgImage.height;
    const scale=Math.min(canvas.width/iw,canvas.height/ih);
    const dw=iw*scale, dh=ih*scale;
    const dx=(canvas.width-dw)/2, dy=(canvas.height-dh)/2;
    ctx.drawImage(bulletHellBgImage,dx,dy,dw,dh);
  }
  // 添付画像を弾幕ゲーム背景の上部中央に、少し大きめに表示する。
  // 背景そのものは変更せず、画像だけを前景レイヤーとして追加。
  if(bulletHellTopImage && bulletHellTopImage.complete){
    ctx.save();
    const iw = bulletHellTopImage.naturalWidth || bulletHellTopImage.width;
    const ih = bulletHellTopImage.naturalHeight || bulletHellTopImage.height;
    const maxW = canvas.width * 0.17;
    const scale = maxW / iw;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (canvas.width - dw) / 2;
    const dy = canvas.height * 0.035;
    ctx.globalAlpha = 0.96;
    ctx.drawImage(bulletHellTopImage, dx, dy, dw, dh);
    ctx.restore();
  }

  for(const b of bulletHell.bullets){const grd=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*2.8);grd.addColorStop(0,b.color);grd.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=.45;ctx.fillStyle=grd;ctx.beginPath();ctx.arc(b.x,b.y,b.r*2.8,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}
  if(bulletHell.item){
    const r=bulletHell.item.r+Math.sin(bulletHell.item.pulse)*5;
    // 脱出アイテムの周囲の取得可能エフェクト
    ctx.save();
    ctx.globalAlpha=.22;
    ctx.fillStyle='#ffe66d';
    ctx.beginPath();
    ctx.arc(bulletHell.item.x,bulletHell.item.y,r*2.2,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=1;
    // 添付画像の脱出アイテムを表示
    if(bulletHellEscapeItemImage && bulletHellEscapeItemImage.complete){
      const iw=bulletHellEscapeItemImage.naturalWidth||bulletHellEscapeItemImage.width||1;
      const ih=bulletHellEscapeItemImage.naturalHeight||bulletHellEscapeItemImage.height||1;
      const size=Math.max(82,r*2.35);
      const scale=Math.min(size/iw,size/ih);
      const dw=iw*scale, dh=ih*scale;
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(bulletHellEscapeItemImage,bulletHell.item.x-dw/2,bulletHell.item.y-dh/2,dw,dh);
    }else{
      ctx.font='30px sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText('💖',bulletHell.item.x,bulletHell.item.y);
    }
    ctx.restore();
  }

  // 弾幕ゲームでも通常ステージと同じ主人公スプライトを表示する。
  // selectedCharacter と player.level に応じて、通常ゲームと同じ見た目を使用。
  const bhSprite = currentPlayerSprite();
  const bhBlinking = bulletHell.invT>0 && Math.floor(performance.now()/80)%2===0;
  if(bhSprite && bhSprite.loaded && !bhBlinking){
    ctx.save();
    // 弾幕ゲームでは背景・弾が見やすいよう、通常ステージより少し小さめに表示。
    const bhScale = Math.min(0.82, 72 / Math.max(1,bhSprite.w));
    const sw = bhSprite.w * bhScale, sh = bhSprite.h * bhScale;
    // 主人公の足元に薄い影を置いて背景から見失いにくくする。
    ctx.globalAlpha=0.28;
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.ellipse(bulletHell.x, bulletHell.y+sh*0.36, sw*0.30, Math.max(4,sh*0.075), 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=1;
    // 無敵点滅時も位置が分かるよう、ごく薄い光輪を表示。
    if(bulletHell.invT>0){
      ctx.globalAlpha=0.22;
      ctx.strokeStyle='#fff';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.arc(bulletHell.x,bulletHell.y,Math.max(sw,sh)*0.48,0,Math.PI*2);
      ctx.stroke();
      ctx.globalAlpha=1;
    }
    ctx.translate(bulletHell.x, bulletHell.y+sh*0.04);
    if(typeof facing!=='undefined' && facing.x<0) ctx.scale(-1,1);
    ctx.drawImage(bhSprite.img, -sw/2, -sh/2, sw, sh);
    ctx.restore();
  } else if(!bhSprite || !bhSprite.loaded){
    // 画像ロード前だけ従来の簡易プレイヤーを表示。
    ctx.globalAlpha=(bulletHell.invT>0&&Math.floor(bulletHell.invT/80)%2===0)?.35:1;
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bulletHell.x,bulletHell.y,13,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ff69d4';ctx.beginPath();ctx.arc(bulletHell.x,bulletHell.y,7,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }
  // 弾幕回避中も主人公の現在HPと最大HPを常時表示する。
  ctx.save();
  const bhHpMax=Math.max(1,Number(player.maxHp)||1);
  const bhHp=Math.max(0,Math.min(bhHpMax,Number(player.hp)||0));
  const bhHpX=18, bhHpY=105, bhHpW=Math.min(210,Math.max(100,canvas.width*0.28));
  ctx.fillStyle='rgba(0,0,0,0.75)';
  ctx.fillRect(bhHpX-9,bhHpY-28,bhHpW+18,53);
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
  ctx.font='bold 17px sans-serif';ctx.fillStyle='#fff';
  ctx.fillText('HP '+Math.ceil(bhHp)+' / '+Math.ceil(bhHpMax),bhHpX,bhHpY-8);
  ctx.fillStyle='rgba(255,255,255,0.22)';ctx.fillRect(bhHpX,bhHpY,bhHpW,13);
  ctx.fillStyle=bhHp/bhHpMax<=0.25?'#ff5252':'#58dc83';
  ctx.fillRect(bhHpX,bhHpY,bhHpW*(bhHp/bhHpMax),13);
  ctx.strokeStyle='rgba(255,255,255,0.8)';ctx.strokeRect(bhHpX,bhHpY,bhHpW,13);
  ctx.restore();
  ctx.textAlign='center';ctx.textBaseline='alphabetic';const lv=bulletHell.level||1;ctx.font='bold 26px sans-serif';ctx.fillStyle=bulletHell.rare?'#ff4040':'#ffe66d';ctx.fillText('☄ 弾幕回避  LEVEL '+lv+(bulletHell.rare?'  ★RARE★':''),canvas.width/2,34);
  ctx.font='14px sans-serif';ctx.fillStyle='#fff';ctx.fillText(bulletHell.warning?'まもなく弾幕回避ゲームへ切り替わります':(bulletHell.item?'脱出アイテムを取得すると元のステージへ戻ります':'WASD / 矢印キーで弾幕を避けよう！'),canvas.width/2,58);
  if(!bulletHell.item){ctx.font='bold 18px sans-serif';ctx.fillStyle='#ffe66d';ctx.fillText('アイテム出現まで '+Math.max(0,Math.ceil((cfg.itemDelay-bulletHell.elapsed)/1000))+'秒',canvas.width/2,86);}ctx.textAlign='left';
}
function updateBossBulletHell(e,dt){if(bulletHell.active||bulletHell.warning||player.bossBind)return;e.timers.bullethell=(e.timers.bullethell==null?BOSS_ABILITY_CONFIG.bullethell.interval:e.timers.bullethell);e.timers.bullethell-=dt*1000;if(e.timers.bullethell<=0){e.timers.bullethell=BOSS_ABILITY_CONFIG.bullethell.interval;startBulletHellAttack(e);}}

function updateEnemies(dt){
  for(const e of enemies){
    const a = Math.atan2(player.y-e.y, player.x-e.x);
    e.angle = a;
    if(e.chillT>0){ e.chillT -= dt*1000; }
    const speedMul = e.chillT>0 ? (e.chillMul||1) : 1;

    e.frozen = false;
    e.dashing = false;
    if(e.abilities && e.abilities.length){
      if(e.abilities.includes('charge')) updateBossCharge(e, dt);
      if(e.abilities.includes('magic')) updateBossMagic(e, dt);
      if(e.abilities.includes('breath')) updateBossBreath(e, dt);
      if(e.abilities.includes('teleport')) updateBossTeleport(e, dt);
      if(e.abilities.includes('bind')) updateBossBind(e, dt);
      if(e.abilities.includes('bullethell') && e.isTrueBossFinal) updateBossBulletHell(e, dt);
    }
    // 真ボス第1戦の2体は、通常の追跡移動をせず、瞬間移動で位置を変える。
    // ただし接触時の体当たりダメージは有効。
    if(!e.trueBossTeleportOnly && !e.dashing && !e.frozen){
      e.x += Math.cos(a)*e.speed*speedMul*dt;
      e.y += Math.sin(a)*e.speed*speedMul*dt;
    }

    if(e.flash>0) e.flash -= dt*1000;
    if(e.artFlash>0) e.artFlash -= dt*1000;
    if(e.poisonT>0 && e.hp>0){
      e.poisonT -= dt*1000;
      const poisonTick = Math.max(0, e.poisonDmg*dt);
      e.hp -= poisonTick;
      addScore(poisonTick);
    }
    if(e.isSuperBoss){
      if(bossArenaCenter){
        const bdx = e.x-bossArenaCenter.x, bdy = e.y-bossArenaCenter.y;
        const bd = Math.hypot(bdx,bdy);
        const bmax = BOSS_ARENA_RADIUS - e.r*0.5;
        if(bd > bmax){
          const bang = Math.atan2(bdy,bdx);
          e.x = bossArenaCenter.x + Math.cos(bang)*bmax;
          e.y = bossArenaCenter.y + Math.sin(bang)*bmax;
        }
      }
      // 真ボス第1戦の2体には範囲攻撃（ノヴァ）を発生させない。
      if(!e.trueBossTeleportOnly && !e.trueBossFinalBulletHellOnly) e.novaTimer = (e.novaTimer||0) - dt*1000;
      if(!e.trueBossTeleportOnly && !e.trueBossFinalBulletHellOnly && e.novaTimer<=0){
        e.novaTimer = e.novaInterval || SUPER_BOSS.novaInterval;
        spawnRing(e.x,e.y,'rgba(255,40,90,0.65)', e.novaRadius || SUPER_BOSS.novaRadius, 550);
        spawnSpark(e.x,e.y,'#ff2846',14);
        addShake(6);
        if(dist(e.x,e.y,player.x,player.y) < (e.novaRadius || SUPER_BOSS.novaRadius) && player.invTimer<=0){
          applyBossDamageToPlayer(e,trueBossAttackDamage(e,(e.novaDmg || SUPER_BOSS.novaDmg)),DIFFICULTIES[difficulty].dmgMul*(e.heartStrengthMul||1),600,260);
          player.invTimer = 600; player.hitFlash = 260;
          spawnSpark(player.x,player.y,'#ff2846',8);
        }
      }
    }
    e.hitTimer = (e.hitTimer||0) - dt*1000;
    const d = dist(e.x,e.y,player.x,player.y);
    // 全ての敵は主人公に接触するとダメージを与える。
    // 真ボス第1戦の瞬間移動ボスだけは下の専用処理を使う。
    // hitTimer + player.invTimer で連続ヒットを防止。
    if(!e.dead && !e.trueBossTeleportOnly && d < e.r+player.radius && e.hitTimer<=0 && player.invTimer<=0){
      // ラスボス接触専用：ハート150個で830/845/860。HP・特殊攻撃とは独立。
      const contactBase = e.isSuperBoss && !e.isTrueBoss
        ? ([830, 845, 860][Math.max(0, Math.min(2, (e.phase || 1)-1))] / 1.15) * (e.heartStrengthMul || 1)
        : e.dmg;
      const contactDmg = Math.max(1, trueBossAttackDamage(e, contactBase));
      applyBossDamageToPlayer(e, contactDmg, 1, 600, 260);
      e.hitTimer = 700;
      const ca = Math.atan2(player.y-e.y, player.x-e.x);
      player.x += Math.cos(ca)*10;
      player.y += Math.sin(ca)*10;
      spawnSpark(player.x,player.y,'#ff4d4d',5);
      addShake(4);
    }

    if(!e.dead && e.isTrueBoss && e.trueBossTeleportOnly && d < e.r+player.radius && e.hitTimer<=0 && player.invTimer<=0){
      applyBossDamageToPlayer(e, trueBossAttackDamage(e,e.dmg), 1, 600, 260);
      e.hitTimer = 500;
      const a2 = Math.atan2(player.y-e.y, player.x-e.x);
      player.x += Math.cos(a2)*18; player.y += Math.sin(a2)*18;
      spawnSpark(player.x,player.y,'#ff4d4d',6);
      addShake(7);
      const apoc = findWeapon('apocalypse');
      const demo = findWeapon('demolition');
      const spike = findWeapon('spikearmor');
      if(apoc){
        const as = rankedStats(EVO_STATS.apocalypse,apoc);
        spawnRing(e.x,e.y,'rgba(120,255,90,0.65)', as.retRadius, 300);
        spawnSpark(e.x,e.y,'#7bff6a',12);
        addShake(5);
        enemies.forEach(e2=>{ if(dist(e2.x,e2.y,e.x,e.y)<as.retRadius) damageEnemy(e2, as.retDmg, as.poison); });
      } else if(demo){
        const ds = rankedStats(EVO_STATS.demolition,demo);
        spawnRing(e.x,e.y,'rgba(255,140,60,0.6)', ds.radius, 260);
        spawnSpark(e.x,e.y,'#ff8c3c',10);
        addShake(4);
        enemies.forEach(e2=>{ if(dist(e2.x,e2.y,e.x,e.y)<ds.radius) damageEnemy(e2, ds.dmg); });
      } else if(spike){
        const ss = weaponStats('spikearmor', spike.level);
        damageEnemy(e, ss.dmg);
        spawnSpark(e.x,e.y,'#ff6bd6',5);
      }
    }
  }
  enemies = enemies.filter(e=> e.hp>0);
}

function updateEnemyBolts(dt){
  enemyBolts.forEach(b=>{
    b.x += b.vx*dt; b.y += b.vy*dt;
    b.life -= dt*1000;
    if(Math.random()<0.6) spawnTrail(b.x,b.y,b.color,4);
    if(!b.hit && dist(b.x,b.y,player.x,player.y) < b.r+player.radius && player.invTimer<=0){
      applyBossDamageToPlayer(b,b.dmg,1,500,220);
      player.invTimer = 500; player.hitFlash = 220;
      spawnSpark(player.x,player.y,b.color,8);
      b.hit = true;
    }
  });
  enemyBolts = enemyBolts.filter(b=> b.life>0 && !b.hit);
}

function updateOrbitals(dt, time){
  player.weapons.forEach(w=>{
    if(w.id==='shield' || w.id==='orb'){
      const s = weaponStats(w.id, w.level);
      w.rotAngle = (w.rotAngle||0) + s.rot*dt*(w.id==='shield'?1:-1);
      const col = w.id==='shield' ? '#9fd3ff' : '#e2a6ff';
      for(let i=0;i<s.count;i++){
        const ang = w.rotAngle + (i*(Math.PI*2/s.count));
        const ox = player.x+Math.cos(ang)*s.radius;
        const oy = player.y+Math.sin(ang)*s.radius;
        if(Math.random()<0.6) spawnTrail(ox,oy,col, w.id==='shield'?5:4);
        enemies.forEach(e=>{
          e._orbitCd = e._orbitCd||{};
          const key = w.id+i;
          e._orbitCd[key] = (e._orbitCd[key]||0) - dt*1000;
          if(dist(e.x,e.y,ox,oy) < e.r+14 && e._orbitCd[key]<=0){
            damageEnemy(e, s.dmg);
            spawnSpark(ox,oy,col,3);
            e._orbitCd[key] = 400;
          }
        });
      }
    }
    if(w.id==='garlic'){
      w.tickTimer = (w.tickTimer||0) - dt*1000;
      if(w.tickTimer<=0){
        const s = weaponStats('garlic', w.level);
        let hit=false;
        enemies.forEach(e=>{ if(dist(e.x,e.y,player.x,player.y)<s.radius){ damageEnemy(e, s.dmg, null, true); hit=true; } });
        if(hit) spawnRing(player.x,player.y,'rgba(160,255,160,0.4)', s.radius, 300);
        w.tickTimer = s.tick;
      }
    }
    if(w.id==='blessingbell'){
      w.tickTimer = (w.tickTimer||0) - dt*1000;
      if(w.tickTimer<=0){
        const s = weaponStats('blessingbell', w.level);
        enemies.forEach(e=>{ if(dist(e.x,e.y,player.x,player.y)<s.radius) damageEnemy(e, s.dmg, null, true); });
        player.hp = Math.min(player.maxHp, player.hp + s.heal);
        spawnRing(player.x,player.y,'rgba(255,220,240,0.5)', s.radius, 350);
        spawnText(player.x,player.y-30,'+'+s.heal,'#ffd6f0',13);
        w.tickTimer = s.tick;
      }
    }
  });
}

function updateProjectiles(dt){
  for(const p of projectiles){
    if(p.homing && !p.homing.dead && p.homing.hp>0){
      const a = Math.atan2(p.homing.y-p.y, p.homing.x-p.x);
      p.vx += Math.cos(a)*900*dt; p.vy += Math.sin(a)*900*dt;
      const sp = Math.hypot(p.vx,p.vy);
      const maxSp = 320;
      if(sp>maxSp){ p.vx=p.vx/sp*maxSp; p.vy=p.vy/sp*maxSp; }
    }
    if(p.isAxe){ p.t=(p.t||0)+dt; p.y += Math.sin(p.t*6)*40*dt; p.rotation=(p.rotation||0)+(p.spin||6)*dt; }
    if(p.isChakram){ p.rotation=(p.rotation||0)+9*dt; }
    if(p.isBoomerang){
      if(!p.returning){
        p.traveled = (p.traveled||0) + Math.hypot(p.vx,p.vy)*dt;
        if(p.traveled > p.range){ p.returning = true; p._hit = new Set(); }
      } else {
        const a = Math.atan2(player.y-p.y, player.x-p.x);
        const sp = Math.hypot(p.vx,p.vy);
        p.vx = Math.cos(a)*sp; p.vy = Math.sin(a)*sp;
        if(dist(p.x,p.y,player.x,player.y) < 26){ p.life = 0; }
      }
    }
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.life -= dt*1000;
    if(Math.random()<0.7) spawnTrail(p.x - p.vx*0.01, p.y - p.vy*0.01, p.poison?'#7bff6a':p.color, p.r*0.6);
    p._hit = p._hit || new Set();
    if(!p.isBomb && !p.isHolyWater && !p.isBlackHole){
      enemies.forEach(e=>{
        if(p._hit.has(e) ) return;
        if(dist(e.x,e.y,p.x,p.y) < e.r+p.r){
          damageEnemy(e, p.dmg, p.poison, false, p.chill);
          if(p.pull){
            const ang = Math.atan2(player.y-e.y, player.x-e.x);
            e.x += Math.cos(ang)*p.pull; e.y += Math.sin(ang)*p.pull;
          }
          p._hit.add(e);
          p.pierce--;
        }
      });
    }
    if((p.isBomb || p.isHolyWater || p.isBlackHole) && p.life<=0 && !p.detonated){
      p.detonated = true;
      if(p.isBomb) explodeBomb(p);
      if(p.isHolyWater) createHolyZone(p);
      if(p.isBlackHole) createBlackHoleZone(p);
    }
  }
  projectiles = projectiles.filter(p=> p.life>0 && p.pierce>=0);
}

function updateZones(dt){
  zones.forEach(z=>{
    z.duration -= dt*1000;
    if(z.pull){
      enemies.forEach(e=>{
        const d = dist(e.x,e.y,z.x,z.y);
        if(d < z.radius && d>4){
          const ang = Math.atan2(z.y-e.y, z.x-e.x);
          e.x += Math.cos(ang)*z.pull*dt; e.y += Math.sin(ang)*z.pull*dt;
        }
      });
    }
    z.tickTimer -= dt*1000;
    if(z.tickTimer<=0){
      let hit=false;
      const chill = z.slow ? {mul:z.slow, dur:z.slowDur} : null;
      enemies.forEach(e=>{ if(dist(e.x,e.y,z.x,z.y)<z.radius){ damageEnemy(e, z.dmgPerTick, null, true, chill); hit=true; } });
      if(hit) spawnRing(z.x,z.y, z.color, z.radius, 260);
      z.tickTimer = z.tickInterval;
    }
  });
  zones = zones.filter(z=> z.duration>0);
}

function updatePickups(dt){
  gems = gems.filter(g=>{
    const d = dist(g.x,g.y,player.x,player.y);
    if(d < player.pickupRadius*1.6 && d>18){
      const a = Math.atan2(player.y-g.y, player.x-g.x);
      g.x += Math.cos(a)*260*dt; g.y += Math.sin(a)*260*dt;
    }
    if(d < 20){ gainXp(g.val); return false; }
    return true;
  });
  hearts = hearts.filter(h=>{
    const d = dist(h.x,h.y,player.x,player.y);
    if(d < player.pickupRadius*1.6 && d>18){
      const a = Math.atan2(player.y-h.y, player.x-h.x);
      h.x += Math.cos(a)*220*dt; h.y += Math.sin(a)*220*dt;
    }
    if(d < 20){
      player.hp = Math.min(player.maxHp, player.hp+20);
      // 「入手した数」だけをカウント（画面上に出現しただけでは増えない）。
      collectedHeartCount++;
      return false;
    }
    return true;
  });
  powerups = powerups.filter(p=>{
    const d = dist(p.x,p.y,player.x,player.y);
    if(d < player.pickupRadius*1.8 && d>18){
      const a = Math.atan2(player.y-p.y, player.x-p.x);
      p.x += Math.cos(a)*240*dt; p.y += Math.sin(a)*240*dt;
    }
    if(d < (p.type==='thankyou' ? 65 : 22)){
      if(p.type==='magnet') collectAllGems();
      else if(p.type==='nuke') nukeAllEnemies();
      else if(p.type==='revive') gainRevive();
      else if(p.type==='chest'){countTitle('chest');checkTitles();const n=Math.floor(Math.random()*5);const labels=['XP +500','HP 30%回復','攻撃力 +30% / 20秒','移動速度 +20% / 20秒','無敵 5秒'];if(n===0)gainXp(500);else if(n===1)player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.3);else if(n===2)player.chestAtk=20;else if(n===3)player.chestSpeed=20;else player.chestInv=5;spawnText(player.x,player.y-35,labels[n],'#ffd700',16);}
      else if(p.type==='thankyou') showThankYouScene();
      return false;
    }
    return true;
  });
}

function collectAllGems(){
  let total = 12;
  gems.forEach(g=>{ total += g.val; });
  gems = [];
  gainXp(total);
  spawnRing(player.x,player.y,'rgba(120,200,255,0.7)', 140, 420);
  spawnSpark(player.x,player.y,'#9fd3ff',14);
  spawnText(player.x,player.y-30,'+'+total+' EXP','#9fd3ff',16);
}

function nukeAllEnemies(){
  const dmg = 260 + elapsed*3;
  enemies.forEach(e=>{ damageEnemy(e, dmg, null, false, null, true); });
  triggerScreenFlash(400);
  addShake(12);
  spawnRing(player.x,player.y,'rgba(255,255,255,0.8)', 260, 400);
}

function gainRevive(){
  player.reviveCharges = (player.reviveCharges||0) + 1;
  spawnRing(player.x,player.y,'rgba(255,105,180,0.7)', 90, 450);
  spawnSpark(player.x,player.y,'#ff69b4',14);
  spawnText(player.x,player.y-30,'復活の力を手に入れた！','#ff69b4',13);
}

function gainXp(v){
  player.xp += v * (DIFFICULTIES[difficulty].xpMul||1)*(player.titleXp||1);
  let gainedLevels = 0;
  while(player.xp >= player.xpNext){
    player.xp -= player.xpNext;
    player.level++;
    player.xpNext = Math.floor(7 + player.level*5);
    gainedLevels++;
    // 見た目の進化はLv11 / Lv21 / Lv31。テロップはLv30までだが、
    // Lv31の最終ティアへの見た目進化時にもステータスボーナスは適用する。
    if(player.level%10===1 && player.level>1){
      applyCharacterEvolutionBonus();
      showCharacterEvolutionAnnounce();
      spawnRing(player.x,player.y,'rgba(255,105,180,0.7)', 90, 500);
      spawnSpark(player.x,player.y,'#ff69b4',16);
    }
  }
  // 一度の経験値獲得で複数レベル上がった場合も、各レベル分を1回ずつ選択させる。
  if(gainedLevels > 0){
    checkTitles();
    pendingLevelUps += gainedLevels;
    if(state !== 'LEVELUP') showLevelUp();
  }
}

function updateParticles(dt){
  particles.forEach(p=>{
    p.life -= dt*1000;
    if(p.type==='bit' || p.type==='spark'){
      p.x += (p.vx||0)*dt; p.y += (p.vy||0)*dt;
      p.vx = (p.vx||0)*(1-dt*3); p.vy = (p.vy||0)*(1-dt*3);
    } else if(p.type==='text'){
      p.y += (p.vy||0)*dt; p.vy *= (1-dt*2);
    }
  });
  particles = particles.filter(p=> p.life>0);
  if(shakeMag>0.05){ shakeMag *= Math.max(0, 1 - 10*dt); } else { shakeMag = 0; }
  if(screenFlashTimer>0) screenFlashTimer -= dt*1000;
}

// ---------- Render ----------
// ---------- Enemy shape rendering ----------
function drawTrueBossRoleSprite(ctx, e, ex, ey){
  const role = e.trueBossRole || 'kata';
  const gachaSprite = (e.trueBossGachaActive && TRUE_BOSS_GACHA_SPRITES[role])
    ? TRUE_BOSS_GACHA_SPRITES[role] : null;
  const teddySprite = (e.trueBossTeddyActive && TRUE_BOSS_TEDDY_SPRITES[role])
    ? TRUE_BOSS_TEDDY_SPRITES[role] : null;
  const set = TRUE_BOSS_ROLE_SPRITES[role];
  if(!set) return false;
  const sprite = (gachaSprite && gachaSprite.loaded)
    ? gachaSprite
    : ((teddySprite && teddySprite.loaded)
      ? teddySprite : (e.artState===1 ? set.hit : set.normal));
  if(!sprite || !sprite.loaded) return false;
  const targetH=e.r*4.15, scale=targetH/sprite.h;
  const w=sprite.w*scale, h=sprite.h*scale;
  ctx.save();
  ctx.translate(ex,ey);
  ctx.globalAlpha=e.artFlash>0?0.92:1;
  ctx.drawImage(sprite.img,-w/2,-h/2,w,h);
  ctx.restore();
  return true;
}

function drawBossSprite(ctx, e, ex, ey, sprite){
  const targetH = e.isTrueBoss ? e.r*3.8 : e.r*3.3;
  const scale = targetH / sprite.h;
  const w = sprite.w*scale, h = sprite.h*scale;
  ctx.save();
  ctx.translate(ex, ey + (e.isTrueBoss ? 0 : h*0.08));
  if(!e.isTrueBoss && Math.cos(e.angle||0) < 0) ctx.scale(-1,1);
  ctx.drawImage(sprite.img, -w/2, -h/2, w, h);
  ctx.restore();
}

function drawFinalTrueBossSprite(ctx, e, ex, ey){
  const sprite = TRUE_BOSS_FINAL_SPRITE;
  if(!sprite || !sprite.loaded) return false;
  const targetH = e.r * 4.05;
  const scale = targetH / sprite.h;
  const w = sprite.w * scale, h = sprite.h * scale;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.globalAlpha = e.flash > 0 ? 0.88 : 1;
  ctx.drawImage(sprite.img, -w/2, -h/2, w, h);
  ctx.restore();
  return true;
}

// 第二形態専用：添付画像を加工せず、そのままの向き・中心位置で描画する。
// 既存ボス用の左右反転や縦方向オフセットを適用しない。
function drawBossPhase2SpriteExact(ctx, e, ex, ey, sprite){
  const targetH = e.r*3.3;
  const scale = targetH / sprite.h;
  const w = sprite.w*scale, h = sprite.h*scale;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.drawImage(sprite.img, -w/2, -h/2, w, h);
  ctx.restore();
}

function drawMobSprite(ctx, e, ex, ey, sprite){
  if(!sprite || !sprite.img || !sprite.img.complete) return;
  const spriteW = Number(sprite.w) || sprite.img.naturalWidth;
  const spriteH = Number(sprite.h) || sprite.img.naturalHeight;
  if(!(spriteW>0 && spriteH>0)) return;
  const isBossPhase1Sprite = !!(e.spriteKey && e.spriteKey.indexOf('boss_phase1_')===0);
  const isBossPhase2Sprite = !!(e.spriteKey && e.spriteKey.indexOf('boss_phase2_minion_')===0);
  const isTrueBossMinionSprite = !!(e.spriteKey && e.spriteKey.indexOf('trueboss_minion_')===0);
  let w, h;
  if(isTrueBossMinionSprite){
    // 6枚とも同じ1254pxキャンバスのユーザー画像。透明余白を含めたまま
    // 比率を維持して描画し、左右反転・回転は行わない。
    const targetH = Math.max(e.r*3.2, 62.4);
    const scale = targetH / spriteH;
    w = spriteW*scale; h = spriteH*scale;
  } else if(isBossPhase2Sprite){
    // 透明余白をトリミング済みのセリフ画像なので、横幅基準で見やすく表示。
    const targetW = Math.max(e.r*4.2, 86);
    const scale = targetW / spriteW;
    w = spriteW*scale; h = spriteH*scale;
  } else {
    const targetH = isBossPhase1Sprite ? Math.max(e.r*4.15, 74) : e.r*2.6;
    const scale = targetH / spriteH;
    w = spriteW*scale; h = spriteH*scale;
  }
  ctx.save();
  ctx.translate(ex, ey);
  if(!isBossPhase2Sprite && !isTrueBossMinionSprite && Math.cos(e.angle||0) < 0) ctx.scale(-1,1);
  if(e.flash>0){
    ctx.filter = 'brightness(2.2)';
  }
  ctx.drawImage(sprite.img, -w/2, -h/2, w, h);
  ctx.filter = 'none';
  ctx.restore();
}

function drawEnemyShape(ctx, e, ex, ey){
  const r = e.r;
  const bodyColor = e.flash>0 ? '#ffffff' : e.color;
  ctx.save();
  ctx.translate(ex,ey);
  ctx.rotate(e.angle||0);

  // body
  ctx.beginPath();
  if(e.key==='ghost'){
    ctx.arc(0,0,r,Math.PI,0);
    const waves=4;
    for(let i=0;i<=waves;i++){
      const wx = r - (2*r*i/waves);
      const wy = (i%2===0)? r*0.55 : r*0.2;
      ctx.lineTo(wx, wy);
    }
    ctx.closePath();
  } else {
    ctx.arc(0,0,r,0,Math.PI*2);
  }
  ctx.fillStyle = bodyColor;
  ctx.fill();

  // wings/horns behind-ish features first for bat/orc/ogre (drawn over body is fine, simple layering)
  if(e.key==='bat'){
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.moveTo(-r*0.2,-r*0.2); ctx.lineTo(-r*1.3,-r*0.9); ctx.lineTo(-r*0.5,r*0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r*0.2,r*0.2); ctx.lineTo(-r*1.3,r*0.9); ctx.lineTo(-r*0.5,-r*0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ffe066';
    ctx.beginPath(); ctx.arc(r*0.35,-r*0.15,r*0.1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.35,r*0.15,r*0.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.moveTo(r*0.7,-r*0.05); ctx.lineTo(r*0.85,0); ctx.lineTo(r*0.7,r*0.05); ctx.closePath(); ctx.fill();
  } else if(e.key==='orc'){
    ctx.fillStyle='#e8e0c0';
    ctx.beginPath(); ctx.moveTo(-r*0.3,-r*0.7); ctx.lineTo(-r*0.6,-r*1.3); ctx.lineTo(-r*0.05,-r*0.85); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r*0.3,-r*0.7); ctx.lineTo(r*0.6,-r*1.3); ctx.lineTo(r*0.05,-r*0.85); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#3a1a1a'; ctx.lineWidth=r*0.12; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.05,-r*0.35); ctx.lineTo(-r*0.45,-r*0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.05,-r*0.35); ctx.lineTo(r*0.45,-r*0.15); ctx.stroke();
    ctx.fillStyle='#ff3030';
    ctx.beginPath(); ctx.arc(-r*0.2,-r*0.05,r*0.09,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.2,-r*0.05,r*0.09,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.moveTo(-r*0.25,r*0.35); ctx.lineTo(-r*0.35,r*0.6); ctx.lineTo(-r*0.1,r*0.45); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r*0.25,r*0.35); ctx.lineTo(r*0.35,r*0.6); ctx.lineTo(r*0.1,r*0.45); ctx.closePath(); ctx.fill();
  } else if(e.key==='ogre'){
    ctx.fillStyle='#5a3418';
    ctx.beginPath(); ctx.moveTo(-r*0.4,-r*0.75); ctx.lineTo(-r*0.75,-r*1.35); ctx.lineTo(-r*0.1,-r*0.9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r*0.4,-r*0.75); ctx.lineTo(r*0.75,-r*1.35); ctx.lineTo(r*0.1,-r*0.9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#2a1408'; ctx.lineWidth=r*0.14; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.05,-r*0.4); ctx.lineTo(-r*0.5,-r*0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.05,-r*0.4); ctx.lineTo(r*0.5,-r*0.2); ctx.stroke();
    ctx.fillStyle='#ffcc33';
    ctx.beginPath(); ctx.arc(-r*0.22,-r*0.05,r*0.1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.22,-r*0.05,r*0.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.moveTo(-r*0.3,r*0.4); ctx.lineTo(-r*0.42,r*0.7); ctx.lineTo(-r*0.12,r*0.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r*0.3,r*0.4); ctx.lineTo(r*0.42,r*0.7); ctx.lineTo(r*0.12,r*0.5); ctx.closePath(); ctx.fill();
  } else if(e.key==='slime'){
    ctx.fillStyle='#1a2a1a';
    ctx.beginPath(); ctx.ellipse(r*0.25,-r*0.05,r*0.12,r*0.16,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-r*0.05,-r*0.2,r*0.1,r*0.14,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-r*0.3,-r*0.35,r*0.14,r*0.08,0.4,0,Math.PI*2); ctx.fill();
  } else if(e.key==='ghost'){
    ctx.fillStyle='#2a2a3a';
    ctx.beginPath(); ctx.arc(-r*0.25,-r*0.1,r*0.13,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.25,-r*0.1,r*0.13,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0,r*0.15,r*0.12,r*0.16,0,0,Math.PI*2); ctx.fill();
  } else {
    ctx.fillStyle='#1a1a1a';
    ctx.beginPath(); ctx.arc(-r*0.25,-r*0.05,r*0.1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.25,-r*0.05,r*0.1,0,Math.PI*2); ctx.fill();
  }

  if(e.isBoss){
    if(e.key==='behemoth'){
      ctx.fillStyle='#e8e0c0';
      ctx.beginPath(); ctx.moveTo(-r*0.4,-r*0.8); ctx.lineTo(-r*0.85,-r*1.5); ctx.lineTo(-r*0.05,-r*0.95); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r*0.4,-r*0.8); ctx.lineTo(r*0.85,-r*1.5); ctx.lineTo(r*0.05,-r*0.95); ctx.closePath(); ctx.fill();
      for(let i=-1;i<=1;i++){
        ctx.beginPath(); ctx.moveTo(i*r*0.4,-r*0.85); ctx.lineTo(i*r*0.4+r*0.08,-r*1.15); ctx.lineTo(i*r*0.4+r*0.16,-r*0.85); ctx.closePath(); ctx.fill();
      }
    } else if(e.key==='lich'){
      ctx.fillStyle='#33334a';
      ctx.beginPath(); ctx.moveTo(-r*0.9,-r*0.3); ctx.lineTo(0,-r*1.4); ctx.lineTo(r*0.9,-r*0.3); ctx.lineTo(0,-r*0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#7fffea';
      ctx.beginPath(); ctx.arc(-r*0.22,-r*0.05,r*0.11,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.22,-r*0.05,r*0.11,0,Math.PI*2); ctx.fill();
    } else if(e.key==='dragon'){
      ctx.fillStyle=e.color;
      ctx.beginPath(); ctx.moveTo(-r*0.3,-r*0.3); ctx.lineTo(-r*1.6,-r*1.1); ctx.lineTo(-r*0.6,r*0.4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r*0.3,r*0.3); ctx.lineTo(-r*1.6,r*1.1); ctx.lineTo(-r*0.6,-r*0.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#8a4b12';
      ctx.beginPath(); ctx.moveTo(-r*0.15,-r*0.75); ctx.lineTo(-r*0.35,-r*1.25); ctx.lineTo(r*0.05,-r*0.9); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r*0.15,-r*0.75); ctx.lineTo(r*0.35,-r*1.25); ctx.lineTo(-r*0.05,-r*0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ff3030';
      ctx.beginPath(); ctx.arc(-r*0.22,-r*0.05,r*0.1,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.22,-r*0.05,r*0.1,0,Math.PI*2); ctx.fill();
    } else if(e.key==='demonking'){
      // huge dark wings
      ctx.fillStyle='#1a0010';
      ctx.beginPath(); ctx.moveTo(-r*0.3,-r*0.2); ctx.lineTo(-r*2.0,-r*1.3); ctx.lineTo(-r*0.7,r*0.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r*0.3,r*0.2); ctx.lineTo(-r*2.0,r*1.3); ctx.lineTo(-r*0.7,-r*0.5); ctx.closePath(); ctx.fill();
      // long curved horns
      ctx.fillStyle='#0d0008';
      ctx.beginPath(); ctx.moveTo(-r*0.35,-r*0.85); ctx.lineTo(-r*0.8,-r*1.75); ctx.lineTo(-r*0.02,-r*1.0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r*0.35,-r*0.85); ctx.lineTo(r*0.8,-r*1.75); ctx.lineTo(r*0.02,-r*1.0); ctx.closePath(); ctx.fill();
      // tattered cape behind
      ctx.fillStyle='#28001a';
      ctx.beginPath(); ctx.moveTo(-r*0.5,r*0.5); ctx.lineTo(-r*0.9,r*1.4); ctx.lineTo(-r*0.1,r*1.1); ctx.lineTo(r*0.3,r*1.5); ctx.lineTo(r*0.6,r*0.6); ctx.closePath(); ctx.fill();
      // glowing crimson eyes
      ctx.fillStyle='#ff2040';
      ctx.beginPath(); ctx.arc(-r*0.24,-r*0.05,r*0.14,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.24,-r*0.05,r*0.14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,60,90,0.5)';
      ctx.beginPath(); ctx.arc(-r*0.24,-r*0.05,r*0.24,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.24,-r*0.05,r*0.24,0,Math.PI*2); ctx.fill();
    }
  }

  ctx.restore();
}

// ===== SPECIAL WEAPON COMPANION EFFECTS (easy to remove later) =====
function drawSpecialWeaponCompanions(){
  if(!player || !player.weapons) return;

  // ===== SPECIAL WEAPON COMPANION EFFECTS (easy to remove later) =====
  // きゅーまる（旧スパイクアーマー）の専用画像を主人公の周囲に周回表示。
  const spikeInst = findWeapon('spikearmor');
  const spikeSprite = SPECIAL_WEAPON_COMPANIONS.spikearmor;
  if(spikeInst && spikeSprite && spikeSprite.loaded){
    const now = performance.now();
    const level = Math.max(1, spikeInst.level||1);
    const count = Math.min(5, 1 + Math.ceil(level/2));
    const radius = 72 + level*5;
    const size = 52;
    const speed = 0.00145;
    const base = now*speed;
    const pulse = 1 + Math.sin(now/170)*0.05;
    const cx = player.x-camX, cy = player.y-camY;
    ctx.save();
    ctx.globalAlpha = 0.97;
    for(let i=0;i<count;i++){
      const a = base + i*(Math.PI*2/count);
      const bob = Math.sin(now/230 + i*1.4)*4;
      const ox = cx + Math.cos(a)*radius;
      const oy = cy + Math.sin(a)*radius + bob;
      const r = size*pulse;
      ctx.save();
      ctx.translate(ox,oy);
      ctx.rotate(Math.sin(now/430+i)*0.12 + a + Math.PI/2);
      ctx.shadowColor = 'rgba(255,170,210,0.9)';
      ctx.shadowBlur = 12;
      ctx.drawImage(spikeSprite.img, -r/2, -r/2, r, r);
      ctx.restore();
    }
    ctx.restore();
  }

  const hasCucumber = !!findWeapon('cucumber');
  const hasHedgehog = !!findWeapon('harvesthedgehog');
  const hasEvolvedHedgehog = !!findWeapon('heavenharvest');
  let mode = hasEvolvedHedgehog ? 'evolved' : (hasHedgehog ? 'hedgehog' : (hasCucumber ? 'cucumber' : null));
  if(!mode) return;
  const sprite = SPECIAL_WEAPON_COMPANIONS[mode==='cucumber' ? 'cucumber' : (mode==='hedgehog' ? 'harvesthedgehog' : 'hedgehog')];
  if(!sprite || !sprite.loaded) return;

  const now = performance.now();
  const levelInst = findWeapon(mode==='cucumber' ? 'cucumber' : (mode==='hedgehog' ? 'harvesthedgehog' : 'heavenharvest'));
  const level = levelInst ? Math.max(1, levelInst.level||1) : 1;
  let count = mode==='cucumber' ? Math.min(6, 2 + level) : (mode==='hedgehog' ? Math.min(5, 2 + Math.floor(level/2)) : 6);
  const radius = mode==='cucumber' ? 68 + level*5 : (mode==='hedgehog' ? 82 + level*5 : 105 + level*7);
  const size = mode==='cucumber' ? 34 : (mode==='hedgehog' ? 40 : 48);
  const speed = mode==='cucumber' ? 0.0016 : (mode==='hedgehog' ? -0.00125 : 0.00105);
  const base = now*speed;
  const pulse = 1 + Math.sin(now/180)*0.06;
  const cx = player.x-camX, cy = player.y-camY;

  ctx.save();
  ctx.globalAlpha = mode==='evolved' ? 0.98 : 0.94;
  for(let i=0;i<count;i++){
    const a = base + i*(Math.PI*2/count);
    const bob = Math.sin(now/260 + i*1.7)*5;
    const ox = cx + Math.cos(a)*radius;
    const oy = cy + Math.sin(a)*radius + bob;
    const r = size*pulse;
    ctx.save();
    ctx.translate(ox,oy);
    ctx.rotate(Math.sin(now/500+i)*0.18 + a + Math.PI/2);
    ctx.shadowColor = mode==='cucumber' ? 'rgba(120,255,120,0.85)' : 'rgba(255,120,210,0.9)';
    ctx.shadowBlur = mode==='evolved' ? 18 : 10;
    ctx.drawImage(sprite.img, -r/2, -r/2, r, r);
    ctx.restore();
  }
  if(mode==='evolved'){
    ctx.globalAlpha = 0.34 + Math.sin(now/140)*0.06;
    ctx.strokeStyle = '#ff69b4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx,cy,radius*0.72,0,Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
  // ===== END SPECIAL WEAPON COMPANION EFFECTS =====
}
// ===== END SPECIAL WEAPON COMPANION EFFECTS =====

function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  camX = player.x - canvas.width/2;
  camY = player.y - canvas.height/2;
  if(shakeMag>0.1){
    camX += rand(-shakeMag,shakeMag);
    camY += rand(-shakeMag,shakeMag);
  }

  // ラスボス背景：第一形態と第二形態で別画像を使用。
  // 第二形態では今回添付された背景を画面全体に cover 表示する。
  const isLastBossBattle = !!(bossActive && bossActive.isSuperBoss);
  const isLastBossPhase2 = !!(isLastBossBattle && bossActive.phase===2 && !bossActive.dead);
  const isLastBossPhase3 = !!(isLastBossBattle && bossActive.phase===3 && !bossActive.dead);
  const activeBossBgImage = isLastBossPhase3 ? bossBgPhase3Image : (isLastBossPhase2 ? bossBgPhase2Image : bossBgImage);
  if(isLastBossBattle && activeBossBgImage){
    const iw = activeBossBgImage.naturalWidth || activeBossBgImage.width;
    const ih = activeBossBgImage.naturalHeight || activeBossBgImage.height;
    const scale = Math.max(canvas.width / iw, canvas.height / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (canvas.width - dw) / 2, dy = (canvas.height - dh) / 2;
    ctx.drawImage(activeBossBgImage, dx, dy, dw, dh);
  } else {
    const activeBgPattern = isLastBossBattle ? (bossBgPattern || stageBgPattern) : stageBgPattern;
    if(activeBgPattern){
      const bx = ((-camX % BG_TILE_SIZE) + BG_TILE_SIZE) % BG_TILE_SIZE;
      const by = ((-camY % BG_TILE_SIZE) + BG_TILE_SIZE) % BG_TILE_SIZE;
      ctx.save();
      ctx.translate(bx - BG_TILE_SIZE, by - BG_TILE_SIZE);
      ctx.fillStyle = activeBgPattern;
      ctx.fillRect(0, 0, canvas.width + BG_TILE_SIZE*2, canvas.height + BG_TILE_SIZE*2);
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      const grid = 80;
      const offX = -camX % grid, offY = -camY % grid;
      for(let x=offX; x<canvas.width; x+=grid){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
      for(let y=offY; y<canvas.height; y+=grid){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
    }
  }

  // last-boss arena boundary
  if(bossArenaCenter){
    const cx = bossArenaCenter.x-camX, cy = bossArenaCenter.y-camY;
    ctx.save();
    ctx.setLineDash([14,10]);
    ctx.strokeStyle = 'rgba(255,60,110,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx,cy,BOSS_ARENA_RADIUS,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // hazard zones (holy water / thunder sanctuary / vortex)
  const zonePulse = 1+Math.sin(performance.now()/150)*0.05;
  zones.forEach(z=>{
    const x=z.x-camX, y=z.y-camY;
    if(z.isVortex){
      const spin = performance.now()/300;
      ctx.save(); ctx.translate(x,y); ctx.rotate(spin);
      const grad = ctx.createRadialGradient(0,0,0,0,0,z.radius*zonePulse);
      grad.addColorStop(0,z.blackHoleLike?'rgba(45,0,25,0.9)':'rgba(10,0,20,0.85)'); grad.addColorStop(0.6,z.color); grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.fillStyle=grad; ctx.arc(0,0,z.radius*zonePulse,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=z.blackHoleLike?'rgba(255,105,180,0.85)':'rgba(200,150,255,0.5)'; ctx.lineWidth=2;
      for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(0,0,z.radius*zonePulse*(0.4+i*0.25), i*0.8, i*0.8+2.4); ctx.stroke(); }
      ctx.restore();
      ctx.font='22px sans-serif'; ctx.textAlign='center'; ctx.fillText('🕳️', x, y+8); ctx.textAlign='left';
    } else {
      ctx.beginPath(); ctx.fillStyle=z.color; ctx.arc(x,y,z.radius*zonePulse,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=2; ctx.arc(x,y,z.radius*zonePulse,0,Math.PI*2); ctx.stroke();
      if(z.isTotem){ ctx.font='22px sans-serif'; ctx.textAlign='center'; ctx.fillText(z.slow?'🧊':'🗿', x, y+8); ctx.textAlign='left'; }
    }
  });

  // meteor telegraphs
  meteors.forEach(m=>{
    const x=m.x-camX, y=m.y-camY;
    const p = clamp(m.timer/m.maxTimer,0,1);
    ctx.beginPath(); ctx.strokeStyle='rgba(255,80,40,'+(0.4+0.4*(1-p))+')'; ctx.lineWidth=3;
    ctx.arc(x,y,m.radius*(0.3+0.7*(1-p)),0,Math.PI*2); ctx.stroke();
    ctx.font='20px sans-serif'; ctx.textAlign='center'; ctx.globalAlpha=0.85;
    ctx.fillText('☄️', x, y - 40*p);
    ctx.globalAlpha=1; ctx.textAlign='left';
  });

  // ground-level fx: rings, slashes, trails (under entities)
  particles.forEach(p=>{
    const a = clamp(p.life/p.maxLife,0,1);
    const x=p.x-camX, y=p.y-camY;
    if(p.type==='ring'){
      const r = p.maxR*(1-a);
      ctx.beginPath();
      ctx.strokeStyle = p.color; ctx.lineWidth = 3+a*3;
      ctx.globalAlpha = a*0.85;
      ctx.arc(x,y,Math.max(1,r),0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    } else if(p.type==='slash'){
      ctx.save();
      ctx.translate(x,y); ctx.rotate(p.angle||0);
      ctx.strokeStyle = p.color; ctx.lineCap='round';
      ctx.lineWidth = (p.width||2)*(0.6+a*1.4);
      ctx.globalAlpha = a*0.9;
      ctx.beginPath();
      ctx.arc(0,0,p.r*(0.7+ (1-a)*0.5), -0.65, 0.65);
      ctx.stroke();
      ctx.globalAlpha=1;
      ctx.restore();
    } else if(p.type==='trail'){
      ctx.beginPath(); ctx.fillStyle=p.color; ctx.globalAlpha = a*0.7;
      ctx.arc(x,y,p.size*a,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    } else if(p.type==='bolt'){
      ctx.strokeStyle=p.color; ctx.lineWidth=3; ctx.globalAlpha=a;
      ctx.beginPath();
      const sy = y-260;
      ctx.moveTo(x,sy);
      const segs=5;
      for(let i=1;i<=segs;i++){
        const t=i/segs;
        ctx.lineTo(x+(Math.random()-0.5)*18*(1-t), sy+(y-sy)*t);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.fillStyle=p.color; ctx.globalAlpha=a*0.6; ctx.arc(x,y,18,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    } else if(p.type==='daisukiCharge'){
      if(!bossActive) { p.life=0; } else {
      const t=1-Math.max(0,p.life)/p.maxLife;
      const px=player.x-camX, py=player.y-camY, bx=bossActive.x-camX, by=bossActive.y-camY;
      const pulse=1+Math.sin(performance.now()/55)*0.16;
      ctx.save();
      ctx.globalAlpha=0.35+0.45*t;
      ctx.strokeStyle='#ff69b4'; ctx.lineCap='round'; ctx.lineWidth=(7+18*t)*pulse;
      ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(bx,by); ctx.stroke();
      ctx.strokeStyle='#fff'; ctx.lineWidth=(2+6*t)*pulse; ctx.stroke();
      ctx.fillStyle='#ff69b4';
      ctx.beginPath(); ctx.arc(px,py,(18+38*t)*pulse,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx,by,(14+28*t)*pulse,0,Math.PI*2); ctx.fill();
      ctx.restore();
      }
    } else if(p.type==='beam'){
      const bx1=p.x1-camX, by1=p.y1-camY, bx2=p.x2-camX, by2=p.y2-camY;
      ctx.strokeStyle=p.color; ctx.lineCap='round'; ctx.globalAlpha=a;
      ctx.lineWidth = 22*a+4;
      ctx.beginPath(); ctx.moveTo(bx1,by1); ctx.lineTo(bx2,by2); ctx.stroke();
      ctx.strokeStyle='#ffffff'; ctx.lineWidth = 8*a+2;
      ctx.beginPath(); ctx.moveTo(bx1,by1); ctx.lineTo(bx2,by2); ctx.stroke();
      ctx.globalAlpha=1;
    }
  });

  // orbitals (with glow + trailing arc)
  player.weapons.forEach(w=>{
    if(w.id==='shield'||w.id==='orb'){
      const s = weaponStats(w.id, w.level);
      const col = w.id==='shield'?'#9fd3ff':'#e2a6ff';
      for(let i=0;i<s.count;i++){
        const ang=(w.rotAngle||0)+(i*(Math.PI*2/s.count));
        const ox=player.x+Math.cos(ang)*s.radius-camX, oy=player.y+Math.sin(ang)*s.radius-camY;
        const rad = w.id==='shield'?12:10;
        const grad = ctx.createRadialGradient(ox,oy,1,ox,oy,rad*2.2);
        grad.addColorStop(0, col); grad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.fillStyle=grad; ctx.arc(ox,oy,rad*2.2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.fillStyle = col; ctx.arc(ox,oy,rad,0,Math.PI*2); ctx.fill();
      }
    }
  });

  // gems (pulsing glow)
const pulse = 1 + Math.sin(performance.now() / 180) * 0.15;
  gems.forEach(gem => {
    const x = gem.x - camX, y = gem.y - camY;
    const radius = gem.r || 4;

    // 1. 外側の光（パルスする半透明の黄色）
    ctx.fillStyle = 'rgba(255, 235, 59, 0.4)';
    ctx.beginPath();
    ctx.arc(x, y, (radius + 3) * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 2. 中心の本体（ゴールド黄色）
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
  hearts.forEach(h=>{
    ctx.font='16px sans-serif'; ctx.fillText('❤️', h.x-camX-8, h.y-camY+6);
  });
  powerups.forEach(p=>{
    const x=p.x-camX, y=p.y-camY;
    const pulse2 = 1+Math.sin(performance.now()/130)*0.2;
    const glowColor = p.type==='thankyou' ? 'rgba(255,145,210,0.72)' : p.type==='nuke' ? 'rgba(255,120,60,0.55)' : p.type==='revive' ? 'rgba(255,105,180,0.6)' : 'rgba(150,220,255,0.55)';
    const grad = ctx.createRadialGradient(x,y,0,x,y,20*pulse2);
    grad.addColorStop(0,glowColor); grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.fillStyle=grad; ctx.arc(x,y,20*pulse2,0,Math.PI*2); ctx.fill();
    ctx.font='20px sans-serif'; ctx.textAlign='center';
    if(p.type==='revive'){
      const reviveImg = window.__reviveItemImage;
      if(reviveImg && reviveImg.complete && reviveImg.naturalWidth){
        const s = 38;
        ctx.save();
        ctx.drawImage(reviveImg, x-s/2, y-s/2, s, s);
        ctx.restore();
      }else{
        ctx.fillText('💖', x, y+7);
      }
    }else if(p.type==='thankyou'){
      const rewardImg = window.__finalThankYouItemImage;
      if(rewardImg && rewardImg.complete && rewardImg.naturalWidth){
        const w=336, h=189; // 特別アイテムを従来の3倍で表示
        ctx.save();
        ctx.shadowColor='rgba(255,105,180,0.9)';
        ctx.shadowBlur=18;
        ctx.drawImage(rewardImg,x-w/2,y-h/2,w,h);
        ctx.restore();
      }else{
        ctx.fillText('💝',x,y+7);
      }
    }else{
      ctx.fillText(p.type==='chest'?'🎁':p.type==='nuke' ? '💥' : '🧲', x, y+7);
    }
    ctx.textAlign='left';
  });

  // projectiles (glow + spin for thrown weapons)
  projectiles.forEach(p=>{
    const x=p.x-camX, y=p.y-camY;
    if(p.glow){
      const grad = ctx.createRadialGradient(x,y,0,x,y,p.r*3);
      grad.addColorStop(0, p.color); grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=0.6; ctx.beginPath(); ctx.fillStyle=grad; ctx.arc(x,y,p.r*3,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    }
    if(p.isAxe){
      ctx.save(); ctx.translate(x,y); ctx.rotate(p.rotation||0);
      ctx.fillStyle=p.color;
      ctx.beginPath();
      ctx.moveTo(0,-p.r*1.4); ctx.lineTo(p.r,0); ctx.lineTo(0,p.r*1.4); ctx.lineTo(-p.r,0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if(p.isChakram){
      ctx.save(); ctx.translate(x,y); ctx.rotate(p.rotation||0);
      ctx.strokeStyle=p.color; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-p.r,0); ctx.lineTo(p.r,0); ctx.moveTo(0,-p.r); ctx.lineTo(0,p.r); ctx.stroke();
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.fillStyle=p.color;
      ctx.arc(x,y,p.r,0,Math.PI*2); ctx.fill();
    }
  });

  // enemy magic bolts
  enemyBolts.forEach(b=>{
    const x=b.x-camX, y=b.y-camY;
    const grad = ctx.createRadialGradient(x,y,0,x,y,b.r*3);
    grad.addColorStop(0, b.color); grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=0.6; ctx.beginPath(); ctx.fillStyle=grad; ctx.arc(x,y,b.r*3,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    ctx.beginPath(); ctx.fillStyle=b.color; ctx.arc(x,y,b.r,0,Math.PI*2); ctx.fill();
  });

  // enemies
  enemies.forEach(e=>{
    const ex=e.x-camX, ey=e.y-camY;
    const bossColor = e.isSuperBoss ? '255,40,70' : '255,215,0';
    const bossHex = e.isSuperBoss ? '#ff2846' : '#ffd700';
    if(e.isBoss){
      const auraPulse = 1+Math.sin(performance.now()/220)*0.08;
      const auraR = e.r*(e.isSuperBoss?2.8:2.2)*auraPulse;
      const grad = ctx.createRadialGradient(ex,ey,e.r*0.5,ex,ey,auraR);
      grad.addColorStop(0,'rgba('+bossColor+',0.35)'); grad.addColorStop(1,'rgba('+bossColor+',0)');
      ctx.beginPath(); ctx.fillStyle=grad; ctx.arc(ex,ey,auraR,0,Math.PI*2); ctx.fill();
      // attack telegraphs
      if(e.chargeState==='telegraph'){
        const p2 = 0.5+Math.sin(performance.now()/60)*0.5;
        ctx.strokeStyle='rgba(255,120,40,'+(0.5+p2*0.5)+')'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(ex+Math.cos(e.chargeDir)*140, ey+Math.sin(e.chargeDir)*140); ctx.stroke();
      }
      if(e.breathState==='telegraph' || e.breathState==='active'){
        const cfg = BOSS_ABILITY_CONFIG.breath;
        ctx.save();
        ctx.translate(ex,ey); ctx.rotate(e.breathDir||0);
        ctx.fillStyle = e.breathState==='active' ? 'rgba(255,140,60,0.4)' : 'rgba(255,140,60,0.2)';
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.arc(0,0,cfg.length,-cfg.halfAngle,cfg.halfAngle);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    if(e.isBoss){const id=e.isTrueBossFinal?'truefinal':e.isTrueBoss?(e.trueBossRole||'kata')+(e.trueBossGachaActive?'gacha':e.trueBossTeddyActive?'teddy':e.artState===1?'hit':'normal'):e.isSuperBoss&&e.phase>1?'phase'+e.phase:e.key;discover(id);}
    const bossSprite = e.isBoss ? BOSS_SPRITES[e.key] : null;
    const trueBossSprite = e.isTrueBoss ? TRUE_BOSS_SPRITE : null;
    const finalTrueBossSprite = e.isTrueBossFinal ? TRUE_BOSS_FINAL_SPRITE : null;
    const phase2Sprite = (e.isSuperBoss && e.phase===2) ? BOSS_PHASE2_SPRITE : null;
    const phase3Sprite = (e.isSuperBoss && e.phase===3) ? BOSS_PHASE3_SPRITE : null;
    const mobSprite = (!e.isBoss) ? (ENEMY_SPRITES[e.spriteKey || e.key] || ENEMY_SPRITES[e.key]) : null;
    if(e.isTrueBossFinal && drawFinalTrueBossSprite(ctx, e, ex, ey)){
    } else if(e.isTrueBoss && drawTrueBossRoleSprite(ctx, e, ex, ey)){
    } else if(phase3Sprite && phase3Sprite.loaded){
      drawBossPhase2SpriteExact(ctx, e, ex, ey, phase3Sprite);
    } else if(phase2Sprite && phase2Sprite.loaded){
      drawBossPhase2SpriteExact(ctx, e, ex, ey, phase2Sprite);
    } else if(bossSprite && bossSprite.loaded){
      drawBossSprite(ctx, e, ex, ey, bossSprite);
    } else if(mobSprite && mobSprite.loaded){
      drawMobSprite(ctx, e, ex, ey, mobSprite);
    } else {
      drawEnemyShape(ctx, e, ex, ey);
    }
    if(e.isBoss && !(e.isSuperBoss && e.phase===2)){
      ctx.beginPath(); ctx.strokeStyle=bossHex; ctx.lineWidth=e.isSuperBoss?4:3; ctx.arc(ex,ey,e.r+2,0,Math.PI*2); ctx.stroke();
      ctx.font=(e.isSuperBoss?'bold 14px sans-serif':'bold 12px sans-serif'); ctx.textAlign='center'; ctx.fillStyle=bossHex;
      ctx.fillText(e.name, ex, ey-e.r-12); ctx.textAlign='left';
    }
    if(e.poisonT>0){
      ctx.beginPath(); ctx.strokeStyle='rgba(123,255,106,0.8)'; ctx.lineWidth=2;
      ctx.arc(ex,ey,e.r+3,0,Math.PI*2); ctx.stroke();
    }
    if(e.chillT>0){
      ctx.beginPath(); ctx.strokeStyle='rgba(150,220,255,0.85)'; ctx.lineWidth=2;
      ctx.arc(ex,ey,e.r+6,0,Math.PI*2); ctx.stroke();
    }
    // hp bar
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(ex-e.r,ey-e.r-8,e.r*2,4);
    ctx.fillStyle='#ff5050'; ctx.fillRect(ex-e.r,ey-e.r-8,e.r*2*clamp(e.hp/e.maxHp,0,1),4);
  });

  // rising damage numbers & impact sparks (drawn above entities)
  particles.forEach(p=>{
    const a = clamp(p.life/p.maxLife,0,1);
    const x=p.x-camX, y=p.y-camY;
    if(p.type==='spark'){
      ctx.strokeStyle=p.color; ctx.lineWidth=2; ctx.globalAlpha=a;
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.lineTo(x+Math.cos(p.angle)*p.len*a, y+Math.sin(p.angle)*p.len*a);
      ctx.stroke(); ctx.globalAlpha=1;
    } else if(p.type==='bit'){
      ctx.beginPath(); ctx.fillStyle=p.color; ctx.globalAlpha=a;
      ctx.arc(x,y,p.size,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    } else if(p.type==='text'){
      ctx.globalAlpha=a; ctx.fillStyle=p.color; ctx.font='bold '+p.size+'px sans-serif'; ctx.textAlign='center';
      ctx.fillText(p.text, x, y); ctx.textAlign='left'; ctx.globalAlpha=1;
    }
  });

  // 真ボス必殺技の落下・直撃アニメーションは敵より手前に描画。
  drawTrueBossImpactAnimations();

  // player
  const px=player.x-camX, py=player.y-camY;
  const blinking = player.invTimer>0 && Math.floor(performance.now()/80)%2===0;
  const sprite = currentPlayerSprite();
  if(sprite.loaded && !blinking){
    ctx.save();
    ctx.translate(px, py+sprite.h*0.06);
    if(facing.x<0) ctx.scale(-1,1);
    ctx.drawImage(sprite.img, -sprite.w/2, -sprite.h/2, sprite.w, sprite.h);
    ctx.restore();
  } else if(!sprite.loaded){
    ctx.beginPath();
    ctx.fillStyle = '#ffd76a';
    ctx.arc(px,py,player.radius,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.strokeStyle='#3a2a00'; ctx.lineWidth=2; ctx.arc(px,py,player.radius,0,Math.PI*2); ctx.stroke();
  }


  // v70: 主人公の直下にHP・経験値を表示。
  // v69をベースにしているため、第三形態・BGM・既存機能を保持したままHUDだけを追加。
  const playerUiY = py + Math.max(player.radius + 12, (sprite.loaded ? sprite.h * 0.5 : player.radius) + 12);
  const uiW = 112, uiH = 9, uiX = px - uiW/2;
  const hpRatio = clamp(player.hp / Math.max(1, player.maxHp), 0, 1);
  const xpRatio = clamp(player.xp / Math.max(1, player.xpNext), 0, 1);
  ctx.save();
  ctx.textAlign='left';
  ctx.font='bold 10px sans-serif';
  ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,0.62)';
  ctx.fillRect(uiX-4, playerUiY-6, uiW+8, 42);
  // HP
  ctx.fillStyle='#fff';
  ctx.fillText('HP '+Math.ceil(Math.max(0,player.hp))+' / '+Math.ceil(Math.max(1,player.maxHp)), uiX, playerUiY);
  ctx.fillStyle='rgba(0,0,0,0.7)';
  ctx.fillRect(uiX, playerUiY+5, uiW, uiH);
  const hpGrad=ctx.createLinearGradient(uiX,0,uiX+uiW,0);
  hpGrad.addColorStop(0,'#ff3f5f'); hpGrad.addColorStop(1,'#ff9aa8');
  ctx.fillStyle=hpGrad; ctx.fillRect(uiX, playerUiY+5, uiW*hpRatio, uiH);
  // EXP
  ctx.fillStyle='#fff';
  ctx.fillText('EXP '+Math.floor(Math.max(0,player.xp))+' / '+Math.floor(Math.max(1,player.xpNext)), uiX, playerUiY+20);
  ctx.fillStyle='rgba(0,0,0,0.7)';
  ctx.fillRect(uiX, playerUiY+25, uiW, uiH);
  const xpGrad=ctx.createLinearGradient(uiX,0,uiX+uiW,0);
  xpGrad.addColorStop(0,'#4da6ff'); xpGrad.addColorStop(1,'#a7ddff');
  ctx.fillStyle=xpGrad; ctx.fillRect(uiX, playerUiY+25, uiW*xpRatio, uiH);
  ctx.restore();

  // Special weapon companion visuals: cucumber / それいけきゅーまる / evolved form.
  drawSpecialWeaponCompanions();

  // player hit flash vignette
  if(player.hitFlash>0){
    const a = clamp(player.hitFlash/260,0,1)*0.35;
    ctx.fillStyle='rgba(255,0,0,'+a+')';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  if(screenFlashTimer>0){
    const a = clamp(screenFlashTimer/400,0,1)*0.6;
    ctx.fillStyle='rgba(255,255,255,'+a+')';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
}

// ---------- Main loop ----------
function loop(now){
  syncBulletHellHpHud();
  if(state!=='PLAYING') return;
  let dt = (now-lastFrame)/1000;
  lastFrame = now;
  dt = Math.min(dt, 0.05); // clamp for tab-switch
  if(document.hidden){ requestAnimationFrame(loop); return; }
  for(const k of ['chestAtk','chestSpeed','chestInv'])player[k]=Math.max(0,player[k]-dt);

  // 最終ラスボスの特殊攻撃中は通常ステージを一時停止し、弾幕回避ゲームを実行。
  if(bulletHell.active || bulletHell.warning){
    updateBulletHell(dt);
    if(player.hp<=0){ gameOver(); return; }
    syncBulletHellHpHud();
    renderBulletHell();
    requestAnimationFrame(loop);
    return;
  }

  elapsed += dt;
  if(Math.floor(elapsed)!==Math.floor(elapsed-dt))checkTitles();
  spawnTimer -= dt*1000;
  const stage = currentStage();
  const spawnFreqMul = 1 + (stage-1)*0.16*DIFFICULTIES[difficulty].scaleMul;
  const spawnInterval = Math.max(150, (1450 - elapsed*6) * DIFFICULTIES[difficulty].spawnMul / spawnFreqMul);
  // ラスボス第一形態中は、既存・新規を問わず全雑魚を指定画像へ切り替える。
  applyBossPhase1MinionSprites();
  // ラスボス第二形態中も、第1形態と同じ5枚の雑魚画像を使用。
  applyBossPhase2MinionSprites();
  // ラスボス第三形態中は、今回添付された5枚を雑魚敵として使用。
  applyBossPhase3MinionSprites();
  // 真ボス戦は今回指定された6枚を雑魚敵として使用。
  applyTrueBossMinionSprites();
  if(!specialClearSequenceActive){
    if(spawnTimer<=0){ spawnEnemy(); spawnTimer = spawnInterval; }

    if(!superBossSpawned && elapsed >= SUPER_BOSS_TIME){
      if(difficulty==='trueboss') triggerTrueBossSpawn();
      else triggerSuperBossSpawn();
    } else if(!bossActive && elapsed >= nextBossTime){
      triggerBossSpawn();
      nextBossTime = elapsed + BOSS_INTERVAL;
    }
  }

  try {
    updatePlayer(dt);
    updateOrbitals(dt, now);
    updateZones(dt);
    updateMeteors(dt);
    if(trueBossSpecialPauseT>0){
      trueBossSpecialPauseT = Math.max(0, trueBossSpecialPauseT-dt*1000);
      const pauseNotice = document.getElementById('trueboss-special-pause-notice');
      if(pauseNotice){
        pauseNotice.style.display = trueBossSpecialPauseT>0 ? 'block' : 'none';
        const small = pauseNotice.querySelector('small');
        if(small) small.textContent = trueBossSpecialPauseT>0
          ? '敵が一時停止中・あと '+(trueBossSpecialPauseT/1000).toFixed(1)+' 秒'
          : '敵が動き始めます';
      }
    }
    if(trueBossSpecialPauseT<=0) {
      updateEnemies(dt);
      updateEnemyBolts(dt);
    }
    updateProjectiles(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateTrueBossImpactAnimations(dt);
    updateHud();
    render();
  } catch(err) {
    // 攻撃ヒット時の一時的な描画/効果エラーでゲームループ全体が停止しないよう復旧する。
    console.error('Game loop recovered:', err);
    if(player){
      if(!Number.isFinite(Number(player.hp))) player.hp=player.maxHp;
      if(!Number.isFinite(Number(player.x))) player.x=canvas.width/2;
      if(!Number.isFinite(Number(player.y))) player.y=canvas.height-120;
      player.invTimer=Math.max(Number(player.invTimer)||0,250);
    }
  }

  if(player.hp<=0){
    if(player.reviveCharges>0){
      player.reviveCharges--;
      player.hp = player.maxHp*0.5;
      player.invTimer = 1800;
      player.hitFlash = 0;
      triggerScreenFlash(400);
      addShake(10);
      spawnRing(player.x,player.y,'rgba(255,105,180,0.75)', 120, 500);
      spawnSpark(player.x,player.y,'#ff69b4',18);
      spawnText(player.x,player.y-34,'復活！','#ff69b4',20);
    } else {
      gameOver(); return;
    }
  }

  requestAnimationFrame(loop);
}

// ===== DEBUG MODE START: このブロックを丸ごと削除すればデバッグ機能を完全撤去できます =====
const DEBUG_MODE_ENABLED = false;
let debugInvincible = false;
let debugPanelTimer = null;
function debugReady(){ return DEBUG_MODE_ENABLED && typeof player!=='undefined' && player; }
function debugToggle(){
  if(!DEBUG_MODE_ENABLED) return;
  const p=document.getElementById('debug-panel');
  if(p) p.classList.toggle('hidden');
}
function debugStatus(){
  const el=document.getElementById('debug-status');
  if(!el || !debugReady()) return;
  const b=bossActive;
  const stage=currentStage();
  const weapons=player.weapons.map(w=>`${w.id}:${w.level}`).join(', ')||'-';
  el.innerHTML = [
    `<div class="dbg-row">state: <span class="dbg-on">${state}</span></div>`,
    `<div class="dbg-row">difficulty: ${DIFFICULTIES[difficulty].label}</div>`,
    `<div class="dbg-row">stage: ${stage} / time: ${Math.floor(elapsed)}s</div>`,
    `<div class="dbg-row">player: (${Math.round(player.x)}, ${Math.round(player.y)})</div>`,
    `<div class="dbg-row">HP: ${Math.ceil(player.hp)} / ${Math.ceil(player.maxHp)} / Lv.${player.level}</div>`,
    `<div class="dbg-row">XP: ${Math.floor(player.xp)} / ${player.xpNext}</div>`,
    `<div class="dbg-row">enemies: ${enemies.length} / kills: ${killCount}</div>`,
    `<div class="dbg-row">boss: ${b ? b.name+' / HP '+Math.ceil(b.hp)+' / phase '+(b.phase||'-') : '-'}</div>`,
    `<div class="dbg-row">superBossSpawned: ${superBossSpawned}</div>`,
    `<div class="dbg-row">arena: ${bossArenaCenter ? 'ON / R='+BOSS_ARENA_RADIUS : 'OFF'}</div>`,
    `<div class="dbg-row">invincible: <span class="dbg-warn">${debugInvincible}</span></div>`,
    `<div class="dbg-row">weapons: ${weapons}</div>`
  ].join('');
}
function debugHeal(){ if(!debugReady()) return; player.hp=player.maxHp; player.invTimer=debugInvincible?999999999:0; }
function debugToggleInv(){ if(!debugReady()) return; debugInvincible=!debugInvincible; player.invTimer=debugInvincible?999999999:0; }
function debugXp(){ if(!debugReady() || state!=='PLAYING') return; gainXp(1000); }
function debugXp10000(){ if(!debugReady() || state!=='PLAYING') return; gainXp(10000); }
function debugLevel(){ if(!debugReady()) return; player.level++; player.xp=0; player.xpNext=Math.floor(7+player.level*5); pendingLevelUps++; if(state==='PLAYING') showLevelUp(); }
function debugBoss(){ if(!debugReady() || state!=='PLAYING') return; if(bossActive) return; if(difficulty==='trueboss') triggerTrueBossSpawn(); else triggerSuperBossSpawn(); }
function debugStage(){ if(!debugReady()) return; elapsed += 60; }
function debugClear(){ if(!debugReady()) return; enemies=[]; bossActive=null; }
function debugScore(){ if(!debugReady()) return; runScore=(Number(runScore)||0)+10000; }
function debugDamage(){ if(!debugReady()) return; saveData.totalDamage=(Number(saveData.totalDamage)||0)+10000; }
function debugForceBulletHell(){
  if(!debugReady() || state!=='PLAYING') return;
  if(bulletHell.active || bulletHell.warning) return;
  bulletHell.warning=false;bulletHell.active=true;bulletHell.savedX=player.x;bulletHell.savedY=player.y;bulletHell.elapsed=0;bulletHell.bullets=[];bulletHell.item=null;bulletHell.spawnedItem=false;bulletHell.waveIndex=0;bulletHell.lastWaveT=-9999;bulletHell.invT=1100;bulletHell.pointerActive=false;bulletHell.pointerX=null;bulletHell.pointerY=null;bulletHell.x=canvas.width/2;bulletHell.y=canvas.height*0.72;
  rollBulletHellLevel();player.invTimer=Math.max(player.invTimer||0,1200);spawnBulletHellWave();lastFrame=performance.now();spawnText(player.x,player.y-85,'弾幕回避テスト Lv.'+bulletHell.level+(bulletHell.rare?' RARE!!':''),'#ff4fd8',24);requestAnimationFrame(loop);
}
function debugUnlockTrueBoss(){
  if(!DEBUG_MODE_ENABLED) return;
  saveData.trueBossUnlocked = true;
  saveGame();
  // 現在のゲーム状態を変更せず、保存だけして再読み込み。
  // 起動時の通常フローで真のボスモードが解放されるため、状態破壊を防止する。
  location.reload();
}
if(DEBUG_MODE_ENABLED){
  document.addEventListener('keydown', e=>{ if(e.key==='F2' && !e.repeat){ e.preventDefault(); debugToggle(); } });
  document.getElementById('dbg-heal').onclick=debugHeal;
  document.getElementById('dbg-inv').onclick=debugToggleInv;
  document.getElementById('dbg-xp').onclick=debugXp;
  document.getElementById('dbg-xp10000').onclick=debugXp10000;
  document.getElementById('dbg-level').onclick=debugLevel;
  document.getElementById('dbg-boss').onclick=debugBoss;
  document.getElementById('dbg-stage').onclick=debugStage;
  document.getElementById('dbg-clear').onclick=debugClear;
  document.getElementById('dbg-score').onclick=debugScore;
  document.getElementById('dbg-damage').onclick=debugDamage;
  document.getElementById('dbg-trueboss').onclick=debugUnlockTrueBoss;
  document.getElementById('dbg-bullethell').onclick=debugForceBulletHell;
  document.getElementById('dbg-close').onclick=()=>document.getElementById('debug-panel').classList.add('hidden');
  debugPanelTimer=setInterval(debugStatus,250);
}
// ===== DEBUG MODE END =====

// ---------- Boot ----------
// 起動時にもゲーム本体を必ず初期化してからオープニングを開始する。
// オープニング→難易度→キャラ→武器選択の途中で player が未生成になる不具合を防止。
resetGame();
state = 'START';
showDifficultyScreen();
updateHud();

})();
window.__finalThankYouItemImage = new Image();
window.__finalThankYouItemImage.src = 'assets/images/5e5cbdb27b64f3371be2c7e5.png';
window.__finalThankYouSceneImage = 'assets/images/a7a434b6c47dd5365ea53402.jpg';
window.__reviveItemImage = new Image();
window.__reviveItemImage.src = "assets/images/cfc92cf84ff0b58bbdcad05c.png";
