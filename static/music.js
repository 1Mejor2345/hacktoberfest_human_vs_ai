(() => {
'use strict';
const menu=document.getElementById('sound-menu'), audio=document.getElementById('music-audio'), slider=document.getElementById('volume'), mute=document.getElementById('music-mute'), status=document.getElementById('music-status'), output=document.getElementById('volume-value');
if(!audio||!menu)return;
const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
let enabled=read('human-vs-ia-muted','false')!=='true',volume=Number(read('human-vs-ia-volume','0.25')),pausedForChallenge=false,scene='welcome',waiting=false,playFailed=false,welcomePlayed=false;
if(!Number.isFinite(volume))volume=.25;volume=Math.min(1,Math.max(0,volume));
const tracks={welcome:'9_Y3lUuplnY',early:'Q7bZ5NIKMBQ',finish:'szHgyOXRf7c'};
slider.value=String(volume);audio.volume=volume;
function render(){
  const silent=!enabled||volume===0;
  menu.dataset.muted=String(silent);menu.dataset.waiting=String(waiting);
  mute.textContent=enabled?'Silenciar':'Activar música';mute.setAttribute('aria-pressed',String(!enabled));output.value=Math.round(volume*100)+'%';output.textContent=output.value;
  status.textContent=pausedForChallenge?'En pausa durante la prueba':silent?'Silenciada':playFailed?'No se pudo cargar el audio':(scene==='welcome'&&welcomePlayed)?'Finalizada':waiting?'Sonará al interactuar':audio.paused?'Preparando música…':'Reproduciendo';
}
function play(){
  if(scene==='welcome'&&welcomePlayed){audio.pause();render();return;}
  if(!enabled||volume===0||pausedForChallenge){audio.pause();render();return;}
  const attempt=audio.play();
  if(attempt)attempt.then(()=>{waiting=false;playFailed=false;render();}).catch(error=>{if(error.name==='AbortError')return;waiting=error.name==='NotAllowedError';playFailed=!waiting;render();});
}
function setScene(next,options={}){
  scene=tracks[next]?next:'welcome';pausedForChallenge=Boolean(options.paused);
  const url='/static/audio/'+tracks[scene]+'.mp3';
  if(audio.getAttribute('src')!==url){audio.src=url;playFailed=false;}
  audio.loop=!['welcome','finish'].includes(scene);play();render();
}
mute.addEventListener('click',()=>{enabled=!enabled;save('human-vs-ia-muted',String(!enabled));waiting=false;play();render();});
slider.addEventListener('input',()=>{volume=Number(slider.value);audio.volume=volume;save('human-vs-ia-volume',String(volume));if(volume>0&&!enabled){enabled=true;save('human-vs-ia-muted','false');}play();render();});
function unlock(e){if(e.target.closest('#music-mute'))return;if(enabled&&audio.paused&&!pausedForChallenge)play();}
document.addEventListener('pointerdown',unlock,{capture:true});document.addEventListener('keydown',unlock,{capture:true});
document.addEventListener('pointerdown',e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus();}});
audio.addEventListener('playing',()=>{waiting=false;playFailed=false;render();});audio.addEventListener('pause',render);audio.addEventListener('error',()=>{playFailed=true;waiting=false;render();});
audio.addEventListener('ended',()=>{if(scene==='welcome')welcomePlayed=true;render();});
window.addEventListener('pagehide',()=>audio.pause());
window.HumanMusic={setScene};
setScene('welcome');
})();
