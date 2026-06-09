import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard } from '../api/dashboardApi';

/* ── Helpers ────────────────────────────────────────────────────── */
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return 'À l\'instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return `Il y a ${Math.floor(diff / 86400)}j`;
}

const PRIO_LABEL = { critical: 'Critique', high: 'Haute', medium: 'Moyenne', low: 'Faible', none: '—' };
const PRIO_COLOR = { critical: '#EF4444', high: '#F97316', medium: '#3B82F6', low: '#94A3B8', none: '#CBD5E1' };

const STATUS_STYLE = {
  active:    { bg: '#F0FDF4', text: '#15803D' },
  archived:  { bg: '#FFFBEB', text: '#B45309' },
  completed: { bg: '#EFF9FB', text: '#0E7490' },
};

/* ── Pure-CSS bar chart (no library) ───────────────────────────── */
function BarChart({ data, keys, colors, height = 160 }) {
  if (!data?.length) return null;
  const maxVal = Math.max(1, ...data.flatMap(d => keys.map(k => d[k] || 0)));

  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
          {/* Stacked bars */}
          <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: height - 28 }}>
            {keys.map((k, ki) => {
              const pct = (d[k] || 0) / maxVal * 100;
              return pct > 0 ? (
                <div key={ki} title={`${k}: ${d[k]}`}
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{ height: `${pct}%`, background: colors[ki], minHeight: 2 }} />
              ) : null;
            })}
          </div>
          {/* Label */}
          <span className="text-[10px] truncate w-full text-center" style={{ color: 'var(--text-3)' }}>
            {d.month}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Pure-CSS donut chart ───────────────────────────────────────── */
function DonutChart({ segments, size = 140 }) {
  if (!segments?.length) return null;
  const total = segments.reduce((s, g) => s + g.value, 0);
  if (total === 0) return <p className="text-sm text-center" style={{ color: 'var(--text-3)' }}>Aucune donnée</p>;

  let offset = 0;
  const r = 40, cx = 50, cy = 50;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="18" />
        {segments.map((seg, i) => {
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const gap  = circumference - dash;
          const el = (
            <circle key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circumference}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          );
          offset += fraction;
          return el;
        })}
        {/* Centre text */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="bold" fill="var(--text-1)">
          {total}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="var(--text-3)">
          total
        </text>
      </svg>
      {/* Legend */}
      <div className="flex flex-col gap-1.5 w-full">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: seg.color }} />
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>{seg.name}</span>
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-1)' }}>
              {seg.value} <span style={{ color: 'var(--text-3)' }}>({Math.round(seg.value / total * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────── */
function Sk({ w = 'full', h = 4 }) {
  return <div className={`skeleton rounded h-${h} w-${w}`} />;
}

/* ── Main ───────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => setError('Impossible de charger le tableau de bord.'))
      .finally(() => setLoading(false));
  }, []);

  const sprintMap = {};
  (data?.sprintStats || []).forEach(s => { sprintMap[s.status] = s.count; });

  const taskSegments = data ? [
    { name: 'À faire',   value: data.taskStats.todo,        color: '#94A3B8' },
    { name: 'En cours',  value: data.taskStats.inProgress,  color: '#F59E0B' },
    { name: 'Terminées', value: data.taskStats.done,        color: '#10B981' },
  ].filter(s => s.value > 0) : [];

  const kpis = data ? [
    { label: 'Projets',        n: data.projectStats.total,    sub: `${data.projectStats.active} actifs`,        color: 'var(--accent)', icon: '📁' },
    { label: 'Tâches totales', n: data.taskStats.total,       sub: `${data.taskStats.done} terminées`,          color: '#10B981',        icon: '✅' },
    { label: 'En cours',       n: data.taskStats.inProgress,  sub: `${data.taskStats.todo} à faire`,            color: '#F59E0B',        icon: '⚡' },
    { label: 'Sprints actifs', n: sprintMap['active'] ?? 0,   sub: `${sprintMap['closed'] ?? 0} clôturés`,      color: '#8B5CF6',        icon: '🏃' },
  ] : [];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-7">
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--accent)' }}>Vue d'ensemble</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
            Tableau de bord
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-7 space-y-7">

        {error && (
          <div className="px-4 py-3 rounded-xl border text-sm"
            style={{ background: 'var(--danger-bg)', borderColor: '#FCA5A5', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* ── KPI cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border p-5 space-y-3"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <Sk w="1/2" h={3} /><Sk h={8} /><Sk w="2/3" h={3} />
                </div>
              ))
            : kpis.map(({ label, n, sub, color, icon }) => (
                <div key={label} className="rounded-2xl border p-5 transition-all hover:-translate-y-0.5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</p>
                    <span className="text-lg">{icon}</span>
                  </div>
                  <p className="text-4xl font-bold tabular-nums mb-1" style={{ color }}>{n}</p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>
                </div>
              ))
          }
        </div>

        {/* ── Charts row ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Monthly activity */}
          <div className="rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
              Activité — 6 derniers mois
            </h2>
            <div className="flex gap-4 mb-5">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--accent-light)' }} /> Créées
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--accent)' }} /> Terminées
              </span>
            </div>
            {loading
              ? <div className="flex items-end gap-2 h-36">
                  {[60, 80, 45, 90, 55, 70].map((h, i) => (
                    <div key={i} className="flex-1 skeleton rounded-t" style={{ height: `${h}%` }} />
                  ))}
                </div>
              : <BarChart
                  data={data.monthly}
                  keys={['created', 'done']}
                  colors={['var(--accent-light)', 'var(--accent)']}
                  height={180}
                />
            }
          </div>

          {/* Task status donut */}
          <div className="rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              Statut des tâches
            </h2>
            {loading
              ? <div className="flex justify-center"><div className="skeleton w-36 h-36 rounded-full" /></div>
              : <DonutChart segments={taskSegments} size={140} />
            }
          </div>
        </div>

        {/* ── Bottom row ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Priority breakdown */}
          <div className="rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              Priorité des tâches
            </h2>
            {loading
              ? <div className="space-y-3">{[...Array(4)].map((_, i) => <Sk key={i} />)}</div>
              : (data.priorities?.length === 0
                  ? <p className="text-sm" style={{ color: 'var(--text-3)' }}>Aucune tâche</p>
                  : <div className="space-y-3">
                      {[...data.priorities].sort((a, b) => b.value - a.value).map(p => {
                        const max = Math.max(1, ...data.priorities.map(x => x.value));
                        const pct = Math.round((p.value / max) * 100);
                        const color = PRIO_COLOR[p.name] || '#94A3B8';
                        const label = PRIO_LABEL[p.name] || p.name;
                        return (
                          <div key={p.name}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</span>
                              <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>{p.value}</span>
                            </div>
                            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                )
            }
          </div>

          {/* Recent projects */}
          <div className="rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              Activité récente
            </h2>
            {loading
              ? <div className="space-y-3">{[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <Sk w="9" h={9} />
                    <div className="flex-1 space-y-1"><Sk w="1/2" /><Sk w="1/3" h={3} /></div>
                  </div>
                ))}</div>
              : (data.recentProjects.length === 0
                  ? <p className="text-sm" style={{ color: 'var(--text-3)' }}>Aucun projet</p>
                  : <div className="space-y-2">
                      {data.recentProjects.map(p => {
                        const ss = STATUS_STYLE[p.status] || { bg: 'var(--surface-2)', text: 'var(--text-2)' };
                        return (
                          <button key={p.id}
                            onClick={() => navigate(`/projects/${p.id}`)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                            style={{ background: 'var(--surface-2)' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: 'var(--accent)' }}>
                              {p.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{p.name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{relativeTime(p.updatedAt)}</p>
                            </div>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: ss.bg, color: ss.text }}>
                              {p.status}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                )
            }
          </div>
        </div>
      </div>
    </div>
  );
}
