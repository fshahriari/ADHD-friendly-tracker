import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, Palette, Smile, Check } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { DEFAULT_CATEGORIES } from '../../lib/db';
import { Modal, toast } from './index';

const PRESET_EMOJIS = [
  '💼', '📅', '🎯', '⭐', '🔄',
  '🏋️', '📚', '💡', '🛒', '💊',
  '🎨', '🚀', '☕', '💻', '🧘',
  '💰', '🩺', '🎵', '🌿', '✈️',
];

const PRESET_COLORS = [
  { name: 'کهربایی', hex: '#f59e0b' },
  { name: 'آبی روشن', hex: '#0ea5e9' },
  { name: 'سرخابی', hex: '#f43f5e' },
  { name: 'نیلی', hex: '#6366f1' },
  { name: 'زمردی', hex: '#10b981' },
  { name: 'بنفش', hex: '#8b5cf6' },
  { name: 'صورتی', hex: '#ec4899' },
  { name: 'فیروزه‌ای', hex: '#14b8a6' },
  { name: 'آبی کلاسیک', hex: '#3b82f6' },
  { name: 'طلایی', hex: '#eab308' },
];

export function CategoryManager({ onCategoryAdded }) {
  const customCategories = useSettingsStore((s) => s.customCategories) || DEFAULT_CATEGORIES;
  const updateCategory = useSettingsStore((s) => s.updateCategory);
  const addCategory = useSettingsStore((s) => s.addCategory);
  const deleteCategory = useSettingsStore((s) => s.deleteCategory);
  const resetCategories = useSettingsStore((s) => s.resetCategories);
  const isDark = useSettingsStore((s) => s.theme) === 'dark';

  // New category form state
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('📌');
  const [newColor, setNewColor] = useState('#8b5cf6');
  const [showNewEmojiPicker, setShowNewEmojiPicker] = useState(false);
  const [activePickerId, setActivePickerId] = useState(null); // 'emoji:val' or 'color:val'

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      toast('لطفاً عنوان دسته‌بندی را وارد کنید', 'warning');
      return;
    }
    const created = addCategory({
      label: newLabel.trim(),
      icon: newIcon || '📌',
      color: newColor || '#8b5cf6',
    });
    if (created) {
      toast(`دسته‌بندی «${newLabel.trim()}» ایجاد شد ✨`);
      setNewLabel('');
      setNewIcon('📌');
      setShowNewEmojiPicker(false);
      if (onCategoryAdded) onCategoryAdded(created.value);
    }
  };

  const handleDelete = (cat) => {
    if (customCategories.length <= 1) {
      toast('حداقل باید یک دسته‌بندی در سیستم باقی بماند', 'warning');
      return;
    }
    if (window.confirm(`آیا از حذف دسته‌بندی «${cat.label}» اطمینان دارید؟`)) {
      deleteCategory(cat.value);
      toast(`دسته‌بندی «${cat.label}» حذف شد`);
    }
  };

  const handleReset = () => {
    if (window.confirm('آیا می‌خواهید تمام دسته‌بندی‌ها به ۵ دسته عمومی و پیش‌فرض بازگردانده شوند؟')) {
      resetCategories();
      toast('دسته‌بندی‌ها به حالت پیش‌فرض بازنشانی شدند ✅');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Description */}
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        شما می‌توانید نام، آیکون و رنگ هر دسته‌بندی را آزادانه تغییر دهید، دسته‌های کاری و شخصی جدید اضافه کنید یا موارد غیرضروری را حذف نمایید.
      </p>

      {/* Categories List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {customCategories.map((cat) => {
          const isEmojiOpen = activePickerId === `emoji:${cat.value}`;
          const isColorOpen = activePickerId === `color:${cat.value}`;

          return (
            <div
              key={cat.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 12,
                background: isDark ? 'rgba(15,10,30,0.45)' : '#ffffff',
                border: '1px solid rgba(var(--accent-glow-rgb),0.18)',
                boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                position: 'relative',
                flexWrap: 'wrap',
              }}
            >
              {/* Color indicator / picker toggle */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  title="تغییر رنگ دسته"
                  onClick={() => setActivePickerId(isColorOpen ? null : `color:${cat.value}`)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: cat.color || '#8b5cf6',
                    border: '2px solid rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 8px ${cat.color || '#8b5cf6'}66`,
                    flexShrink: 0,
                    padding: 0,
                  }}
                />

                {/* Color Palette Popover */}
                {isColorOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 32,
                      right: 0,
                      zIndex: 100,
                      background: isDark ? '#1a1130' : '#ffffff',
                      border: '1px solid rgba(var(--accent-glow-rgb),0.3)',
                      borderRadius: 12,
                      padding: 10,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      width: 170,
                    }}
                  >
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => {
                          updateCategory(cat.value, { color: c.hex });
                          setActivePickerId(null);
                        }}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: c.hex,
                          border: cat.color === c.hex ? '2px solid white' : '1px solid rgba(0,0,0,0.2)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                        }}
                      >
                        {cat.color === c.hex && <Check size={12} color="#ffffff" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Emoji icon picker toggle */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  title="تغییر ایموجی"
                  onClick={() => setActivePickerId(isEmojiOpen ? null : `emoji:${cat.value}`)}
                  style={{
                    fontSize: '1.15rem',
                    background: 'rgba(var(--accent-glow-rgb),0.12)',
                    border: '1px solid rgba(var(--accent-glow-rgb),0.25)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    width: 34,
                    height: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {cat.icon || '📌'}
                </button>

                {/* Emoji Palette Popover */}
                {isEmojiOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 40,
                      right: 0,
                      zIndex: 100,
                      background: isDark ? '#1a1130' : '#ffffff',
                      border: '1px solid rgba(var(--accent-glow-rgb),0.3)',
                      borderRadius: 12,
                      padding: 10,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: 6,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      width: 190,
                    }}
                  >
                    {PRESET_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          updateCategory(cat.value, { icon: emoji });
                          setActivePickerId(null);
                        }}
                        style={{
                          fontSize: '1.15rem',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: 6,
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Editable Name Input */}
              <input
                className="input"
                value={cat.label}
                placeholder="عنوان دسته‌بندی..."
                onChange={(e) => updateCategory(cat.value, { label: e.target.value })}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: '6px 10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  height: 34,
                }}
              />

              {/* Live Preview Badge (visible on tablets/desktop) */}
              <span
                className="hidden sm:inline-flex"
                style={{
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: cat.color || '#8b5cf6',
                  background: `${cat.color || '#8b5cf6'}22`,
                  border: `1px solid ${cat.color || '#8b5cf6'}55`,
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.icon || '📌'} {cat.label || 'بدون نام'}
              </span>

              {/* Delete Category button */}
              <button
                type="button"
                onClick={() => handleDelete(cat)}
                disabled={customCategories.length <= 1}
                title="حذف دسته‌بندی"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: customCategories.length <= 1 ? '#64748b' : '#fb7185',
                  cursor: customCategories.length <= 1 ? 'not-allowed' : 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 6,
                  opacity: customCategories.length <= 1 ? 0.4 : 1,
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add New Category Form */}
      <form
        onSubmit={handleAddCategory}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 12,
          background: 'rgba(var(--accent-glow-rgb),0.07)',
          border: '1.5px dashed rgba(var(--accent-glow-rgb),0.35)',
        }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          ➕ افزودن دسته‌بندی دلخواه جدید
        </span>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* New Emoji Picker Toggle */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowNewEmojiPicker(!showNewEmojiPicker)}
              title="انتخاب آیکون ایموجی"
              style={{
                fontSize: '1.15rem',
                background: isDark ? '#1e1b4b' : '#f1f5f9',
                border: '1px solid rgba(var(--accent-glow-rgb),0.3)',
                borderRadius: 8,
                cursor: 'pointer',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {newIcon}
            </button>

            {showNewEmojiPicker && (
              <div
                style={{
                  position: 'absolute',
                  top: 42,
                  right: 0,
                  zIndex: 100,
                  background: isDark ? '#1a1130' : '#ffffff',
                  border: '1px solid rgba(var(--accent-glow-rgb),0.3)',
                  borderRadius: 12,
                  padding: 10,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  width: 190,
                }}
              >
                {PRESET_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setNewIcon(emoji);
                      setShowNewEmojiPicker(false);
                    }}
                    style={{
                      fontSize: '1.15rem',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: 6,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New Title Input */}
          <input
            className="input"
            placeholder="نام دسته‌بندی جدید (مثلاً: ورزش، مطالعه، کارفرما...)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            style={{ flex: 1, minWidth: 150, height: 36, fontSize: '0.85rem' }}
          />

          {/* Color choices & submit button container */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flex: '1 1 auto', minWidth: 220 }}>
            {/* Color choices */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {PRESET_COLORS.slice(0, 6).map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  onClick={() => setNewColor(c.hex)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: c.hex,
                    border: newColor === c.hex ? '2.5px solid white' : '1px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: newColor === c.hex ? `0 0 6px ${c.hex}` : 'none',
                  }}
                />
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '7px 16px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
              }}
            >
              <Plus size={15} /> افزودن
            </button>
          </div>
        </div>
      </form>

      {/* Footer Reset Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          type="button"
          onClick={handleReset}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.78rem',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 6,
            opacity: 0.8,
          }}
        >
          <RotateCcw size={13} /> بازنشانی به ۵ دسته پیش‌فرض سیستم
        </button>
      </div>
    </div>
  );
}

// ── Modal Wrapper for Quick Access ──────────────────────────────────────────
export function CategoryManagerModal({ open, onClose, onCategoryAdded }) {
  return (
    <Modal open={open} onClose={onClose} title="⚙️ مدیریت و شخصی‌سازی دسته‌بندی‌ها" maxWidth="560px">
      <CategoryManager
        onCategoryAdded={(newVal) => {
          if (onCategoryAdded) onCategoryAdded(newVal);
        }}
      />
    </Modal>
  );
}
