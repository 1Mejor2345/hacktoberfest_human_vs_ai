import { TURN_MS, migrateTurnDuration, createSession, currentId, beginTurn, expireTurn, revealAnswer, advanceTurn, nextRound, validSession } from './flow.js';
import { DEFAULT_FRAMING, normalizeFraming, restoreFraming, fitFrame } from './framing.js';
import { MaterialAmplifier, normalizeBoost } from './amplifier.js';

const $ = id => document.getElementById(id);
const KEY = 'human-vs-ia-presentation-v2';
let bank = new Map();
let session = null;
let activeMedia = null;
let activeAsset = null;
let mediaReady = false;
let loadToken = 0;
let tick = null;
let warningTimeout;
const BOOST_KEY = 'human-vs-ia-material-boost-v1';
let savedBoost = 1;
try { savedBoost = normalizeBoost(localStorage.getItem(BOOST_KEY)); } catch { /* Normal sound by default. */ }
const amplifier = new MaterialAmplifier(window.AudioContext || window.webkitAudioContext, savedBoost);

function updateBoost(value) {
  const amount = amplifier.set(value);
  $('material-boost').value = amount;
  $('boost-value').textContent = amount + '×';
  try { localStorage.setItem(BOOST_KEY, String(amount)); } catch { /* Keep the setting in memory. */ }
  if (activeMedia?.play) prepareSound(activeMedia);
}

function prepareSound(media) {
  try { amplifier.attach(media); }
  catch { notify('No se pudo activar la amplificación. Prueba el volumen normal del reproductor.'); }
}
$('material-boost').addEventListener('input', () => updateBoost($('material-boost').value));
$('boost-reset').onclick = () => updateBoost(1);
$('material-boost').value = savedBoost;
$('boost-value').textContent = savedBoost + '×';
if (!amplifier.Context) {
  $('material-boost').disabled = true;
  $('boost-reset').disabled = true;
  $('boost-help').textContent = 'Este navegador solo permite el volumen normal del reproductor.';
}
const FRAMING_KEY = 'human-vs-ia-framing-v2';
let framing = { ...DEFAULT_FRAMING };
try {
  const saved = JSON.parse(localStorage.getItem(FRAMING_KEY));
  const legacy = saved == null ? JSON.parse(localStorage.getItem('human-vs-ia-framing-v1')) : null;
  framing = restoreFraming(saved, legacy);
  if (saved == null && legacy != null) localStorage.setItem(FRAMING_KEY, JSON.stringify(framing));
} catch { /* Use the default frame. */ }

function fitMedia() {
  const frame = $('media-frame');
  if (!frame || !activeMedia) return;
  const stage = $('stage');
  const box = fitFrame(stage.clientWidth, stage.clientHeight,
    activeMedia.videoWidth || activeMedia.naturalWidth,
    activeMedia.videoHeight || activeMedia.naturalHeight, framing);
  if (!box) return;
  frame.style.width = box.width + 'px';
  frame.style.height = box.height + 'px';
  Object.assign(activeMedia.style, { width: box.mediaWidth + 'px', height: box.mediaHeight + 'px', left: box.left + 'px', top: box.top + 'px' });
}

function updateFraming() {
  $('zoom').value = framing.zoom;
  $('crop-bottom').value = framing.crop;
  $('zoom-value').textContent = framing.zoom + '%';
  $('crop-value').textContent = framing.crop + '%';
  fitMedia();
}

for (const id of ['zoom', 'crop-bottom']) $(id).addEventListener('input', () => {
  framing = normalizeFraming({ zoom: Number($('zoom').value), crop: Number($('crop-bottom').value) });
  try { localStorage.setItem(FRAMING_KEY, JSON.stringify(framing)); } catch { /* Keep the current settings in memory. */ }
  updateFraming();
});
$('framing-reset').onclick = () => {
  framing = { ...DEFAULT_FRAMING };
  try { localStorage.setItem(FRAMING_KEY, JSON.stringify(framing)); } catch { /* The current view still resets. */ }
  updateFraming();
};
window.addEventListener('resize', fitMedia);
new ResizeObserver(fitMedia).observe($('stage'));
document.addEventListener('pointerdown', event => {
  const menu = $('framing-menu');
  if (menu.open && !menu.contains(event.target)) menu.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('framing-menu').open) {
    $('framing-menu').open = false;
    $('framing-menu').querySelector('summary').focus();
  }
});
updateFraming();

function notify(message) {
  $('notice').textContent = message;
  $('notice').hidden = false;
  clearTimeout(warningTimeout);
  warningTimeout = setTimeout(() => { $('notice').hidden = true; }, 6500);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(session)); }
  catch { notify('No se pudo guardar el historial. Mantén esta pestaña abierta para evitar repeticiones.'); }
}

function show(view) {
  document.body.classList.toggle('presenting', view === 'game');
  window.HumanMusic?.setScene(view === 'welcome' ? 'welcome' : view === 'exhausted' ? 'finish' : 'early', { paused: view === 'game' && session?.phase === 'running' });
  window.scrollTo({ top: 0, behavior: 'instant' });
  for (const id of ['welcome', 'game', 'round-end', 'exhausted']) $(id).hidden = id !== view;
}

function stopClock() {
  clearInterval(tick);
  tick = null;
}

function stopMedia() {
  activeMedia?.pause?.();
}

function releaseMedia() {
  loadToken++;
  stopMedia();
  amplifier.detach();
  if (activeMedia && ['AUDIO', 'VIDEO'].includes(activeMedia.tagName)) {
    activeMedia.removeAttribute('src');
    activeMedia.load();
  }
  activeMedia = null;
  activeAsset = null;
  mediaReady = false;
  $('media-slot').replaceChildren();
}

function setCurtain(caption, title, copy) {
  $('curtain-caption').textContent = caption;
  $('curtain-title').textContent = title;
  $('curtain-copy').textContent = copy;
}

function setAction(label, disabled = false) {
  $('action').textContent = label;
  $('action').disabled = disabled;
  $('action').hidden = false;
}

function renderTimer() {
  const seconds = session.phase === 'running' ? Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000)) : session.phase === 'ready' ? TURN_MS / 1000 : 0;
  $('time').textContent = seconds;
  document.querySelector('.clock').classList.toggle('urgent', session.phase === 'running' && seconds <= 5);
}

function updateClock() {
  if (expireTurn(session)) {
    // Hide the original before exposing any answer control.
    $('media-slot').hidden = true;
    $('stage').className = 'stage blank';
    stopMedia();
    stopClock();
    save();
    render();
    $('action').focus({ preventScroll: true });
  } else renderTimer();
}

function armClock() {
  stopClock();
  if (session.phase !== 'running') return;
  updateClock();
  if (session.phase === 'running') tick = setInterval(updateClock, 100);
}

function loadMedia() {
  const asset = currentId(session);
  if (activeAsset === asset) return;
  releaseMedia();
  activeAsset = asset;
  const token = loadToken;
  const material = bank.get(asset);
  const el = document.createElement({ image: 'img', audio: 'audio', video: 'video' }[material.tipo]);
  activeMedia = el;
  const onReady = () => {
    if (token !== loadToken || mediaReady) return;
    mediaReady = true;
    fitMedia();
    $('retry').hidden = true;
    $('replace').hidden = true;
    if (session.phase === 'ready') {
      $('status').textContent = 'Todo listo. Esperando Start.';
      setAction('Start');
    } else if (session.phase === 'running') {
      updateClock();
      if (session.phase === 'running') {
        prepareSound(el);
        el.play?.().catch(() => notify('El navegador bloqueó el sonido. Usa los controles del reproductor.'));
      }
    }
  };
  el.addEventListener('error', () => {
    if (token !== loadToken) return;
    mediaReady = false;
    if (session.phase === 'running') {
      session.phase = 'blank';
      session.deadline = null;
      save();
      render();
      notify('La reproducción falló. Puedes revelar la respuesta y continuar.');
    } else if (session.phase === 'ready') {
      $('status').textContent = 'No se pudo cargar este archivo. Reintenta o usa otro material nuevo.';
      setAction('Start', true);
      $('retry').hidden = false;
      $('replace').hidden = false;
    }
  });
  if (material.tipo === 'image') {
    el.alt = 'Material del turno: ¿humano o inteligencia artificial?';
    el.addEventListener('load', onReady);
    const frame = document.createElement('div');
    frame.id = 'media-frame'; frame.className = 'media-frame';
    frame.append(el); $('media-slot').append(frame);
  } else {
    el.preload = 'auto';
    el.controls = true;
    el.setAttribute('aria-label', material.tipo === 'audio' ? 'Audio del turno' : 'Video del turno');
    el.addEventListener('canplay', onReady);
    // Prevent a replay after the curtain closes, including through media keys.
    el.addEventListener('play', () => {
      if (session.phase !== 'running') el.pause();
      else { prepareSound(el); updateClock(); }
    });
    if (material.tipo === 'video') {
      el.playsInline = true;
      el.addEventListener('loadedmetadata', fitMedia);
      const frame = document.createElement('div');
      frame.id = 'media-frame'; frame.className = 'media-frame';
      frame.append(el); $('media-slot').append(frame);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'audio-scene';
      const symbol = document.createElement('div');
      symbol.className = 'audio-symbol';
      symbol.textContent = '♫';
      symbol.setAttribute('aria-hidden', 'true');
      const label = document.createElement('p');
      label.textContent = '¿Una grabación real o un sonido generado?';
      wrap.append(symbol, label, el);
      $('media-slot').append(wrap);
    }
  }
  el.src = material.asset;
  setTimeout(() => {
    if (token !== loadToken || mediaReady || session.phase !== 'ready') return;
    $('status').textContent = 'La carga está tardando. Puedes reintentar o usar otro material nuevo.';
    $('retry').hidden = false;
    $('replace').hidden = false;
  }, 18000);
}

function render() {
  stopClock();
  if (session.phase === 'roundEnd') {
    releaseMedia();
    show('round-end');
    $('completed-round').textContent = `Ronda ${session.round} completada`;
    return;
  }
  if (session.phase === 'exhausted') {
    releaseMedia();
    show('exhausted');
    const left = session.order.length - session.cursor;
    $('exhausted-note').textContent = left ? `Quedan ${left} materiales nuevos: no alcanzan para otra ronda de tres.` : 'Ya se mostraron todos los materiales de esta sesión.';
    return;
  }
  show('game');
  $('round-label').textContent = `Ronda ${session.round} · Turno ${session.turn + 1} de 3`;
  document.querySelectorAll('.turn-progress span').forEach((el, i) => {
    el.className = i < session.turn ? 'complete' : i === session.turn ? 'current' : '';
  });
  $('retry').hidden = true;
  $('replace').hidden = true;
  $('answer').hidden = true;
  $('curtain').hidden = false;
  $('media-slot').hidden = true;
  $('stage').className = 'stage ' + ({ ready: 'waiting', running: 'viewing', blank: 'blank', answer: 'revealed' }[session.phase]);
  renderTimer();
  if (session.phase === 'ready') {
    setCurtain('El guardián espera tu señal', '¿Listos para observar?', 'Pulsa Start cuando todos estén preparados.');
    $('status').textContent = mediaReady && activeAsset === currentId(session) ? 'Todo listo. Esperando Start.' : 'Preparando material…';
    setAction('Start', !mediaReady || activeAsset !== currentId(session));
    loadMedia();
  } else if (session.phase === 'running') {
    $('curtain').hidden = true;
    $('media-slot').hidden = false;
    $('action').hidden = true;
    $('status').textContent = 'Observa y decide: ¿humano o IA?';
    loadMedia();
    fitMedia();
    armClock();
  } else if (session.phase === 'blank') {
    stopMedia();
    setCurtain('Tiempo terminado', '¿Humano o IA?', 'Comenten sus respuestas antes de descubrirlo.');
    $('status').textContent = 'El material está oculto. La respuesta sigue en secreto.';
    setAction('Mostrar respuesta');
  } else {
    stopMedia();
    $('curtain').hidden = true;
    $('answer').hidden = false;
    const material = bank.get(currentId(session));
    $('truth').textContent = material.categoria === 'real' ? 'Humano' : 'Inteligencia artificial';
    $('explanation').textContent = material.explicacion;
    $('source').href = material.fuente;
    $('source').textContent = `${material.titulo} · Ver fuente original ↗`;
    $('credit').textContent = [material.credito, material.licencia_resumen].filter(Boolean).join(' · ');
    $('status').textContent = session.turn === 2 ? 'Tercer turno. Puedes cerrar esta ronda cuando quieras.' : 'Cuando estén listos, pasa al siguiente turno.';
    setAction('Siguiente');
  }
}

function act() {
  if (!session) return;
  if (session.phase === 'ready') {
    if (!mediaReady || !beginTurn(session)) return;
    save();
    render();
    if (activeMedia?.play) {
      prepareSound(activeMedia);
      activeMedia.play().catch(() => notify('Pulsa reproducir en el material para activar el sonido.'));
    }
  } else if (session.phase === 'blank') {
    revealAnswer(session);
    save();
    render();
  } else if (session.phase === 'answer') {
    advanceTurn(session);
    save();
    render();
  }
}

$('action').onclick = act;
function openSession() {
  if (!session) { session = createSession([...bank.keys()]); save(); }
  expireTurn(session);
  // Unlock during Continue's click, before a restored audio finishes loading.
  if (session.phase === 'running') {
    try { amplifier.unlock(); } catch { /* Native playback remains available. */ }
  }
  save();
  render();
}
$('begin').onclick = openSession;
$('next-round').onclick = () => { if (nextRound(session)) { save(); render(); } };
$('retry').onclick = () => { if (session.phase === 'ready') { releaseMedia(); render(); } };
$('replace').onclick = () => {
  if (session.phase !== 'ready') return;
  const nextIndex = session.cursor + 1;
  if (nextIndex >= session.order.length) { notify('No quedan otros materiales nuevos. Reintenta la carga.'); return; }
  const [failed] = session.order.splice(session.cursor, 1);
  session.order.push(failed);
  save();
  releaseMedia();
  render();
};
$('reset').onclick = () => $('reset-dialog').showModal();
$('reset-cancel').onclick = () => $('reset-dialog').close();
$('reset-confirm').onclick = () => {
  $('reset-dialog').close();
  session = createSession([...bank.keys()]);
  save();
  render();
};
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { notify('Tu navegador no permite pantalla completa en este dispositivo.'); }
};
document.addEventListener('keydown', event => {
  if (event.repeat || document.querySelector('dialog[open]') || ['BUTTON', 'A', 'INPUT', 'SUMMARY'].includes(document.activeElement.tagName)) return;
  if (event.key === 'Enter' || event.code === 'Space') {
    event.preventDefault();
    if (!$('welcome').hidden && !$('begin').disabled) $('begin').click();
    else if (!$('game').hidden && !$('action').disabled && !$('action').hidden) act();
    else if (!$('round-end').hidden) $('next-round').click();
  }
});
document.addEventListener('visibilitychange', () => {
  if (session?.phase === 'running') updateClock();
});
window.addEventListener('pageshow', () => {
  if (session?.phase === 'running') updateClock();
});

async function init() {
  try {
    const response = await fetch('materials.json');
    if (!response.ok) throw Error('inventory');
    const materials = await response.json();
    if (!Array.isArray(materials) || materials.length < 3) throw Error('inventory');
    bank = new Map(materials.map(material => [material.asset, material]));
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (validSession(saved, [...bank.keys()])) {
        session = saved;
        migrateTurnDuration(session);
        // A refresh cannot buy another 10 seconds or expose an expired material.
        expireTurn(session);
        save();
      }
    } catch { /* A fresh session will be created on Start. */ }
    $('begin').onclick = openSession;
    $('begin').textContent = session ? 'Continuar sesión' : 'Preparar primera ronda';
    $('begin').disabled = false;
  } catch {
    $('begin').textContent = 'Reintentar carga';
    $('begin').disabled = false;
    $('begin').onclick = () => { $('begin').disabled = true; init(); };
    notify('No se pudo cargar el banco. Reintenta la carga.');
  }
}
init();
