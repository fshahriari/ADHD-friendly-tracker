import React, { useState } from 'react';
import { Pencil, Trash2, Play, ChevronDown, ChevronUp, CheckCircle2, Circle, GripVertical, Zap } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskStore } from '../../store/useTaskStore';
import { useTimerStore } from '../../store/useTimerStore';
import { CategoryBadge, PriorityDot } from '../shared';
import { decomposeTask } from '../../lib/gemini';
import { toast } from '../shared';

const CAT_CLASS = { exam: 'cat-exam', assignment: 'cat-assignment', habit: 'cat-habit', personal: 'cat-personal', lecture: 'cat-lecture' };

function formatDue(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = Math.ceil((d - Date.now()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)} روز گذشته`, color: '#fb7185' };
  if (diff === 0) return { label: 'امروز', color: '#f59e0b' };
  if (diff === 1) return { label: 'فردا', color: '#fbbf24' };
  return { label: `${diff} روز دیگر`, color: '#94a3b8' };
}

export default function TaskCard({ task, onEdit }) {
  const { toggleComplete, deleteTask, updateTask } = useTaskStore();
  const { startFocus } = useTimerStore();
  const [expanded, setExpanded] = useState(false);
  const [decomposing, setDecomposing] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : 'auto',
  };

  const due = formatDue(task.dueDate);

  const handleDecompose = async (e) => {
    e.stopPropagation();
    setDecomposing(true);
    try {
      const steps = await decomposeTask(task.title, task.description);
      updateTask(task.id, { steps });
      setExpanded(true);
      toast('وظیفه به گام‌های کوچک تقسیم شد ✨');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDecomposing(false);
    }
  };

  return (
    <div
      ref={setNodeRef} style={style}
      className={`task-card ${CAT_CLASS[task.category] || ''} ${task.completed ? 'completed' : ''} animate-fade-in`}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Drag handle */}
        <div {...attributes} {...listeners}
          style={{ cursor: 'grab', color: '#334155', paddingTop: 2, touchAction: 'none', flexShrink: 0 }}
          aria-label="بکش برای مرتب‌سازی">
          <GripVertical size={16} />
        </div>

        {/* Checkbox */}
        <button onClick={() => toggleComplete(task.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: task.completed ? '#34d399' : '#475569', flexShrink: 0, marginTop: 1 }}
          aria-label={task.completed ? 'علامت‌گذاری به‌عنوان ناتمام' : 'علامت‌گذاری به‌عنوان تمام‌شده'}>
          {task.completed
            ? <CheckCircle2 size={20} color="#34d399" />
            : <Circle size={20} />}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <PriorityDot priority={task.priority} />
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none', wordBreak: 'break-word' }}>
              {task.title}
            </span>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <CategoryBadge category={task.category} />
            {task.estimatedMinutes && (
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>🕐 {task.estimatedMinutes} دقیقه</span>
            )}
            {due && (
              <span style={{ fontSize: '0.75rem', color: due.color, fontWeight: 600 }}>📅 {due.label}</span>
            )}
            {task.energyRequired && (
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {task.energyRequired === 'high' ? '⚡' : task.energyRequired === 'medium' ? '🔆' : '🌙'}
              </span>
            )}
          </div>

          {/* Steps preview */}
          {task.steps && task.steps.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>
                {task.steps.filter((s) => s.done).length}/{task.steps.length} گام تکمیل شده
              </div>
              <div style={{ height: 4, background: '#1a1130', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #6d28d9, #34d399)',
                  width: `${(task.steps.filter((s) => s.done).length / task.steps.length) * 100}%`,
                  transition: 'width 400ms ease',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {!task.completed && (
            <button onClick={() => startFocus(task.id, task.estimatedMinutes)}
              className="btn btn-icon btn-sm" style={{ color: '#a78bfa', background: 'rgba(var(--accent-glow-rgb),0.1)', border: '1px solid rgba(var(--accent-glow-rgb),0.2)' }}
              title="شروع تمرکز" aria-label="شروع حالت تمرکز">
              <Play size={14} />
            </button>
          )}
          <button onClick={() => onEdit(task)}
            className="btn btn-icon btn-sm btn-ghost" title="ویرایش" aria-label="ویرایش وظیفه">
            <Pencil size={14} />
          </button>
          <button onClick={() => deleteTask(task.id)}
            className="btn btn-icon btn-sm btn-ghost" style={{ color: '#fb7185' }} title="حذف" aria-label="حذف وظیفه">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expandable steps / AI decompose */}
      {!task.completed && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1a1130', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {task.steps && task.steps.length > 0 ? (
            <button onClick={() => setExpanded(!expanded)}
              className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'بستن گام‌ها' : `نمایش ${task.steps.length} گام`}
            </button>
          ) : (
            <button onClick={handleDecompose} disabled={decomposing}
              className="btn btn-ai btn-sm" style={{ fontSize: '0.78rem' }}>
              {decomposing ? '⏳ در حال تقسیم...' : <><Zap size={12} /> تقسیم با هوش مصنوعی</>}
            </button>
          )}
        </div>
      )}

      {/* Steps list */}
      {expanded && task.steps && task.steps.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }} className="animate-fade-in">
          {task.steps.map((step, idx) => (
            <div key={idx} onClick={() => {
              const steps = task.steps.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
              updateTask(task.id, { steps });
            }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                background: 'rgba(15,10,30,0.5)', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${step.done ? 'rgba(52,211,153,0.2)' : '#1a1130'}`,
                opacity: step.done ? 0.6 : 1, transition: 'all 150ms',
              }}>
              <span style={{ fontSize: '0.8rem', color: step.done ? '#34d399' : '#475569', flexShrink: 0 }}>
                {step.done ? '✅' : `${idx + 1}.`}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textDecoration: step.done ? 'line-through' : 'none' }}>
                  {step.title}
                </span>
                {step.estimatedMinutes && (
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginRight: 8 }}>
                    🕐 {step.estimatedMinutes} دقیقه
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
