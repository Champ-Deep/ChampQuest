import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTeam } from '../../contexts/TeamContext';
import { API } from '../../utils/api';
import Modal from '../common/Modal';

export default function TeamSelectorScreen() {
  const { user, logout, isSuperadmin } = useAuth();
  const { activeTheme } = useTheme();
  const { userTeams, selectTeam, loadTeams } = useTeam();
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');

  const handleJoin = async () => {
    setError('');
    try {
      await API.joinTeamByCode(joinCode);
      await loadTeams();
      setShowJoin(false);
      setJoinCode('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreate = async () => {
    setError('');
    try {
      await API.createTeam(teamName);
      await loadTeams();
      setShowCreate(false);
      setTeamName('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="team-selector-screen">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-8">
          <div className="text-sm text-slate-400">
            Welcome, <span className="text-white font-semibold">{user?.displayName}</span>
          </div>
          <button onClick={logout} className="text-xs text-slate-500 hover:text-red-500">Logout</button>
        </div>

        <h2 className="pixel-font text-xl text-center mb-8" style={{ color: activeTheme.vars['--neon-primary'] }}>
          SELECT YOUR TEAM
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {userTeams.map(team => (
            <button key={team.id} onClick={() => selectTeam(team)}
              className="glass-card p-4 text-left hover:border-red-500/30 transition-colors">
              <div className="font-bold text-white text-sm mb-1">{team.name}</div>
              <div className="text-[10px] text-slate-500">
                {team.memberRole} &middot; Code: {team.code}
              </div>
              <div className="text-[10px] text-slate-600 mt-1">
                {team.xp || 0} XP &middot; {team.tasksCompleted || 0} completed
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={() => setShowJoin(true)}
            className="glass-btn px-4 py-2 rounded-lg text-xs text-slate-300">
            Join Team
          </button>
          <button onClick={() => setShowCreate(true)}
            className="glass-btn px-4 py-2 rounded-lg text-xs text-slate-300">
            Create Team
          </button>
        </div>

        {isSuperadmin && (
          <div className="text-center mt-4">
            <span className="text-[10px] text-amber-500 pixel-font">SUPERADMIN</span>
          </div>
        )}

        <Modal isOpen={showJoin} onClose={() => setShowJoin(false)} title="JOIN TEAM">
          <div className="space-y-4">
            <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter team code" maxLength={8}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-red-500 focus:outline-none" />
            {error && <div className="text-red-500 text-xs">{error}</div>}
            <button onClick={handleJoin}
              className="w-full py-2 rounded-lg pixel-font text-sm text-white" style={{ background: activeTheme.vars['--neon-primary'] }}>
              JOIN
            </button>
          </div>
        </Modal>

        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="CREATE TEAM">
          <div className="space-y-4">
            <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)}
              placeholder="Team name" maxLength={50}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-red-500 focus:outline-none" />
            {error && <div className="text-red-500 text-xs">{error}</div>}
            <button onClick={handleCreate}
              className="w-full py-2 rounded-lg pixel-font text-sm text-white" style={{ background: activeTheme.vars['--neon-primary'] }}>
              CREATE
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
