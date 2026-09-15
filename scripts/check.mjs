import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {course} from '../dist/content/course.js';
import {validateCourse} from '../dist/engine.js';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
validateCourse(course);
for(const file of ['game.js','engine.js','content/course.js']){
 const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
 if(result.status!==0)throw new Error(result.stderr);
}
for(const file of ['index.html','game.css','game.js','engine.js','content/course.js','content/media.json','assets/lily-reference.jpg','assets/lily-happy-reference.jpg','assets/bear-reference.jpg','assets/bear-happy-reference.jpg','assets/oscar-reference.jpg','assets/duo-reference.jpg'])await stat(path.join(root,file));
const media=JSON.parse(await readFile(path.join(root,'content/media.json'),'utf8'));
for(const url of [...Object.values(media.audio),media.advertisement,media.qrCode].filter(Boolean)){
 if(!url.startsWith('./media/'))throw new Error(`素材必须使用本地相对路径：${url}`);
 const target=path.resolve(root,url);if(!target.startsWith(root))throw new Error('素材路径越界');await stat(target);
}
console.log('通过：9题配置、脚本语法、页面入口、角色图片及已接入素材引用。');
