
const CONFIG = {
    topic:   'DẤU ẤN THỜI GIAN',
    klass:   'THPT Ngô Sĩ Liên-12A5',
    //author:  'Nhóm thực hiện: Họ và tên',  // để '' nếu không muốn hiện
    videos:  [
        ' ',
        {src:'video2.mp4', title:'Phần 2'},  
    ],
    T: { charge:2.4, blast:2.4, form:3.0, formDur:2.5, title:4.9, warpStart:9.0, warpDur:1.5, end:10.6 }
};

const qs = new URLSearchParams(location.search);
if (qs.get('topic'))  CONFIG.topic  = qs.get('topic');
if (qs.get('class'))  CONFIG.klass  = qs.get('class');
if (qs.has('author')) CONFIG.author = qs.get('author');
if (qs.get('videos')) CONFIG.videos = qs.get('videos').split(',').map(x => x.trim()).filter(Boolean);

const T = CONFIG.T;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

/* ---------- Tiêu đề ---------- */
const titleEl = $('title'), topicEl = $('topic');
CONFIG.topic.trim().split(/\s+/).forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'word'; s.style.setProperty('--i', i); s.textContent = w;
    topicEl.append(s, ' ');
});
$('klass').textContent = CONFIG.klass;
$('author').textContent = CONFIG.author;
if (!CONFIG.author) $('author').style.display = 'none';

/* ---------- Helpers ---------- */
const clamp01 = x => Math.min(1, Math.max(0, x));
const lerp = (a,b,t) => a + (b-a)*t;
const easeOut = t => 1 - Math.pow(1-t, 3);
const smooth = (a,b,x) => { const t = clamp01((x-a)/(b-a)); return t*t*(3-2*t); };
const easeInOut = t => t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;

/* ================= THREE.JS ================= */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, powerPreference:'high-performance' });
const PR = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2);
renderer.setPixelRatio(PR);
renderer.setClearColor(0x03040c, 1);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);

/* ---------- Hạt không gian ---------- */
const N = innerWidth < 700 ? 55000 : 100000;
const aDir = new Float32Array(N*3), aRingPos = new Float32Array(N*3), aColor = new Float32Array(N*3);
const aSeed = new Float32Array(N), aRing = new Float32Array(N), dummy = new Float32Array(N*3);

const palHot = [new THREE.Color('#ff8a3d'), new THREE.Color('#ff5c8a')];
const palViolet = new THREE.Color('#8a6bff'), palCyan = new THREE.Color('#5ef2ee');
const tmp = new THREE.Color();

for (let i = 0; i < N; i++){
    const u = Math.random()*2-1, th = Math.random()*Math.PI*2, sq = Math.sqrt(1-u*u);
    aDir[i*3] = sq*Math.cos(th); aDir[i*3+1] = u; aDir[i*3+2] = sq*Math.sin(th);
    aSeed[i] = Math.random();

    const cr = Math.random();
    if (cr < .4) tmp.copy(palHot[0]).lerp(palHot[1], Math.random());
    else if (cr < .75) tmp.copy(palViolet).lerp(palCyan, Math.random()*.3);
    else tmp.copy(palCyan).lerp(palViolet, Math.random()*.25);
    aColor[i*3] = tmp.r; aColor[i*3+1] = tmp.g; aColor[i*3+2] = tmp.b;

    const m = i % 100, a0 = Math.random(), b = Math.random()*Math.PI*2;
    let R, r, ring, a, z = null;
    if (m < 34)      { ring = 0; R = 12;  r = Math.sqrt(Math.random())*.5;  a = ((Math.floor(a0*60) + Math.random()*.6)/60)*Math.PI*2; }
    else if (m < 60) { ring = 1; R = 8.8; r = Math.sqrt(Math.random())*.42; a = a0*Math.PI*2; }
    else if (m < 78) { ring = 2; R = 5.6; r = Math.sqrt(Math.random())*.34; a = ((Math.floor(a0*24) + Math.random()*.5)/24)*Math.PI*2; }
    else             { ring = 3; R = 13.5 + Math.random()*10; r = 0; a = a0*Math.PI*2; z = (Math.random()-.5)*7; }
    aRing[i] = ring;
    aRingPos[i*3]   = (R + r*Math.cos(b)) * Math.cos(a);
    aRingPos[i*3+1] = (R + r*Math.cos(b)) * Math.sin(a);
    aRingPos[i*3+2] = z !== null ? z : r*Math.sin(b);
}

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(dummy, 3));
geo.setAttribute('aDir',     new THREE.BufferAttribute(aDir, 3));
geo.setAttribute('aRingPos', new THREE.BufferAttribute(aRingPos, 3));
geo.setAttribute('aColor',   new THREE.BufferAttribute(aColor, 3));
geo.setAttribute('aSeed',    new THREE.BufferAttribute(aSeed, 1));
geo.setAttribute('aRing',    new THREE.BufferAttribute(aRing, 1));

const pMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uTime:{value:0}, uCharge:{value:0}, uBlast:{value:0}, uForm:{value:0}, uPR:{value:PR}, uSize:{value:1.9} },
    vertexShader:`
        uniform float uTime, uCharge, uBlast, uForm, uPR, uSize;
        attribute vec3 aDir, aRingPos, aColor; attribute float aSeed, aRing;
        varying vec3 vColor; varying float vAlpha;
        mat2 rot(float a){ float s = sin(a), c = cos(a); return mat2(c,-s,s,c); }
        void main(){
            float s = aSeed;
            float R0 = 4.0 + 30.0 * pow(fract(s*7.13), 0.75);
            vec3 p = aDir * R0;
            p.xz = rot(uTime * 0.08 * (1.0 + fract(s*3.1))) * p.xz;

            float c = uCharge, ce = c*c*(3.0 - 2.0*c);
            float pull = pow(ce, 1.6);
            float rr = mix(R0, 0.25 + 0.6*fract(s*5.7), pull);
            p = normalize(p + 1e-4) * rr;
            p.xz = rot(c*c*14.0*(0.4 + fract(s*9.1))) * p.xz;
            p.y *= 1.0 - 0.6*ce;

            float b = uBlast, be = 1.0 - pow(1.0 - b, 3.0);
            float Rb = 3.0 + 34.0 * pow(fract(s*11.7), 0.6);
            vec3 bp = aDir * (0.3 + Rb*be);
            bp.xz = rot(be * 1.2 * (fract(s*2.3) - 0.5)) * bp.xz;
            p = mix(p, bp, clamp(b*40.0, 0.0, 1.0));

            float m = clamp((uForm - fract(s*13.3)*0.45) / 0.55, 0.0, 1.0);
            m = m*m*(3.0 - 2.0*m);
            vec3 t = aRingPos;
            float rs = aRing < 0.5 ? 0.22 : (aRing < 1.5 ? -0.4 : (aRing < 2.5 ? 0.7 : -0.1));
            t.xy = rot(uTime * rs) * t.xy;
            t.xy *= 1.0 + 0.025 * sin(uTime*2.0 + length(t.xy)*0.8);
            p = mix(p, t, m);
            float k = sin(m * 3.14159);
            p += vec3(sin(s*40.0 + uTime*2.0), cos(s*33.0 - uTime*2.0), sin(s*27.0 + uTime)) * k * 2.2;

            vec3 rc = aRing < 0.5 ? vec3(0.37,0.95,0.93) : (aRing < 1.5 ? vec3(0.54,0.42,1.0) : (aRing < 2.5 ? vec3(1.0,0.48,0.42) : vec3(1.0,0.85,0.6)));
            vColor = mix(aColor, rc, m * 0.85);
            vColor += vec3(1.0,0.85,0.6) * smoothstep(3.0, 0.0, length(p)) * ce * (1.0 - m) * 1.4;

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vAlpha = (0.55 + 0.45*fract(s*23.7)) * (0.75 + 0.25*sin(uTime*3.0 + s*50.0));
            float size = uSize * uPR * (0.5 + 1.3*fract(s*17.3)) * (34.0 / max(-mv.z, 0.1));
            gl_PointSize = clamp(size, 0.0, 60.0 * uPR);
            gl_Position = projectionMatrix * mv;
        }`,
    fragmentShader:`
        varying vec3 vColor; varying float vAlpha;
        void main(){
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d); a *= a;
            gl_FragColor = vec4(vColor, a * vAlpha);
        }`
});
scene.add(new THREE.Points(geo, pMat));

/* ---------- Bụi sao & Lõi phát sáng ---------- */
{
    const M = 2600, sp = new Float32Array(M*3);
    for (let i = 0; i < M; i++){
        const r = 110 + Math.random()*260, u = Math.random()*2-1, th = Math.random()*Math.PI*2, s = Math.sqrt(1-u*u);
        sp[i*3] = r*s*Math.cos(th); sp[i*3+1] = r*u; sp[i*3+2] = r*s*Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size:1.1*PR, sizeAttenuation:false, color:0x9fb0ff, transparent:true, opacity:.5, depthWrite:false })));
}

function glowTex(){
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), gr = g.createRadialGradient(128,128,0,128,128,128);
    gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.18,'rgba(255,232,196,.9)');
    gr.addColorStop(.5,'rgba(255,120,100,.28)'); gr.addColorStop(1,'rgba(255,120,100,0)');
    g.fillStyle = gr; g.fillRect(0,0,256,256);
    return new THREE.CanvasTexture(c);
}
const core = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex(), color:0xffe6c8, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
scene.add(core);

/* ---------- Sóng xung kích & Vành cơ khí ---------- */
const waveGeo = new THREE.RingGeometry(.965, 1, 160);
const waves = [
    { t:T.blast,      d:1.7, max:70, c:0xffffff, a:1,  tilt:0 },
    { t:T.blast+.18,  d:2.0, max:60, c:0xff7a6b, a:.9, tilt:1.15 },
    { t:T.blast+.36,  d:2.2, max:80, c:0x5ef2ee, a:.8, tilt:-.7 },
    { t:T.title,      d:1.5, max:34, c:0x8a6bff, a:.9, tilt:0 },
].map(w => {
    w.m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color:w.c, transparent:true, opacity:0, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false }));
    w.m.rotation.x = w.tilt; w.m.visible = false; scene.add(w.m); return w;
});

const mkTorus = (R, tube, color) => new THREE.Mesh(
    new THREE.TorusGeometry(R, tube, 10, 280),
    new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
const structRings = [ {m:mkTorus(12, .03, 0x5ef2ee), rs:.22}, {m:mkTorus(8.8, .035, 0x8a6bff), rs:-.4}, {m:mkTorus(5.6, .03, 0xff7a6b), rs:.7} ];
const gyros = [ {m:mkTorus(15, .022, 0xffd9a0), ax:1.25, sp:.18}, {m:mkTorus(16.4, .018, 0x5ef2ee), ax:-.95, sp:-.14} ];
[...structRings, ...gyros].forEach(o => { o.m.visible = false; scene.add(o.m); });

/* ---------- Vệt sáng Hyperspace ---------- */
const SN = 1500, sPos = new Float32Array(SN*6), sEnd = new Float32Array(SN*2), sMix = new Float32Array(SN*2);
for (let i = 0; i < SN; i++){
    const ang = Math.random()*Math.PI*2, r = 3.4 + Math.pow(Math.random(), 1.4)*34, z = -170 + Math.random()*200;
    const x = Math.cos(ang)*r, y = Math.sin(ang)*r, len = .4 + Math.random()*1.3, mx = Math.random();
    sPos.set([x,y,z, x,y,z], i*6); sEnd[i*2] = 0; sEnd[i*2+1] = len; sMix[i*2] = sMix[i*2+1] = mx;
}
const sGeo = new THREE.BufferGeometry();
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
sGeo.setAttribute('aEnd', new THREE.BufferAttribute(sEnd, 1));
sGeo.setAttribute('aMix', new THREE.BufferAttribute(sMix, 1));
const sMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, uniforms:{ uStreak:{value:0} },
    vertexShader:`
        uniform float uStreak; attribute float aEnd, aMix; varying float vA; varying float vM;
        void main(){
            vec3 p = position; p.z -= aEnd * uStreak * 26.0;
            vA = uStreak * (aEnd > 0.001 ? 0.12 : 1.0); vM = aMix;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
    fragmentShader:`
        varying float vA; varying float vM;
        void main(){ gl_FragColor = vec4(mix(vec3(0.5,0.95,1.0), vec3(1.0,0.6,0.85), vM) * 1.3, vA); }`
});
const streaks = new THREE.LineSegments(sGeo, sMat); streaks.visible = false; streaks.frustumCulled = false; scene.add(streaks);

/* ---------- Hậu kỳ (Post-processing) ---------- */
const RGBShift = {
    uniforms:{ tDiffuse:{value:null}, amount:{value:0} },
    vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader:`
        uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
        void main(){
            vec2 d = vUv - 0.5; vec2 off = d * length(d) * amount * 6.0;
            gl_FragColor = vec4(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b, 1.0);
        }`
};
let composer = null, bloom = null, shift = null;
if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass && THREE.ShaderPass){
    composer = new THREE.EffectComposer(renderer);
    composer.setPixelRatio(PR);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .85, .6, .08);
    composer.addPass(bloom);
    shift = new THREE.ShaderPass(RGBShift);
    composer.addPass(shift);
}

let distScale = 1;
function resize(){
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    camera.aspect = w / h;
    distScale = Math.min(2.2, Math.max(1, 1.3 / camera.aspect));
    camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ================= PLAYLIST & VIDEO ================= */
const stage = $('stage'), flash = $('flash'), skipBtn = $('skip'), gate = $('gate');
const sources = CONFIG.videos.map(v => typeof v === 'string' ? { src:v, title:'' } : v);
const vids = [$('vidA'), $('vidB')];
const wipe = $('wipe'), ring = $('ring'), cap = $('cap');
const FEATHER = 60;
let cur = 0, active = 0, busy = false;

function loadInto(el, i){ if (i < sources.length){ el.src = sources[i].src; el.load(); } }
loadInto(vids[0], 0); loadInto(vids[1], 1);
function startFirst(){ const v = vids[0]; v.classList.add('active'); v.currentTime = 0; v.play().catch(() => {}); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
function tween(ms, fn){
    return new Promise(res => {
        const s = performance.now();
        (function step(n){ const p = clamp01((n - s) / ms); fn(p); p < 1 ? requestAnimationFrame(step) : res(); })(s);
    });
}
function whenReady(el, ms = 6000){
    return new Promise(res => {
        if (el.readyState >= 3 || el.error) return res();
        const done = () => { el.removeEventListener('canplay', done); res(); };
        el.addEventListener('canplay', done); setTimeout(res, ms);
    });
}
const maxR = () => Math.hypot(innerWidth, innerHeight) / 2 + FEATHER + 4;
function setMask(r, mode){
    const a = Math.max(r - FEATHER, 0);
    const g = mode === 'cover'
        ? `radial-gradient(circle at 50% 50%, #000 ${a}px, transparent ${r}px)`
        : `radial-gradient(circle at 50% 50%, transparent ${a}px, #000 ${r}px)`;
    wipe.style.webkitMaskImage = wipe.style.maskImage = g;
    ring.style.width = ring.style.height = Math.max(r - FEATHER * .5, 0) * 2 + 'px';
    ring.style.opacity = r > 2 ? 1 : 0;
}
async function cover(){ wipe.style.display = ring.style.display = 'block'; await tween(1000, p => setMask(maxR() * easeInOut(p), 'cover')); }
async function reveal(){ await tween(1100, p => setMask(maxR() * easeInOut(p), 'reveal')); wipe.style.display = ring.style.display = 'none'; }

async function next(){
    if (busy) return;
    const n = cur + 1;
    if (n >= sources.length){ $('replay').classList.add('on'); return; }
    busy = true;
    const from = vids[active], to = vids[1 - active];
    await cover();
    await whenReady(to);
    if (to.error){ await reveal(); $('replay').classList.add('on'); busy = false; return; }
    from.pause(); from.classList.remove('active');
    to.classList.add('active'); to.currentTime = 0;
    active = 1 - active; cur = n;
    const title = sources[n].title;
    if (title){ cap.textContent = title; cap.classList.add('on'); await sleep(1500); cap.classList.remove('on'); await sleep(350); }
    else await sleep(150);
    to.play().catch(() => {});
    await reveal();
    loadInto(from, n + 1);
    busy = false;
}
vids.forEach(v => {
    v.addEventListener('ended', () => { if (v === vids[active]) next(); });
    v.addEventListener('play',  () => $('replay').classList.remove('on'));
});

/* ================= TIMELINE ANIMATION ================= */
let started = false, done = false, t0 = 0, titleShown = false, leaving = false;
const rnd = () => Math.random() - .5;

function frame(){
    if (done) return;
    requestAnimationFrame(frame);
    const now = performance.now() / 1000;
    const t = started ? now - t0 : 0;
    pMat.uniforms.uTime.value = now;

    const c  = clamp01(t / T.charge), ce = c*c*(3 - 2*c);
    const bt = t - T.blast;
    const f  = easeInOut(clamp01((t - T.form) / T.formDur));
    pMat.uniforms.uCharge.value = c;
    pMat.uniforms.uBlast.value  = clamp01(bt / 1.3);
    pMat.uniforms.uForm.value   = f;

    let cs, co;
    if (t < T.blast){ cs = .9 + Math.sin(now*3)*.08*(1-c) + 10*Math.pow(ce, 2.2); co = .6 + .4*ce; }
    else { const q = clamp01(bt / .7); cs = 10 + 28*easeOut(q); co = 1 - q; }
    core.scale.set(cs, cs, 1); core.material.opacity = co; core.visible = co > .01;

    waves.forEach(w => {
        const p = clamp01((t - w.t) / w.d), on = started && t >= w.t && p < 1;
        w.m.visible = on;
        if (on){ w.m.scale.setScalar(.5 + w.max*easeOut(p)); w.m.material.opacity = Math.pow(1 - p, 1.6) * w.a; }
    });

    const so = smooth(.35, 1, f);
    structRings.forEach(o => { o.m.visible = so > .01; o.m.material.opacity = so * .9; o.m.rotation.z = -now * o.rs; });
    gyros.forEach(o => { o.m.visible = so > .01; o.m.material.opacity = so * .55; o.m.rotation.x = o.ax + now*.12; o.m.rotation.y = now * o.sp; });

    let z, fov, sh = 0;
    if (t < T.blast){
        z = lerp(44, 32, ce) + (started ? 0 : Math.sin(now*.4) * .8);
        fov = 55 - 8*ce; sh = Math.pow(c, 3) * .9;
    } else {
        const q = clamp01(bt / 2);
        z = lerp(32, 34, easeOut(q)) + 5 * Math.sin(clamp01(bt / 1.2) * Math.PI);
        fov = lerp(47, 55, easeOut(q)) + 16 * Math.exp(-bt * 3.5);
        sh = 1.2 * Math.exp(-bt * 4);
    }
    if (reduceMotion) sh = 0;
    z *= distScale;
    const w = clamp01((t - T.warpStart) / T.warpDur), we = w*w*w;
    z -= we * (34 * distScale + 14);
    camera.fov = fov + (reduceMotion ? 0 : we * 60);
    camera.updateProjectionMatrix();
    camera.position.set(Math.sin(now*.22) * (t < T.blast ? 2.5 : 1.3) + rnd()*sh, Math.sin(now*.17) * 1.2 + rnd()*sh, z);
    camera.lookAt(0, 0, 0);
    camera.rotation.z += rnd()*sh*.012 + (reduceMotion ? 0 : we * .6);

    sMat.uniforms.uStreak.value = we; streaks.visible = we > .01;

    let bs, sa;
    if (t < T.blast){ bs = .85 + 1.6*c*c; sa = .0004 + .002*c*c; }
    else { bs = .95 + 3.4*Math.exp(-bt * 2); sa = .012 * Math.exp(-bt * 3); }
    bs += we * 3.2; sa += we * .012;
    if (bloom) bloom.strength = bs;
    if (shift) shift.uniforms.amount.value = reduceMotion ? 0 : sa;
    const fBlast = (started && bt >= 0) ? .85 * Math.exp(-bt * 6) : 0;
    flash.style.opacity = Math.max(fBlast, smooth(.68, .96, w));

    if (started && !titleShown && t >= T.title){ titleShown = true; titleEl.classList.add('show'); }
    if (started && !leaving && t >= T.warpStart){ leaving = true; titleEl.classList.add('leave'); }

    composer ? composer.render() : renderer.render(scene, camera);
    if (started && t >= T.end) finish(false);
}

function finish(skipped){
    if (done) return; done = true;
    skipBtn.classList.remove('on');
    titleEl.classList.add('leave');
    if (skipped){ flash.style.transition = 'none'; flash.style.opacity = 1; void flash.offsetWidth; }
    stage.classList.add('on');
    startFirst();
    flash.style.transition = 'opacity 1.4s ease';
    requestAnimationFrame(() => { flash.style.opacity = 0; });
    setTimeout(() => { canvas.style.display = 'none'; $('vig').style.display = 'none'; renderer.dispose(); geo.dispose(); pMat.dispose(); }, 1600);
}

$('startBtn').addEventListener('click', () => {
    if (started) return;
    started = true; t0 = performance.now() / 1000;
    gate.classList.add('gone'); skipBtn.classList.add('on');
});
skipBtn.addEventListener('click', () => finish(true));
$('replay').addEventListener('click', () => location.reload());

requestAnimationFrame(frame);