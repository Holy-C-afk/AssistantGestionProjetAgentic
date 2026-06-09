import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getProjectById, getProjectMembers, addMemberByEmail, removeMember,
  updateProject, updateProjectStatus, downloadProjectPdf, getUsers,
} from '../api/projectApi';
import SprintSelector from '../components/SprintSelector';
import KanbanBoard from '../components/KanbanBoard';
import TaskDetailModal from '../components/TaskDetailModal';
import AgentPanel from '../components/AgentPanel';
import TimelineTab from '../components/TimelineTab';
import MultiSprintView from '../components/MultiSprintView';

/* ── SVG icons ─────────────────────────────────────────────────── */
const IconArrow = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);
const IconEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IconPdf = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);
const IconSearch = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IconX = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────── */
export default function ProjectDetailPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { t }     = useTranslation();

  const [project,  setProject]  = useState(null);
  const [members,  setMembers]  = useState([]);
  const [tab,      setTab]      = useState('board');
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [selectedTaskId,   setSelectedTaskId]   = useState(null);
  const [boardRefreshKey,  setBoardRefreshKey]  = useState(0);
  const [sprintRefreshKey, setSprintRefreshKey] = useState(0);

  const [newRole,       setNewRole]       = useState('member');
  const [addingMember,  setAddingMember]  = useState(false);
  const [userSearch,    setUserSearch]    = useState('');
  const [allUsers,      setAllUsers]      = useState([]);
  const [selectedUser,  setSelectedUser]  = useState(null);

  const [editing,     setEditing]     = useState(false);
  const [form,        setForm]        = useState({ name: '', description: '' });
  const [error,       setError]       = useState('');
  const [pdfLoading,  setPdfLoading]  = useState(false);

  const currentUserId = sessionStorage.getItem('userId');
  const isOwner       = project?.ownerId === currentUserId;
  const currentMember = members.find(m => m.userId === currentUserId);
  const isAdmin       = isOwner || currentMember?.role === 'admin' || currentMember?.role === 'owner';

  useEffect(() => {
    getProjectById(id).then(p => {
      setProject(p);
      setForm({ name: p.name, description: p.description || '' });
    }).catch(console.error);
    getProjectMembers(id).then(setMembers).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (tab === 'members') getUsers().then(setAllUsers).catch(console.error);
  }, [tab]);

  const handleAddMember = async (e) => {
    e?.preventDefault();
    if (!selectedUser) return;
    setError(''); setAddingMember(true);
    try {
      await addMemberByEmail(id, selectedUser.email, newRole);
      const updated = await getProjectMembers(id);
      setMembers(updated); setSelectedUser(null); setUserSearch(''); setNewRole('member');
    } catch (err) {
      setError(err?.response?.data?.message || t('project.errors.status'));
    } finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeMember(id, userId);
      setMembers(members.filter(m => m.userId !== userId));
    } catch (e) { console.error(e); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const updated = await updateProject(id, form);
      setProject(updated); setEditing(false);
    } catch (e) { console.error(e); }
  };

  const handleExportPdf = async () => {
    setPdfLoading(true);
    try { await downloadProjectPdf(id, project.name); }
    catch { setError(t('project.errors.pdf')); }
    finally { setPdfLoading(false); }
  };

  const handleStatusChange = async (newStatus) => {
    const label = t(`project.status.${newStatus}`, { defaultValue: newStatus });
    if (!confirm(t('project.confirmStatus', { status: label }))) return;
    try {
      const updated = await updateProjectStatus(id, newStatus);
      setProject(p => ({ ...p, status: updated.status }));
    } catch { setError(t('project.errors.status')); }
  };

  const refreshBoard = () => setBoardRefreshKey(k => k + 1);

  const handleAutoRefresh = ({ sprintAutoClosed, projectAutoCompleted, sprintReopened, projectReactivated, sprintActivated } = {}) => {
    if (sprintAutoClosed || sprintReopened || sprintActivated) setSprintRefreshKey(k => k + 1);
    if (sprintAutoClosed || sprintReopened || projectAutoCompleted || projectReactivated) {
      getProjectById(id).then(p => setProject(p)).catch(console.error);
    }
  };

  /* Loading skeleton */
  if (!project) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>{t('common.loading')}</p>
      </div>
    </div>
  );

  const STATUS_STYLE = {
    active:    { bg: '#F0FDF4', text: '#15803D', dot: '#16A34A' },
    archived:  { bg: '#FFFBEB', text: '#B45309', dot: '#D97706' },
    completed: { bg: '#EFF9FB', text: '#0E7490', dot: '#0E9488' },
  };
  const statusCfg   = STATUS_STYLE[project.status] ?? { bg: 'var(--surface-2)', text: 'var(--text-2)', dot: 'var(--text-3)' };
  const statusLabel = t(`project.status.${project.status}`, { defaultValue: project.status });

  const ROLE_STYLE = {
    admin:  { bg: '#F3E8FF', text: '#7C3AED' },
    owner:  { bg: '#F3E8FF', text: '#7C3AED' },
    member: { bg: '#EFF9FB', text: '#0E7490' },
    viewer: { bg: '#F4F2EE', text: '#6B6560' },
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Project header ──────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 py-5">

          {/* Breadcrumb */}
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm mb-4 transition-colors"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
            <IconArrow />
            <span>{t('project.backToProjects')}</span>
          </button>

          {error && (
            <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl mb-4 border"
              style={{ background: 'var(--danger-bg)', borderColor: '#FCA5A5', color: 'var(--danger)' }}>
              ⚠ {error}
            </div>
          )}

          {editing ? (
            <form onSubmit={handleUpdate} className="space-y-3 max-w-xl">
              <input
                className="w-full px-4 py-2.5 text-xl font-bold rounded-xl border outline-none transition-all"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <textarea
                className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none resize-none transition-all"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2} placeholder={`${t('common.description')} (${t('common.optional')})`}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <div className="flex gap-2">
                <ActionBtn primary onClick={e => { e.preventDefault(); handleUpdate(e); }}>{t('common.save')}</ActionBtn>
                <ActionBtn onClick={() => setEditing(false)}>{t('common.cancel')}</ActionBtn>
              </div>
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                    {project.name}
                  </h1>
                  <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: statusCfg.bg, color: statusCfg.text }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.dot }} />
                    {statusLabel}
                  </span>
                </div>
                <p className="text-sm mb-2" style={{ color: project.description ? 'var(--text-2)' : 'var(--text-3)' }}>
                  {project.description || <em>{t('project.noDescription')}</em>}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {t('project.createdOn')} {new Date(project.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' · '} <span style={{ color: 'var(--text-2)' }}>{members.length}</span>{' '}
                  {members.length !== 1 ? t('common.members') : t('common.member')}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {isAdmin && (
                  <ActionBtn icon={<IconEdit />} onClick={() => setEditing(true)}>{t('project.actions.edit')}</ActionBtn>
                )}
                {isAdmin && project.status !== 'archived' && (
                  <ActionBtn warning onClick={() => handleStatusChange('archived')}>{t('project.actions.archive')}</ActionBtn>
                )}
                {isAdmin && project.status !== 'completed' && (
                  <ActionBtn onClick={() => handleStatusChange('completed')}>{t('project.actions.complete')}</ActionBtn>
                )}
                {isAdmin && (project.status === 'archived' || project.status === 'completed') && (
                  <ActionBtn success onClick={() => handleStatusChange('active')}>{t('project.actions.reactivate')}</ActionBtn>
                )}
                <ActionBtn
                  icon={pdfLoading
                    ? <span className="w-3.5 h-3.5 border-2 border-t-current rounded-full animate-spin inline-block" />
                    : <IconPdf />}
                  onClick={handleExportPdf}
                  disabled={pdfLoading}>
                  {pdfLoading ? t('project.actions.pdfLoading') : t('project.actions.pdf')}
                </ActionBtn>
              </div>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            {[
              { k: 'board',     l: t('project.tabs.board') },
              { k: 'timeline',  l: 'Timeline' },
              { k: 'multisp',   l: 'Multi-sprint' },
              { k: 'members',   l: t('project.tabs.members', { count: members.length }) },
            ].map(tabItem => (
              <button key={tabItem.k}
                onClick={() => setTab(tabItem.k)}
                className="px-5 py-3 text-sm font-medium transition-all relative"
                style={{
                  color: tab === tabItem.k ? 'var(--accent)' : 'var(--text-2)',
                  borderBottom: `2px solid ${tab === tabItem.k ? 'var(--accent)' : 'transparent'}`,
                }}>
                {tabItem.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">

        {tab === 'board' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <div className="lg:col-span-1">
              <SprintSelector
                projectId={id}
                selectedSprintId={selectedSprintId}
                onSelect={setSelectedSprintId}
                refreshKey={sprintRefreshKey}
                onAutoRefresh={handleAutoRefresh}
                isAdmin={isAdmin}
              />
            </div>
            <div className="lg:col-span-3">
              <KanbanBoard
                sprintId={selectedSprintId}
                projectId={id}
                refreshKey={boardRefreshKey}
                onTaskClick={(task) => setSelectedTaskId(task.id)}
                onAutoRefresh={handleAutoRefresh}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        )}

        {tab === 'timeline' && (
          <TimelineTab
            projectId={id}
            onSelectSprint={(sid) => { setSelectedSprintId(sid); setTab('board'); }}
          />
        )}

        {tab === 'multisp' && (
          <MultiSprintView projectId={id} />
        )}

        {tab === 'members' && (
          <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-2' : ''} gap-5`}>

            {/* Add member panel — admin only */}
            {isAdmin && (
              <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>
                  {t('project.members.add')}
                </h3>

                {/* Search box */}
                <div className="relative mb-3">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--text-3)' }}>
                    <IconSearch />
                  </span>
                  <input
                    type="text"
                    placeholder={t('project.members.searchPlaceholder')}
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setSelectedUser(null); }}
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border outline-none transition-all"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>

                {/* User list */}
                {(() => {
                  const memberIds = new Set(members.map(m => m.userId));
                  const term = userSearch.trim().toLowerCase();
                  const filtered = allUsers.filter(u =>
                    !memberIds.has(u.id) &&
                    (!term || u.fullName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
                  );
                  return (
                    <div className="rounded-xl border overflow-hidden mb-4 max-h-64 overflow-y-auto"
                      style={{ borderColor: 'var(--border)' }}>
                      {filtered.length === 0 ? (
                        <p className="text-xs text-center py-6 italic" style={{ color: 'var(--text-3)' }}>
                          {allUsers.length === 0
                            ? t('project.members.noUsers')
                            : t('project.members.noResults')}
                        </p>
                      ) : filtered.map(u => {
                        const ini = u.fullName
                          ? u.fullName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
                          : u.email[0].toUpperCase();
                        const isSelected = selectedUser?.id === u.id;
                        return (
                          <button
                            key={u.id} type="button"
                            onClick={() => setSelectedUser(isSelected ? null : u)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b last:border-0"
                            style={{
                              background: isSelected ? 'var(--accent-light)' : 'transparent',
                              borderColor: 'var(--border)',
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                              style={{ background: isSelected ? 'var(--accent)' : 'var(--text-3)' }}>
                              {ini}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{u.fullName}</p>
                              <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{u.email}</p>
                            </div>
                            {isSelected && (
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                style={{ color: 'var(--accent)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Role + add button */}
                {selectedUser && (
                  <div className="p-3 rounded-xl border mb-3"
                    style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--accent-text)' }}>
                      {t('project.members.addAs', { name: selectedUser.fullName })}
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={newRole}
                        onChange={e => setNewRole(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm rounded-xl border outline-none transition-all"
                        style={{ background: 'var(--surface)', borderColor: 'var(--accent)', color: 'var(--text-1)' }}>
                        <option value="member">{t('project.members.roleCollaborateur')}</option>
                        <option value="admin">{t('project.members.roleChef')}</option>
                      </select>
                      <button
                        onClick={handleAddMember}
                        disabled={addingMember}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                        style={{ background: 'var(--accent)' }}>
                        {addingMember
                          ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          : t('project.members.addBtn')}
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
                  {t('project.members.onlyRegistered')}
                </p>
              </div>
            )}

            {/* Current members */}
            <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                  {t('project.members.current')}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                  {members.length}
                </span>
              </div>

              <div className="space-y-2 max-h-[450px] overflow-y-auto">
                {members.length === 0 && (
                  <p className="text-sm text-center py-8 italic" style={{ color: 'var(--text-3)' }}>
                    {t('project.members.noMembers')}
                  </p>
                )}
                {members.map(m => {
                  const ini = m.fullName
                    ? m.fullName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
                    : '?';
                  const roleSt = ROLE_STYLE[m.role] ?? { bg: 'var(--surface-2)', text: 'var(--text-2)' };
                  const roleLabel = t(`project.roles.${m.role}`, { defaultValue: m.role });
                  return (
                    <div key={m.userId}
                      className="flex items-center justify-between p-3 rounded-xl transition-colors"
                      style={{ background: 'var(--surface-2)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full text-white text-sm font-semibold flex items-center justify-center shrink-0"
                          style={{ background: 'var(--accent)' }}>
                          {ini}
                        </div>
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{m.fullName}</p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: roleSt.bg, color: roleSt.text }}>
                          {roleLabel}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemoveMember(m.userId)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: 'var(--text-3)', background: 'transparent' }}
                            title={t('project.members.remove')}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-bg)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
                          >
                            <IconX />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {selectedTaskId && (
          <TaskDetailModal
            taskId={selectedTaskId}
            members={members}
            isAdmin={isAdmin}
            onClose={() => setSelectedTaskId(null)}
            onUpdated={refreshBoard}
            onAutoRefresh={handleAutoRefresh}
          />
        )}
      </div>

      {/* Floating AI assistant */}
      <AgentPanel projectId={id} sprintId={selectedSprintId} />
    </div>
  );
}

/* ── Action button ─────────────────────────────────────────────── */
function ActionBtn({ children, onClick, disabled, icon, primary, warning, success, danger }) {
  let style = {};
  if (primary) {
    style = { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' };
  } else if (warning) {
    style = { background: 'var(--warning-bg)', color: 'var(--warning)', borderColor: '#FDE68A' };
  } else if (success) {
    style = { background: 'var(--success-bg)', color: 'var(--success)', borderColor: '#86EFAC' };
  } else if (danger) {
    style = { background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: '#FCA5A5' };
  } else {
    style = { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' };
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border transition-all disabled:opacity-50 hover:-translate-y-px active:scale-[0.98]"
      style={style}
    >
      {icon}
      {children}
    </button>
  );
}
