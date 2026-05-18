import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ ok: true, service: 'comtam-dashboard-next', time: new Date().toISOString() }); }
