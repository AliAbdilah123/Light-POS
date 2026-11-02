import type {ReactNode} from 'react';

export function EmptyState({title,children}:{title:string;children?:ReactNode}){return <div className="empty"><span aria-hidden="true">◇</span><h3>{title}</h3>{children}</div>}
