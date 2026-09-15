export function shuffle(items, random = Math.random) {
  const output = [...items];
  for(let i=output.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[output[i],output[j]]=[output[j],output[i]];}
  return output;
}

// Deliberately front-loaded visual pacing; an approximation, not Duolingo's private formula.
export const PROGRESS_WEIGHTS = [18,16,14,12,10,9,8,7,6];

export function validateCourse(course) {
  if(!Array.isArray(course.order)||course.order.length!==9||new Set(course.order).size!==9) throw new Error('必须配置9个互不重复的题号');
  const counts={translate:0,match:0,speak:0};
  for(const id of course.order){
    const q=course.questions.find(q=>q.id===id);
    if(!q||!(q.type in counts)) throw new Error(`题目不存在或类型错误：${id}`);
    counts[q.type]++;
    if(q.type==='translate'){
      if(!q.words?.length||new Set(q.words.map(w=>w.id)).size!==q.words.length) throw new Error(`${id}词块编号重复或为空`);
      if(!q.answers?.length||q.answers.some(a=>!Array.isArray(a)||!a.length||new Set(a).size!==a.length||a.some(w=>!q.words.some(v=>v.id===w)))) throw new Error(`${id}答案配置错误`);
    }
    if(q.type==='match'&&(!q.pairs||q.pairs.length!==4||new Set(q.pairs.map(p=>p.id)).size!==4)) throw new Error(`${id}必须有4组配对`);
  }
  if(counts.translate!==5||counts.match!==2||counts.speak!==2) throw new Error('必须是5题翻译、2题配对、2题跟读');
  const speakers=course.questions.filter(q=>course.order.includes(q.id)&&q.type==='speak').map(q=>q.character);
  if(!speakers.includes('bear')||!speakers.includes('lily')) throw new Error('两道跟读需分别为熊二和拽姐');
}

export class Lesson {
  constructor(course, now = ()=>Date.now(), random = Math.random){
    validateCourse(course);this.course=course;this.now=now;this.random=random;this.reset();
  }
  reset(){
    this.phase='main';this.mainIndex=0;this.reviewIndex=0;this.reviewQueue=[];this.reviewed=[];
    this.results={};this.streak=0;this.bestStreak=0;this.correctEvent=0;this.elapsed=0;this.runningSince=this.now();this.prepare();
  }
  get question(){const id=this.phase==='review'?this.reviewQueue[this.reviewIndex]:this.course.order[this.mainIndex];return this.course.questions.find(q=>q.id===id);}
  get isQuestion(){return this.phase==='main'||this.phase==='review';}
  get progress(){
    const completed=Object.entries(this.results).filter(([id,result])=>result.correct||this.course.questions.find(q=>q.id===id).type!=='translate').length;
    return Math.min(9,completed+this.reviewed.length);
  }
  get progressPercent(){
    return this.course.order.reduce((sum,id,index)=>{
      const q=this.course.questions.find(q=>q.id===id),result=this.results[id];
      const done=this.reviewed.includes(id)||(result&&(result.correct||q.type!=='translate'));
      return sum+(done?PROGRESS_WEIGHTS[index]:0);
    },0);
  }
  get stats(){const correct=Object.values(this.results).filter(r=>r.correct).length;return {correct,total:9,accuracy:Math.round(correct/9*100),milliseconds:this.elapsed+(this.runningSince===null?0:this.now()-this.runningSince),bestStreak:this.bestStreak};}
  prepare(){
    this.selected=[];this.feedback=null;this.paired=[];this.pairSelection={left:null,right:null};this.pairFlash=null;this.pairHadError=false;
    const q=this.question;
    this.bank=q?.words?shuffle(q.words.map(w=>w.id),this.random):[];
    if(q?.type==='match'){this.left=shuffle(q.pairs.map(p=>p.id),this.random);this.right=shuffle(q.pairs.map(p=>p.id),this.random);}
  }
  pause(){if(this.runningSince!==null){this.elapsed+=this.now()-this.runningSince;this.runningSince=null;}}
  resume(){if(this.isQuestion&&this.runningSince===null)this.runningSince=this.now();}
  markCorrect(){this.streak++;this.correctEvent++;this.bestStreak=Math.max(this.bestStreak,this.streak);}
  markWrong(){this.streak=0;}
  selectWord(id){
    if(!this.isQuestion||this.feedback||this.question.type!=='translate'||!this.question.words.some(w=>w.id===id))return false;
    const i=this.selected.indexOf(id);if(i<0)this.selected.push(id);else this.selected.splice(i,1);return true;
  }
  checkTranslation(){
    if(!this.isQuestion||this.question.type!=='translate'||this.feedback||!this.selected.length)return false;
    const correct=this.question.answers.some(a=>a.length===this.selected.length&&a.every((id,i)=>id===this.selected[i]));
    if(correct)this.markCorrect();else this.markWrong();
    this.finishQuestion(correct);return true;
  }
  finishQuestion(correct){
    if(this.phase==='main'){
      this.results[this.question.id]={correct};
      if(!correct&&this.question.type==='translate'&&!this.reviewQueue.includes(this.question.id))this.reviewQueue.push(this.question.id);
    } else if(this.phase==='review'&&!this.reviewed.includes(this.question.id))this.reviewed.push(this.question.id);
    this.feedback={correct,review:this.phase==='review'};
  }
  selectPair(side,id){
    if(!this.isQuestion||this.question.type!=='match'||this.feedback||this.pairFlash||!['left','right'].includes(side)||this.paired.includes(id)||!this.question.pairs.some(p=>p.id===id))return false;
    this.pairSelection[side]=id;
    const {left,right}=this.pairSelection;
    if(left&&right){
      const correct=left===right;this.pairFlash={left,right,correct};
      if(correct){this.paired.push(left);}else{this.pairHadError=true;this.markWrong();}
    }
    return true;
  }
  settlePair(){
    if(!this.pairFlash)return false;
    this.pairFlash=null;this.pairSelection={left:null,right:null};
    if(this.paired.length===this.question.pairs.length){
      if(!this.pairHadError)this.markCorrect();
      this.finishQuestion(!this.pairHadError);this.feedback={correct:true,review:false};
    }
    return true;
  }
  continueSpeaking(){
    if(!this.isQuestion||this.question.type!=='speak'||this.feedback)return false;
    this.markCorrect();this.finishQuestion(true);return this.advance();
  }
  advance(){
    if(!this.isQuestion||!this.feedback)return false;
    if(this.phase==='main'){
      this.mainIndex++;
      if(this.mainIndex>=this.course.order.length){if(this.reviewQueue.length)this.phase='review';else this.complete();}
    }else{this.reviewIndex++;if(this.reviewIndex>=this.reviewQueue.length)this.complete();}
    if(this.isQuestion)this.prepare();return true;
  }
  complete(){this.pause();this.phase='summary';this.feedback=null;}
  startAdvertisement(){if(this.phase!=='summary')return false;this.phase='ad';return true;}
  finishAdvertisement(gate){if(this.phase!=='ad'||!gate?.complete)return false;this.phase='qr';return true;}
}

// Track actually played forward intervals, rejecting seeks, background time and fast playback.
export class AdGate {
  constructor(duration=15){this.duration=duration;this.watched=0;this.mediaWatched=0;this.wallWatched=0;this.lastMedia=0;this.lastClock=null;this.playing=false;this.ended=false;}
  update(mediaTime,clockMs,playing=true,visible=true){
    const delta=mediaTime-this.lastMedia;
    if(this.lastClock!==null&&this.playing&&playing&&visible&&delta>=0){
      const wall=Math.max(0,(clockMs-this.lastClock)/1000);
      if(delta<=wall+0.25){this.mediaWatched+=delta;this.wallWatched+=wall;this.watched=Math.min(this.mediaWatched,this.wallWatched);}
    }
    this.lastMedia=mediaTime;this.lastClock=clockMs;this.playing=playing&&visible;
  }
  markEnded(){this.ended=true;}
  get complete(){return this.ended&&this.watched>=this.duration-0.15;}
  get remaining(){return Math.max(0,Math.ceil(this.duration-this.watched));}
}
