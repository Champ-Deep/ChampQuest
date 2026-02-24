import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTeam } from '../../contexts/TeamContext';
import { API } from '../../utils/api';
import Modal from '../common/Modal';

const FUNCTIONAL_ROLES = [
  'Frontend Dev', 'Backend Dev', 'Full Stack', 'Designer', 'QA',
  'PM', 'Data', 'DevOps', 'Marketing', 'Other'
];

export default function TeamSelectorScreen() {
  const { user, logout, isSuperadmin } = useAuth();
  const { activeTheme } = useTheme();
  const { userTeams, selectTeam, loadTeams } = useTeam();
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [roleStep, setRoleStep] = useState(null); // { teamId, teamName }
  const [selectedRole, setSelectedRole] = useState('');
  const [customRole, setCustomRole] = useState('');

  const handleJoin = async () => {
    setError('');
    try {
      const result = await API.joinTeamByCode(joinCode);
      await loadTeams();
      setShowJoin(false);
      setJoinCode('');
      setRoleStep({ teamId: result.teamId, teamName: result.teamName || 'your team' });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreate = async () => {
    setError('');
    try {
      const result = await API.createTeam(teamName);
      await loadTeams();
      setShowCreate(false);
      setTeamName('');
      setRoleStep({ teamId: result.team?.id || result.id, teamName: teamName });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetRole = async () => {
    const role = selectedRole === 'Other' ? customRole.trim() : selectedRole;
    if (!role) return;
    try {
      await API.updateMemberFunctionalRole(roleStep.teamId, user.id, role);
      setRoleStep(null);
      setSelectedRole('');
      setCustomRole('');
    } catch (err) {
      // Non-blocking — user can set role later
      console.error('Failed to set role:', err);
      setRoleStep(null);
    }
  };

  const skipRole = () => {
    setRoleStep(null);
    setSelectedRole('');
    setCustomRole('');
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

        {/* Role Selection Step */}
        <Modal isOpen={!!roleStep} onClose={skipRole} title="WHAT'S YOUR ROLE?">
          <p className="text-sm text-slate-400 mb-4">
            Select your functional role in <span className="text-white font-medium">{roleStep?.teamName}</span>.
            This helps the AI assign tasks to the right people.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {FUNCTIONAL_ROLES.map(role => (
              <motion.button key={role} onClick={() => setSelectedRole(role)}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className={`p-3 rounded-lg text-xs text-left transition-colors border ${
                  selectedRole === role
                    ? 'border-red-500/50 bg-red-600/10 text-white'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                }`}>
                {role}
              </motion.button>
            ))}
          </div>
          <AnimatePresence>
            {selectedRole === 'Other' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <input type="text" value={customRole} onChange={e => setCustomRole(e.target.value)}
                  placeholder="Enter your role..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white mb-4 focus:border-red-500 focus:outline-none" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3">
            <button onClick={skipRole} className="flex-1 py-2 rounded-lg text-xs text-slate-500 hover:text-white transition-colors">
              Skip for now
            </button>
            <button onClick={handleSetRole}
              disabled={!selectedRole || (selectedRole === 'Other' && !customRole.trim())}
              className="flex-1 py-2 rounded-lg pixel-font text-sm text-white disabled:opacity-40"
              style={{ background: activeTheme.vars['--neon-primary'] }}>
              SET ROLE
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
