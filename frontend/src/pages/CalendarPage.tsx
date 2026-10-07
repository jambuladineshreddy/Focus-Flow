import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarApi, type CalendarEvent } from '../lib/api';
import { Plus, ChevronLeft, ChevronRight, Loader2, X, Trash2, Bot } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO, addMonths, subMonths
} from 'date-fns';
import toast from 'react-hot-toast';

function EventDot({ color }: { color: string }) {
  return <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />;
}

function CreateEventModal({ onClose, onSave, defaultDate }: {
  onClose: () => void;
  onSave: (data: Partial<CalendarEvent>) => void;
  defaultDate?: Date;
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_time: defaultDate
      ? format(defaultDate, "yyyy-MM-dd'T'09:00")
      : format(new Date(), "yyyy-MM-dd'T'09:00"),
    end_time: defaultDate
      ? format(defaultDate, "yyyy-MM-dd'T'10:00")
      : format(new Date(), "yyyy-MM-dd'T'10:00"),
    color: '#6366f1',
  });

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">New Event</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input autoFocus className="input" placeholder="Event title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start</label>
              <input type="datetime-local" className="input" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <label className="label">End</label>
              <input type="datetime-local" className="input" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-indigo-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => {
              if (form.title && form.start_time && form.end_time) {
                onSave({
                  ...form,
                  start_time: new Date(form.start_time).toISOString(),
                  end_time: new Date(form.end_time).toISOString(),
                });
                onClose();
              }
            }}
            className="btn-primary"
            disabled={!form.title}
          >
            Create Event
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', format(currentMonth, 'yyyy-MM')],
    queryFn: () =>
      calendarApi.getEvents({
        start: calStart.toISOString(),
        end: calEnd.toISOString(),
      }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<CalendarEvent>) => calendarApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast.success('Event created'); },
    onError: () => toast.error('Failed to create event'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => calendarApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast.success('Event deleted'); },
    onError: () => toast.error('Failed to delete event'),
  });

  const eventsOnDay = (day: Date) =>
    events.filter(e => isSameDay(parseISO(e.start_time), day));

  const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  return (
    <div className="page-container">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Manage your schedule and time blocks</p>
        </div>
        <button id="create-event-btn" onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar grid */}
        <div className="lg:col-span-2 card p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="font-semibold text-slate-800">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map(day => {
              const dayEvents = eventsOnDay(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`relative min-h-[60px] p-1.5 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 ring-1 ring-indigo-400'
                      : isToday(day)
                        ? 'bg-indigo-600/5'
                        : 'hover:bg-slate-50'
                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  <span className={`text-xs font-medium mb-1 flex items-center justify-center w-6 h-6 rounded-full ${
                    isToday(day) ? 'bg-indigo-600 text-white' : 'text-slate-700'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <EventDot key={e.id} color={e.color} />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-xs text-slate-400">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">
              {selectedDay ? format(selectedDay, 'EEEE, MMMM d') : 'Select a day'}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /></div>
            ) : selectedEvents.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400 mb-3">No events this day</p>
                <button onClick={() => setShowCreate(true)} className="btn-secondary text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add event
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedEvents
                  .sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime())
                  .map(ev => (
                    <div key={ev.id} className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="w-1 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                          <button
                            onClick={() => deleteMutation.mutate(ev.id)}
                            className="text-slate-300 hover:text-red-400 transition-colors ml-2 flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {format(parseISO(ev.start_time), 'h:mm a')} – {format(parseISO(ev.end_time), 'h:mm a')}
                        </p>
                        {ev.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ev.description}</p>
                        )}
                        {ev.is_ai_generated && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Bot className="w-3 h-3 text-indigo-400" />
                            <span className="text-xs text-indigo-400">AI scheduled</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onSave={data => createMutation.mutate(data)}
          defaultDate={selectedDay || undefined}
        />
      )}
    </div>
  );
}
