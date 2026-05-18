import { NextRequest, NextResponse } from 'next/server';
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, message: 'Telegram Cron placeholder. Chuyển trigger Telegram sang Vercel Cron ở giai đoạn sau.' });
}
