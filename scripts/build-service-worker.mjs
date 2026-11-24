import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildServiceWorker} from '../src/serviceWorker.ts';

const base='/projects/light-pos/';
const outDir=process.argv[2]||'dist';
const distIndex=join(outDir,'index.html');
const html=readFileSync(distIndex,'utf8');
const assets=[...html.matchAll(/(?:src|href)="[^"]*?\/assets\/([^"?]+)/g)].map(match=>`assets/${match[1]}`);
const unique=[...new Set(assets)].sort();
const version=`build-${createHash('sha1').update(base+unique.join('|')).digest('hex').slice(0,12)}`;
mkdirSync(join(outDir,'assets'),{recursive:true});
writeFileSync(join(outDir,'sw.js'),buildServiceWorker({base,version,assets:unique}));
console.log(`service worker ${version} precached ${unique.length} assets`);