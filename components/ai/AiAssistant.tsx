'use client';

import { useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import type { DashboardFilters, DashboardPayload } from '@/types/dashboard';

type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
};

const QUICK_PROMPTS = [
  'Tóm tắt CEO trong 5 dòng',
  'Chi nhánh nào cần xử lý ngay?',
  'Chi phí nào đang ăn mòn lợi nhuận?',
  'Doanh thu tăng/giảm do đâu?',
  'Đề xuất 3 việc cần làm hôm nay'
];

function formatAnswer(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function AiAssistant({
  filters,
  payload
}: {
  filters: DashboardFilters;
  payload: DashboardPayload | null;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'quick' | 'deep'>('quick');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const currentTabLabel = useMemo(() => {
    return payload?.tab || filters.tab || 'dashboard';
  }, [filters.tab, payload?.tab]);

  async function ask(q = question) {
    const text = q.trim();
    if (!text || loading) return;

    setOpen(true);
    setMessages((m) => [...m, { role: 'user', text }]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          mode,
          filters,
          snapshot: payload
        })
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'AI lỗi');

      setMessages((m) => [...m, { role: 'ai', text: json.answer || 'AI chưa có câu trả lời.' }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: 'ai',
          text: e instanceof Error ? e.message : 'AI lỗi không xác định'
        }
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`ai-fab ${open ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Mở Trợ lý AI CEO"
        title="Trợ lý AI CEO"
      >
        {open ? <X size={20} /> : <Bot size={22} />}
        <span>AI</span>
      </button>

      {open ? (
        <aside className="ai-panel" aria-label="Trợ lý AI CEO">
          <div className="ai-panel-head">
            <div className="ai-title-wrap">
              <div className="ai-avatar">
                <Sparkles size={17} />
              </div>
              <div>
                <h3>Trợ lý AI CEO</h3>
                <p>Đang phân tích: {currentTabLabel}</p>
              </div>
            </div>

            <div className="ai-head-actions">
              <label className="ai-mode-select">
                <select value={mode} onChange={(e) => setMode(e.target.value as 'quick' | 'deep')}>
                  <option value="quick">Quick AI</option>
                  <option value="deep">Deep Analyst</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <button type="button" className="ai-close" onClick={() => setOpen(false)} aria-label="Đóng AI">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="ai-quick-row">
            {QUICK_PROMPTS.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} disabled={loading}>
                {q}
              </button>
            ))}
          </div>

          <div className="ai-chat-body">
            {messages.length === 0 ? (
              <div className="ai-empty">
                <MessageCircle size={28} />
                <b>Hỏi tự do về dashboard</b>
                <span>Ví dụ: “Chi nhánh nào cần xử lý?”, “Chi phí nào bất thường?”, “Hôm nay nên làm gì trước?”</span>
              </div>
            ) : null}

            {messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`ai-message ${m.role}`}>
                {m.role === 'ai' ? (
                  <div className="ai-message-lines">
                    {formatAnswer(m.text).map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p>{m.text}</p>
                )}
              </div>
            ))}

            {loading ? <div className="ai-message ai loading">Đang phân tích dữ liệu hiện tại...</div> : null}
          </div>

          <form
            className="ai-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Hỏi tự do về dashboard..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
            />
            <button type="submit" disabled={loading || !question.trim()}>
              <Send size={16} />
              <span>Gửi</span>
            </button>
          </form>
        </aside>
      ) : null}
    </>
  );
}
