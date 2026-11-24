import {describe,expect,it} from 'vitest';
import {buildServiceWorker,serviceWorkerCachePrefix} from './serviceWorker';

describe('buildServiceWorker',()=>{
  it('versions the cache by build and precaches the built shell asset list',()=>{
    const source=buildServiceWorker({base:'/projects/light-pos/',version:'build-20261124-1',assets:['assets/index-A.js','assets/index-B.css']});
    expect(source).toContain(`CACHE="light-pos-shell-build-20261124-1"`);
    expect(source).toContain('/projects/light-pos/assets/index-A.js');
    expect(source).toContain('/projects/light-pos/assets/index-B.css');
    expect(source).toContain("key.startsWith(\"light-pos-shell-\")");
  });
  it('removes only prior app caches on activate, never API responses',()=>{
    const source=buildServiceWorker({base:'/app/',version:'2',assets:[]});
    expect(source).toContain('url.pathname.startsWith(BASE+\'api/\')');
    expect(source).toContain(`${serviceWorkerCachePrefix}`)
  });
});