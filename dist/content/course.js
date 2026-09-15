// 9道不重复的测试题：保留截图语料，并加入用户授权编写的浙大校园例句。
// 题号与出场顺序独立。正式材料到齐后在此替换文字、粤拼与答案。
const hk = [
  ['今年','gam1 nin4'],['我要','ngo5 jiu3'],['去','heoi3'],['香港','hoeng1 gong2'],['追星','zeoi1 sing1'],
];
const eason = [
  ['陳','can4'],['奕','jik6'],['迅首','seon3 sau2'],['首歌','sau2 go1'],['都','dou1'],['好聽','hou2 teng1'],['真係','zan1 hai6'],['有料','jau5 liu2'],
];
const translations={
  hk:{prompt:'今年我要去香港追星！',answer:'今年我要去香港追星！',character:'lily',items:hk},
  eason:{prompt:'陈奕迅每首歌都好听，真是有实力。',answer:'陳奕迅首首歌都好聽，真係有料。',character:'oscar',items:eason},
  zju:{prompt:'我在浙大读书。',answer:'我喺浙大讀書。',character:'lily',items:[['我','ngo5'],['喺','hai2'],['浙大','zit3 daai6'],['讀書','duk6 syu1']]},
  campus:{prompt:'我们一起去紫金港。',answer:'我哋一齊去紫金港。',character:'oscar',items:[['我哋','ngo5 dei6'],['一齊','jat1 cai4'],['去','heoi3'],['紫金港','zi2 gam1 gong2']]},
  dinner:{prompt:'下课后去吃饭吧！',answer:'落堂之後去食飯啦！',character:'lily',items:[['落堂','lok6 tong4'],['之後','zi1 hau6'],['去','heoi3'],['食飯','sik6 faan6'],['啦','laa1']]},
};
function translation(id, variant) {
  const {items,prompt,answer,character} = translations[variant];
  return {
    id, type:'translate', character,prompt,answerText:answer,
    words:items.map(([text,jyutping],i)=>({id:`w${i+1}`,text,jyutping,audioKey:`${id}/${String(i+1).padStart(2,'0')}`})),
    answers:[items.map((_,i)=>`w${i+1}`)],
  };
}
function matching(id, items) {
  return {id,type:'match',pairs:items.map(([text,meaning],i)=>({id:`p${i+1}`,text,meaning,audioKey:`${id}/${String(i+1).padStart(2,'0')}`}))};
}
const readingWords = [
  ['聽','ting1'],['日','jat6'],['記','gei3'],['得','dak1'],['搶','coeng2'],['五','ng5'],['月','jyut6'],['天','tin1'],['演','jin2'],['唱','coeng3'],['會','wui6'],['嘅','ge3'],['飛！','fei1'],
];
const welcomeWords=[['歡迎','fun1 jing4'],['嚟','lai4'],['浙大','zit3 daai6'],['粵語社！','jyut6 jyu5 se5']];
function speaking(id,character){
  const items=character==='bear'?readingWords:welcomeWords;
  return {id,type:'speak',character,audioKey:id,prompt:items.map(([text])=>text).join(''),meaning:character==='bear'?'明天记得抢五月天演唱会的票！':'欢迎来到浙大粤语社！',words:items.map(([text,jyutping])=>({text,jyutping}))};
}

export const course = {
  id:'zju-yue-demo', demo:true,
  // 5 翻译 + 2 配对 + 2 跟读，调整此数组即可更改顺序。
  order:['T01','M01','T02','S01','T03','M02','T04','S02','T05'],
  questions:[
    translation('T01','hk'), translation('T02','eason'),
    translation('T03','zju'), translation('T04','campus'), translation('T05','dinner'),
    matching('M01',[['掛','挂'],['升職','升职'],['阿頭','领导'],['追星','追星']]),
    matching('M02',[['學生證','学生证'],['單車','自行车'],['宿舍','宿舍'],['圖書館','图书馆']]),
    speaking('S01','bear'),speaking('S02','lily'),
  ],
  ad:{duration:15},
};
