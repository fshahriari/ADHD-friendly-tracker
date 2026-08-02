import React, { useState } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus, SlidersHorizontal, Search, Trash2 } from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import { Button, EmptyState } from '../shared';

const ENERGY_OPTIONS = [
  { value: null,     label: 'همه', icon: '🌐' },
  { value: 'high',   label: 'انرژی بالا', icon: '⚡' },
  { value: 'medium', label: 'متوسط', icon: '🔆' },
  { value: 'low',    label: 'کم‌انرژی', icon: '🌙' },
];

export default function TaskList() {
  const {
    getFilteredTasks, reorderTasks, clearCompleted,
    energyFilter, setEnergyFilter, searchQuery, setSearchQuery,
  } = useTaskStore();
  const { energyLevel } = useSettingsStore();

  const [showForm, setShowForm]   = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [activeId, setActiveId]   = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const tasks = getFilteredTasks();
  const completedCount = tasks.filter((t) => t.completed).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = ({ active }) => setActiveId(active.id);
  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (over && active.id !== over.id) reorderTasks(active.id, over.id);
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="primary" onClick={() => setShowForm(true)} style={{ gap: 6 }}>
          <Plus size={16} /> وظیفه جدید
        </Button>

        {/* Search */}
        <div style={{ flex: 1, position: 'relative', minWidth: 140 }}>
          <Search size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
          <input className="input" style={{ paddingRight: 36 }}
            placeholder="جستجوی وظیفه..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <button className="btn btn-ghost btn-icon" onClick={() => setShowFilters(!showFilters)}
          title="فیلترها" style={{ color: showFilters ? '#a78bfa' : '#64748b' }}>
          <SlidersHorizontal size={16} />
        </button>

        {completedCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={clearCompleted}
            style={{ color: '#64748b', fontSize: '0.78rem' }}>
            <Trash2 size={13} /> پاک کردن {completedCount} تمام‌شده
          </button>
        )}
      </div>

      {/* Energy filter pills */}
      {showFilters && (
        <div className="animate-fade-in" style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', alignSelf: 'center' }}>فیلتر انرژی:</span>
          {ENERGY_OPTIONS.map((opt) => (
            <button key={String(opt.value)} onClick={() => setEnergyFilter(opt.value)}
              style={{
                padding: '5px 14px', borderRadius: 20, border: '1.5px solid',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
                transition: 'all 150ms',
                background: energyFilter === opt.value ? 'rgba(139,92,246,0.2)' : 'transparent',
                borderColor: energyFilter === opt.value ? '#8b5cf6' : '#2f2258',
                color: energyFilter === opt.value ? '#a78bfa' : '#64748b',
              }}>
              {opt.icon} {opt.label}
            </button>
          ))}

          {/* Quick match current energy */}
          <button onClick={() => setEnergyFilter(energyLevel)}
            style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px solid rgba(52,211,153,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
            ✨ مناسب انرژی من
          </button>
        </div>
      )}

      {/* Task count */}
      {tasks.length > 0 && (
        <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 12px' }}>
          {tasks.length} وظیفه · {completedCount} تمام‌شده
        </p>
      )}

      {/* DnD task list */}
      {tasks.length === 0 ? (
        <EmptyState
          icon="📋" title="هیچ وظیفه‌ای وجود ندارد"
          subtitle="وظیفه جدیدی اضافه کنید یا ذهن‌تان را خالی کنید!"
          action={<Button variant="primary" onClick={() => setShowForm(true)}>➕ افزودن وظیفه</Button>}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className="stagger">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} onEdit={(t) => setEditTask(t)} />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeTask && (
              <div style={{ opacity: 0.9, transform: 'rotate(2deg)', boxShadow: '0 20px 60px rgba(109,40,217,0.4)' }}>
                <TaskCard task={activeTask} onEdit={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Forms */}
      <TaskForm open={showForm} onClose={() => setShowForm(false)} />
      <TaskForm open={!!editTask} onClose={() => setEditTask(null)} initial={editTask} />
    </div>
  );
}
