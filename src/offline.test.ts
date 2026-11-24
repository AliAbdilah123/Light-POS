import {describe,expect,it} from 'vitest';
import {compactOperation,createOperation,sortOperations} from './offline';

describe('offline operation contract',()=>{
  it('creates stable scoped operation envelopes',()=>{const operation=createOperation({userId:'u1',business:'harbor',baseRevision:7,action:'Save',data:{value:1},id:'fixed',createdAt:'2026-11-24T12:00:00.000Z'});expect(operation).toEqual({id:'fixed',userId:'u1',business:'harbor',baseRevision:7,action:'Save',createdAt:'2026-11-24T12:00:00.000Z',data:{value:1}})});
  it('replays operations in creation order without crossing users or tenants',()=>{const rows=[{id:'b',userId:'u1',business:'harbor',baseRevision:1,action:'b',createdAt:'2026-11-24T12:01:00Z',data:{}},{id:'a',userId:'u1',business:'harbor',baseRevision:1,action:'a',createdAt:'2026-11-24T12:00:00Z',data:{}},{id:'x',userId:'u2',business:'harbor',baseRevision:1,action:'x',createdAt:'2026-11-24T11:00:00Z',data:{}}];expect(sortOperations(rows,'u1','harbor').map(row=>row.id)).toEqual(['a','b'])});
  it('compacts cumulative snapshots without changing the stable id or original revision',()=>{const first=createOperation({userId:'u1',business:'harbor',baseRevision:7,action:'First',data:{notes:['first']},id:'fixed',createdAt:'2026-11-24T12:00:00.000Z'});expect(compactOperation(first,{notes:['first','second']},'Second')).toEqual({...first,action:'Second',data:{notes:['first','second']}})});
  it('does not compact snapshots across users or tenants',()=>{const first=createOperation({userId:'u1',business:'harbor',baseRevision:7,action:'First',data:{value:1},id:'fixed',createdAt:'2026-11-24T12:00:00.000Z'});expect(()=>compactOperation(first,{value:2},'Second',{userId:'u2',business:'harbor'})).toThrow('scope')});
});
