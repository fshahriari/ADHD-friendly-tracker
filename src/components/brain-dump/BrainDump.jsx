import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Trash2, Sparkles, CheckCircle, X,
  Calendar as CalendarIcon, Check, Plus, AlertCircle, Bookmark,
  Lightbulb, Copy, Clock
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { useEventStore } from '../../store/useEventStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { runADHDCoach } from '../../lib/gemini';
import { brainDumpDb, DEFAULT_CATEGORIES } from '../../lib/db';
import { Button, Spinner, toast, CategoryBadge } from '../shared';

const PLACEHOLDER = `هرچیزی که تو ذهنته رو اینجا بنویس یا ویس بده (کارها، ایده‌ها، جلسات، یا چیزایی که نباید یادت بره)...

مثال:
- فردا ساعت ۱۰ با همکارم جلسه بررسی پروژه دارم، ۲ ساعت قبلش یادم بنداز
- یه ایده خفن برای بهبود سیستم به ذهنم رسید
- پیگیری تمدید قرارداد تا پنجشنبه
- حواست باشه برای پرداخت‌ها همیشه ۲ روز قبل یادآوری بگذاری`;

export default function BrainDump() {
  const { theme, customCategories = DEFAULT_CATEGORIES } = useSettingsStore();
  const isDark = theme === 'dark';
  const catValues = (customCategories && customCategories.length > 0)
    ? customCategories.map((c) => c.value)
    : ['assignment', 'lecture', 'exam', 'personal', 'habit'];

  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Proposal modal state from AI
  const [proposal, setProposal] = useState(null);
  const [acceptedTasks, setAcceptedTasks] = useState(new Set());
  const [acceptedEvents, setAcceptedEvents] = useState(new Set());
  const [acceptedNotes, setAcceptedNotes] = useState(new Set());

  const [savedDumps, setSavedDumps] = useState([]);

  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  const { tasks, addTask } = useTaskStore();
  const { events, coachRules, addEvent, addCoachRule } = useEventStore();

  // Auto-focus on mount & load saved dumps
  useEffect(() => { textareaRef.current?.focus(); }, []);

  const loadSavedDumps = useCallback(() => {
    const all = brainDumpDb.getAll();
    const seen = new Set();
    const unique = [];
    all.forEach((item) => {
      const key = `${(item.title || '').trim()}:::${(item.text || '').trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    });
    if (unique.length !== all.length) {
      brainDumpDb.saveAll(unique);
    }
    setSavedDumps(unique);
  }, []);

  useEffect(() => {
    loadSavedDumps();
  }, [loadSavedDumps]);

  const handleQuickSaveIdea = () => {
    if (!text.trim()) {
      toast('ابتدا ایده یا یادداشت خود را بنویسید', 'warning');
      return;
    }
    brainDumpDb.add({
      title: text.trim().slice(0, 60),
      text: text.trim(),
      type: 'idea',
    });
    toast('ایده / یادداشت شما با موفقیت ذخیره شد 💡');
    setText('');
    loadSavedDumps();
  };

  const handleConvertIdeaToTask = (dump) => {
    const taskTitle = dump.title || dump.text || '';
    if (!taskTitle) return;
    addTask({
      title: taskTitle.slice(0, 100),
      category: 'personal',
      priority: 'medium',
      steps: [],
    });
    toast('ایده به فهرست وظایف اضافه شد 🎯');
  };

  const handleDeleteSavedDump = (id) => {
    brainDumpDb.delete(id);
    loadSavedDumps();
    toast('یادداشت حذف شد');
  };

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

    recognition.onresult = (e) => {
      let finalStr = '';
      let interimStr = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalStr += e.results[i][0].transcript + ' ';
        } else {
          interimStr += e.results[i][0].transcript;
        }
      }
      // Always rebuild from original text + all finalized speech + current interim
      setText(originalText + finalStr + (interimStr ? `[🎙️ ${interimStr}]` : ''));
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
      const notesToAccept = new Set((result.proposedNotes || []).map((_, i) => i));

      setAcceptedTasks(tasksToAccept);
      setAcceptedEvents(eventsToAccept);
      setAcceptedNotes(notesToAccept);
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
    let addedNotesCount = 0;

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

    // Apply notes / ideas (only selected ones)
    (proposal.proposedNotes || []).forEach((n, i) => {
      if (acceptedNotes.has(i)) {
        const title = typeof n === 'string' ? n : (n.title || n.content || n.text || '');
        const content = typeof n === 'string' ? n : (n.content || n.text || n.title || '');
        brainDumpDb.add({
          title,
          text: content,
          type: 'idea',
        });
        addedNotesCount++;
      }
    });

    // Save detected rule if present
    if (proposal.newDetectedRule) {
      addCoachRule(proposal.newDetectedRule);
      toast(`قانون جدید به حافظه کوچ اضافه شد: ${proposal.newDetectedRule}`);
    }

    loadSavedDumps();

    const parts = [];
    if (addedTasksCount > 0) parts.push(`${addedTasksCount} وظیفه`);
    if (addedEventsCount > 0) parts.push(`${addedEventsCount} رویداد`);
    if (addedNotesCount > 0) parts.push(`${addedNotesCount} ایده/یادداشت`);

    toast(parts.length > 0
      ? `موارد (${parts.join(' و ')}) با موفقیت به برنامه اضافه شدند ✨`
      : 'موارد انتخابی اعمال شدند ✨'
    );
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
        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b' }}>
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
            direction: 'rtl', textAlign: 'right',
          }}
        />

        {/* Action bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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

            <Button
              variant="ghost"
              size="sm"
              onClick={handleQuickSaveIdea}
              disabled={!text.trim()}
              title="ذخیره مستقیم به عنوان ایده یا یادداشت بدون نیاز به تحلیل هوش مصنوعی"
              style={{ fontSize: '0.8rem', padding: '6px 12px', gap: 6 }}>
              <Lightbulb size={15} color="#eab308" />
              ثبت سریع ایده
            </Button>
          </div>

          <Button variant="ai" onClick={handleAnalyze} disabled={isAnalyzing || !text.trim()}>
            {isAnalyzing ? <Spinner size={16} /> : <Sparkles size={16} />}
            {isAnalyzing ? 'در حال تحلیل کوچ...' : 'تحلیل و پیشنهاد کوچ'}
          </Button>
        </div>
      </div>

      {/* AI Interactive Proposal Modal / Pop-up */}
      {proposal && (
        <div
          className="surface-glass animate-scale-up"
          style={{
            padding: 20,
            borderRadius: 16,
            borderColor: isDark ? 'var(--color-primary-500)' : '#a855f7',
            background: isDark ? 'rgba(26, 17, 48, 0.92)' : '#ffffff',
            boxShadow: isDark
              ? '0 8px 32px rgba(139, 92, 246, 0.25)'
              : '0 8px 32px rgba(147, 51, 234, 0.14)',
          }}>
          {/* Coach Message */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #7c3aed, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)'
            }}>
              🤖
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isDark ? '#c084fc' : '#7c3aed', marginBottom: 4 }}>
                پاسخ کوچ ADHD
              </div>
              <p style={{
                margin: 0,
                fontSize: '0.92rem',
                color: isDark ? '#f1f5f9' : '#0f172a',
                fontWeight: 500,
                lineHeight: 1.65,
              }}>
                {proposal.coachMessage}
              </p>
            </div>
          </div>

          {/* New Rule Detected Banner */}
          {proposal.newDetectedRule && (
            <div style={{
              padding: '10px 14px',
              background: isDark ? 'rgba(14,165,233,0.12)' : '#f0f9ff',
              borderRadius: 10,
              border: `1px solid ${isDark ? 'rgba(14,165,233,0.3)' : '#bae6fd'}`,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <Bookmark size={16} color={isDark ? '#38bdf8' : '#0284c7'} />
              <span style={{ fontSize: '0.82rem', color: isDark ? '#7dd3fc' : '#0369a1' }}>
                قانون جدید ثبت‌شده در حافظه کوچ: <strong style={{ color: isDark ? '#bae6fd' : '#0c4a6e' }}>{proposal.newDetectedRule}</strong>
              </span>
            </div>
          )}

          {/* Proposed Tasks */}
          {proposal.proposedTasks?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isDark ? '#c084fc' : '#6b21a8',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                📋 وظایف شناسایی‌شده (تایید کنید):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {proposal.proposedTasks.map((t, idx) => {
                  const isChecked = acceptedTasks.has(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setAcceptedTasks((prev) => {
                          const s = new Set(prev);
                          if (s.has(idx)) s.delete(idx); else s.add(idx);
                          return s;
                        });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: `1.5px solid ${
                          isChecked
                            ? (isDark ? '#8b5cf6' : '#7c3aed')
                            : (isDark ? 'rgba(100,116,139,0.2)' : '#e2e8f0')
                        }`,
                        background: isChecked
                          ? (isDark ? 'rgba(139, 92, 246, 0.15)' : '#faf5ff')
                          : (isDark ? 'rgba(15,10,30,0.3)' : '#f8fafc'),
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          border: `1.5px solid ${isChecked ? (isDark ? '#8b5cf6' : '#7c3aed') : (isDark ? '#64748b' : '#cbd5e1')}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isChecked ? (isDark ? '#8b5cf6' : '#7c3aed') : 'transparent',
                        }}>
                          {isChecked && <Check size={13} color="white" />}
                        </div>
                        <div>
                          <div style={{
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            color: isDark ? '#f1f5f9' : '#0f172a',
                          }}>
                            {t.title}
                          </div>
                          {t.dueDate && (
                            <div style={{ fontSize: '0.74rem', color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                              ددلاین: {t.dueDate}
                            </div>
                          )}
                        </div>
                      </div>
                      <CategoryBadge
                        category={t.category}
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextCat = catValues[(catValues.indexOf(t.category || catValues[0]) + 1) % catValues.length];
                          setProposal((prev) => {
                            if (!prev) return prev;
                            const newTasks = [...prev.proposedTasks];
                            newTasks[idx] = { ...newTasks[idx], category: nextCat };
                            return { ...prev, proposedTasks: newTasks };
                          });
                        }}
                        style={{ cursor: 'pointer' }}
                        title="کلیک برای تغییر دسته‌بندی"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Proposed Calendar Events */}
          {proposal.proposedEvents?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isDark ? '#34d399' : '#047857',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                📅 رویدادها و جلسات تقویم:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {proposal.proposedEvents.map((e, idx) => {
                  const isChecked = acceptedEvents.has(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setAcceptedEvents((prev) => {
                          const s = new Set(prev);
                          if (s.has(idx)) s.delete(idx); else s.add(idx);
                          return s;
                        });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: `1.5px solid ${
                          isChecked
                            ? '#10b981'
                            : (isDark ? 'rgba(100,116,139,0.2)' : '#e2e8f0')
                        }`,
                        background: isChecked
                          ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5')
                          : (isDark ? 'rgba(15,10,30,0.3)' : '#f8fafc'),
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          border: `1.5px solid ${isChecked ? '#10b981' : (isDark ? '#64748b' : '#cbd5e1')}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isChecked ? '#10b981' : 'transparent',
                        }}>
                          {isChecked && <Check size={13} color="white" />}
                        </div>
                        <div>
                          <div style={{
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            color: isDark ? '#f1f5f9' : '#0f172a',
                          }}>
                            {e.title}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: isDark ? '#34d399' : '#059669', marginTop: 2 }}>
                            زمان: {new Date(e.startDate).toLocaleString('fa-IR')}
                          </div>
                        </div>
                      </div>
                      <CategoryBadge
                        category={e.category || 'lecture'}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          const nextCat = catValues[(catValues.indexOf(e.category || catValues[0]) + 1) % catValues.length];
                          setProposal((prev) => {
                            if (!prev) return prev;
                            const newEvents = [...prev.proposedEvents];
                            newEvents[idx] = { ...newEvents[idx], category: nextCat };
                            return { ...prev, proposedEvents: newEvents };
                          });
                        }}
                        style={{ cursor: 'pointer' }}
                        title="کلیک برای تغییر دسته‌بندی"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Proposed Notes / Ideas */}
          {proposal.proposedNotes?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isDark ? '#fbbf24' : '#b45309',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                💡 ایده‌ها و یادداشت‌های ذهنی (برای ذخیره در حافظه):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {proposal.proposedNotes.map((n, idx) => {
                  const isChecked = acceptedNotes.has(idx);
                  const noteTitle = typeof n === 'string' ? n : (n.title || n.content || n.text || '');
                  const noteContent = typeof n === 'object' ? (n.content || n.text || '') : '';
                  const noteDetail = noteContent && noteContent !== noteTitle ? noteContent : null;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setAcceptedNotes((prev) => {
                          const s = new Set(prev);
                          if (s.has(idx)) s.delete(idx); else s.add(idx);
                          return s;
                        });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: `1.5px solid ${
                          isChecked
                            ? '#f59e0b'
                            : (isDark ? 'rgba(100,116,139,0.2)' : '#e2e8f0')
                        }`,
                        background: isChecked
                          ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb')
                          : (isDark ? 'rgba(15,10,30,0.3)' : '#f8fafc'),
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          border: `1.5px solid ${isChecked ? '#f59e0b' : (isDark ? '#64748b' : '#cbd5e1')}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isChecked ? '#f59e0b' : 'transparent',
                        }}>
                          {isChecked && <Check size={13} color="white" />}
                        </div>
                        <div>
                          <div style={{
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            color: isDark ? '#f1f5f9' : '#0f172a',
                          }}>
                            {noteTitle}
                          </div>
                          {noteDetail && (
                            <div style={{ fontSize: '0.74rem', color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                              {noteDetail}
                            </div>
                          )}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
                        color: isDark ? '#fbbf24' : '#d97706',
                        border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.4)' : '#fde68a'}`,
                      }}>
                        ایده / یادداشت
                      </span>
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

      {/* Saved Ideas & Notes Section */}
      {savedDumps.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem', fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>
              <Lightbulb size={20} color="#eab308" />
              <span>ایده‌ها و یادداشت‌های ثبت‌شده ({savedDumps.length})</span>
            </div>
            <span style={{ fontSize: '0.74rem', color: isDark ? '#94a3b8' : '#64748b' }}>
              هرچیزی که وسط کار یادت می‌آید را ثبت کن تا تمرکزت به هم نریزد
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savedDumps.slice(0, 20).map((dump) => (
              <div
                key={dump.id}
                className="surface"
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                <div style={{ flex: 1, minWidth: 0, direction: 'rtl', textAlign: 'right' }}>
                  {dump.title && dump.title !== dump.text && (
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isDark ? '#f8fafc' : '#0f172a', marginBottom: 4, direction: 'rtl', textAlign: 'right' }}>
                      {dump.title}
                    </div>
                  )}
                  <p style={{
                    margin: 0,
                    fontSize: '0.86rem',
                    color: isDark ? '#cbd5e1' : '#334155',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    direction: 'rtl',
                    textAlign: 'right',
                  }}>
                    {dump.text}
                  </p>
                  {dump.savedAt && (
                    <div style={{ fontSize: '0.72rem', color: isDark ? '#64748b' : '#94a3b8', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={12} />
                      <span>{new Date(dump.savedAt).toLocaleDateString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => handleConvertIdeaToTask(dump)}
                    className="btn btn-icon btn-ghost"
                    title="تبدیل به وظیفه در پلنر"
                    style={{ color: '#8b5cf6' }}>
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(dump.text);
                      toast('متن کپی شد 📋');
                    }}
                    className="btn btn-icon btn-ghost"
                    title="کپی متن">
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteSavedDump(dump.id)}
                    className="btn btn-icon btn-ghost text-danger"
                    title="حذف یادداشت">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
