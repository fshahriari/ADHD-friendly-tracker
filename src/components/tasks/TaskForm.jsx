import React, { useState } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { Modal, Button, CategoryBadge } from '../shared';

const CATEGORIES = [
  { value: 'exam',       label: 'امتحان',   icon: '📝' },
  { value: 'assignment', label: 'تکلیف',    icon: '📚' },
  { value: 'habit',      label: 'عادت',     icon: '🔄' },
  { value: 'personal',   label: 'شخصی',     icon: '⭐' },
  { value: 'lecture',    label: 'درس',      icon: '🎓' },
];
const PRIORITIES = [
  { value: 'high',   label: 'بالا',   color: '#fb7185' },
  { value: 'medium', label: 'متوسط',  color: '#fbbf24' },
  { value: 'low',    label: 'پایین',  color: '#64748b' },
];
const ENERGIES = [
  { value: 'high',   label: 'انرژی بالا', icon: '⚡' },
  { value: 'medium', label: 'متوسط',       icon: '🔆' },
  { value: 'low',    label: 'کم‌انرژی',    icon: '🌙' },
];

const DEFAULTS = {
  title: '', description: '', category: 'personal',
  priority: 'medium', energyRequired: 'medium',
  estimatedMinutes: 25, dueDate: '',
};

export default function TaskForm({ open, onClose, initial = null }) {
  const { addTask, updateTask } = useTaskStore();
  const [form, setForm] = useState(initial ? {
    ...DEFAULTS, ...initial,
    dueDate: initial.dueDate ? initial.dueDate.slice(0, 10) : '',
  } : DEFAULTS);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = { ...form, dueDate: form.dueDate || null };
    if (initial) {
      updateTask(initial.id, payload);
    } else {
      addTask(payload);
    }
    onClose();
    setForm(DEFAULTS);
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'ویرایش وظیفه' : 'وظیفه جدید'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Title */}
        <div>
          <label style={labelStyle}>عنوان وظیفه *</label>
          <input
            className="input" placeholder="مثال: مطالعه فصل سوم..."
            value={form.title} onChange={(e) => set('title', e.target.value)}
            autoFocus required
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>توضیحات (اختیاری)</label>
          <textarea className="input" rows={2} placeholder="جزئیات بیشتر..."
            value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        {/* Category */}
        <div>
          <label style={labelStyle}>دسته‌بندی</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => (
              <button key={c.value} type="button"
                onClick={() => set('category', c.value)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600,
                  transition: 'all 150ms',
                  background: form.category === c.value ? 'rgba(var(--accent-glow-rgb),0.2)' : 'transparent',
                  borderColor: form.category === c.value ? 'var(--color-primary-500)' : '#2f2258',
                  color: form.category === c.value ? '#a78bfa' : '#64748b',
                }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Priority + Energy row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>اولویت</label>
            <select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>سطح انرژی</label>
            <select className="input" value={form.energyRequired} onChange={(e) => set('energyRequired', e.target.value)}>
              {ENERGIES.map((e) => <option key={e.value} value={e.value}>{e.icon} {e.label}</option>)}
            </select>
          </div>
        </div>

        {/* Estimated time + Due date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>زمان تخمینی (دقیقه)</label>
            <input className="input" type="number" min={1} max={480} value={form.estimatedMinutes}
              onChange={(e) => set('estimatedMinutes', parseInt(e.target.value) || 25)} />
          </div>
          <div>
            <label style={labelStyle}>سررسید</label>
            <input className="input" type="date" value={form.dueDate}
              onChange={(e) => set('dueDate', e.target.value)} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button type="submit" variant="primary" style={{ flex: 1 }}>
            {initial ? '💾 ذخیره تغییرات' : '➕ افزودن وظیفه'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>لغو</Button>
        </div>
      </form>
    </Modal>
  );
}

const labelStyle = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600,
  color: '#94a3b8', marginBottom: 6,
};
