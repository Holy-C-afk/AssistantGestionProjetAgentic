import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { getDashboard } from '../api/dashboardApi';

/* ── Palette ────────────────────────────────────────────────────── */
const COLORS = {
  todo:       '#94A3B8',
  inProgress: '#F59E0B',
  done:       '#10B981',
  critical:   '#EF4444',
  high:       '#F97316',
  medium:     '#3B82F6',
  low:        '#6B7280',
  none:       '#CBD5E1',
};
const STATUS_COLORS = ['#10B981','#3B82F6','#F59E0B','#94A3B8'];

/* ── Helpers ────────────────────────────────────────────────────── */
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)  return 'À l\'instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff/3600)}h`;
  return `Il y a ${Math.floor(diff/86400)}j`;
}

const PRIO_LABEL = { critical:'Critique', high:'Haute', medium:'Moyenne', low:'Faible', none:'—' };

/* ── Skeleton ───────────────────────────────────────────────────── */
function Sk({ w = 'full', h = 4 }) {
  return <div className={`skeleton h-${h} rounded w-${w}`} />;
}

/* ── Main ───────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const taskPieData = data ? [
    { name: 'À faire',      value: data.taskStats.todo,       color: COLORS.todo       },
    { name: 'En cours',     value: data.taskStats.inProgress, color: COLORS.inProgress },
    { name: 'Terminées',    value: data.taskStats.done,       color: COLORS.done       },
  ].filter(d => d.value > 0) : [];

  const prioData = data?.priorities?.map(p => ({
    ...p,
    name:  PRIO_LABEL[p.name] || p.name,
    color: COLORS[p.name] || '#94A3B8',
  })) || [];

  const sprintMap = {};
  (data?.sprintStats || []).forEach(s => { sprintMap[s.status] = s.count; });

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

        {/* ── KPI cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading ? [...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border p-5 space-y-2"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <Sk w="1/2" h={3} /><Sk h={8} /><Sk w="2/3" h={3} />
            </div>
          )) : [
            { label: 'Projets',        n: data.projectStats.total,    sub: `${data.projectStats.active} actifs`,    color: 'var(--accent)',   icon: '📁' },
            { label: 'Tâches totales', n: data.taskStats.total,        sub: `${data.taskStats.done} terminées`,      color: '#10B981',         icon: '✅' },
            { label: 'En cours',       n: data.taskStats.inProgress,   sub: `${data.taskStats.todo} à faire`,        color: '#F59E0B',         icon: '⚡' },
            { label: 'Sprints actifs', n: sprintMap['active'] ?? 0,    sub: `${sprintMap['closed']??0} clôturés`,    color: '#8B5CF6',         icon: '🏃' },
          ].map(({ label, n, sub, color, icon }) => (
            <div key={label} className="rounded-2xl border p-5 transition-all hover:-translate-y-0.5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</p>
                <span className="text-lg">{icon}</span>
              </div>
              <p className="text-4xl font-bold tabular-nums mb-1" style={{ color }}>{n}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Charts row ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Monthly bar chart */}
          <div className="rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              Activité — 6 derniers mois
            </h2>
            {loading ? <div className="h-48 flex items-end gap-2 px-2">
              {[60,80,45,90,55,70].map((h,i) => (
                <div key={i} className="flex-1 skeleton rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.monthly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                    cursor={{ fill: 'var(--surface-2)' }}
                  />
                  <Bar dataKey="created" name="Créées" fill="var(--accent-light)" radius={[4,4,0,0]} />
                  <Bar dataKey="done"    name="Terminées" fill="var(--accent)"       radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-4 mt-3 justify-center">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--accent-light)' }} /> Créées
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--accent)' }} /> Terminées
              </span>
            </div>
          </div>

          {/* Task status donut */}
          <div className="rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              Statut des tâches
            </h2>
            {loading ? <div className="h-48 skeleton rounded-full w-48 mx-auto" /> : (
              taskPieData.length === 0
                ? <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>Aucune tâche</div>
                : <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                        paddingAngle={3} dataKey="value">
                        {taskPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Bottom row ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Priority distribution */}
          <div className="rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              Priorité des tâches
            </h2>
            {loading ? <div className="space-y-3">{[...Array(4)].map((_, i) => <Sk key={i} />)}</div> : (
              prioData.length === 0
                ? <p className="text-sm" style={{ color: 'var(--text-3)' }}>Aucune tâche</p>
                : <div className="space-y-3">
                    {prioData.sort((a,b) => b.value - a.value).map(p => {
                      const max = Math.max(...prioData.map(x => x.value));
                      const pct = max > 0 ? Math.round((p.value / max) * 100) : 0;
                      return (
                        <div key={p.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{p.name}</span>
                            <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>{p.value}</span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: p.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
            )}
          </div>

          {/* Recent projects */}
          <div className="rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              Activité récente
            </h2>
            {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 items-center">
                <Sk w="9" h={9} /> <div className="flex-1 space-y-1"><Sk w="1/2" /><Sk w="1/3" h={3} /></div>
              </div>
            ))}</div> : (
              data.recentProjects.length === 0
                ? <p className="text-sm" style={{ color: 'var(--text-3)' }}>Aucun projet</p>
                : <div className="space-y-2">
                    {data.recentProjects.map(p => {
                      const STATUS_STYLE = {
                        active:    { bg: '#F0FDF4', text: '#15803D' },
                        archived:  { bg: '#FFFBEB', text: '#B45309' },
                        completed: { bg: '#EFF9FB', text: '#0E7490' },
                      };
                      const ss = STATUS_STYLE[p.status] || { bg: 'var(--surface-2)', text: 'var(--text-2)' };
                      return (
                        <button key={p.id}
                          onClick={() => navigate(`/projects/${p.id}`)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:opacity-80"
                          style={{ background: 'var(--surface-2)' }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: 'var(--accent)' }}>
                            {p.name.slice(0,2).toUpperCase()}
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
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
