import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {RemoteOrderPage} from './RemoteOrderPage';
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear()});
const session={active:true,business:{id:'harbor',name:'Harbor Café',location:'Kemang'},tableName:'T01',menu:[{id:'coffee',name:'Kopi',category:'Drinks',description:'Fresh',price:20000,variations:[]}],last:null};
describe('RemoteOrderPage',()=>{
 it('submits a customer order and shows the approval wait state',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(session),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({request:{id:'r1',sessionId:'s1',businessId:'harbor',tableId:'T01',tableName:'T01',status:'pending',lines:[],customerNote:'',createdAt:new Date().toISOString()}}),{status:201}));
  const user=userEvent.setup();render(<MemoryRouter initialEntries={['/remote-order/s1']}><Routes><Route path="/remote-order/:id" element={<RemoteOrderPage/>}/></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading',{name:'Order from T01'})).toBeVisible();await user.click(screen.getByRole('button',{name:'Add Kopi'}));await user.click(screen.getByRole('button',{name:/Send for approval/}));expect(await screen.findByRole('heading',{name:'Waiting for cashier approval'})).toBeVisible();
  expect(fetcher.mock.calls[1][0]).toContain('/remote/order');
 });
});
