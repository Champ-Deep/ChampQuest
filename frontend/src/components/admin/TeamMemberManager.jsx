import { useState, useEffect } from 'react';
import { Copy, UserMinus, Crown, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTeam } from '../../contexts/TeamContext';
import { useAuth } from '../../contexts/AuthContext';
import { API } from '../../utils/api';
import Modal from '../common/Modal';

const ROLE_OPTIONS = [
  'Frontend Dev', 'Backend Dev', 'Full Stack', 'Designer', 'QA',
  'PM', 'Data', 'DevOps', 'Marketing', 'Other'
];

export default function TeamMemberManager({ isOpen, onClose }) {
  const { currentTeam, teamMembers, loadData } = useTeam();
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [customRole, setCustomRole] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && currentTeam) {
      refreshMembers();
    }
  }, [isOpen, currentTeam]);

  const refreshMembers = async () => {
    try {
      const data = await API.getTeamMembers(currentTeam.id);
      setMembers(data);
    } catch (e) {
      console.error('Failed to load members:', e);
    }
  };

  const copyCode = () => {
    if (currentTeam?.code) {
      navigator.clipboard.writeText(currentTeam.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const changeRole = async (userId, newRole) => {
    try {
      await API.updateMemberRole(currentTeam.id, userId, newRole);
      refreshMembers();
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const setFunctionalRole = async (userId, memberRole) => {
    try {
      await API.updateMemberFunctionalRole(currentTeam.id, userId, memberRole);
      setEditingRole(null);
      setCustomRole('');
      refreshMembers();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeMember = async (userId, name) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    try {
      await API.removeTeamMember(currentTeam.id, userId);
      refreshMembers();
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="TEAM MEMBERS" maxWidth="max-w-3xl">
      {/* Join Code */}
      <div className="glass-card p-3 mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] pixel-font text-slate-500 mb-1">INVITE CODE</div>
          <div className="text-lg font-mono text-white tracking-wider">{currentTeam?.code || '...'}</div>
        </div>
        <button onClick={copyCode}
          className={`px-3 py-2 rounded text-xs pixel-font flex items-center gap-2 transition-colors ${
            copied ? 'bg-green-600/20 text-green-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}>
          <Copy className="w-3.5 h-3.5" /> {copied ? 'COPIED!' : 'COPY'}
        </button>
      </div>
      <p className="text-[10px] text-slate-500 mb-4">Share this code with teammates so they can join.</p>

      {error && <div className="text-xs text-red-400 mb-3 bg-red-500/10 p-2 rounded">{error}</div>}

      {/* Member List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {members.map(m => (
          <motion.div key={m.userId} className="glass-card p-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{m.displayName}</span>
                  {m.role === 'admin' && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-400 pixel-font flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" /> ADMIN
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                  <span>{m.xp || 0} XP</span>
                  <span>{m.tasksCompleted || 0} tasks</span>
                  {m.memberRole && (
                    <span className="text-blue-400">{m.memberRole}</span>
                  )}
                  {!m.memberRole && (
                    <span className="text-slate-600 italic">no role set</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Functional Role Setter */}
                <div className="relative">
                  <button onClick={() => setEditingRole(editingRole === m.userId ? null : m.userId)}
                    className="text-[9px] px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 pixel-font flex items-center gap-1 transition-colors">
                    ROLE <ChevronDown className="w-2.5 h-2.5" />
                  </button>
                  <AnimatePresence>
                    {editingRole === m.userId && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                        className="absolute right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded shadow-xl z-50 min-w-[160px] p-2">
                        {ROLE_OPTIONS.map(r => (
                          <button key={r} onClick={() => setFunctionalRole(m.userId, r)}
                            className={`block w-full text-left text-[10px] px-2 py-1.5 rounded hover:bg-slate-800 transition-colors ${
                              m.memberRole === r ? 'text-blue-400 font-bold' : 'text-slate-400'
                            }`}>
                            {r}
                          </button>
                        ))}
                        <div className="border-t border-slate-700 mt-1 pt-1 flex gap-1">
                          <input type="text" value={customRole} onChange={e => setCustomRole(e.target.value)}
                            placeholder="Custom..."
                            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] text-white" />
                          <button onClick={() => customRole.trim() && setFunctionalRole(m.userId, customRole.trim())}
                            className="text-[9px] px-2 py-1 rounded bg-blue-600 text-white pixel-font">OK</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Team Role Toggle */}
                {m.userId !== user?.id && (
                  <button onClick={() => changeRole(m.userId, m.role === 'admin' ? 'member' : 'admin')}
                    className={`text-[9px] px-2 py-1 rounded pixel-font transition-colors ${
                      m.role === 'admin' ? 'bg-amber-600/20 text-amber-400' : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}>
                    {m.role === 'admin' ? 'DEMOTE' : 'MAKE ADMIN'}
                  </button>
                )}

                {/* Remove */}
                {m.userId !== user?.id && (
                  <button onClick={() => removeMember(m.userId, m.displayName)}
                    className="p-1.5 rounded bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-colors">
                    <UserMinus className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {members.length === 0 && (
          <div className="text-center text-slate-600 py-8">No members yet. Share the invite code.</div>
        )}
      </div>
    </Modal>
  );
}
