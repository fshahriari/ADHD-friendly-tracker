import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Trash2, Sparkles, CheckCircle, X, Calendar as CalendarIcon, Check, Plus, AlertCircle, Bookmark } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { useEventStore } from '../../store/useEventStore';
import { runADHDCoach } from '../../lib/gemini';
import { brainDumpDb } from '../../lib/db';
import { Button, Spinner, toast } from '../shared';

const PLACEHOLDER = `افکارت، کارهات، ددلاین‌ها یا کلاس‌هات رو اینجا بنویس یا ویس بده...

مثال:
- فردا ساعت ۴ کلاس ریاضی دارم و یادم بنداز ۲ ساعت قبلش
- تا جمعه پروژه الگوریتم رو تحویل بدم
- حواست باشه تمرین‌های دانشگاه همیشه ۱ روز قبل یادآوری بشن`;

export default function BrainDump() {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Proposal modal state from AI
  const [proposal, setProposal] = useState(null);
  const [acceptedTasks, setAcceptedTasks] = useState(new Set());
  const [acceptedEvents, setAcceptedEvents] = useState(new Set());

  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  const { tasks, addTask } = useTaskStore();
  const { events, coachRules, addEvent, addCoachRule } = useEventStore();

  // Auto-focus on mount
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Voice input (Web Speech API)
  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند', 'error'); return; }

    const recognition = new SR();
    recognition.lang = 'fa-IR';
    recognition.continuous = true;
    recognition.interimResults = true;

    // Capture the exact text when recording starts to avoid duplicating phrases
    const originalText = text.trim() ? text.trim() + ' ' : '';
    let finalTranscript = '';

    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript + ' ';
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      // Always rebuild from original text + all finalized speech + current interim
      setText(originalText + finalTranscript + (interim ? `[🎙️ ${interim}]` : ''));
    };

    recognition.onend = () => {
      setIsListening(false);
      setText((prev) => prev.replace(/\[🎙️.*?\]/g, '').trim());
    };

    recognition.onerror = (e) => {
      console.warn('[speech]', e.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleAnalyze = async () => {
    if (!text.trim()) { toast('ابتدا چیزی بنویسید یا ویس بدهید!', 'warning'); return; }
    setIsAnalyzing(true);
    try {
      const result = await runADHDCoach(text, { tasks, events, rules: coachRules });
      setProposal(result);

      const tasksToAccept = new Set((result.proposedTasks || []).map((_, i) => i));
      const eventsToAccept = new Set((result.proposedEvents || []).map((_, i) => i));

      setAcceptedTasks(tasksToAccept);
      setAcceptedEvents(eventsToAccept);

      brainDumpDb.add({ text });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyProposal = () => {
    if (!proposal) return;

    let addedTasksCount = 0;
    let addedEventsCount = 0;

    // Apply tasks
    (proposal.proposedTasks || []).forEach((t, i) => {
      if (acceptedTasks.has(i)) {
        addTask(t);
        addedTasksCount++;
      }
    });

    // Apply calendar events
    (proposal.proposedEvents || []).forEach((e, i) => {
      if (acceptedEvents.has(i)) {
        addEvent(e);
        addedEventsCount++;
      }
    });

    // Save detected rule if present
    if (proposal.newDetectedRule) {
      addCoachRule(proposal.newDetectedRule);
      toast(`قانون جدید به حافظه کوچ اضافه شد: ${proposal.newDetectedRule}`);
    }

    toast(`تعداد ${addedTasksCount} تکلیف و ${addedEventsCount} رویداد با موفقیت به برنامه اضافه شدند ✨`);
    setProposal(null);
    setText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div>
        <h1 className="section-title" style={{ margin: 0, fontSize: '1.4rem' }}>
          🧠 تخلیه ذهن و کوچ ADHD
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
          افکارت را بدون دغدغه ساختار بنویس یا بگو. هوش مصنوعی کارهای تو را تحلیل و پاپ‌آپ تایید می‌سازد.
        </p>
      </div>

      {/* Main Textarea input */}
      <div className="surface" style={{ padding: 16, position: 'relative' }}>
        <textarea
          ref={textareaRef}
          className="input"
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          style={{
            width: '100%', resize: 'none', border: 'none', background: 'transparent',
            fontSize: '0.95rem', lineHeight: 1.7, padding: 0, boxShadow: 'none',
          }}
        />

        {/* Action bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(139,92,246,0.15)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={toggleVoice}
              className={`btn btn-icon ${isListening ? 'btn-danger animate-pulse' : 'btn-ghost'}`}
              title={isListening ? 'توقف ضبط صوتی' : 'شروع ورودی صوتی (فارسی)'}>
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {text && (
              <button onClick={() => setText('')} className="btn btn-icon btn-ghost" title="پاک کردن متن">
                <Trash2 size={18} />
              </button>
            )}
          </div>

          <Button variant="ai" onClick={handleAnalyze} disabled={isAnalyzing || !text.trim()}>
            {isAnalyzing ? <Spinner size={16} /> : <Sparkles size={16} />}
            {isAnalyzing ? 'در حال تحلیل کوچ...' : 'تحلیل و پیشنهاد کوچ'}
          </Button>
        </div>
      </div>

      {/* AI Interactive Proposal Modal / Pop-up */}
      {proposal && (
        <div className="surface-glass animate-scale-up" style={{ padding: 20, borderColor: '#8b5cf6', boxShadow: '0 8px 30px rgba(109,40,217,0.3)' }}>
          {/* Coach Message */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6d28d9, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
              🤖
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8b5cf6', marginBottom: 2 }}>پاسخ کوچ ADHD</div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.6 }}>{proposal.coachMessage}</p>
            </div>
          </div>

          {/* New Rule Detected Banner */}
          {proposal.newDetectedRule && (
            <div style={{ padding: '10px 14px', background: 'rgba(14,165,233,0.12)', borderRadius: 10, border: '1px solid rgba(14,165,233,0.3)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bookmark size={16} color="#38bdf8" />
              <span style={{ fontSize: '0.8rem', color: '#7dd3fc' }}>قانون جدید ثبت شده در حافظه: <strong>{proposal.newDetectedRule}</strong></span>
            </div>
          )}

          {/* Proposed Tasks */}
          {proposal.proposedTasks?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>📋 تکالیف شناسایی‌شده (تایید کنید):</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {proposal.proposedTasks.map((t, idx) => {
                  const isChecked = acceptedTasks.has(idx);
                  return (
                    <div key={idx} onClick={() => {
                      setAcceptedTasks((prev) => {
                        const s = new Set(prev);
                        if (s.has(idx)) s.delete(idx); else s.add(idx);
                        return s;
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px',
                      borderRadius: 10, border: `1.5px solid ${isChecked ? '#8b5cf6' : 'rgba(100,116,139,0.2)'}`,
                      background: isChecked ? 'rgba(139,92,246,0.15)' : 'rgba(15,10,30,0.3)', cursor: 'pointer',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid #8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isChecked ? '#8b5cf6' : 'transparent' }}>
                          {isChecked && <Check size={12} color="white" />}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>{t.title}</div>
                          {t.dueDate && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ددلاین: {t.dueDate}</div>}
                        </div>
                      </div>
                      <span className={`cat-badge cat-${t.category || 'personal'}`}>{t.category}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Proposed Calendar Events */}
          {proposal.proposedEvents?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', marginBottom: 8 }}>📅 رویدادها/کلاس‌های تقویم:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {proposal.proposedEvents.map((e, idx) => {
                  const isChecked = acceptedEvents.has(idx);
                  return (
                    <div key={idx} onClick={() => {
                      setAcceptedEvents((prev) => {
                        const s = new Set(prev);
                        if (s.has(idx)) s.delete(idx); else s.add(idx);
                        return s;
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px',
                      borderRadius: 10, border: `1.5px solid ${isChecked ? '#10b981' : 'rgba(100,116,139,0.2)'}`,
                      background: isChecked ? 'rgba(16,185,129,0.15)' : 'rgba(15,10,30,0.3)', cursor: 'pointer',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isChecked ? '#10b981' : 'transparent' }}>
                          {isChecked && <Check size={12} color="white" />}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>{e.title}</div>
                          <div style={{ fontSize: '0.72rem', color: '#34d399' }}>زمان: {new Date(e.startDate).toLocaleString('fa-IR')}</div>
                        </div>
                      </div>
                      <span className="cat-badge cat-lecture">ایونت تقویم</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Proposal action buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="ghost" size="sm" onClick={() => setProposal(null)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" onClick={handleApplyProposal}>
              <CheckCircle size={15} /> اعمال موارد انتخابی
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
