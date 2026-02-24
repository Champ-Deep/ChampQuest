import { useState, useEffect } from 'react';
import { Timer, Plus, ChevronDown, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTeam } from '../../contexts/TeamContext';
import { API } from '../../utils/api';
import Modal from '../common/Modal';

export default function SprintPanel() {
  const { currentTeam, tasks } = useTeam();
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [sprintDetail, setSprintDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: '', startDate: '', endDate: '' });

  useEffect(() => {
    if (currentTeam) loadSprints();
  }, [currentTeam]);

  const loadSprints = async () => {
    try {
      const data = await API.getSprints(currentTeam.id);
      setSprints(data);
      const active = data.find(s => s.status === 'active');
      if (active) {
        setActiveSprint(active);
        loadDetail(active.id);
      }
    } catch (e) {
      console.error('Failed to load sprints:', e);
    }
  };

  const loadDetail = async (sprintId) => {
    try {
      const data = await API.getSprintDetail(currentTeam.id, sprintId);
      setSprintDetail(data);
    } catch (e) {
      console.error('Failed to load sprint detail:', e);
    }
  };

  const createSprint = async () => {
    if (!newSprint.name || !newSprint.startDate || !newSprint.endDate) return;
    try {
      await API.createSprint(currentTeam.id, newSprint);
      setShowCreate(false);
      setNewSprint({ name: '', startDate: '', endDate: '' });
      loadSprints();
    } catch (e) {
      console.error('Failed to create sprint:', e);
    }
  };

  const addTask = async (taskId) => {
    if (!activeSprint) return;
    try {
      await API.addTaskToSprint(currentTeam.id, activeSprint.id, taskId);
      loadDetail(activeSprint.id);
    } catch (e) {
      console.error('Failed to add task to sprint:', e);
    }
  };

  if (!activeSprint && sprints.length === 0) {
    return (
      <div className="glass-card p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-3.5 h-3.5 text-purple-400" />
            <span className="pixel-font text-[10px] text-purple-400">SPRINTS</span>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="text-[9px] px-2 py-1 rounded bg-purple-600/20 text-purple-400 pixel-font flex items-center gap-1">
            <Plus className="w-2.5 h-2.5" /> NEW
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-2">No active sprint. Create one to focus your team.</p>
        <CreateSprintModal isOpen={showCreate} onClose={() => setShowCreate(false)}
          newSprint={newSprint} setNewSprint={setNewSprint} onCreate={createSprint} />
      </div>
    );
  }

  const progress = activeSprint
    ? Math.round((activeSprint.completedCount / Math.max(activeSprint.taskCount, 1)) * 100)
    : 0;

  const daysLeft = activeSprint
    ? Math.max(0, Math.ceil((new Date(activeSprint.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <>
      <div className="glass-card p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Timer className="w-3.5 h-3.5 text-purple-400" />
            <span className="pixel-font text-[10px] text-purple-400">
              {activeSprint?.name || 'SPRINT'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500">{daysLeft}d left</span>
            <button onClick={() => setExpanded(!expanded)}
              className="text-slate-500 hover:text-white transition-colors">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="text-[9px] px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400 pixel-font">
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
          <motion.div className="h-full bg-purple-500 rounded-full"
            initial={{ width: 0 }} animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }} />
        </div>
        <div className="flex justify-between text-[9px] text-slate-600">
          <span>{activeSprint?.completedCount || 0}/{activeSprint?.taskCount || 0} tasks</span>
          <span>{progress}%</span>
        </div>

        {/* Goals */}
        {activeSprint?.goals?.length > 0 && (
          <div className="mt-2 space-y-1">
            {activeSprint.goals.map((g, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Target className="w-2.5 h-2.5 text-purple-400" />
                <span>{g}</span>
              </div>
            ))}
          </div>
        )}

        {/* Expanded: sprint tasks */}
        <AnimatePresence>
          {expanded && sprintDetail && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 pt-2 border-t border-slate-800 space-y-1.5">
                <div className="text-[9px] pixel-font text-slate-600 mb-1">SPRINT TASKS</div>
                {sprintDetail.tasks?.map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'done' ? 'bg-green-500' : 'bg-slate-600'}`} />
                    <span className={t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-300'}>{t.title}</span>
                  </div>
                ))}
                {(!sprintDetail.tasks || sprintDetail.tasks.length === 0) && (
                  <div className="text-[10px] text-slate-600 italic">No tasks in this sprint yet</div>
                )}

                {/* Quick add unassigned tasks */}
                {tasks.filter(t => t.status !== 'done').length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800">
                    <div className="text-[9px] pixel-font text-slate-600 mb-1">ADD TO SPRINT</div>
                    <div className="max-h-[100px] overflow-y-auto space-y-1">
                      {tasks.filter(t => t.status !== 'done' && !sprintDetail.tasks?.some(st => st.id === t.id))
                        .slice(0, 5).map(t => (
                          <button key={t.id} onClick={() => addTask(t.id)}
                            className="block w-full text-left text-[10px] text-slate-500 hover:text-white px-1 py-0.5 rounded hover:bg-slate-800 truncate transition-colors">
                            + {t.title}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CreateSprintModal isOpen={showCreate} onClose={() => setShowCreate(false)}
        newSprint={newSprint} setNewSprint={setNewSprint} onCreate={createSprint} />
    </>
  );
}

function CreateSprintModal({ isOpen, onClose, newSprint, setNewSprint, onCreate }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="NEW SPRINT">
      <div className="space-y-3">
        <input type="text" value={newSprint.name} onChange={e => setNewSprint(s => ({ ...s, name: e.target.value }))}
          placeholder="Sprint name (e.g. Week 9)" maxLength={100}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 focus:outline-none" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">Start</label>
            <input type="date" value={newSprint.startDate}
              onChange={e => setNewSprint(s => ({ ...s, startDate: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">End</label>
            <input type="date" value={newSprint.endDate}
              onChange={e => setNewSprint(s => ({ ...s, endDate: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
          </div>
        </div>
        <button onClick={onCreate}
          disabled={!newSprint.name || !newSprint.startDate || !newSprint.endDate}
          className="w-full py-2.5 rounded-lg pixel-font text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 transition-colors">
          CREATE SPRINT
        </button>
      </div>
    </Modal>
  );
}
