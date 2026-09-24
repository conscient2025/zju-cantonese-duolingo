import {mkdir,readdir,copyFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {course} from '../dist/content/course.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const materialRoot=path.join(root,'materials'),output=path.join(root,'dist','media');
const manifest={audio:{},advertisement:null,qrCodes:[]};
const acceptedAudio=new Set(['.mp3','.m4a','.wav']);
const missing=[];
async function findFile(directory,stem,extensions){
 let files;try{files=await readdir(directory);}catch(error){if(error.code==='ENOENT')return null;throw error;}
 const matches=files.filter(f=>path.parse(f).name===stem&&extensions.has(path.extname(f).toLowerCase()));
 if(matches.length>1)throw new Error(`发现同名不同格式文件，请只保留一个：${path.join(directory,stem)}`);
 return matches.length?path.join(directory,matches[0]):null;
}
async function copy(source,key){
 const destination=path.join(output,key+path.extname(source).toLowerCase());
 await mkdir(path.dirname(destination),{recursive:true});await copyFile(source,destination);
 return './media/'+key.split(path.sep).join('/')+path.extname(source).toLowerCase();
}
for(const q of course.questions){
 if(q.type==='speak'){
  const source=await findFile(path.join(materialRoot,'跟读'),`${q.id}-${q.character==='bear'?'熊二':'拽姐'}`,acceptedAudio);
  if(source)manifest.audio[q.audioKey]=await copy(source,q.audioKey);else missing.push(q.audioKey);
 }else for(const item of q.words||q.pairs){
  const stem=item.audioKey.split('/')[1];
  const source=await findFile(path.join(materialRoot,q.type==='translate'?'翻译':'配对',q.id),stem,acceptedAudio);
  if(source)manifest.audio[item.audioKey]=await copy(source,item.audioKey);else missing.push(item.audioKey);
 }
}
const ad=await findFile(path.join(materialRoot,'广告'),'粤社广告',new Set(['.mp4']));
if(ad)manifest.advertisement=await copy(ad,'advertisement');
const qrDefinitions=[
 {id:'signup',name:'报名表',title:'填写报名表'},
 {id:'group',name:'纳新群',title:'加入 QQ 纳新群'},
 {id:'account',name:'公众号',title:'关注粤社公众号'},
];
for(const {name,...details} of qrDefinitions){
 const source=await findFile(path.join(materialRoot,'二维码'),name,new Set(['.svg','.png','.jpg','.jpeg','.webp']));
 if(source)manifest.qrCodes.push({...details,label:name,src:await copy(source,`qr-${details.id}`)});
}
// Keep accepting the original single-image material for existing installations.
if(!manifest.qrCodes.length){
 const source=await findFile(path.join(materialRoot,'二维码'),'招新二维码',new Set(['.svg','.png','.jpg','.jpeg','.webp']));
 if(source)manifest.qrCodes.push({id:'signup',label:'报名',title:'加入粤语社',src:await copy(source,'qr-code')});
}
await mkdir(path.join(root,'dist','content'),{recursive:true});
await writeFile(path.join(root,'dist','content','media.json'),JSON.stringify(manifest,null,2)+'\n');
process.stdout.write(`已接入 ${Object.keys(manifest.audio).length} 段录音；待补充 ${missing.length} 段。\n缺失录音：${missing.join('、')||'无'}\n广告：${ad?'已接入':'占位演示'}；二维码：${manifest.qrCodes.length} 张。\n`);
