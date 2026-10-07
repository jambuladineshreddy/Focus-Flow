import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { habitsApi, tasksApi } from '../lib/api';
import { format, subDays, parseISO, startOfWeek, getDay, eachDayOfInterval, subYears } from 'date-fns';
import { Activity, TrendingUp, CheckSquare, Flame, Calendar } from 'lucide-react';

// Generate color scale based on intensity
function getColor(count: number, max: number): string {
  if (count === 0) return '#f1f5f9';
  const intensity = Math.min(count / Math.max(max, 1), 1);
  if (intensity < 0.25) return '#c7d2fe'; // indigo-200
  if (intensity < 0.5)  return '#818cf8'; // indigo-400
  if (intensity < 0.75) return '#6366f1'; // indigo-500
  return '#4338ca'; // indigo-700
}

function HeatmapGrid({ data, year }: { data: Record<string, number>; year: number }) {
  const today = new Date();
  const startDate = new Date(year, 0, 1); // Jan 1
  const endDate = year === today.getFullYear() ? today : new Date(year, 11, 31);

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  const maxCount = Math.max(...Object.values(data), 1);

  // Group into weeks starting from Sunday
  const firstDayOfWeek = getDay(startDate); // 0=Sun
  const paddedDays: (Date | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...allDays,
  ];

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7));
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days   = ['S','M','T','W','T','F','S'];

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1 mt-5">
          {days.map((d, i) => (
            <div key={i} className="h-3 w-3 text-[9px] text-slate-400 flex items-center">{i % 2 === 1 ? d : ''}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex flex-col">
          {/* Month labels */}
          <div className="flex gap-1 mb-1">
            {weeks.map((week, wi) => {
              const firstReal = week.find(d => d !== null);
              const showMonth = firstReal && format(firstReal, 'd') === '1';
              return (
                <div key={wi} className="w-3 text-[9px] text-slate-400 text-center">
                  {showMonth && firstReal ? months[firstReal.getMonth()] : ''}
                </div>
              );
            })}
          </div>

          {/* Day cells */}
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => {
                  if (!day) return <div key={di} className="w-3 h-3" />;
                  const key = format(day, 'yyyy-MM-dd');
                  const count = data[key] ?? 0;
                  return (
                    <div
                      key={di}
                      className="w-3 h-3 rounded-sm transition-all hover:ring-1 hover:ring-indigo-400 cursor-default"
                      style={{ backgroundColor: getColor(count, maxCount) }}
                      title={`${format(day, 'MMM d, yyyy')}: ${count} task${count !== 1 ? 's' : ''} completed`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-slate-400">Less</span>
        {['#f1f5f9','#c7d2fe','#818cf8','#6366f1','#4338ca'].map(c => (
          <div key={c} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span className="text-xs text-slate-400">More</span>
      </div>
    </div>
  );
}

function WeeklyBarChart({ data }: { data: Record<string, number> }) {
  // Last 12 weeks
  const today = new Date();
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const weekStart = subDays(today, (11 - i) * 7);
    const weekEnd = subDays(today, (10 - i) * 7);
    let total = 0;
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    days.forEach(d => { total += data[format(d, 'yyyy-MM-dd')] ?? 0; });
    return { label: format(weekStart, 'MMM d'), total };
  });
  const max = Math.max(...weeks.map(w => w.total), 1);

  return (
    <div className="flex items-end gap-2 h-28">
      {weeks.map((w, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] text-slate-500 font-medium">{w.total > 0 ? w.total : ''}</span>
          <div
            className="w-full rounded-t-md transition-all duration-500"
            style={{
              height: `${Math.max((w.total / max) * 96, w.total > 0 ? 8 : 2)}px`,
              background: i === 11
                ? 'linear-gradient(to top, #4338ca, #818cf8)'
                : 'linear-gradient(to top, #6366f1aa, #818cf866)',
            }}
            title={`Week of ${w.label}: ${w.total} tasks`}
          />
          <span className="text-[9px] text-slate-400 rotate-45 origin-left hidden sm:block">{w.label}</span>
        </div>
      ))}
    </div>
  );
}

function DayOfWeekChart({ data }: { data: Record<string, number> }) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = [0, 0, 0, 0, 0, 0, 0];

  Object.entries(data).forEach(([dateStr, count]) => {
    const d = parseISO(dateStr);
    counts[getDay(d)] += count;
  });

  const max = Math.max(...counts, 1);

  return (
    <div className="flex items-end gap-3 h-20">
      {counts.map((c, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full rounded-md"
            style={{
              height: `${Math.max((c / max) * 64, c > 0 ? 6 : 2)}px`,
              backgroundColor: i === 0 || i === 6 ? '#818cf8' : '#6366f1',
            }}
          />
          <span className="text-[10px] text-slate-500">{dayNames[i]}</span>
        </div>
      ))}
    </div>
  );
}

export default function HeatmapPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data: heatmapData, isLoading } = useQuery({
    queryKey: ['heatmap'],
    queryFn: async () => {
      const res = await habitsApi.getHeatmap(365);
      return res.data.heatmap;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'completed'],
    queryFn: async () => {
      const res = await tasksApi.getAll({ status: 'completed' });
      return res.data;
    },
  });

  const heatmap = heatmapData ?? {};
  const totalCompleted = Object.values(heatmap).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(heatmap).filter(v => v > 0).length;
  const currentStreak = (() => {
    let streak = 0;
    let d = new Date();
    while (true) {
      const key = format(d, 'yyyy-MM-dd');
      if ((heatmap[key] ?? 0) > 0) {
        streak++;
        d = subDays(d, 1);
      } else break;
    }
    return streak;
  })();

  const bestDay = Object.entries(heatmap).sort(([,a],[,b]) => b - a)[0];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title flex items-center gap-2">
          <Activity className="w-7 h-7 text-indigo-600" />
          Productivity Heatmap
        </h1>
        <p className="page-subtitle">Your activity over time — every square is a day of progress</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-500" />
            <span className="stat-label">Total Done</span>
          </div>
          <div className="stat-value">{totalCompleted}</div>
          <span className="text-xs text-slate-400">tasks completed</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="stat-label">Current Streak</span>
          </div>
          <div className="stat-value">{currentStreak}</div>
          <span className="text-xs text-slate-400">days in a row</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span className="stat-label">Active Days</span>
          </div>
          <div className="stat-value">{activeDays}</div>
          <span className="text-xs text-slate-400">days with tasks</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="stat-label">Best Day</span>
          </div>
          <div className="stat-value">{bestDay ? bestDay[1] : 0}</div>
          <span className="text-xs text-slate-400">{bestDay ? format(parseISO(bestDay[0]), 'MMM d') : 'N/A'}</span>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">
            {year} Activity
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear(y => y - 1)}
              className="btn-ghost p-1.5"
              disabled={year <= currentYear - 2}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-600 w-12 text-center">{year}</span>
            <button
              onClick={() => setYear(y => y + 1)}
              className="btn-ghost p-1.5"
              disabled={year >= currentYear}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="skeleton h-32 w-full rounded-lg" />
        ) : (
          <HeatmapGrid data={heatmap} year={year} />
        )}
      </div>

      {/* Bottom charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            Weekly Output (Last 12 Weeks)
          </h2>
          {isLoading ? (
            <div className="skeleton h-28 w-full rounded" />
          ) : (
            <WeeklyBarChart data={heatmap} />
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            Most Productive Days
          </h2>
          {isLoading ? (
            <div className="skeleton h-20 w-full rounded" />
          ) : (
            <DayOfWeekChart data={heatmap} />
          )}
        </div>
      </div>
    </div>
  );
}
