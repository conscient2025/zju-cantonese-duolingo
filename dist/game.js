import { course } from './content/course.js';
import { Lesson, AdGate } from './engine.js';

const app=document.querySelector('#app'),dialog=document.querySelector('#settings'),toast=document.querySelector('#toast');
const lesson=new Lesson(course);
let media={audio:{},advertisement:null,qrCode:null};
let sound=true,showJyutping=true,toastTimer,pairTimer,adFrame,adVideo,adGate,adCleanup=()=>{},audioEpoch=0;
let lastCorrectEvent=0,streakAnimation,progressAnimation;
const wordFlights=new Set(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const player=new Audio();player.preload='auto';
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={
gear:'<path d="m10 2-.6 2.5-2 .9-2.2-1.3-2.8 4.8 2 1.7-.1 2.3L2.4 15l2.8 4.8 2.4-.7 1.8 1.1L10 23h5l.6-2.8 1.9-1 2.3.6 2.8-4.8-1.9-2.1-.1-2.3 2-1.7-2.8-4.8-2.2 1.3-2-.9L15 2Z" transform="translate(1 0) scale(.88)" stroke-linejoin="round"/><circle cx="12" cy="11" r="3.9"/>',
speaker:'<path d="M11 4 5 9H2v6h3l6 5Z" fill="currentColor" stroke-linejoin="round"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke-linecap="round"/>',
check:'<path d="m5 12 5 5L20 6" stroke-linecap="round" stroke-linejoin="round"/>',
close:'<path d="m6 6 12 12M6 18 18 6" stroke-linecap="round"/>',
repeat:'<path d="M5 7h12l-3-3m5 13H7l3 3M4 13a8 8 0 0 1 1-6m14 4a8 8 0 0 1 0 6" stroke-linecap="round" stroke-linejoin="round"/>',
lightning:'<path d="m13 2-8 12h6l-1 8 9-13h-7Z" fill="currentColor" stroke-linejoin="round"/>',
clock:'<circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2M9 2h6M12 2v3" stroke-linecap="round"/>',
target:'<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="m11 13 9-9m-4 0h4v4" stroke-linecap="round"/>',
muted:'<path d="M11 4 5 9H2v6h3l6 5Z" fill="currentColor" stroke-linejoin="round"/><path d="m16 9 6 6m0-6-6 6" stroke-linecap="round"/>',
play:'<path d="m8 4 12 8-12 8Z" fill="currentColor" stroke-linejoin="round"/>',
};
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5">${icons[name]||icons.speaker}</svg>`;}
function notify(message){clearTimeout(toastTimer);toast.textContent=message;toast.hidden=false;toastTimer=setTimeout(()=>toast.hidden=true,2400);}
function stopAudio(){audioEpoch++;player.pause();player.removeAttribute('src');document.querySelectorAll('.is-playing').forEach(el=>el.classList.remove('is-playing'));}
async function playAudio(key,label){
 if(!sound){notify('声音已关闭，可在设置中开启。');return;}
 const src=media.audio[key];stopAudio();
 if(!src){notify(`「${label}」的社员录音待补充`);return;}
 const epoch=audioEpoch;player.src=src;
 document.querySelectorAll(`[data-audio-key="${CSS.escape(key)}"]`).forEach(el=>el.classList.add('is-playing'));
 try{await player.play();}catch(error){if(epoch===audioEpoch){stopAudio();notify(error.name==='NotAllowedError'?'请再点一次播放录音。':'录音暂时无法播放，请重试。');}}
}
player.addEventListener('ended',()=>document.querySelectorAll('.is-playing').forEach(el=>el.classList.remove('is-playing')));
player.addEventListener('error',()=>{if(player.getAttribute('src')){stopAudio();notify('录音暂时无法播放，请重试。');}});
function character(name,pose='idle',size='normal'){
 const refs={lily:pose==='success'?'lily-happy-reference.jpg':'lily-reference.jpg',bear:pose==='success'?'bear-happy-reference.jpg':'bear-reference.jpg',oscar:'oscar-reference.jpg',duo:'duo-reference.jpg'};
 return `<div class="character ${e(name)} ${e(pose)} ${size==='large'?'large':''}" role="img" aria-label="${{lily:'拽姐',bear:'熊二',oscar:'角色',duo:'庆祝角色'}[name]}"><div class="character-window"><img src="./assets/${refs[name]}" alt="" draggable="false"></div></div>`;
}
function ruby(word){return `<ruby>${e(word.text)}${showJyutping&&word.jyutping?`<rt>${e(word.jyutping)}</rt>`:''}</ruby>`;}
function header(){
 const q=lesson.question,color=q?.type==='speak'?'blue':q?.type==='match'?'yellow':'green';
 return `<header class="lesson-header"><button class="icon-button" data-action="settings" aria-label="设置">${icon('gear')}</button><div class="progress-wrap"><div class="streak ${color}" aria-live="polite"></div><div class="progress-track" role="progressbar" aria-label="课程进度" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill ${color}" style="width:0%"></div></div></div><span class="energy" aria-label="无限能量"><svg class="energy-icon" viewBox="0 0 34 28" aria-hidden="true"><path d="M29 11h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2Z" fill="#c952a0"/><rect x="1" y="4" width="29" height="22" rx="6" fill="#f47cc6"/><path d="M10 4h10L10 26H7a6 6 0 0 1-6-6v-1Z" fill="#ffafe3"/><path d="m18 2-9 14h7l-2 11 11-16h-7l3-9Z" transform="translate(5 5) scale(.65)" fill="#fff0fb"/></svg><span>∞</span></span></header>`;
}
function syncHeader(){
 const color=lesson.question.type==='speak'?'blue':lesson.question.type==='match'?'yellow':'green';
 const fill=app.querySelector('.progress-fill'),track=app.querySelector('.progress-track'),streak=app.querySelector('.streak');
 fill.className=`progress-fill ${color}`;streak.className=`streak ${color}`;
 track.setAttribute('aria-valuenow',lesson.progressPercent);track.setAttribute('aria-valuetext',`已完成 ${lesson.progress} / 9 题`);
 if(fill.dataset.progress!==String(lesson.progressPercent)){
  // Animate the actual width so the rounded end cap keeps its circular shape.
  const from=getComputedStyle(fill).width;progressAnimation?.cancel();
  fill.dataset.progress=lesson.progressPercent;fill.style.width=`${lesson.progressPercent}%`;
  if(!reducedMotion.matches)progressAnimation=fill.animate([{width:from},{width:fill.style.width}],{duration:700,easing:'cubic-bezier(.22,1,.36,1)'});
 }
 if(lesson.streak===0){streakAnimation?.cancel();streak.textContent='';}
 if(lesson.correctEvent!==lastCorrectEvent){
  lastCorrectEvent=lesson.correctEvent;streakAnimation?.cancel();streak.textContent=`连击 × ${lesson.streak}`;
  streakAnimation=streak.animate(reducedMotion.matches?[{opacity:1},{opacity:1,offset:.8},{opacity:0}]:[
   {opacity:0,transform:'translateY(8px) scale(.9)'},{opacity:1,transform:'translateY(-2px) scale(1.04)',offset:.14},
   {opacity:1,transform:'translateY(0) scale(1)',offset:.25},{opacity:1,transform:'translateY(0) scale(1)',offset:.75},{opacity:0,transform:'translateY(-5px) scale(1)'}
  ],{duration:1650,easing:'ease-out'});
  streakAnimation.onfinish=()=>{streak.textContent='';};
 }
}
function title(){return `${lesson.phase==='review'?`<div class="review-label">${icon('repeat')}错题重练</div>`:''}<h1 tabindex="-1">${lesson.question.type==='translate'?'翻译这句话':lesson.question.type==='match'?'选择配对':`跟着${lesson.question.character==='bear'?'熊二':'拽姐'}念`}</h1>`;}
function wordTile(word,placed=false){
 const used=lesson.selected.includes(word.id),correct=placed&&lesson.feedback?.correct;
 return `<button class="word ${!placed&&used?'placeholder':''} ${correct?'correct':''}" data-word="${e(word.id)}" data-zone="${placed?'answer':'bank'}" data-audio-key="${e(word.audioKey)}" ${lesson.feedback||(!placed&&used)?'disabled':''} aria-label="${placed?'移回词库':'选择'} ${e(word.text)}">${ruby(word)}</button>`;
}
function translation(){
 const q=lesson.question,pose=lesson.feedback?(lesson.feedback.correct?'success':'wrong'):'idle';
 return `<section class="exercise translation ${q.words.length>6?'long-translation':''}">${title()}<div class="translation-body"><div class="prompt-row">${character(q.character,pose)}<div class="speech side-tail"><span>${e(q.prompt)}</span></div></div><div class="answer-zone" aria-label="已选答案"></div><div class="word-bank" aria-label="可选词语">${lesson.bank.map(id=>wordTile(q.words.find(w=>w.id===id))).join('')}</div></div></section>`;
}
function finishWordFlights(){for(const finish of [...wordFlights])finish();}
function layoutAnswerRows(){
 const zone=app.querySelector('.answer-zone');if(!zone)return;
 const bank=new Map([...app.querySelectorAll('[data-zone="bank"]')].map(el=>[el.dataset.word,el]));
 const existing=new Map([...zone.querySelectorAll('.word')].map(el=>[el.dataset.word,el]));
 const rows=[],maxWidth=zone.clientWidth;let row,width=0;
 const newRow=()=>{row=document.createElement('div');row.className='answer-row';rows.push(row);width=0;};newRow();
 for(const id of lesson.selected){
  const tileWidth=bank.get(id).getBoundingClientRect().width;
  if(width&&width+8+tileWidth>maxWidth+.5)newRow();
  let tile=existing.get(id);
  if(!tile){const template=document.createElement('template');template.innerHTML=wordTile(lesson.question.words.find(w=>w.id===id),true);tile=template.content.firstElementChild;}
  tile.style.width=`${tileWidth}px`;row.append(tile);width+=(width?8:0)+tileWidth;
 }
 while(rows.length<2)newRow();zone.replaceChildren(...rows);
 for(const [id,tile] of bank){const used=lesson.selected.includes(id);tile.classList.toggle('placeholder',used);tile.disabled=Boolean(used||lesson.feedback);}
}
function moveWord(id,source){
 finishWordFlights();const from=source.getBoundingClientRect(),clone=source.cloneNode(true),computed=getComputedStyle(source),rtStyle=getComputedStyle(source.querySelector('ruby'));
 const font=source.querySelector('rt')?getComputedStyle(source.querySelector('rt')).fontSize:null;
 if(!lesson.selectWord(id))return false;
 layoutAnswerRows();app.querySelector('[data-action="check"]').disabled=!lesson.selected.length;
 const destination=app.querySelector(`[data-zone="${lesson.selected.includes(id)?'answer':'bank'}"][data-word="${CSS.escape(id)}"]`);
 destination.focus({preventScroll:true});
 if(reducedMotion.matches)return true;
 const to=destination.getBoundingClientRect();clone.classList.remove('placeholder','is-playing');clone.classList.add('flying-word');
 clone.removeAttribute('data-word');clone.removeAttribute('data-zone');clone.removeAttribute('data-audio-key');clone.setAttribute('aria-hidden','true');clone.tabIndex=-1;
 Object.assign(clone.style,{width:`${from.width}px`,height:`${from.height}px`,fontSize:computed.fontSize,padding:computed.padding,lineHeight:computed.lineHeight});
 clone.querySelector('ruby').style.letterSpacing=rtStyle.letterSpacing;if(font)clone.querySelector('rt').style.fontSize=font;
 destination.style.visibility='hidden';document.body.append(clone);
 const flight=clone.animate([{transform:`translate(${from.left}px,${from.top}px)`},{transform:`translate(${to.left}px,${to.top}px)`}],{duration:220,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'});
 const finish=()=>{flight.cancel();clone.remove();destination.style.visibility='';wordFlights.delete(finish);};wordFlights.add(finish);flight.onfinish=finish;
 return true;
}
function wave(){return `<span class="wave" aria-hidden="true">${[4,9,16,23,29,18,24,35,27,16,8,4].map(h=>`<i style="--height:${h}px"></i>`).join('')}</span>`;}
function pairTile(id,side,index){
 const p=lesson.question.pairs.find(p=>p.id===id),done=lesson.paired.includes(id),flashing=lesson.pairFlash?.[side]===id;
 const style=flashing?(lesson.pairFlash.correct?'correct':'wrong'):done?'matched':lesson.pairSelection[side]===id?'selected':'';
 return `<button class="pair-card ${style}" data-side="${side}" data-pair="${e(id)}" ${side==='left'?`data-audio-key="${e(p.audioKey)}"`:''} ${done||lesson.feedback||lesson.pairFlash?'disabled':''} aria-label="${side==='left'?(done?p.text:`播放第 ${index+1} 段粤语录音`):e(p.meaning)}">${side==='right'?e(p.meaning):done?e(p.text):`${icon('speaker')}${wave()}`}</button>`;
}
function matching(){return `<section class="exercise matching">${title()}<div class="match-body"><div class="match-grid"><div class="match-column">${lesson.left.map((id,i)=>pairTile(id,'left',i)).join('')}</div><div class="match-column">${lesson.right.map((id,i)=>pairTile(id,'right',i)).join('')}</div></div></div></section>`;}
function speaking(){
 const q=lesson.question;
 return `<section class="exercise reading">${title()}<div class="reading-body"><div class="speech bottom-tail"><button class="sentence-play" data-action="read" data-audio-key="${q.audioKey}" aria-label="播放示范录音">${icon('speaker')}</button><div class="reading-sentence">${q.words.map(ruby).join('')}</div></div>${character(q.character,'still','large')}<p class="reading-instruction">请读给现场的粤语社工作人员听<br>工作人员确认后，点击「继续」。</p></div></section>`;
}
function footer(){
 if(lesson.feedback){
  const {correct,review}=lesson.feedback;
  const heading=correct?(review?'纠错成功！':lesson.question.type==='match'?'真棒！':'非常好！'):'差了一点点哦～';
  const answer=!correct?`<div class="correct-answer">${lesson.question.answers[0].map(id=>ruby(lesson.question.words.find(w=>w.id===id))).join('')}</div>`:'';
  return `<footer class="lesson-footer feedback ${correct?'success':'error'}"><div class="feedback-heading" role="status"><span class="feedback-icon">${icon(correct?'check':'close')}</span><h2>${heading}</h2></div>${answer}<button class="primary ${correct?'green':'red'}" data-action="next">${correct?(review?'走起！':'继续'):'知道了'}</button></footer>`;
 }
 const q=lesson.question;
 return `<footer class="lesson-footer"><button class="primary ${q.type==='speak'?'blue':'green'}" data-action="${q.type==='speak'?'spoken':'check'}" ${q.type==='match'||(q.type==='translate'&&!lesson.selected.length)?'disabled':''}>${q.type==='speak'?'继续':'检查'}</button></footer>`;
}
function timeText(milliseconds){const seconds=Math.floor(milliseconds/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
function summary(){
 const s=lesson.stats;
 return `<section class="summary"><div class="summary-main">${character('duo','success','large')}<h1>不愧是你！</h1><p>你的中文（粤语）技能正在悄悄升级</p><div class="stats"><div class="stat yellow"><span>正确题数</span><div>${icon('lightning')}<strong>${s.correct}<small> / 9</small></strong></div></div><div class="stat green"><span>正确率</span><div>${icon('target')}<strong>${s.accuracy}%</strong></div></div><div class="stat blue"><span>用时</span><div>${icon('clock')}<strong>${timeText(s.milliseconds)}</strong></div></div></div></div><footer class="lesson-footer"><button class="primary blue" data-action="advertisement">继续</button></footer></section>`;
}
function qr(){return `<section class="qr-screen"><h1>浙江大学学生粤语社</h1><p>期待与你见面！</p>${media.qrCode?`<img class="qr-image" src="${e(media.qrCode)}" alt="粤语社招新二维码">`:'<div class="qr-missing"><span>粤语社二维码</span><small>待提供素材后显示</small></div>'}<button class="text-button" data-action="restart">再玩一次</button></section>`;}
function render(focusHeading=false){
 finishWordFlights();
 const active=document.activeElement,wordFocus=active?.dataset.word,actionFocus=active?.dataset.action;
 if(lesson.isQuestion){
  const content=({translate:translation,match:matching,speak:speaking}[lesson.question.type]())+footer();
  if(app.querySelector('.lesson-header')){app.querySelector('.exercise').remove();app.querySelector('.lesson-footer').remove();app.insertAdjacentHTML('beforeend',content);}
  else app.innerHTML=header()+content;
  layoutAnswerRows();syncHeader();
 }
 else if(lesson.phase==='summary')app.innerHTML=summary();
 else if(lesson.phase==='qr'){
  app.innerHTML=qr();app.querySelector('.qr-image')?.addEventListener('error',event=>{event.target.outerHTML='<div class="qr-missing"><span>二维码加载失败</span><small>请联系现场粤社工作人员</small></div>';});
 }
 document.body.classList.toggle('hide-jyutping',!showJyutping);
 if(focusHeading){window.scrollTo({top:0,behavior:'instant'});app.querySelector('h1')?.focus({preventScroll:true});}
 else if(wordFocus)app.querySelector(`[data-word="${CSS.escape(wordFocus)}"]:not(:disabled)`)?.focus({preventScroll:true});
 else if(actionFocus)app.querySelector(`[data-action="${CSS.escape(actionFocus)}"]:not(:disabled)`)?.focus({preventScroll:true});
}
function cleanupQuestion(){finishWordFlights();clearTimeout(pairTimer);stopAudio();toast.hidden=true;}
function advance(){cleanupQuestion();lesson.advance();render(true);}
function settings(){
 stopAudio();
 dialog.innerHTML=`<form method="dialog"><div class="dialog-title"><h2 id="settings-title">设置</h2><button class="icon-button" aria-label="关闭设置">${icon('close')}</button></div><label class="setting-row">播放声音<input id="sound-option" type="checkbox" ${sound?'checked':''}></label><label class="setting-row">显示粤拼<input id="jyutping-option" type="checkbox" ${showJyutping?'checked':''}></label><p class="demo-note">当前使用测试语料。<br>社员录音、广告和二维码待补充。</p><button class="primary blue">继续练习</button><button class="text-button" type="button" id="ask-restart">重新开始本轮</button><div id="restart-confirm" hidden><p>重新开始会清空本轮答题进度。</p><button type="button" class="secondary" id="confirm-restart">确认重新开始</button></div></form>`;
 dialog.querySelector('#sound-option').onchange=event=>{sound=event.target.checked;if(!sound)stopAudio();};
 dialog.querySelector('#jyutping-option').onchange=event=>{showJyutping=event.target.checked;render();};
 dialog.querySelector('#ask-restart').onclick=()=>dialog.querySelector('#restart-confirm').hidden=false;
 dialog.querySelector('#confirm-restart').onclick=()=>{dialog.close();restart();};dialog.showModal();
}
function restart(){adCleanup();cancelAnimationFrame(adFrame);adVideo?.pause();adVideo=null;cleanupQuestion();streakAnimation?.cancel();progressAnimation?.cancel();lastCorrectEvent=0;lesson.reset();render(true);}
app.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||button.disabled)return;
 if(button.dataset.word){const word=lesson.question.words.find(w=>w.id===button.dataset.word);if(moveWord(word.id,button))void playAudio(word.audioKey,word.text);return;}
 if(button.dataset.pair){
  const id=button.dataset.pair,side=button.dataset.side,pair=lesson.question.pairs.find(p=>p.id===id);
  if(lesson.selectPair(side,id)){render();if(side==='left')void playAudio(pair.audioKey,pair.text);if(lesson.pairFlash)pairTimer=setTimeout(()=>{lesson.settlePair();render();},lesson.pairFlash.correct?420:650);}return;
 }
 switch(button.dataset.action){
  case 'settings':settings();break;
  case 'check':if(lesson.checkTranslation()){cleanupQuestion();render();}break;
  case 'next':advance();break;
  case 'read':void playAudio(lesson.question.audioKey,lesson.question.prompt);break;
  case 'spoken':cleanupQuestion();lesson.continueSpeaking();render(true);break;
  case 'advertisement':if(lesson.startAdvertisement())startAd();break;
  case 'restart':restart();break;
 }
});

function startAd(){
 cleanupQuestion();adCleanup();adGate=new AdGate(course.ad.duration);
 const isDemo=!media.advertisement;
 app.innerHTML=`<section class="ad-screen"><div class="ad-top"><span class="ad-counter" aria-label="广告剩余秒数">15</span><button class="icon-button ad-sound" aria-label="${sound?'关闭':'开启'}广告声音">${icon(sound?'speaker':'muted')}</button></div>${isDemo?'<div class="ad-placeholder"><span class="ad-placeholder-label">15 秒广告占位演示</span><h1>浙江大学<br>学生粤语社</h1><p>正式广告视频待补充</p></div>':'<video id="ad-video" playsinline webkit-playsinline preload="auto" disablepictureinpicture disableremoteplayback></video>'}<button class="ad-play" hidden aria-label="播放广告">${icon('play')}<span>点击播放</span></button><p class="ad-error" role="status" hidden></p></section>`;
 const counter=app.querySelector('.ad-counter'),soundButton=app.querySelector('.ad-sound'),playButton=app.querySelector('.ad-play'),errorLine=app.querySelector('.ad-error');
 let destroyed=false;
 function finish(){if(lesson.finishAdvertisement(adGate)){destroyed=true;cancelAnimationFrame(adFrame);adCleanup();adVideo?.pause();render(true);}}
 soundButton.onclick=()=>{sound=!sound;if(adVideo)adVideo.muted=!sound;soundButton.innerHTML=icon(sound?'speaker':'muted');soundButton.setAttribute('aria-label',`${sound?'关闭':'开启'}广告声音`);};
 if(isDemo){
  let elapsed=0,last=performance.now();adGate.update(0,last,true,!document.hidden);
  const visibility=()=>{last=performance.now();adGate.update(elapsed,last,!document.hidden,!document.hidden);};
  document.addEventListener('visibilitychange',visibility);
  const tick=now=>{
   if(destroyed)return;
   if(!document.hidden)elapsed=Math.min(course.ad.duration,elapsed+Math.min((now-last)/1000,0.1));
   adGate.update(elapsed,now,!document.hidden,!document.hidden);last=now;counter.textContent=adGate.remaining;
   if(elapsed>=course.ad.duration){adGate.markEnded();finish();}
   if(!destroyed)adFrame=requestAnimationFrame(tick);
  };
  adCleanup=()=>{destroyed=true;document.removeEventListener('visibilitychange',visibility);cancelAnimationFrame(adFrame);};
  adFrame=requestAnimationFrame(tick);return;
 }
 adVideo=app.querySelector('#ad-video');adVideo.muted=!sound;
 let lastSafeTime=0,recoveringSeek=false;
 const showPlay=()=>{if(!destroyed)playButton.hidden=false;};
 const begin=async()=>{errorLine.hidden=true;playButton.hidden=true;if(adVideo.error)adVideo.load();try{await adVideo.play();}catch{showPlay();}};
 playButton.onclick=begin;
 const visibility=()=>{if(document.hidden){adGate.update(adVideo.currentTime,performance.now(),false,false);adVideo.pause();}else showPlay();};
 document.addEventListener('visibilitychange',visibility);
 adVideo.addEventListener('play',()=>{playButton.hidden=true;adGate.update(adVideo.currentTime,performance.now(),true,!document.hidden);});
 adVideo.addEventListener('pause',()=>{adGate.update(adVideo.currentTime,performance.now(),false,!document.hidden);if(!adVideo.ended&&!document.hidden)showPlay();});
 adVideo.addEventListener('ratechange',()=>{if(adVideo.playbackRate!==1)adVideo.playbackRate=1;});
 adVideo.addEventListener('seeking',()=>{if(!recoveringSeek&&Math.abs(adVideo.currentTime-lastSafeTime)>0.35){recoveringSeek=true;adVideo.currentTime=lastSafeTime;}});
 adVideo.addEventListener('seeked',()=>{recoveringSeek=false;adGate.update(adVideo.currentTime,performance.now(),!adVideo.paused,!document.hidden);});
 adVideo.addEventListener('ended',()=>{
  adGate.update(adVideo.currentTime,performance.now(),true,!document.hidden);adGate.markEnded();
  if(adGate.complete)finish();
  else{errorLine.textContent='广告尚未完整播放，请重新播放。';errorLine.hidden=false;playButton.hidden=false;playButton.onclick=()=>{adGate=new AdGate(course.ad.duration);lastSafeTime=0;recoveringSeek=true;adVideo.currentTime=0;void begin();};}
 });
 adVideo.addEventListener('error',()=>{errorLine.textContent='广告加载失败，请检查网络后点击重试。';errorLine.hidden=false;playButton.hidden=false;});
 const tick=now=>{
  if(destroyed)return;
  const playing=!adVideo.paused&&!adVideo.seeking&&!document.hidden;adGate.update(adVideo.currentTime,now,playing,!document.hidden);
  if(playing)lastSafeTime=adVideo.currentTime;counter.textContent=adGate.remaining;adFrame=requestAnimationFrame(tick);
 };
 adCleanup=()=>{destroyed=true;cancelAnimationFrame(adFrame);document.removeEventListener('visibilitychange',visibility);};
 adVideo.src=media.advertisement;adFrame=requestAnimationFrame(tick);void begin();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){lesson.pause();stopAudio();}else lesson.resume();});
window.addEventListener('pagehide',()=>{stopAudio();adVideo?.pause();});
window.addEventListener('resize',()=>{finishWordFlights();layoutAnswerRows();});

// Optional page-scoped tools. Unsupported browsers use the normal visible interface.
const registry=document.modelContext,lifecycle=new AbortController();
if(registry?.registerTool){
 const state=()=>({phase:lesson.phase,question:lesson.isQuestion?{id:lesson.question.id,type:lesson.question.type,prompt:lesson.question.prompt,words:lesson.question.words?.map(w=>({id:w.id,text:w.text})),selected:lesson.selected}:null,streak:lesson.streak,progress:lesson.progress,progressPercent:lesson.progressPercent,feedback:lesson.feedback});
 const definitions=[
  {name:'get_exercise_state',description:'Read the visible Cantonese exercise and selected words.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>state()},
  {name:'submit_translation',description:'Select an ordered list of word IDs and check the current translation, using the same rules as the visible interface.',inputSchema:{type:'object',properties:{wordIds:{type:'array',items:{type:'string'}}},required:['wordIds'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{
   const ids=input?.wordIds;if(!lesson.isQuestion||lesson.question.type!=='translate'||lesson.feedback||!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!lesson.question.words.some(w=>w.id===id)))throw new Error('Invalid words or exercise state');
   lesson.selected=[...ids];lesson.checkTranslation();stopAudio();render();return state();
  }},
 ];
 for(const definition of definitions){try{Promise.resolve(registry.registerTool(definition,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
try{const response=await fetch('./content/media.json');if(response.ok)media=await response.json();}catch{/* Missing media does not prevent the demo lesson. */}
render();
