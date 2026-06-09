import { useEffect, useState, useRef } from 'react';
import { getSprints } from '../api/sprintApi';

const STATUS_COLOR = {
  planned:   { bar: '#94A3B8', bg: '#F1F5F9', text: '#475569' },
  active:    { bar: '#10B981', bg: '#F0FDF4', text: '#15803D' },
  closed:    { bar: '#64748B', bg: '#F4F2EE', text: '#6B6560' },
  completed: { bar: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8' },
};

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function TimelineTab({ projectId, onSelectSprint }) {
  const [sprints, setSprints]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const scrollRef                = useRef(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getSprints(projectId)
      .then(setSprints)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return (
    <div className="p-8 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="skeleton w-32 h-5 rounded" />
          <div className="flex-1 skeleton h-8 rounded-lg" style={{ marginLeft: `${i * 8}%`, width: `${30 + i * 10}%` }} />
        </div>
      ))}
    </div>
  );

  const sprintsWithDates = sprints.filter(s => s.startDate && s.endDate);
  const sprintsNoDates   = sprints.filter(s => !s.startDate || !s.endDate);

  if (sprintsWithDates.length === 0) return (
    <div className="p-10 text-center">
      <div className="text-4xl mb-3">📅</div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-1)' }}>
        Aucun sprint avec des dates
      </p>
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
        Ajoutez des dates de début et de fin à vos sprints pour afficher le Gantt.
      </p>
    </div>
  );

  // Compute the timeline range
  const allDates = sprintsWithDates.flatMap(s => [new Date(s.startDate), new Date(s.endDate)]);
  const minDate  = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate  = new Date(Math.max(...allDates.map(d => d.getTime())));
  const startRange = addDays(minDate, -3);
  const endRange   = addDays(maxDate, 3);
  const totalDays  = Math.max(1, Math.round((endRange - startRange) / 86400000));

  const today = new Date();
  const todayPct = Math.max(0, Math.min(100,
    ((today - startRange) / (endRange - startRange)) * 100
  ));

  // Build month markers
  const months = [];
  let cur = new Date(startRange.getFullYear(), startRange.getMonth(), 1);
  while (cur <= endRange) {
    const pct = ((cur - startRange) / (endRange - startRange)) * 100;
    if (pct >= 0 && pct <= 100) {
      months.push({ label: `${MONTHS_FR[cur.getMonth()]} ${cur.getFullYear()}`, pct });
    }
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  const pct = (date) =>
    Math.max(0, Math.min(100, ((new Date(date) - startRange) / (endRange - startRange)) * 100));

  const width = (s) => Math.max(1, pct(s.endDate) - pct(s.startDate));

  return (
    <div className="p-1">
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

        {/* Header row */}
        <div className="flex items-stretch"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div className="w-40 shrink-0 px-4 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border)' }}>
            Sprint
          </div>
          {/* Month labels */}
          <div className="flex-1 relative h-10">
            {months.map((m, i) => (
              <div key={i} className="absolute top-0 flex flex-col items-start"
                style={{ left: `${m.pct}%`, height: '100%' }}>
                <div className="h-full w-px" style={{ background: 'var(--border)' }} />
                <span className="absolute top-2.5 left-1 text-[10px] whitespace-nowrap"
                  style={{ color: 'var(--text-3)' }}>{m.label}</span>
              </div>
            ))}
            {/* Today line */}
            {today >= startRange && today <= endRange && (
              <div className="absolute top-0 h-full w-0.5 z-10"
                style={{ left: `${todayPct}%`, background: '#EF4444' }}>
                <span className="absolute -top-0.5 -left-3 text-[9px] font-bold px-1 rounded"
                  style={{ background: '#EF4444', color: '#fff' }}>
                  Auj.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sprint rows */}
        <div ref={scrollRef}>
          {sprintsWithDates.map(sprint => {
            const cfg  = STATUS_COLOR[sprint.status] || STATUS_COLOR.planned;
            const left = pct(sprint.startDate);
            const w    = width(sprint);
            const donePct = sprint.totalTasks > 0
              ? Math.round((sprint.doneTasks / sprint.totalTasks) * 100)
              : null;

            return (
              <div key={sprint.id}
                className="flex items-center group"
                style={{ borderBottom: '1px solid var(--border)', minHeight: 52 }}>
                {/* Label */}
                <div className="w-40 shrink-0 px-4 py-3"
                  style={{ borderRight: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                    {sprint.name}
                  </p>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ background: cfg.bg, color: cfg.text }}>
                    {sprint.status}
                  </span>
                </div>
                {/* Gantt area */}
                <div className="flex-1 relative h-full py-2.5 px-1">
                  {/* Today line (inside rows) */}
                  {today >= startRange && today <= endRange && (
                    <div className="absolute top-0 bottom-0 w-0.5 z-10"
                      style={{ left: `${todayPct}%`, background: 'rgba(239,68,68,0.3)' }} />
                  )}
                  {/* Bar */}
                  <button
                    onClick={() => onSelectSprint?.(sprint.id)}
                    title={`${sprint.name} — Cliquer pour sélectionner`}
                    className="absolute top-2.5 rounded-lg h-7 transition-all group-hover:brightness-95 active:scale-[0.99] cursor-pointer overflow-hidden"
                    style={{
                      left: `${left}%`,
                      width: `${w}%`,
                      background: cfg.bar,
                      minWidth: 40,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                    }}>
                    {/* Progress fill */}
                    {donePct !== null && (
                      <div className="absolute inset-0 opacity-30 rounded-lg"
                        style={{ width: `${donePct}%`, background: '#fff' }} />
                    )}
                    <span className="relative z-10 px-2.5 text-white text-[11px] font-semibold truncate flex items-center h-full">
                      {sprint.name}
                      {donePct !== null && (
                        <span className="ml-1.5 opacity-80">· {donePct}%</span>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sprints without dates */}
        {sprintsNoDates.length > 0 && (
          <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
              {sprintsNoDates.length} sprint{sprintsNoDates.length > 1 ? 's' : ''} sans dates :
            </p>
            <div className="flex flex-wrap gap-2">
              {sprintsNoDates.map(s => {
                const cfg = STATUS_COLOR[s.status] || STATUS_COLOR.planned;
                return (
                  <button key={s.id}
                    onClick={() => onSelectSprint?.(s.id)}
                    className="text-xs font-medium px-2.5 py-1 rounded-full transition-opacity hover:opacity-70"
                    style={{ background: cfg.bg, color: cfg.text }}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
