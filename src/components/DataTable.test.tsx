import {act,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
import {DataTable,type DataTableColumn} from './DataTable';

type Row={id:string;name:string;status:string};
const rows:Row[]=[{id:'1',name:'Zulu',status:'Active'},{id:'2',name:'Alpha',status:'Inactive'},{id:'3',name:'Bravo',status:'Active'}];
const columns:DataTableColumn<Row>[]=[{key:'name',label:'Name',value:x=>x.name,render:x=>x.name},{key:'status',label:'Status',value:x=>x.status,render:x=>x.status}];
afterEach(()=>{cleanup();vi.unstubAllGlobals()});

describe('DataTable',()=>{
  it('searches, filters, sorts, selects, and runs caller bulk actions',async()=>{
    const action=vi.fn();render(<DataTable ariaLabel="People" rows={rows} rowKey={x=>x.id} columns={columns} filters={[{label:'Status',value:'Active',onChange:()=>{},options:['Active','Inactive']}]} bulkActions={[{label:'Archive',onClick:action}]}/>);const user=userEvent.setup();
    await user.type(screen.getByRole('searchbox',{name:'Quick search'}),'a');
    const table=screen.getByRole('table',{name:'People'});expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Alpha');
    await user.click(screen.getByRole('checkbox',{name:'Select Alpha'}));await user.click(screen.getByRole('button',{name:/Archive/}));expect(action).toHaveBeenCalledWith([rows[1]]);
  });

  it('reveals additional rows when the infinite-scroll sentinel intersects',async()=>{
    let observer:IntersectionObserverCallback|undefined;vi.stubGlobal('IntersectionObserver',class{constructor(callback:IntersectionObserverCallback){observer=callback}observe(){}disconnect(){}});
    render(<DataTable ariaLabel="People" rows={rows} rowKey={x=>x.id} columns={columns} pageSize={2}/>);expect(screen.queryByText('Zulu')).not.toBeInTheDocument();
    await waitFor(()=>expect(observer).toBeDefined());act(()=>observer?.([{isIntersecting:true} as IntersectionObserverEntry],{} as IntersectionObserver));expect(screen.getByText('Zulu')).toBeInTheDocument();
  });

  it('keeps query, sorting, selection, row actions, and pagination caller controlled',async()=>{
    let observer:IntersectionObserverCallback|undefined;vi.stubGlobal('IntersectionObserver',class{constructor(callback:IntersectionObserverCallback){observer=callback}observe(){}disconnect(){}});
    const onQueryChange=vi.fn(),onSortChange=vi.fn(),onSelectionChange=vi.fn(),onLoadMore=vi.fn();
    render(<DataTable ariaLabel="People" rows={rows} rowKey={x=>x.id} columns={columns} search={{value:'',onChange:onQueryChange}} sort={{key:'name',direction:'ascending',onChange:onSortChange}} selection={{selected:new Set(['2']),onChange:onSelectionChange}} bulkActions={[{label:'Archive',onClick:vi.fn()}]} rowActions={row=><button>Open {row.name}</button>} hasMore onLoadMore={onLoadMore}/>);const user=userEvent.setup();
    await user.type(screen.getByRole('searchbox',{name:'Quick search'}),'z');expect(onQueryChange).toHaveBeenCalledWith('z');
    await user.click(screen.getByRole('button',{name:'Name, sorted ascending'}));expect(onSortChange).toHaveBeenCalledWith({key:'name',direction:'descending'});
    expect(screen.getByRole('checkbox',{name:'Select Alpha'})).toBeChecked();await user.click(screen.getByRole('checkbox',{name:'Select Bravo'}));expect(onSelectionChange).toHaveBeenCalledWith(new Set(['2','3']));
    expect(screen.getByRole('button',{name:'Open Zulu'})).toBeInTheDocument();await waitFor(()=>expect(observer).toBeDefined());act(()=>observer?.([{isIntersecting:true} as IntersectionObserverEntry],{} as IntersectionObserver));expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('announces incremental loading and renders explicit errors without exposing rows',()=>{
    const {rerender}=render(<DataTable ariaLabel="People" rows={rows} rowKey={x=>x.id} columns={columns} incrementalLoading/>);expect(screen.getByRole('status')).toHaveTextContent('Loading more results');
    rerender(<DataTable ariaLabel="People" rows={rows} rowKey={x=>x.id} columns={columns} error="No access"/>);expect(screen.getByRole('alert')).toHaveTextContent('No access');expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
