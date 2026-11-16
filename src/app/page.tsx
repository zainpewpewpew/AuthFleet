import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Root() {
  const jar = await cookies();
  const session = jar.get('af_session')?.value;
  redirect(session ? '/dashboard' : '/login');
}
