import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {ensureDevelopmentAccounts,ensureSeedReceipts,initializeSchema} from './app.mjs';
import {seedState} from './seed.mjs';

export async function resetSeedDatabase(dbPath,{resetPasswords=false,reference=new Date()}={}){
  const resolved=resolve(dbPath),backup=`${resolved}.backup-${reference.toISOString().replaceAll(':','-')}`,existed=existsSync(resolved),db=new DatabaseSync(resolved);
  try{
    if(existed)db.prepare('VACUUM INTO ?').run(backup);
    initializeSchema(db);db.exec('BEGIN IMMEDIATE');
    db.prepare('INSERT INTO app_state(id,revision,data) VALUES(1,1,?) ON CONFLICT(id) DO UPDATE SET revision=app_state.revision+1,data=excluded.data').run(JSON.stringify(seedState(reference)));
    db.exec('DELETE FROM sessions; DELETE FROM audit_events; DELETE FROM receipts');
    await ensureDevelopmentAccounts(db,{resetPasswords});ensureSeedReceipts(db,reference);db.exec('COMMIT');
    return{dbPath:resolved,backup:existed?backup:null};
  }catch(error){try{db.exec('ROLLBACK')}catch{}throw error}finally{db.close()}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv[2]!=='RESET_DEVELOPMENT_DATA'){
    console.error('Refusing reset. Usage: npm run seed:reset -- RESET_DEVELOPMENT_DATA [--reset-passwords]');
    process.exit(2);
  }
  const result=await resetSeedDatabase(process.env.POS_DB_PATH||'sqlite.db',{resetPasswords:process.argv.includes('--reset-passwords')});
  console.log(`Seed reset complete: ${result.dbPath}`);
  console.log(result.backup?`Backup: ${result.backup}`:'Backup: not needed (new database)');
}
