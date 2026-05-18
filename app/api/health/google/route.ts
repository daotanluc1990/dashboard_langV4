import { NextResponse } from 'next/server';
import { inspectGoogleWorkbook, loadWorkbook } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const workbook = await loadWorkbook(true);
    const debug = process.env.DASHBOARD_DEBUG === '1' ? await inspectGoogleWorkbook() : undefined;
    return NextResponse.json({
      ok: true,
      dashboardRows: workbook.dashboard.length,
      menuRows: workbook.menuSales.length,
      feedbackRows: workbook.feedback.length,
      debug
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown Google Sheets error'
      },
      { status: 500 }
    );
  }
}
