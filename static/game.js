const $ = (id) => document.getElementById(id);
let game, busy = false, activeId = null, media = null;
let crop = Math.max(0, Math.min(16, Number(localStorage.getItem('humanvsai-crop') ?? 8) || 0));
$('crop').value = crop;
$('crop-value').textContent = crop + '%';

function showError(message) {
  $('error').textContent = message;
  $('error').hidden = false;
  setTimeout(() => { $('error').hidden = true; }, 6000);
}

async function api(path, body) {
  const response = await fetch('/api/' + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la acción.');
  return data;
}

function fitMedia() {
  if (!media) return;
  if (media.tagName === 'AUDIO') {
    $('crop-window').style.width = Math.min(480, $('stage').clientWidth - 40) + 'px';
    $('crop-window').style.height = 'auto';
    return;
  }
  const w = media.videoWidth || media.naturalWidth;
  const h = media.videoHeight || media.naturalHeight;
  if (!w || !h) return;
  const stage = $('stage');
  const ratio = w / (h * (1 - crop / 100));
  const width = Math.min(stage.clientWidth - 24, (stage.clientHeight - 24) * ratio);
  $('crop-window').style.width = width + 'px';
  $('crop-window').style.height = width / ratio + 'px';
}

function loadMedia(material) {
  if (activeId === material.id) return;
  if (['VIDEO', 'AUDIO'].includes(media?.tagName)) { media.pause(); media.removeAttribute('src'); media.load(); }
  activeId = material.id;
  $('crop-window').replaceChildren();
  $('loading').textContent = 'Preparando la ronda…';
  $('loading').hidden = false;
  $('replay').hidden = material.type === 'image';
  $('replay').textContent = material.type === 'audio' ? '↻ Repetir audio' : '↻ Repetir clip';
  $('framing').hidden = material.type === 'audio';
  $('framing-popover').hidden = true;
  $('framing').setAttribute('aria-expanded', 'false');
  $('crop-window').classList.toggle('audio-window', material.type === 'audio');
  $('media-kind').textContent = material.type === 'video' ? '▶ CLIP DE VIDEO' : material.type === 'audio' ? '♫ AUDIO' : '▧ IMAGEN';
  $('media-hint').textContent = material.type === 'video' ? 'Clic en el video para pausar o continuar.' : material.type === 'audio' ? 'Pulsa reproducir y escucha antes de elegir.' : 'Observa los detalles. Confía en tu ojo.';
  media = document.createElement(material.type === 'video' ? 'video' : material.type === 'audio' ? 'audio' : 'img');
  const currentMedia = media;
  if (material.type === 'video') {
    media.muted = true; media.autoplay = true; media.playsInline = true; media.loop = true;
    media.preload = 'auto'; media.setAttribute('aria-label', 'Video de la ronda, haz clic para pausar');
    media.addEventListener('click', () => currentMedia.paused ? currentMedia.play().catch(() => {}) : currentMedia.pause());
    media.addEventListener('loadeddata', () => { if (media === currentMedia) { fitMedia(); $('loading').hidden = true; } });
  } else if (material.type === 'audio') {
    media.controls = true; media.preload = 'metadata';
    media.setAttribute('aria-label', 'Audio de la ronda');
    media.addEventListener('loadedmetadata', () => { if (media === currentMedia) { fitMedia(); $('loading').hidden = true; } });
  } else {
    media.alt = 'Imagen de la ronda: decide si es real o generada con IA';
    media.addEventListener('load', () => { if (media === currentMedia) { fitMedia(); $('loading').hidden = true; } });
  }
  media.addEventListener('error', () => {
    if (media === currentMedia) { $('loading').hidden = false; $('loading').textContent = 'No se pudo abrir este material. Recarga la página para reintentarlo.'; }
  });
  media.src = material.url;
  if (material.type === 'audio') {
    const card = document.createElement('div'); card.className = 'audio-card';
    const icon = document.createElement('div'); icon.className = 'audio-symbol'; icon.textContent = '♫'; icon.setAttribute('aria-hidden', 'true');
    const title = document.createElement('h3'); title.textContent = 'Afina el oído.';
    const hint = document.createElement('p'); hint.textContent = '¿Grabación real o sonido generado con IA?';
    card.append(icon, title, hint, media); $('crop-window').append(card); fitMedia();
  } else { $('crop-window').append(media); }
}

function render(data) {
  game = data;
  $('game').hidden = data.finished;
  $('finish').hidden = !data.finished;
  if (data.finished) {
    media?.pause?.();
    $('final-score').textContent = data.score;
    $('final-total').textContent = '/ ' + data.total;
    const ratio = data.score / data.total;
    $('final-message').textContent = ratio >= .8 ? 'Tienes buen ojo para los detalles. ¿Te atreves a repetir?' : ratio >= .5 ? 'La realidad y la IA se parecen más de lo que creemos. Prueba otra vez.' : 'No siempre basta con mirar. Verificar la fuente marca la diferencia.';
    return;
  }
  $('round-number').textContent = String(data.position + 1).padStart(2, '0');
  $('total').textContent = data.total;
  $('score').textContent = data.score;
  $('answered').textContent = data.answered;
  $('progress').style.width = (data.answered / data.total * 100) + '%';
  $('progress-label').textContent = data.answered ? `${data.answered} de ${data.total} materiales resueltos.` : `${data.total} oportunidades para poner a prueba tu intuición.`;
  loadMedia(data.material);
  const answered = Boolean(data.answer);
  document.querySelector('.decision-top h2').textContent = data.material.type === 'audio' ? '¿Qué estás escuchando?' : '¿Qué estás viendo?';
  document.querySelector('.decision-top').hidden = answered;
  document.querySelector('.choices').hidden = answered;
  for (const choice of ['real', 'ia']) {
    const button = $('choose-' + choice);
    button.disabled = answered;
    button.classList.toggle('correct', answered && data.answer.category === choice);
    button.classList.toggle('wrong', answered && data.answer.choice === choice && !data.answer.correct);
    button.classList.toggle('selected', answered && data.answer.choice === choice);
  }
  $('answer').hidden = !answered;
  $('next').disabled = !answered;
  $('next').firstChild.textContent = data.position === data.total - 1 ? 'Ver resultado final ' : 'Siguiente material ';
  $('decision-help').textContent = answered ? 'Respuesta revelada. Comprueba su origen abajo.' : data.material.type === 'audio' ? 'Escucha con atención y elige el origen de este sonido.' : 'Mira con atención y elige el origen de este material.';
  if (answered) {
    const a = data.answer;
    $('verdict').classList.toggle('miss', !a.correct);
    $('verdict').textContent = a.correct ? '✓ ¡Acertaste!' : '↗ Esta vez no.';
    $('answer-title').textContent = a.category === 'ia' ? 'Es inteligencia artificial.' : 'Es real.';
    $('explanation').textContent = a.explanation;
    $('source').textContent = a.source;
    $('source').href = a.source;
    $('download').href = a.download;
    $('credit').textContent = 'Crédito: ' + a.credit;
  }
}

async function action(task) {
  if (busy) return;
  busy = true;
  try { render(await task()); }
  catch (error) { showError(error.message || 'No se pudo conectar con el juego.'); }
  finally { busy = false; }
}
function vote(choice) {
  if (!game || game.finished || game.answer) return;
  action(() => api('answer', { id: game.material.id, choice }));
}
function next() {
  if (!game?.answer || game.finished) return;
  action(() => api('next', { id: game.material.id }));
}
$('choose-real').addEventListener('click', () => vote('real'));
$('choose-ia').addEventListener('click', () => vote('ia'));
$('next').addEventListener('click', next);
$('replay').addEventListener('click', () => { if (['VIDEO', 'AUDIO'].includes(media?.tagName)) { media.currentTime = 0; media.play().catch(() => {}); } });
$('framing').addEventListener('click', () => {
  $('framing-popover').hidden = !$('framing-popover').hidden;
  $('framing').setAttribute('aria-expanded', String(!$('framing-popover').hidden));
});
$('crop').addEventListener('input', (event) => {
  crop = Number(event.target.value); $('crop-value').textContent = crop + '%';
  localStorage.setItem('humanvsai-crop', crop); fitMedia();
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.framing-control')) { $('framing-popover').hidden = true; $('framing').setAttribute('aria-expanded', 'false'); }
});
async function toggleFullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { showError('Usa F11 para abrir la pantalla completa en tu navegador.'); }
}
$('fullscreen').addEventListener('click', toggleFullscreen);
$('restart').addEventListener('click', () => $('restart-dialog').showModal());
$('cancel-restart').addEventListener('click', () => $('restart-dialog').close());
$('confirm-restart').addEventListener('click', () => { $('restart-dialog').close(); action(() => api('start', {})); });
$('play-again').addEventListener('click', () => action(() => api('start', {})));
document.addEventListener('keydown', (event) => {
  if (event.repeat || $('restart-dialog').open || ['INPUT', 'BUTTON', 'A'].includes(document.activeElement.tagName)) return;
  if (event.key === '1') vote('real');
  else if (event.key === '2') vote('ia');
  else if (['Enter', 'ArrowRight'].includes(event.key)) { event.preventDefault(); next(); }
  else if (event.key.toLowerCase() === 'f') toggleFullscreen();
  else if (event.code === 'Space' && ['VIDEO', 'AUDIO'].includes(media?.tagName)) { event.preventDefault(); media.paused ? media.play().catch(() => {}) : media.pause(); }
});
new ResizeObserver(fitMedia).observe($('stage'));
action(() => api('state'));
