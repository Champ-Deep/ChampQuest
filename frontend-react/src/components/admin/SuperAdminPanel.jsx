import { useState, useEffect } from 'react';
import { Users, Shield, Trash2, Plus, BarChart3, Copy } from 'lucide-react';
import { motion } from 'motion/react';
import { API } from '../../utils/api';
import Modal from '../common/Modal';

export default function SuperAdminPanel({ isOpen, onClose }) {
  const [tab, setTab] = useState('overview');
  const [analytics, setAnalytics] = useState(null);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen, tab]);

  const loadData = async () => {
    try {
      if (tab === 'overview') {
        const data = await API.getAdminAnalytics();
        setAnalytics(data);
      } else if (tab === 'teams') {
        const data = await API.getAdminTeams();
        setTeams(data);
      } else if (tab === 'users') {
        const data = await API.getAdminUsers();
        setUsers(data);
      }
    } catch (e) {
      console.error('Failed to load admin data:', e);
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await API.createTeam(newTeamName.trim());
      setNewTeamName('');
      loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteTeam = async (teamId, teamName) => {
    if (!confirm(`Delete team "${teamName}"? This will remove all tasks and members.`)) return;
    try {
      await API.deleteTeam(teamId);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleSuperadmin = async (userId, currentRole) => {
    const newRole = currentRole === 'superadmin' ? 'user' : 'superadmin';
    if (!confirm(`${newRole === 'superadmin' ? 'Promote' : 'Demote'} this user?`)) return;
    try {
      await API.updateUserGlobalRole(userId, newRole);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const tabs = [
    { id: 'overview', label: 'OVERVIEW', icon: BarChart3 },
    { id: 'teams', label: 'TEAMS', icon: Users },
    { id: 'users', label: 'USERS', icon: Shield },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SUPER ADMIN" maxWidth="max-w-4xl">
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs pixel-font transition-colors ${
              tab === t.id ? 'bg-red-600/20 text-red-400' : 'bg-slate-800 text-slate-500 hover:text-white'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-xs text-red-400 mb-4 bg-red-500/10 p-2 rounded">{error}</div>}

      {/* Overview Tab */}
      {tab === 'overview' && analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'TEAMS', value: analytics.totalTeams, color: 'text-blue-400' },
            { label: 'USERS', value: analytics.totalUsers, color: 'text-green-400' },
            { label: 'TASKS', value: analytics.totalTasks, color: 'text-amber-400' },
            { label: 'COMPLETED', value: analytics.completedTasks, color: 'text-emerald-400' },
          ].map((s, i) => (
            <motion.div key={i} className="glass-card p-4 text-center" whileHover={{ scale: 1.02 }}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value || 0}</div>
              <div className="text-[9px] pixel-font text-slate-500 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Teams Tab */}
      {tab === 'teams' && (
        <div>
          <div className="flex gap-2 mb-4">
            <input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
              placeholder="New team name..."
              onKeyDown={e => e.key === 'Enter' && createTeam()}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none" />
            <button onClick={createTeam} disabled={creating || !newTeamName.trim()}
              className="px-4 py-2 rounded bg-red-600 text-white text-xs pixel-font disabled:opacity-50 flex items-center gap-2">
              <Plus className="w-3 h-3" /> CREATE
            </button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {teams.map(team => (
              <motion.div key={team.id} className="glass-card p-3 flex items-center justify-between"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">{team.name}</div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                    <span>Code: <span className="text-slate-300 font-mono">{team.code}</span></span>
                    <button onClick={() => { navigator.clipboard.writeText(team.code); }}
                      className="text-slate-400 hover:text-white"><Copy className="w-3 h-3 inline" /></button>
                    <span>{team.memberCount || 0} members</span>
                    <span>{team.taskCount || 0} tasks</span>
                  </div>
                </div>
                <button onClick={() => deleteTeam(team.id, team.name)}
                  className="p-2 rounded bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
            {teams.length === 0 && (
              <div className="text-center text-slate-600 py-8">No teams yet. Create one above.</div>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {users.map(u => (
            <motion.div key={u.id} className="glass-card p-3 flex items-center justify-between"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div>
                <div className="text-sm text-white">{u.displayName || u.display_name}</div>
                <div className="text-[10px] text-slate-500">{u.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[9px] px-2 py-1 rounded pixel-font ${
                  (u.globalRole || u.global_role) === 'superadmin' ? 'bg-amber-600/20 text-amber-400' : 'bg-slate-700 text-slate-400'
                }`}>
                  {(u.globalRole || u.global_role) === 'superadmin' ? 'SUPERADMIN' : 'USER'}
                </span>
                <button onClick={() => toggleSuperadmin(u.id, u.globalRole || u.global_role)}
                  className="text-[9px] px-2 py-1 rounded bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 pixel-font transition-colors">
                  {(u.globalRole || u.global_role) === 'superadmin' ? 'DEMOTE' : 'PROMOTE'}
                </button>
              </div>
            </motion.div>
          ))}
          {users.length === 0 && (
            <div className="text-center text-slate-600 py-8">No users found.</div>
          )}
        </div>
      )}
    </Modal>
  );
}
