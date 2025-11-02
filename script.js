
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function randStr(len=2){
  let s=''; for(let i=0;i<len;i++) s += ALPHA[Math.floor(Math.random()*ALPHA.length)];
  return s;
}
const daysEl = document.querySelector('.block[data-unit="days"]');
const hoursEl = document.querySelector('.block[data-unit="hours"]');
const minutesEl = document.querySelector('.block[data-unit="minutes"]');
const secondsEl = document.querySelector('.block[data-unit="seconds"]');
const seps = document.querySelectorAll('.sep.blink');

// init
[daysEl,hoursEl,minutesEl,secondsEl].forEach(el => el.textContent = randStr(2));


const FADE_DURATION = 1200; // matches CSS transition (1.2s)
function updateWithFade(el){
  el.classList.add('fade-out');
  setTimeout(()=>{
    el.textContent = randStr(2);
    el.classList.remove('fade-out');
  }, FADE_DURATION/2);
}
function loop(el){
  const delay = Math.floor(2000 + Math.random()*3000); // 2–5s
  setTimeout(()=>{ updateWithFade(el); loop(el); }, delay);
}
[daysEl,hoursEl,minutesEl,secondsEl].forEach(loop);

// Blink separators (subtle, 1Hz)
let blinkOn = true;
setInterval(()=>{
  blinkOn = !blinkOn;
  seps.forEach(s => s.classList.toggle('off', !blinkOn));
}, 1000);


const canvas = document.getElementById('space');
const ctx = canvas.getContext('2d');

let Wcss, Hcss, DPR;
let stars = [];
let galaxy = [];
let rot = 0;

function genStars(){
  const count = Math.floor((Wcss * Hcss) / 9000);
  stars = Array.from({length: count}, () => ({
    x: Math.random() * Wcss,
    y: Math.random() * Hcss,
    r: Math.random() * 1.1 + 0.2,
    a: Math.random() * 0.5 + 0.35,
    tw: (Math.random() * 0.6 + 0.2)
  }));
}

function genGalaxy(){
  galaxy = [];
  const ARMS = 4;
  const PARTICLES = 1300;
  const maxR = Math.min(Wcss, Hcss) * 0.35;
  const armSep = (Math.PI * 2) / ARMS;
  for(let i=0;i<PARTICLES;i++){
    const arm = i % ARMS;
    const t = Math.random() * 5.0;
    const r = (t * t) / 25 * maxR + Math.random() * 8;
    const angle = arm * armSep + t * 1.6 + (Math.random() - 0.5) * 0.25;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    const size = Math.random() * 1.6 + 0.3;
    const alpha = 0.65 - (r / maxR) * 0.45 + (Math.random() * 0.15);
    galaxy.push({x, y, size, alpha});
  }
}

function resize(){
  DPR = Math.max(1, window.devicePixelRatio || 1);
  Wcss = window.innerWidth;
  Hcss = window.innerHeight;
  canvas.width = Math.floor(Wcss * DPR);
  canvas.height = Math.floor(Hcss * DPR);
  canvas.style.width = Wcss + 'px';
  canvas.style.height = Hcss + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  genStars();
  genGalaxy();
}
window.addEventListener('resize', resize, {passive:true});
resize();

function draw(){
  // Clear transparent to let CSS nebula show
  ctx.clearRect(0,0,Wcss,Hcss);

  // Stars
  for(const s of stars){
    ctx.globalAlpha = Math.max(0.15, Math.min(1, s.a + (Math.random()-0.5)*0.05 * s.tw));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fillStyle = '#eafff7';
    ctx.fill();
  }

  // Centered galaxy
  const cx = Wcss/2, cy = Hcss/2;
  // Core glow (greenish)
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(Wcss, Hcss)*0.36);
  core.addColorStop(0, 'rgba(220, 255, 240, 0.22)');
  core.addColorStop(0.2, 'rgba(120, 255, 200, 0.16)');
  core.addColorStop(0.65, 'rgba(0, 255, 170, 0.05)');
  core.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(Wcss, Hcss)*0.36, 0, Math.PI*2);
  ctx.fill();

  // Spiral (gentle rotation)
  rot += 0.002;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for(const p of galaxy){
    const gx = p.x * cos - p.y * sin;
    const gy = p.x * sin + p.y * cos;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#cffff0';
    ctx.beginPath();
    ctx.arc(cx + gx, cy + gy, p.size, 0, Math.PI*2);
    ctx.fill();
  }

  requestAnimationFrame(draw);
}
draw();


let actx = null, masterGain, noiseSrc, noiseGain, lp, bp, lfo, lfoGain, rumbleOsc, rumbleGain, delayL, delayR, fbL, fbR, merger;

function createNoiseBuffer(ctx, seconds=2){
  const sr = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sr*seconds, sr);
  const data = buffer.getChannelData(0);
  for(let i=0;i<data.length;i++){
    data[i] = (Math.random()*2 - 1) * 0.5;
  }
  return buffer;
}

function setupAudio(){
  actx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = actx.createGain();
  masterGain.gain.value = 0.25; // fixed volume
  masterGain.connect(actx.destination);

  // Noise path
  const noiseBuffer = createNoiseBuffer(actx, 2);
  noiseSrc = actx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;
  noiseSrc.loop = true;
  noiseGain = actx.createGain();
  noiseGain.gain.value = 0.35;

  // Filters
  lp = actx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.7;

  bp = actx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 1.2;

  lfo = actx.createOscillator();
  lfo.frequency.value = 0.05;
  lfoGain = actx.createGain();
  lfoGain.gain.value = 200;
  lfo.connect(lfoGain).connect(bp.frequency);

  // Rumble
  rumbleOsc = actx.createOscillator();
  rumbleOsc.type = 'sine'; rumbleOsc.frequency.value = 48;
  rumbleGain = actx.createGain();
  rumbleGain.gain.value = 0.03;

  // Delays
  delayL = actx.createDelay(3.0); delayL.delayTime.value = 0.27;
  delayR = actx.createDelay(3.0); delayR.delayTime.value = 0.41;
  fbL = actx.createGain(); fbL.gain.value = 0.25;
  fbR = actx.createGain(); fbR.gain.value = 0.21;
  delayL.connect(fbL).connect(delayL);
  delayR.connect(fbR).connect(delayR);

  merger = actx.createChannelMerger(2);
  const dryGain = actx.createGain(); dryGain.gain.value = 0.05;

  // Graph
  noiseSrc.connect(lp);
  lp.connect(bp);
  bp.connect(delayL);
  bp.connect(delayR);
  bp.connect(dryGain).connect(masterGain);

  rumbleOsc.connect(rumbleGain);
  rumbleGain.connect(delayL);
  rumbleGain.connect(delayR);

  delayL.connect(merger, 0, 0);
  delayR.connect(merger, 0, 1);
  merger.connect(masterGain);

  noiseSrc.start();
  lfo.start();
  rumbleOsc.start();
}

function ensureAudio(){
  if(!actx){ setupAudio(); }
  if(actx.state === 'suspended'){
    actx.resume().catch(()=>{});
  }
}


document.addEventListener('DOMContentLoaded', ensureAudio);
window.addEventListener('load', ensureAudio);


['pointerdown','click','keydown','touchstart'].forEach(evt => {
  window.addEventListener(evt, ensureAudio, {once:false, passive:true});
});
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible'){ ensureAudio(); }
});
