import { NextResponse } from 'next/server';
import { addSub } from '@/lib/sheets';
import { authed } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!authed(req)) return NextResponse.json({ error: 'الرقم السري غلط' }, { status: 401 });
  try {
    const sub = await req.json();
    if (!sub || !sub.endpoint) return NextResponse.json({ error: 'اشتراك غير صالح' }, { status: 400 });
    await addSub(sub);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
