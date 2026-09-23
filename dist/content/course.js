// 9道题的文字、粤拼、词块和录音编号与 materials/题目说明.txt 对应。
// 题号与出场顺序独立，材料调整时需同步此文件。
const fuji = [
  ['誰能','seoi4 nang4'],['憑愛意','pang4 oi3 ji3'],['要','jiu3'],['富士山','fu3 si6 saan1'],['私有','si1 jau5'],
];
const eason = [
  ['陳奕迅','can4 jik6 seon3'],['首首歌','sau2 sau2 go1'],['都','dou1'],['好聽','hou2 teng1'],['真係','zan1 hai6'],['有料','jau5 liu2'],
];
const translations={
  fuji:{prompt:'谁能凭爱意要富士山私有。',answer:'誰能憑愛意要富士山私有。',character:'lily',items:fuji},
  eason:{prompt:'陈奕迅每首歌都好听，真是有实力。',answer:'陳奕迅首首歌都好聽，真係有料。',character:'oscar',items:eason},
  freedom:{prompt:'原谅我这一生不羁放纵爱自由',answer:'原諒我這一生不羈放縱愛自由',character:'lily',items:[['原諒我','jyun4 loeng6 ngo5'],['這一生','ze5 jat1 sang1'],['不羈','bat1 gei1'],['放縱','fong3 zung3'],['愛','oi3'],['自由','zi6 jau4']]},
  campus:{prompt:'我们一起去紫金港。',answer:'我哋一齊去紫金港。',character:'oscar',items:[['我哋','ngo5 dei6'],['一齊','jat1 cai4'],['去','heoi3'],['紫金港','zi2 gam1 gong2']]},
  dreams:{prompt:'做人如果没有梦想，和一条咸鱼有什么区别？',answer:'做人如果冇夢想，同條鹹魚有乜分別？',character:'lily',items:[['做人','zou6 jan4'],['如果','jyu4 gwo2'],['冇','mou5'],['夢想','mung6 soeng2'],['同條','tung4 tiu4'],['鹹魚','haam4 jyu2'],['有','jau5'],['乜','mat1'],['分別','fan1 bit6']]},
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
const readings={
  S01:{meaning:'命运就算颠沛流离，命运就算曲折离奇。',items:[['命運','ming6 wan6'],['就','zau6'],['算','syun3'],['顛沛流離，','din1 pui3 lau4 lei4'],['命運','ming6 wan6'],['就','zau6'],['算','syun3'],['曲折離奇。','kuk1 zit3 lei4 kei4']]},
  S02:{meaning:'我在浙江大学读书。',items:[['我','ngo5'],['喺','hai2'],['浙江','zit3 gong1'],['大學','daai6 hok6'],['讀書。','duk6 syu1']]},
};
function speaking(id,character){
  const {items,meaning}=readings[id];
  return {id,type:'speak',character,audioKey:id,prompt:items.map(([text])=>text).join(''),meaning,words:items.map(([text,jyutping])=>({text,jyutping}))};
}

export const course = {
  id:'zju-yue-demo', demo:true,
  // 5 翻译 + 2 配对 + 2 跟读，调整此数组即可更改顺序。
  order:['T01','M01','T02','S01','T03','M02','T04','S02','T05'],
  questions:[
    translation('T01','fuji'), translation('T02','eason'),
    translation('T03','freedom'), translation('T04','campus'), translation('T05','dreams'),
    matching('M01',[['中意','喜欢'],['單車','自行车'],['靚女','美女'],['靚仔','帅哥']]),
    matching('M02',[['蝦餃','虾饺'],['鳳爪','鸡脚'],['排骨','排骨'],['牛肉丸','牛肉丸']]),
    speaking('S01','bear'),speaking('S02','lily'),
  ],
  ad:{duration:15},
};
