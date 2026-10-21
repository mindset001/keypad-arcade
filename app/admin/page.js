import { notFound } from 'next/navigation';
import { adminStatus } from '@/lib/admin-guard';
import AdminUsers from './AdminUsers';

export const dynamic = 'force-dynamic';

/* The title and noindex rule are returned ONLY to admins; everyone else gets the site's defaults, so the 404 they
   see does not carry an admin title. (generateMetadata and the page share one cached admin lookup.) */
export async function generateMetadata(){
  return (await adminStatus()) === 'admin' ? { title:'Players — Keypad Arcade admin', robots:{ index:false, follow:false } } : {};
}

/* Only admins ever receive this page. Logged-out visitors and ordinary players get the normal 404 with no admin UI,
   title or data. (The route's bundle names can still show in the 404's page data, so don't rely on the page being
   secret: the real protection is this check plus the same check inside /api/admin/users.) */
export default async function AdminPage(){
  const status = await adminStatus();
  if(status === 'denied') notFound();
  if(status === 'down'){
    return <main style={{ padding:32, color:'#e8ebff', font:'16px system-ui' }}><h1>Server unavailable</h1><p>The database could not be reached. Open <code>/api/health</code> to see why, then reload.</p></main>;
  }
  return <AdminUsers />;
}
