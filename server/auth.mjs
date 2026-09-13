import {createHash,randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const hashToken=token=>createHash('sha256').update(token).digest('hex');
export async function passwordHash(password,salt=randomBytes(16).toString('hex')){const derived=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});return{salt,hash:Buffer.from(derived).toString('hex')}}
export async function passwordMatches(password,salt,expected){const derived=Buffer.from(await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024})),actual=Buffer.from(expected,'hex');return actual.length===derived.length&&timingSafeEqual(actual,derived)}
export const safeEqual=(a,b)=>{const left=Buffer.from(String(a)),right=Buffer.from(String(b));return left.length===right.length&&timingSafeEqual(left,right)};
