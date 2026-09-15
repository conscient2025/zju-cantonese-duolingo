import test from 'node:test';
import assert from 'node:assert/strict';
import {Lesson,AdGate,validateCourse,PROGRESS_WEIGHTS} from '../dist/engine.js';
import {course} from '../dist/content/course.js';

function answer(lesson,correct=true){
 const q=lesson.question;
 if(q.type==='translate'){
  lesson.selected=correct?[...q.answers[0]]:[q.answers[0][0]];
  lesson.checkTranslation();lesson.advance();
 }else if(q.type==='speak')lesson.continueSpeaking();
 else{
  if(!correct){lesson.selectPair('left',q.pairs[0].id);lesson.selectPair('right',q.pairs[1].id);lesson.settlePair();}
  for(const p of q.pairs){lesson.selectPair('left',p.id);lesson.selectPair('right',p.id);lesson.settlePair();}
  lesson.advance();
 }
}
test('fixed nine questions finish with 9/9 and a nine-question streak',()=>{
 let time=0;const lesson=new Lesson(course,()=>time);
 for(let i=0;i<9;i++){time+=1000;answer(lesson);}
 assert.equal(lesson.phase,'summary');assert.equal(lesson.stats.correct,9);assert.equal(lesson.stats.accuracy,100);
 assert.equal(lesson.streak,9);assert.equal(lesson.correctEvent,9);assert.equal(lesson.progress,9);assert.equal(lesson.stats.milliseconds,9000);
 time+=5000;assert.equal(lesson.stats.milliseconds,9000);
});
test('translation errors reappear once; even a second error finishes without another retry or score change',()=>{
 const lesson=new Lesson(course);
 while(lesson.phase==='main')answer(lesson,!['T01','T02'].includes(lesson.question.id));
 assert.deepEqual(lesson.reviewQueue,['T01','T02']);assert.equal(lesson.stats.correct,7);assert.equal(lesson.progress,7);
 answer(lesson,false);assert.equal(lesson.phase,'review');assert.equal(lesson.question.id,'T02');
 answer(lesson,true);assert.equal(lesson.phase,'summary');assert.equal(lesson.stats.correct,7);
 assert.equal(lesson.stats.accuracy,78);assert.equal(lesson.progress,9);assert.deepEqual(lesson.reviewed,['T01','T02']);
});
test('wrong matches reset streak, preserve solved pairs, count whole question wrong and never queue review',()=>{
 const lesson=new Lesson(course);answer(lesson);
 const q=lesson.question;
 lesson.selectPair('left','p1');lesson.selectPair('right','p1');lesson.settlePair();assert.equal(lesson.streak,1);
 lesson.selectPair('left','p2');lesson.selectPair('right','p3');assert.equal(lesson.streak,0);
 assert.equal(lesson.selectPair('right','p2'),false);lesson.settlePair();assert.deepEqual(lesson.paired,['p1']);
 for(const p of q.pairs.slice(1)){lesson.selectPair('right',p.id);lesson.selectPair('left',p.id);lesson.settlePair();}
 assert.equal(lesson.results.M01.correct,false);assert.equal(lesson.feedback.correct,true);assert.equal(lesson.streak,0);assert.equal(lesson.correctEvent,1);
 assert.deepEqual(lesson.reviewQueue,[]);assert.equal(lesson.selectPair('left','p1'),false);
});
test('only the fourth clean match increments question score and emits one streak event',()=>{
 const lesson=new Lesson(course);answer(lesson);
 for(const [i,p] of lesson.question.pairs.entries()){
  lesson.selectPair('left',p.id);lesson.selectPair('right',p.id);
  assert.equal(lesson.streak,1);assert.equal(lesson.correctEvent,1);
  lesson.settlePair();assert.equal(lesson.streak,i===3?2:1);assert.equal(lesson.correctEvent,i===3?2:1);
  assert.equal(lesson.stats.correct,i===3?2:1);
 }
 assert.equal(lesson.settlePair(),false);assert.equal(lesson.correctEvent,2);
});
test('progress grows more early, fills completely, and is independent of question ordering',()=>{
 for(const order of [course.order,[...course.order].reverse()]){
  const lesson=new Lesson({...course,order});let previous=0;
  for(let i=0;i<9;i++){
   answer(lesson);const growth=lesson.progressPercent-previous;
   assert.equal(growth,PROGRESS_WEIGHTS[i]);if(i)assert.ok(growth<PROGRESS_WEIGHTS[i-1]);previous=lesson.progressPercent;
  }
  assert.equal(lesson.progressPercent,100);
 }
});
test('wrong translations earn their deferred progress once, including a failed review',()=>{
 const lesson=new Lesson(course);let previous=0;
 while(lesson.phase==='main'){
  answer(lesson,!['T01','T05'].includes(lesson.question.id));assert.ok(lesson.progressPercent>=previous);previous=lesson.progressPercent;
 }
 assert.equal(lesson.progressPercent,76);answer(lesson,false);assert.equal(lesson.progressPercent,94);
 answer(lesson,false);assert.equal(lesson.progressPercent,100);assert.equal(lesson.stats.correct,7);
});
test('all nine testing questions have distinct sentence or matching content',()=>{
 const contents=course.questions.map(q=>q.type==='match'?q.pairs.map(p=>p.text).sort().join('|'):q.prompt);
 assert.equal(new Set(contents).size,9);
 const sentences=course.questions.filter(q=>q.type!=='match').map(q=>q.words.map(w=>w.text).join(''));
 assert.equal(new Set(sentences).size,7);
});
test('word removal, invalid IDs and repeated checking cannot duplicate results or streak',()=>{
 const lesson=new Lesson(course);assert.equal(lesson.checkTranslation(),false);
 assert.equal(lesson.selectWord('bogus'),false);lesson.selectWord('w1');lesson.selectWord('w1');assert.deepEqual(lesson.selected,[]);
 lesson.selected=[...lesson.question.answers[0]];lesson.checkTranslation();assert.equal(lesson.streak,1);
 assert.equal(lesson.checkTranslation(),false);assert.equal(lesson.selectWord('w1'),false);assert.equal(lesson.streak,1);
});
test('both reading questions complete with one continue and do not expose grading or microphone state',()=>{
 const lesson=new Lesson(course);let reads=[];
 while(lesson.phase==='main'){if(lesson.question.type==='speak')reads.push(lesson.question.character);answer(lesson);}
 assert.deepEqual(reads,['bear','lily']);assert.equal(lesson.results.S01.correct,true);assert.equal(lesson.results.S02.correct,true);
});
test('hidden intervals are excluded from lesson time',()=>{
 let time=0;const lesson=new Lesson(course,()=>time);time=1000;lesson.pause();time=10000;
 assert.equal(lesson.stats.milliseconds,1000);lesson.resume();time=12000;assert.equal(lesson.stats.milliseconds,3000);
});
test('configuration rejects missing questions and wrong type distribution',()=>{
 assert.throws(()=>validateCourse({...course,order:course.order.slice(0,8)}));
 assert.throws(()=>validateCourse({...course,order:[...course.order.slice(0,8),'T01']}));
});
test('advertisement requires genuinely played duration and ended event before revealing QR',()=>{
 const gate=new AdGate(15);gate.update(0,0);
 for(let i=1;i<=140;i++)gate.update(i/10,i*100);
 gate.markEnded();assert.equal(gate.complete,false);
 for(let i=141;i<=150;i++)gate.update(i/10,i*100);
 assert.equal(gate.complete,true);
 const lesson=new Lesson(course);assert.equal(lesson.startAdvertisement(),false);
 while(lesson.isQuestion)answer(lesson);
 assert.equal(lesson.finishAdvertisement(gate),false);lesson.startAdvertisement();
 assert.equal(lesson.finishAdvertisement(new AdGate()),false);assert.equal(lesson.finishAdvertisement(gate),true);assert.equal(lesson.phase,'qr');
});
test('seeking to the end, background waiting and fast playback cannot satisfy the ad gate',()=>{
 const seek=new AdGate();seek.update(0,0);seek.update(15,20);seek.markEnded();assert.equal(seek.complete,false);
 const hidden=new AdGate();hidden.update(0,0);hidden.update(15,15000,true,false);hidden.markEnded();assert.equal(hidden.complete,false);
 const fast=new AdGate();fast.update(0,0);for(let i=1;i<=150;i++)fast.update(i/10,i*50);fast.markEnded();assert.equal(fast.complete,false);
});
test('normal per-frame media clock jitter does not reject a fully played advertisement',()=>{
 const gate=new AdGate();gate.update(0,0);
 for(let i=1;i<=900;i++){const media=i===900?15:i/60+(i%2?0.003:-0.003);gate.update(media,i/60*1000);}
 gate.markEnded();assert.equal(gate.complete,true);
});
