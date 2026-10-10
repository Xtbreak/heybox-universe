/**
 * 小黑盒 · procedural soundtrack and effects, recorded driving engine.
 * Car-only lazy sample: audio/engine-qubodup-loop.wav, qubodup, CC BY 3.0.
 * See audio/ENGINE-LICENSE.txt. No autoplay, storage, or global AudioContext.
 *
 * const audio = createGameAudio();
 * button.addEventListener('pointerdown', () => { void audio.unlock(); });
 * audio.setScene('helmet'); // helmet=flight, robot=FPS, car=driving
 * audio.update({speed: 120, rpm: 5400, throttle: .8, skid: .15}, dt);
 * audio.play('plasma', {pan: -.25, intensity: .8});
 * audio.setPaused(true); // stop sources and suspend after a short click-free fade
 * await audio.dispose(); // final, idempotent teardown
 *
 * Music and other worlds remain procedural; the driving engine uses a credited field recording.
 * Optional contextFactory/document/random injection is intended for deterministic tests.
 */

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const midi = (note) => 440 * 2 ** ((note - 69) / 12);
const SCENES = {
  showcase: {track: 'journey'}, travel: {track: 'journey'},
  helmet: {track: 'play'}, robot: {track: 'play'}, car: {track: 'play'},
};
const ALIASES = {
  gun: 'shot', gunshot: 'shot', shoot: 'shot', fire: 'shot', pistol: 'shot', rifle: 'shot',
  pulse: 'plasma', laser: 'plasma', weapon: 'plasma', rocket: 'missile', railgun: 'rail',
  hit: 'impact', damage: 'impact', playerhit: 'impact', crash: 'collision', hitmetal: 'impact', hitstone: 'impact',
  hitconfirm: 'confirmhit', enemyfire: 'shot', reloadend: 'select', equip: 'select', defeat: 'warning',
  lockon: 'lock', locked: 'lock', targetlock: 'lock', scan: 'lock',
  engineboost: 'boost', nitro: 'boost', afterburner: 'boost',
  collect: 'pickup', ammo: 'pickup', heal: 'pickup', rescue: 'pickup',
  success: 'mission', complete: 'mission', victory: 'mission', missioncomplete: 'mission',
  step: 'footstep', footsteps: 'footstep', gear: 'shift', gearshift: 'shift',
  portal: 'warp', travel: 'warp', transition: 'warp', enter: 'warp',
  shieldhit: 'shield', shieldbreak: 'shield', countermeasure: 'shield', alarm: 'warning',
  ui: 'select', click: 'select', confirm: 'select',
};
const COOLDOWNS = {horn: .45, shot: .052, plasma: .055, rail: .23, missile: .23, reload: .4, impact: .065, collision: .14,
  explosion: .12, lock: .32, boost: .5, pickup: .12, mission: 1.5, footstep: .15, checkpoint: .45,
  shift: .13, warp: .8, shield: .12, select: .065, warning: .65,
  confirmhit: .065, jump: .2, land: .15, throw: .3};

export function createGameAudio(options = {}) {
  const doc = options.document ?? (typeof document === 'undefined' ? null : document);
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const Factory = options.contextFactory || (() => {
    const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Constructor ? new Constructor({latencyHint: 'interactive'}) : null;
  });
  const available = !!options.contextFactory || !!(globalThis.AudioContext || globalThis.webkitAudioContext);
  const volumes = {master: .85, music: .7, effects: .72};
  for (const key of Object.keys(volumes)) if (options.volumes?.[key] != null) volumes[key] = clamp(number(options.volumes[key], volumes[key]));
  let ctx = null, graph = null, noise = null, impulse = null;
  let engineBuffer = null, engineLoad = null, engineAssetStatus = 'idle', engineAssetError = null;
  const fetchAsset = options.fetch || globalThis.fetch?.bind(globalThis);
  const assetAbort = typeof AbortController === 'function' ? new AbortController() : null;
  // Resolve relative to this module, including when published under a nested site path.
  const engineURL = new URL('./audio/engine-qubodup-loop.wav', import.meta.url).href;
  let scene = 'showcase', unlocked = false, disposed = false, paused = false, muted = !!options.muted;
  let hidden = !!doc?.hidden, lastError = null, resumePromise = null, suspendPromise = null;
  let timer = null, suspendTimer = null, lifecycle = 0, running = false;
  let pad = null, ambience = null;
  // CC0 recordings: calm synthwave for the journey, a driving synthwave loop inside worlds.
  const TRACKS = {
    journey: {url: new URL('./audio/journey.m4a', import.meta.url).href, gain: .78},
    play: {url: new URL('./audio/play.m4a', import.meta.url).href, gain: .5},
  };
  let dynamics = {speed: 0, rpm: 900, throttle: 0, skid: 0, boost: 0, intensity: 0};
  let lastGear = null, footstepClock = 0, lastUpdate = null;
  const groups = new Set(), cooldowns = new Map();
  const now = () => ctx?.currentTime || 0;
  const enabled = () => !disposed && !paused && !muted && !hidden && scene !== null;
  const audible = () => enabled() && unlocked && ctx?.state === 'running';
  const ramp = (param, value, time = .08) => {
    if (!param || !ctx) return;
    const t = now();
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(t);
    else {param.cancelScheduledValues(t); param.setValueAtTime(param.value, t);}
    if (time <= 0) param.setValueAtTime(value, t);
    else param.linearRampToValueAtTime(value, t + time);
  };
  const tune = (param, value, time = .09) => {
    if (param) param.setTargetAtTime(value, now(), Math.max(.006, time));
  };
  const disconnect = (node) => {try {node?.disconnect();} catch { /* Already detached. */ }};
  const safeStop = (source, at = now()) => {try {source.stop(at);} catch { /* Already stopped. */ }};
  const makeGain = (value = 1) => {const node = ctx.createGain(); node.gain.value = value; return node;};
  const filter = (type, frequency, q = .7) => {
    const node = ctx.createBiquadFilter(); node.type = type; node.frequency.value = frequency; node.Q.value = q; return node;
  };
  function makeBuffers() {
    const size = Math.ceil(ctx.sampleRate * 3);
    noise = ctx.createBuffer(2, size, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = noise.getChannelData(channel);
      let brown = 0;
      for (let i = 0; i < size; i++) {
        const white = random() * 2 - 1;
        brown = (brown + white * .035) / 1.025;
        data[i] = white * .52 + brown * 2.1;
      }
      // Short seam crossfade makes repeated mechanical beds smooth.
      const seam = Math.min(1024, size >> 3);
      for (let i = 0; i < seam; i++) data[size - seam + i] = data[size - seam + i] * (1 - i / seam) + data[i] * (i / seam);
    }
    const length = Math.ceil(ctx.sampleRate * 2.1);
    impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      let low = 0;
      for (let i = 0; i < length; i++) {
        low = low * .67 + (random() * 2 - 1) * .33;
        data[i] = low * .29 * (1 - i / length) ** 3.2;
      }
      for (const seconds of [.021, .047, .091, .143]) {
        const index = Math.floor((seconds + channel * .007) * ctx.sampleRate);
        if (index < length) data[index] += .16 * (1 - seconds * 3);
      }
    }
  }
  function buildGraph() {
    makeBuffers();
    const mix = makeGain(), master = makeGain(0), music = makeGain(volumes.music), effects = makeGain(volumes.effects);
    const musicSend = makeGain(volumes.music), effectsSend = makeGain(volumes.effects), wet = makeGain(.38);
    const room = ctx.createConvolver(); room.buffer = impulse;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -17; compressor.knee.value = 18; compressor.ratio.value = 4;
    compressor.attack.value = .004; compressor.release.value = .16;
    music.connect(mix); effects.connect(mix); musicSend.connect(room); effectsSend.connect(room);
    room.connect(wet); wet.connect(mix); mix.connect(compressor); compressor.connect(master); master.connect(ctx.destination);
    graph = {mix, master, music, effects, musicSend, effectsSend, room, wet, compressor};
    ctx.onstatechange = () => {
      if (disposed) return;
      if (ctx.state !== 'running') {
        running = false; stopScheduler();
        // A platform interruption must never leave a falsely active music clock.
        if (ctx.state === 'closed') {unlocked = false; lastError = 'Audio context was closed.';}
      } else if (unlocked && enabled()) startRuntime();
    };
  }
  function cleanup(group) {
    if (group.cleaned) return;
    group.cleaned = true;
    for (const node of group.nodes) disconnect(node);
    groups.delete(group);
    if (pad === group) pad = null;
    if (ambience === group) ambience = null;
  }
  function retire(group, fade = .05) {
    if (!group || group.cleaned || group.retiring) return;
    group.retiring = true;
    if (group.source && TRACKS[group.track]) TRACKS[group.track].offset = group.startOffset + (now() - group.startedAt);
    ramp(group.gain.gain, 0, fade);
    group.end = now() + fade + .015;
    for (const source of group.sources) safeStop(source, group.end);
    if (fade === 0) cleanup(group);
  }
  function prune() {
    const t = now();
    for (const group of groups) if (group.end <= t) cleanup(group);
  }
  function makeGroup(kind, at = now(), duration = Infinity, settings = {}) {
    // Bound even rapidly crossfaded scenes and retiring tails, not just active shots.
    if (groups.size >= 64) {
      const victim = [...groups].find((group) => group.retiring) || [...groups].find((group) => group.kind !== 'loop');
      if (victim) {for (const source of victim.sources) safeStop(source); cleanup(victim);}
      else return null;
    }
    const cap = kind === 'effect' ? 32 : 24;
    const pool = [...groups].filter((g) => g.kind === kind && !g.retiring);
    if (kind !== 'loop' && pool.length >= cap) {
      const victim = pool.find((g) => g.priority <= (settings.priority || 0));
      if (!victim) return null;
      retire(victim, 0);
    }
    const gain = makeGain(settings.gain ?? 1), nodes = [gain], sources = [];
    let output = gain;
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner(); panner.pan.value = clamp(number(settings.pan), -1, 1);
      gain.connect(panner); output = panner; nodes.push(panner);
    }
    const isMusic = kind === 'music' || settings.music;
    output.connect(isMusic ? graph.music : graph.effects);
    const send = makeGain(settings.wet ?? .1); output.connect(send); send.connect(isMusic ? graph.musicSend : graph.effectsSend); nodes.push(send);
    const group = {kind, gain, nodes, sources, end: at + duration + .05, cleaned: false, retiring: false, priority: settings.priority || 0};
    groups.add(group);
    return group;
  }
  function addSource(group, source, at = now(), stopAt = null) {
    group.sources.push(source); group.nodes.push(source);
    source.onended = () => {
      source._heyboxEnded = true;
      if (group.sources.every((node) => node._heyboxEnded)) cleanup(group);
    };
    source.start(at);
    if (stopAt != null) safeStop(source, stopAt);
    return source;
  }
  function envelope(param, at, peak, attack, decay, sustain = 0) {
    param.setValueAtTime(0, at);
    param.linearRampToValueAtTime(Math.max(.00001, peak), at + Math.max(.001, attack));
    param.exponentialRampToValueAtTime(Math.max(.00001, sustain), at + Math.max(attack + .002, decay));
    param.linearRampToValueAtTime(0, at + Math.max(attack + .003, decay) + .008);
  }
  function tone(group, at, duration, frequency, settings = {}) {
    if (!group) return null;
    const source = ctx.createOscillator(), gain = makeGain(0);
    source.type = settings.type || 'sine'; source.frequency.setValueAtTime(Math.max(8, frequency), at);
    source.detune.value = settings.detune || 0;
    if (settings.to != null) source.frequency.exponentialRampToValueAtTime(Math.max(8, settings.to), at + duration);
    source.connect(gain);
    if (settings.filter) {
      const low = filter('lowpass', settings.filter, .75); gain.connect(low); low.connect(group.gain); group.nodes.push(low);
    } else gain.connect(group.gain);
    envelope(gain.gain, at, settings.gain ?? .2, settings.attack ?? .003, duration - .013);
    group.nodes.push(gain); addSource(group, source, at, at + duration);
    return source;
  }
  function burst(group, at, duration, settings = {}) {
    if (!group) return null;
    const source = ctx.createBufferSource(), gain = makeGain(0);
    source.buffer = noise; source.loop = true;
    const band = filter(settings.type || 'bandpass', settings.frequency || 1700, settings.q ?? .7);
    source.playbackRate.value = settings.rate || 1;
    source.connect(band); band.connect(gain); gain.connect(group.gain);
    if (settings.to) band.frequency.exponentialRampToValueAtTime(Math.max(30, settings.to), at + duration);
    envelope(gain.gain, at, settings.gain ?? .3, settings.attack ?? .001, duration - .012);
    group.nodes.push(band, gain); addSource(group, source, at, at + duration);
    return source;
  }
  function continuous(group, type, frequency, gainValue, filterFrequency = 4000) {
    const source = type === 'noise' ? ctx.createBufferSource() : ctx.createOscillator();
    if (type === 'noise') {source.buffer = noise; source.loop = true;}
    else {source.type = type; source.frequency.value = frequency;}
    const gain = makeGain(gainValue), low = filter('lowpass', filterFrequency, .65);
    source.connect(low); low.connect(gain); gain.connect(group.gain); group.nodes.push(low, gain);
    addSource(group, source);
    return {source, gain, filter: low};
  }
  function trackData(name) {
    const track = TRACKS[name];
    if (!track.data && fetchAsset && !disposed) {
      track.data = fetchAsset(track.url, {signal: assetAbort?.signal, credentials: 'same-origin'}).then((response) => {
        if (!response.ok) throw new Error(`Music HTTP ${response.status}`);
        return response.arrayBuffer();
      });
      track.data.catch(() => {});
    }
    return track.data;
  }
  function loadTrack(name) {
    const track = TRACKS[name];
    if (!track || track.buffer || track.load || disposed || !ctx) return track?.load;
    const pending = track.load = Promise.resolve(trackData(name)).then(async (data) => {
      if (!data || disposed || track.load !== pending) return;
      const buffer = await ctx.decodeAudioData(data.slice(0));
      if (disposed || track.load !== pending || !buffer?.duration) return;
      track.buffer = buffer;
      attachTrack(pad);
    }).catch((error) => {if (!disposed) track.error = String(error?.message || error);});
    return track.load;
  }
  function attachTrack(group) {
    const track = TRACKS[group?.track];
    if (!track?.buffer || group !== pad || group.retiring || group.cleaned || group.source || !audible()) return;
    const source = ctx.createBufferSource();
    source.buffer = track.buffer; source.loop = true; source.connect(group.gain);
    group.source = source; group.startedAt = now(); group.startOffset = (track.offset || 0) % track.buffer.duration;
    group.sources.push(source); group.nodes.push(source);
    source.start(now(), group.startOffset);
    ramp(group.gain.gain, track.gain, 1.4);
  }
  function startPad() {
    const name = SCENES[scene]?.track;
    if (!name) return;
    pad = makeGroup('loop', now(), Infinity, {gain: 0, music: true, wet: .08});
    pad.track = name;
    attachTrack(pad);
    if (!TRACKS[name].buffer) void loadTrack(name);
    // The in-game track is fetched only once an entry starts, and dropped again when the world closes.
    if (scene === 'travel') void trackData('play');
  }
  function updateRecordedEngine(group, d) {
    if (!group?.recordedEngine) return;
    // A restrained overlapping idle / loaded band avoids chipmunk-like pitch scaling.
    // Both voices are the real field recording, not oscillator approximations.
    const rev = clamp((d.rpm - 850) / 7100), load = clamp(d.throttle + d.boost * .15);
    const blend = clamp((rev - .12) / .72), level = .28 + load * .14;
    const [idle, power] = group.recordedEngine;
    tune(idle.source.playbackRate, .68 + rev * .34, .12);
    tune(power.source.playbackRate, .88 + rev * .77, .10);
    tune(idle.gain.gain, Math.cos(blend * Math.PI / 2) * level, .10);
    tune(power.gain.gain, Math.sin(blend * Math.PI / 2) * level, .10);
    tune(idle.filter.frequency, 850 + load * 850 + rev * 500, .12);
    tune(power.filter.frequency, 1800 + load * 1700 + rev * 1200, .12);
  }
  function attachRecordedEngine(group) {
    // A late download must never resurrect a muted, paused, exited, or retired scene.
    if (!engineBuffer || !group || group !== ambience || group.retiring || group.cleaned ||
        scene !== 'car' || !audible() || group.recordedEngine) return;
    group.recordedEngine = [.68, .88].map((rate) => {
      const source = ctx.createBufferSource(), gain = makeGain(0), low = filter('lowpass', 1500, .6);
      source.buffer = engineBuffer; source.loop = true; source.loopStart = 0; source.loopEnd = engineBuffer.duration;
      source.playbackRate.value = rate;
      source.connect(low); low.connect(gain); gain.connect(group.gain);
      group.nodes.push(low, gain); addSource(group, source);
      return {source, gain, filter: low};
    });
    updateRecordedEngine(group, dynamics);
  }
  function loadRecordedEngine() {
    if (engineLoad || engineBuffer || disposed || scene !== 'car' || !audible()) return engineLoad;
    engineAssetStatus = 'loading';
    engineLoad = Promise.resolve().then(async () => {
      if (!fetchAsset) throw new Error('Audio download is unavailable.');
      const response = await fetchAsset(engineURL, {signal: assetAbort?.signal, credentials: 'same-origin'});
      if (!response.ok) throw new Error(`Engine sample HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      if (disposed) return;
      const buffer = await ctx.decodeAudioData(data);
      if (disposed) return;
      if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('Invalid engine sample.');
      engineBuffer = buffer; engineAssetStatus = 'ready'; engineAssetError = null;
      attachRecordedEngine(ambience);
    }).catch((error) => {
      if (disposed) return;
      engineAssetStatus = 'failed'; engineAssetError = String(error?.message || error);
      // Road, music and effects stay usable if the asset is unavailable; no fetch retry loop.
    });
    return engineLoad;
  }
  function startAmbience() {
    if (!scene || scene === 'showcase') return;
    ambience = makeGroup('loop', now(), Infinity, {gain: 0, wet: scene === 'travel' ? .7 : .035});
    if (scene === 'car') {
      attachRecordedEngine(ambience);
      if (!engineBuffer) void loadRecordedEngine();
      ambience.wind = continuous(ambience, 'noise', 0, 0, 1800);
      ambience.skid = continuous(ambience, 'noise', 0, 0, 2900);
      ambience.skid.filter.type = 'bandpass'; ambience.skid.filter.Q.value = 2.5;
      ambience.tire = continuous(ambience, 'triangle', 590, 0, 2400);
    } else if (scene === 'helmet') {
      ambience.engine = continuous(ambience, 'sawtooth', 47, .04, 300);
      ambience.exhaust = continuous(ambience, 'sine', 91, .055, 440);
      ambience.wind = continuous(ambience, 'noise', 0, .045, 620);
      ambience.turbine = continuous(ambience, 'sine', 430, .012, 1800);
    } else if (scene === 'robot') {
      ambience.wind = continuous(ambience, 'noise', 0, .023, 390);
      ambience.hum = continuous(ambience, 'sine', 54, .021, 300);
    } else {
      ambience.wind = continuous(ambience, 'noise', 0, .045, 1100);
      ambience.engine = continuous(ambience, 'triangle', 37, .035, 550);
    }
    ramp(ambience.gain.gain, 1, .35);
  }
  function schedule() {
    if (!running || !audible()) return;
    prune();
  }
  function stopScheduler() {if (timer !== null) {clearInterval(timer); timer = null;}}
  function clearSuspendTimer() {if (suspendTimer !== null) {clearTimeout(suspendTimer); suspendTimer = null;}}
  function startRuntime() {
    if (!audible() || running) return;
    clearSuspendTimer();
    for (const group of groups) retire(group, 0);
    // Recreating the convolver clears frozen reverb tails after a suspended pause.
    disconnect(graph.room); disconnect(graph.musicSend); disconnect(graph.effectsSend);
    graph.room = ctx.createConvolver(); graph.room.buffer = impulse;
    graph.musicSend.connect(graph.room); graph.effectsSend.connect(graph.room); graph.room.connect(graph.wet);
    startPad(); startAmbience(); running = true;
    ramp(graph.master.gain, volumes.master, .12);
    schedule(); timer = setInterval(schedule, 80);
  }
  function stopRuntime(suspend = true) {
    running = false; stopScheduler(); clearSuspendTimer();
    if (!ctx || !graph || ctx.state === 'closed') return;
    ramp(graph.master.gain, 0, .045);
    for (const group of groups) retire(group, .045);
    const ticket = ++lifecycle;
    suspendTimer = setTimeout(() => {
      suspendTimer = null;
      if (ticket !== lifecycle || disposed || enabled()) return;
      for (const group of groups) retire(group, 0);
      for (const group of [...groups]) cleanup(group);
      if (suspend && ctx.state === 'running') {
        suspendPromise = Promise.resolve(ctx.suspend()).catch((error) => {lastError = String(error?.message || error);}).finally(() => {suspendPromise = null;});
      }
    }, 75);
  }
  async function resumePreviouslyUnlocked() {
    if (!unlocked || !enabled() || !ctx || ctx.state === 'closed') return false;
    clearSuspendTimer(); ++lifecycle;
    if (suspendPromise) await suspendPromise;
    if (!enabled() || disposed) return false;
    if (ctx.state !== 'running') {
      try {await ctx.resume();} catch (error) {lastError = String(error?.message || error); return false;}
    }
    if (enabled() && ctx.state === 'running') {lastError = null; startRuntime(); return true;}
    return false;
  }
  function unlock(event) {
    if (disposed || !available || event?.isTrusted === false) return Promise.resolve(false);
    if (resumePromise) return resumePromise;
    // An initial unlock is a gesture operation. Never create a context on page load.
    const activation = globalThis.navigator?.userActivation;
    if (!ctx && activation && !activation.isActive) return Promise.resolve(false);
    try {
      if (!ctx) {ctx = Factory(); if (!ctx) return Promise.resolve(false); buildGraph();}
      if (ctx.state === 'closed') {lastError = 'Audio context was closed.'; return Promise.resolve(false);}
      clearSuspendTimer(); ++lifecycle;
      // Call resume synchronously, while the invoking gesture is still active.
      const request = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
      resumePromise = Promise.resolve(request).then(async () => {
        if (disposed) return false;
        if (suspendPromise) {await suspendPromise; if (enabled() && ctx.state !== 'running') await ctx.resume();}
        if (ctx.state !== 'running') {lastError = 'Audio is waiting for a browser gesture.'; return false;}
        unlocked = true; lastError = null;
        if (enabled()) startRuntime(); else stopRuntime();
        return true;
      }).catch((error) => {lastError = String(error?.message || error); return false;}).finally(() => {resumePromise = null;});
      return resumePromise;
    } catch (error) {lastError = String(error?.message || error); return Promise.resolve(false);}
  }
  function play(rawName, params = {}) {
    if (!audible() || !running) return false;
    const key = String(rawName || '').toLowerCase().replace(/[\s_-]/g, '');
    const name = ALIASES[key] || key;
    if (!(name in COOLDOWNS)) return false;
    const t = now();
    if (t - (cooldowns.get(name) ?? -Infinity) < COOLDOWNS[name]) return false;
    cooldowns.set(name, t); prune();
    const distanceGain = 1 / (1 + Math.max(0, number(params.distance)) * .032);
    const intensity = clamp(number(params.intensity ?? params.volume, 1), 0, 1.5) * distanceGain;
    if (intensity <= 0 || volumes.effects <= 0) return false;
    const pitch = clamp(number(params.pitch, 1), .5, 2) * (.975 + random() * .05);
    const pan = clamp(number(params.pan), -1, 1);
    let duration = 1;
    if (name === 'explosion') duration = 2;
    if (name === 'mission') duration = 2.8;
    if (name === 'warp') duration = 2.35;
    const g = makeGroup('effect', t, duration, {gain: intensity * .7, pan, wet: ['warp', 'mission', 'pickup', 'shield'].includes(name) ? .6 : .12,
      priority: ['warp', 'mission', 'explosion'].includes(name) ? 2 : name === 'footstep' ? -1 : 0});
    if (!g) return false;
    if (name === 'horn') {
      tone(g,t,.32,370,{to:355,type:'triangle',gain:.26,attack:.018,filter:1500});
      tone(g,t,.28,466,{to:451,type:'triangle',gain:.15,attack:.015,filter:1500});
    } else if (name === 'shot') {
      tone(g, t, .16, 165 * pitch, {to: 46, type: 'triangle', gain: .58, filter: 1300});
      burst(g, t, .11, {type: 'highpass', frequency: 900, gain: .52});
      burst(g, t, .027, {type: 'highpass', frequency: 4500, gain: .32});
      burst(g, t + .03, .07, {frequency: 1250, q: 2, gain: .21});
      tone(g, t + .018, .045, 1800 * pitch, {to: 1050, gain: .045});
      if (params.weapon === 'shotgun') {
        burst(g, t + .008, .23, {type: 'lowpass', frequency: 3200, to: 480, gain: .32});
        tone(g, t, .25, 105, {to: 31, type: 'triangle', gain: .28});
      }
    } else if (name === 'plasma' && params.world === 'flight' && params.weapon === 'laser') {
      // Crisp optical pulse: a bright short chirp and a compact low end, rather
      // than the longer sawtooth plasma tail used elsewhere in the game.
      tone(g, t, .105, 1680 * pitch, {to: 410, type: 'triangle', gain: .27});
      tone(g, t, .065, 3100 * pitch, {to: 1350, gain: .075});
      tone(g, t, .085, 135 * pitch, {to: 48, gain: .22});
      burst(g, t, .028, {type: 'highpass', frequency: 4300, gain: .16});
      burst(g, t + .008, .065, {frequency: 1900, to: 950, q: 1.8, gain: .09});
    } else if (name === 'plasma' || name === 'rail') {
      tone(g, t, .2, (name === 'rail' ? 1280 : 610) * pitch, {to: 92, type: 'sawtooth', gain: .2, filter: 1700});
      tone(g, t, .24, 1140 * pitch, {to: 265, type: 'triangle', gain: .17});
      tone(g, t, .14, 98 * pitch, {to: 38, gain: .3});
      burst(g, t, .12, {frequency: 2800, to: 650, q: 1.4, gain: .17});
      if (name === 'rail') {
        burst(g, t, .045, {type: 'highpass', frequency: 4100, gain: .38});
        tone(g, t, .38, 132, {to: 31, gain: .34});
        burst(g, t + .035, .35, {frequency: 640, to: 120, gain: .22});
      }
    } else if (name === 'missile') {
      burst(g, t, .72, {type: 'lowpass', frequency: 950, to: 2400, gain: .54, attack: .025});
      burst(g, t, .14, {frequency: 2400, gain: .3});
      tone(g, t, .42, 58 * pitch, {to: 123, type: 'sawtooth', filter: 380, gain: .33, attack: .02});
      tone(g, t, .13, 190, {to: 40, gain: .3});
    } else if (name === 'reload') {
      for (const [offset, frequency, amplitude] of [[0, 1600, .21], [.18, 900, .15], [.44, 2200, .24], [.51, 1100, .22]]) {
        burst(g, t + offset, .065, {frequency, q: 1.9, gain: amplitude});
        tone(g, t + offset, .07, frequency * .42, {to: frequency * .27, type: 'triangle', gain: .055});
      }
      burst(g, t + .08, .16, {frequency: 400, gain: .08, attack: .04});
    } else if (name === 'impact' || name === 'collision') {
      const heavy = name === 'collision';
      tone(g, t, heavy ? .35 : .14, heavy ? 98 : 155, {to: 34, type: 'triangle', gain: heavy ? .46 : .26});
      burst(g, t, heavy ? .43 : .1, {type: 'lowpass', frequency: heavy ? 2200 : 3500, to: 230, gain: heavy ? .55 : .28});
      for (const multiplier of [1, 1.47, 2.31]) tone(g, t, .22, (heavy ? 280 : 490) * multiplier * pitch, {gain: .045 / multiplier, type: 'triangle'});
    } else if (name === 'explosion') {
      tone(g, t, .85, 95, {to: 24, gain: .58});
      tone(g, t, .24, 150, {to: 38, type: 'triangle', gain: .37});
      burst(g, t, 1.55, {type: 'lowpass', frequency: 1800, to: 80, gain: .88, attack: .008});
      burst(g, t, .13, {type: 'highpass', frequency: 1800, gain: .37});
      for (const offset of [.21, .34, .52]) burst(g, t + offset, .16, {frequency: 640 + random() * 1300, gain: .11});
    } else if (name === 'shield') {
      for (const [index, ratio] of [1, 1.59, 2.31, 3.13].entries()) tone(g, t, .56 + index * .04, 260 * ratio * pitch, {type: 'triangle', to: 200 * ratio, gain: .095 / (1 + index * .6), attack: .002});
      burst(g, t, .24, {frequency: 2700, to: 820, q: 3, gain: .18});
      tone(g, t, .26, 85, {to: 39, gain: .2});
    } else if (name === 'footstep' || name === 'land') {
      tone(g, t, .085, 115 * pitch, {to: 46, type: 'triangle', gain: .23});
      burst(g, t, .1, {type: 'lowpass', frequency: 780, gain: .18});
      burst(g, t + .032, .07, {frequency: 1600, gain: .045});
      if (name === 'land') {
        tone(g, t, .19, 80, {to: 35, gain: .22});
        burst(g, t, .2, {frequency: 700, gain: .14});
      }
    } else if (name === 'jump' || name === 'throw') {
      burst(g, t, .22, {frequency: name === 'throw' ? 1800 : 800, to: 420, gain: .19, attack: .035});
      if (name === 'throw') burst(g, t, .035, {frequency: 2800, gain: .12});
    } else if (name === 'confirmhit') {
      tone(g, t, .055, 840, {to: 590, type: 'triangle', gain: .1});
      burst(g, t, .028, {frequency: 2200, gain: .06});
      if (params.kill || params.headshot) tone(g, t + .025, .12, params.headshot ? 1568 : 1174, {gain: .085, attack: .003});
    } else if (name === 'lock') {
      for (const [index, note] of [72, 79, 84].entries()) {
        tone(g, t + index * .085, .14, midi(note), {type: 'triangle', gain: .075, attack: .007, filter: 2300});
        tone(g, t + index * .085, .12, midi(note - 12), {gain: .04});
      }
      burst(g, t, .065, {frequency: 1500, gain: .06});
    } else if (name === 'boost') {
      burst(g, t, .84, {type: 'lowpass', frequency: 700, to: 3500, gain: .38, attack: .07});
      tone(g, t, .6, 45, {to: 125, type: 'triangle', gain: .24, attack: .035});
      tone(g, t, .4, 310, {to: 730, gain: .045, attack: .05});
    } else if (name === 'shift') {
      tone(g, t, .12, 148 * pitch, {to: 67, type: 'triangle', gain: .19});
      burst(g, t, .12, {frequency: 1600, q: 1.4, gain: .15});
      burst(g, t + .055, .035, {frequency: 900, gain: .12});
    } else if (name === 'warp') {
      burst(g, t, 1.7, {frequency: 230, to: 3800, q: .65, gain: .43, attack: .45});
      burst(g, t + .8, .9, {type: 'lowpass', frequency: 5000, to: 100, gain: .35, attack: .015});
      tone(g, t, 1.35, 43, {to: 190, type: 'sawtooth', filter: 850, gain: .16, attack: .3});
      tone(g, t + .7, 1.1, 88, {to: 26, gain: .3, attack: .01});
      for (const ratio of [1, 1.5, 2]) tone(g, t + .12, 1.8, 145 * ratio, {to: 530 * ratio, gain: .045 / ratio, attack: .4});
    } else if (name === 'pickup' || name === 'mission' || name === 'checkpoint') {
      const notes = name === 'mission' ? [62, 69, 74, 78, 81] : name === 'checkpoint' ? [62, 69, 74] : [74, 81];
      const spacing = name === 'mission' ? .16 : .075;
      for (const [index, note] of notes.entries()) {
        tone(g, t + index * spacing, name === 'mission' ? 1.75 : .65, midi(note), {gain: .11, attack: .012});
        tone(g, t + index * spacing, .5, midi(note) * 2.006, {gain: .022, attack: .005, type: 'triangle', filter: 3400});
      }
      if (name === 'mission') {
        tone(g, t, 1.7, midi(38), {type: 'triangle', gain: .14, attack: .02});
        burst(g, t, .7, {type: 'lowpass', frequency: 1500, gain: .11, attack: .15});
      }
    } else if (name === 'warning') {
      for (const offset of [0, .19]) {
        tone(g, t + offset, .16, 220, {gain: .075, type: 'triangle', attack: .025});
        tone(g, t + offset, .16, 293.66, {gain: .05, attack: .025});
      }
    } else if (name === 'select') {
      burst(g, t, .027, {frequency: 1900, gain: .07});
      tone(g, t, .08, 440 * pitch, {to: 550, gain: .055, type: 'triangle', attack: .006});
    }
    return true;
  }
  function setScene(value) {
    if (disposed) return;
    const aliases = {flight: 'helmet', space: 'helmet', fps: 'robot', shooter: 'robot', driving: 'car', racing: 'car', menu: 'showcase', lobby: 'showcase', warp: 'travel'};
    let next = String(value ?? 'off').toLowerCase(); next = aliases[next] || next;
    if (['off', 'none', 'exit', 'null'].includes(next)) next = null;
    if (next !== null && !SCENES[next]) return;
    if (scene === next) return;
    if (next === 'showcase' && scene !== 'travel') {const play = TRACKS.play; play.buffer = play.load = play.data = null;}
    scene = next; dynamics = {speed: 0, rpm: 900, throttle: 0, skid: 0, boost: 0, intensity: 0};
    footstepClock = 0; lastGear = null; lastUpdate = null; cooldowns.clear();
    if (!enabled()) {stopRuntime(); return;}
    if (running && audible()) {
      for (const group of groups) if (group.kind === 'loop' || group.kind === 'music') retire(group, .14);
      pad = null; ambience = null;
      startPad(); startAmbience();
    } else if (unlocked) void resumePreviouslyUnlocked();
  }
  function update(state = {}, dt) {
    if (disposed) return;
    if (typeof state.paused === 'boolean' && state.paused !== paused) setPaused(state.paused);
    if (!audible() || !running) return;
    const t = now();
    let delta = number(dt, lastUpdate === null ? 1 / 60 : t - lastUpdate);
    if (delta > 2) delta /= 1000; // Tolerate a frame duration in milliseconds.
    delta = clamp(delta, .001, .1); lastUpdate = t;
    const speed = Math.abs(number(state.speed ?? state.speedKmh ?? state.signedSpeed));
    const throttle = clamp(Math.abs(number(state.throttle ?? state.acceleration, speed > 1 ? .3 : 0)));
    const boost = state.boosting || state.boost || state.nitro ? 1 : 0;
    const skid = clamp(Math.abs(number(state.skid ?? state.drift ?? state.skidding)));
    const gear = state.gear == null ? null : number(state.gear);
    const inferredGear = Math.max(1, Math.min(6, 1 + Math.floor(speed / 48)));
    const rpmInput = number(state.rpm, NaN);
    const rpm = Number.isFinite(rpmInput) ? (rpmInput <= 1.5 ? 850 + clamp(rpmInput) * 7650 : rpmInput) :
      950 + (speed / inferredGear) * 78 + throttle * 1750 + boost * 650;
    const smoothing = 1 - Math.exp(-delta * 8);
    const desired = {speed, rpm: clamp(rpm, 650, 11000), throttle, skid, boost, intensity: clamp(number(state.intensity, throttle * .6 + speed / 800))};
    for (const key of Object.keys(dynamics)) dynamics[key] += (desired[key] - dynamics[key]) * smoothing;
    const a = ambience, d = dynamics;
    if (a && scene === 'car') {
      updateRecordedEngine(a, d);
      tune(a.wind.gain.gain, Math.min(.15, (d.speed / 280) ** 1.55 * .13));
      tune(a.wind.filter.frequency, 800 + d.speed * 5);
      tune(a.skid.gain.gain, d.skid * .2 * clamp(d.speed / 22));
      tune(a.skid.filter.frequency, 1400 + d.skid * 1050);
      tune(a.tire.source.frequency, 590 + d.skid * 290 + Math.sin(t * 34) * 30);
      tune(a.tire.gain.gain, d.skid * .023 * clamp(d.speed / 22));
      if (state.autoShiftSounds && gear != null && lastGear != null && gear !== lastGear) play('shift', {intensity: .6});
      lastGear = gear;
    } else if (a && scene === 'helmet') {
      const thrust = clamp(d.throttle + d.speed / 700 + d.boost * .3);
      tune(a.engine.source.frequency, 39 + thrust * 58 + d.boost * 17);
      tune(a.engine.filter.frequency, 260 + thrust * 540);
      tune(a.engine.gain.gain, .025 + thrust * .045);
      tune(a.exhaust.source.frequency, 78 + thrust * 112);
      tune(a.wind.gain.gain, .025 + thrust * .11);
      tune(a.wind.filter.frequency, 470 + thrust * 1250);
      tune(a.turbine.source.frequency, 380 + thrust * 580);
      tune(a.turbine.gain.gain, .009 + thrust * .014);
    } else if (a && scene === 'travel') {
      tune(a.wind.filter.frequency, 900 + (Math.sin(t * 1.2) * .5 + .5) * 1800);
      tune(a.engine.source.frequency, 37 + (Math.sin(t * .5) * .5 + .5) * 45);
    }
    // Opt in only: providers that emit their own contact-timed footsteps won't double-play.
    if (scene === 'robot' && state.autoFootsteps && (state.moving || state.isMoving) && !state.airborne) {
      footstepClock += delta;
      const cadence = state.sprinting ? .29 : .43;
      if (footstepClock >= cadence) {footstepClock %= cadence; play('footstep', {intensity: state.sprinting ? .76 : .53, pan: Math.sin(t * 10) * .13});}
    } else footstepClock = 0;
  }
  function setPaused(value) {
    if (disposed || paused === !!value) return;
    paused = !!value;
    if (!enabled()) stopRuntime(); else if (unlocked) void resumePreviouslyUnlocked();
  }
  function setMuted(value) {
    if (disposed || muted === !!value) return;
    muted = !!value;
    if (!enabled()) stopRuntime(); else if (unlocked) void resumePreviouslyUnlocked();
  }
  function setVolumes(values = {}) {
    if (disposed) return;
    for (const key of Object.keys(volumes)) if (values[key] != null) volumes[key] = clamp(number(values[key], volumes[key]));
    if (graph) {
      ramp(graph.music.gain, volumes.music, .08); ramp(graph.musicSend.gain, volumes.music, .08);
      ramp(graph.effects.gain, volumes.effects, .08); ramp(graph.effectsSend.gain, volumes.effects, .08);
      ramp(graph.master.gain, audible() ? volumes.master : 0, .08);
    }
  }
  function getState() {
    let status = 'locked';
    if (disposed) status = 'disposed';
    else if (!available) status = 'unavailable';
    else if (hidden) status = 'hidden';
    else if (muted) status = 'muted';
    else if (paused || scene === null) status = 'paused';
    else if (resumePromise) status = 'starting';
    else if (audible() && running) status = 'running';
    else if (unlocked) status = 'suspended';
    return {available, unlocked: unlocked && !disposed, status, scene, paused, muted, hidden,
      music: pad?.source ? pad.track : null, engineAssetStatus, engineAssetError, volumes: {...volumes}, contextState: ctx?.state || 'not-created', error: lastError,
      needsGesture: !disposed && available && enabled() && (!unlocked || ctx?.state !== 'running'),
      activeVoices: [...groups].filter((group) => !group.cleaned && !group.retiring).length,
      running: running && audible()};
  }
  function reset(settings = {}) {
    if (disposed) return;
    for (const group of groups) retire(group, 0);
    running = false; stopScheduler(); cooldowns.clear();
    dynamics = {speed: 0, rpm: 900, throttle: 0, skid: 0, boost: 0, intensity: 0};
    lastGear = null; footstepClock = 0; lastUpdate = null;
    if (settings.scene != null) setScene(settings.scene);
    if (typeof settings.paused === 'boolean') paused = settings.paused;
    if (enabled() && unlocked) void resumePreviouslyUnlocked(); else stopRuntime();
  }
  const visibilityChanged = () => {
    hidden = !!doc?.hidden;
    if (!enabled()) stopRuntime(); else if (unlocked) void resumePreviouslyUnlocked();
  };
  const pageHidden = () => {hidden = true; stopRuntime();};
  const pageShown = () => {hidden = !!doc?.hidden; if (enabled() && unlocked) void resumePreviouslyUnlocked();};
  doc?.addEventListener?.('visibilitychange', visibilityChanged);
  const win = doc?.defaultView || (typeof window === 'undefined' ? null : window);
  win?.addEventListener?.('pagehide', pageHidden);
  win?.addEventListener?.('pageshow', pageShown);
  let disposal = null;
  function dispose() {
    if (disposed) return disposal || Promise.resolve();
    disposed = true; unlocked = false; running = false; ++lifecycle;
    assetAbort?.abort(); engineBuffer = null; engineLoad = null;
    for (const track of Object.values(TRACKS)) {track.buffer = null; track.load = null; track.data = null;}
    stopScheduler(); clearSuspendTimer();
    doc?.removeEventListener?.('visibilitychange', visibilityChanged);
    win?.removeEventListener?.('pagehide', pageHidden); win?.removeEventListener?.('pageshow', pageShown);
    if (graph) ramp(graph.master.gain, 0, 0);
    for (const group of [...groups]) {retire(group, 0); cleanup(group);}
    if (ctx) ctx.onstatechange = null;
    if (graph) for (const node of Object.values(graph)) disconnect(node);
    noise = null; impulse = null; pad = null; ambience = null;
    try {disposal = ctx && ctx.state !== 'closed' ? Promise.resolve(ctx.close()).catch(() => {}) : Promise.resolve();}
    catch {disposal = Promise.resolve();}
    return disposal;
  }
  return {unlock, setScene, update, play, setPaused, setMuted, setVolumes, getState, reset, dispose};
}

export default createGameAudio;
