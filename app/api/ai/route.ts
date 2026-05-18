import { NextRequest, NextResponse } from 'next/server';
import type { DashboardFilters } from '@/types/dashboard';
import { loadWorkbook } from '@/lib/google-sheets';
import { buildDashboardPayload } from '@/lib/build-dashboard';

export const dynamic = 'force-dynamic';

const DEFAULT_SYSTEM_PROMPT = `Bạn là Trợ lý AI chuyên sâu cho CEO chuỗi F&B. Chỉ phân tích dựa trên dữ liệu dashboard được cung cấp. Nếu thiếu dữ liệu, nói rõ chưa đủ dữ liệu để kết luận, không tự bịa số. Trả lời ngắn gọn, ưu tiên cảnh báo, nguyên nhân và hành động đề xuất.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = String(body.question || '').trim();
    if (!question) return NextResponse.json({ ok: false, error: 'Thiếu câu hỏi.' }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ ok: false, error: 'Thiếu GEMINI_API_KEY trong environment.' }, { status: 500 });

    const filters = body.filters as DashboardFilters;
    const mode = body.mode === 'deep' ? 'deep' : 'quick';
    const workbook = await loadWorkbook(false);
    const payload = buildDashboardPayload(workbook, filters);
    const compact = {
      mode,
      tab: payload.title,
      filters: payload.meta.filters,
      period: payload.meta.periodLabel,
      kpis: payload.kpis,
      widgets: payload.widgets.map((w) => ({ id: w.id, title: w.title, summary: w.summary, rows: (w.data || []).slice(0, mode === 'deep' ? 20 : 8) }))
    };
    const prompt = `${DEFAULT_SYSTEM_PROMPT}\n\nDỮ LIỆU DASHBOARD JSON:\n${JSON.stringify(compact).slice(0, mode === 'deep' ? 28000 : 12000)}\n\nCÂU HỎI CEO: ${question}`;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'Gemini API error');
    const answer = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n') || 'Không có phản hồi.';
    return NextResponse.json({ ok: true, answer });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
