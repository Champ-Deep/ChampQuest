import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, RefreshCw, MessageSquare, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTeam } from '../../contexts/TeamContext';
import { useAuth } from '../../contexts/AuthContext';
import { API } from '../../utils/api';
import { ChampAnimations, motionVariants } from '../../utils/animations';
import TaskFormModal from '../tasks/TaskFormModal';

const STATUS_COLORS = {
  todo: { bg: 'bg-slate-600/20', text: 'text-slate-400', label: 'TODO' },
  in_progress: { bg: 'bg-blue-600/20', text: 'text-blue-400', label: 'IN PROGRESS' },
  blocked: { bg: 'bg-red-600/20', text: 'text-red-400', label: 'BLOCKED' },
  in_review: { bg: 'bg-purple-600/20', text: 'text-purple-400', label: 'IN REVIEW' },
  done: { bg: 'bg-green-600/20', text: 'text-green-400', label: 'DONE' },
};

const STATUS_ORDER = ['todo', 'in_progress', 'blocked', 'in_review', 'done'];

const PRIORITY_COLORS = {
  P0: 'bg-red-500', P1: 'bg-amber-500', P2: 'bg-blue-500', P3: 'bg-green-500',
};

export default function CenterPanel() {
  const { activeTheme, getTerminology } = useTheme();
  const { user } = useAuth();
  const { currentTeam, tasks, stats, loadData, refreshTasks, teamMembers } = useTeam();
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [quickCapture, setQuickCapture] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [openStatusId, setOpenStatusId] = useState(null);
  const [expandedComments, setExpandedComments] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const taskListRef = useRef(null);

  useEffect(() => {
    if (taskListRef.current && tasks.length > 0) {
      ChampAnimations.animateTasksIn(taskListRef.current);
    }
  }, [tasks]);

  // Close status dropdown on outside click
  useEffect(() => {
    if (!openStatusId) return;
    const handler = () => setOpenStatusId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openStatusId]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const filteredTasks = useMemo(() => {
    let filtered = tasks || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.assignedToName?.toLowerCase().includes(q)
      );
    }
    if (priorityFilter !== 'ALL') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }
    if (statusFilter === 'BLOCKED') {
      filtered = filtered.filter(t => t.status === 'blocked');
    } else if (statusFilter === 'OVERDUE') {
      filtered = filtered.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done');
    }
    return filtered;
  }, [tasks, searchQuery, priorityFilter, statusFilter]);

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      let blockerNote = null;
      if (newStatus === 'blocked') {
        blockerNote = prompt('What is blocking this task?');
        if (blockerNote === null) return;
      }
      await API.updateTaskStatus(currentTeam.id, taskId, newStatus, blockerNote);
      setOpenStatusId(null);
      refreshTasks();
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const handleComplete = async (taskId, isCompleted) => {
    try {
      if (isCompleted) {
        await API.uncompleteTask(currentTeam.id, taskId);
      } else {
        await API.completeTask(currentTeam.id, taskId);
      }
      loadData();
    } catch (e) {
      console.error('Failed to toggle complete:', e);
    }
  };

  const handleDelete = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await API.deleteTask(currentTeam.id, taskId);
      refreshTasks();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  // AI Scan
  const handleScan = async () => {
    if (!quickCapture.trim()) return;
    setScanning(true);
    setScanResults(null);
    try {
      const data = await API.aiParseTasks(currentTeam.id, quickCapture);
      setScanResults(data.tasks || data);
    } catch (e) {
      // Fallback to simple parsing
      const lines = quickCapture.split(/[.\n]+/).filter(l => l.trim());
      setScanResults(lines.map(l => ({
        title: l.trim(),
        priority: l.match(/P[0-3]/i)?.[0]?.toUpperCase() || 'P2',
      })));
    } finally {
      setScanning(false);
    }
  };

  const addScannedTask = async (task) => {
    try {
      const member = task.assignedTo
        ? teamMembers.find(m => m.displayName?.toLowerCase().includes(task.assignedTo.toLowerCase()))
        : null;
      await API.createTask(currentTeam.id, {
        title: task.title,
        priority: task.priority || 'P2',
        assignedTo: member?.userId || undefined,
        dueDate: task.dueDate || undefined,
      });
      setScanResults(prev => prev.filter(t => t !== task));
      loadData();
    } catch (e) {
      console.error('Failed to add task:', e);
    }
  };

  const addAllScanned = async () => {
    for (const task of scanResults) {
      await addScannedTask(task);
    }
    setScanResults(null);
    setQuickCapture('');
  };

  // Comments
  const toggleComments = async (taskId) => {
    if (expandedComments === taskId) {
      setExpandedComments(null);
      return;
    }
    setExpandedComments(taskId);
    try {
      const data = await API.getTaskComments(currentTeam.id, taskId);
      setComments(data);
    } catch (e) {
      setComments([]);
    }
  };

  const addComment = async (taskId) => {
    if (!newComment.trim()) return;
    try {
      await API.addTaskComment(currentTeam.id, taskId, newComment.trim());
      setNewComment('');
      const data = await API.getTaskComments(currentTeam.id, taskId);
      setComments(data);
    } catch (e) {
      console.error('Failed to add comment:', e);
    }
  };

  const activeTasks = tasks.filter(t => t.status !== 'done').length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;

  return (
    <main className="center-panel">
      {/* Header */}
      <header className="p-6 pb-4">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="pixel-font text-lg mb-1" style={{ color: activeTheme.vars['--neon-primary'] }}>
              {currentTeam?.name || 'Team'}
            </h1>
            <p className="text-slate-500 text-xs">{getTerminology('commandCenter')}</p>
          </div>
          <div className="text-right">
            <div className="text-white text-sm font-medium">{today}</div>
            <div className="pixel-font text-[9px] text-slate-500">{getTerminology('missionDay')}</div>
          </div>
          <button onClick={loadData} className="ml-2 p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { value: activeTasks, label: 'ACTIVE', color: activeTheme.vars['--neon-primary'] },
            { value: completedTasks, label: 'COMPLETED', color: '#10b981' },
            { value: stats.streak || 0, label: 'STREAK', color: '#f59e0b' },
            { value: stats.mvp || '-', label: 'MVP', color: '#3b82f6' },
          ].map((s, i) => (
            <motion.div key={i} className="stat-box" whileHover={{ scale: 1.03 }} transition={{ duration: 0.15 }}>
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[9px] pixel-font text-slate-500">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Mission Scanner */}
        <div className="mission-scanner mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span>📱</span>
              <span className="pixel-font text-[10px]" style={{ color: activeTheme.vars['--neon-primary'] }}>
                {getTerminology('scanner')}
              </span>
            </div>
            <span className="text-slate-500 text-[10px]">{getTerminology('scannerHint')}</span>
          </div>
          <textarea value={quickCapture} onChange={e => setQuickCapture(e.target.value)}
            rows={2} placeholder="e.g., Fix the login bug P0 assign to Sreedeep. Also plan the offsite for next Friday."
            className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-sm text-white resize-y focus:border-red-500 focus:outline-none" />

          {/* Scan Results */}
          <AnimatePresence>
            {scanResults && scanResults.length > 0 && (
              <motion.div {...motionVariants.fadeIn} className="mt-3 space-y-2">
                <div className="text-[10px] pixel-font text-green-400 mb-2">EXTRACTED TASKS ({scanResults.length})</div>
                {scanResults.map((task, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between p-2 bg-slate-900/50 rounded border border-slate-800">
                    <div className="flex-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded pixel-font ${PRIORITY_COLORS[task.priority] || 'bg-blue-500'} text-white mr-2`}>
                        {task.priority || 'P2'}
                      </span>
                      <span className="text-xs text-white">{task.title}</span>
                      {task.assignedTo && <span className="text-[10px] text-slate-500 ml-2">→ {task.assignedTo}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => addScannedTask(task)}
                        className="text-[9px] px-2 py-1 rounded bg-green-600/20 text-green-400 pixel-font">ADD</button>
                      <button onClick={() => setScanResults(prev => prev.filter(t => t !== task))}
                        className="text-[9px] px-2 py-1 rounded bg-red-600/10 text-red-400 pixel-font">SKIP</button>
                    </div>
                  </motion.div>
                ))}
                <button onClick={addAllScanned}
                  className="text-[10px] px-3 py-1.5 rounded bg-green-600 text-white pixel-font w-full">
                  ADD ALL {scanResults.length} TASKS
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end gap-3 mt-3">
            <button onClick={() => { setQuickCapture(''); setScanResults(null); }}
              className="text-xs text-slate-500 hover:text-white transition-colors">Clear</button>
            <button onClick={handleScan} disabled={scanning || !quickCapture.trim()}
              className="text-xs px-3 py-1.5 rounded border pixel-font disabled:opacity-40 transition-colors"
              style={{ borderColor: activeTheme.vars['--neon-primary'], color: activeTheme.vars['--neon-primary'], background: activeTheme.vars['--bg-capture'] }}>
              {scanning ? '⏳ SCANNING...' : '✨ SCAN WITH AI'}
            </button>
            <button onClick={() => setShowTaskForm(true)}
              className="text-xs px-3 py-1.5 rounded bg-blue-600/20 text-blue-500 border border-blue-600/30 pixel-font hover:bg-blue-600/30 transition-colors">
              + MANUAL ADD
            </button>
          </div>
        </div>
      </header>

      {/* Task List */}
      <section className="px-6 pb-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="pixel-font text-[10px] text-slate-500">
            ACTIVE {getTerminology('missions').toUpperCase()}
          </h2>
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:border-red-500 focus:outline-none" />
            </div>
          </div>
          {/* Priority Filters */}
          <div className="flex gap-1">
            {['ALL', 'P0', 'P1', 'P2', 'P3'].map(p => (
              <button key={p} onClick={() => setPriorityFilter(p)}
                className={`text-[10px] px-2 py-1 rounded pixel-font transition-colors ${
                  priorityFilter === p
                    ? `${p === 'ALL' ? 'bg-blue-600 text-white' : `${PRIORITY_COLORS[p]} text-white`}`
                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                }`}>
                {p}
              </button>
            ))}
          </div>
          <span className="text-slate-700">|</span>
          {/* Status Filters */}
          <div className="flex gap-1">
            {['ALL', 'BLOCKED', 'OVERDUE'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-[10px] px-2 py-1 rounded pixel-font transition-colors ${
                  statusFilter === s
                    ? `${s === 'ALL' ? 'bg-amber-600 text-white' : s === 'BLOCKED' ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'}`
                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div ref={taskListRef} className="space-y-3">
          {filteredTasks.map(task => {
            const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS.todo;
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

            return (
              <motion.div key={task.id} whileHover={{ x: 2 }} transition={{ duration: 0.15 }}
                className={`task-card p-4 priority-${task.priority?.toLowerCase()} ${task.status === 'done' ? 'completed' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded pixel-font ${PRIORITY_COLORS[task.priority] || 'bg-slate-600'} text-white`}>
                        {task.priority || 'P3'}
                      </span>
                      {/* Status dropdown */}
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenStatusId(openStatusId === task.id ? null : task.id); }}
                          className={`text-[9px] px-1.5 py-0.5 rounded pixel-font ${statusStyle.bg} ${statusStyle.text} flex items-center gap-1`}>
                          {statusStyle.label} <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                        <AnimatePresence>
                          {openStatusId === task.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                              className="absolute top-full left-0 mt-1 bg-slate-900 border border-slate-700 rounded shadow-xl z-50 min-w-[120px]">
                              {STATUS_ORDER.map(s => {
                                const sc = STATUS_COLORS[s];
                                return (
                                  <button key={s} onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, s); }}
                                    className={`block w-full text-left text-[9px] px-3 py-1.5 pixel-font hover:bg-slate-800 ${
                                      task.status === s ? `${sc.text} font-bold` : 'text-slate-400'
                                    }`}>
                                    {sc.label}
                                  </button>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      {isOverdue && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-600/20 text-orange-400 pixel-font">OVERDUE</span>
                      )}
                      {task.category && (
                        <span className="text-[9px] text-slate-600">{task.category}</span>
                      )}
                    </div>
                    <div className={`text-sm font-medium ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>
                      {task.title}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                      {task.assignedToName && <span>→ {task.assignedToName}</span>}
                      {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                      {task.timeEstimate && <span>~{task.timeEstimate}</span>}
                    </div>
                    {task.blockerNote && task.status === 'blocked' && (
                      <div className="mt-2 text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1">
                        Blocked: {task.blockerNote}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 ml-3">
                    <button onClick={() => toggleComments(task.id)}
                      className={`text-[10px] px-2 py-1 rounded transition-colors ${expandedComments === task.id ? 'bg-cyan-600/20 text-cyan-400' : 'bg-slate-800 text-slate-500 hover:text-white'}`}>
                      <MessageSquare className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleComplete(task.id, task.status === 'done')}
                      className={`text-[10px] px-2 py-1 rounded transition-colors ${task.status === 'done' ? 'bg-slate-700 text-slate-400' : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'}`}>
                      {task.status === 'done' ? 'Undo' : '✓'}
                    </button>
                    <button onClick={() => handleDelete(task.id)}
                      className="text-[10px] px-2 py-1 rounded bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-colors">
                      ✕
                    </button>
                  </div>
                </div>

                {/* Comments section */}
                <AnimatePresence>
                  {expandedComments === task.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <div className="space-y-2 max-h-[150px] overflow-y-auto mb-2">
                          {comments.length === 0 && <div className="text-[10px] text-slate-600 italic">No comments yet</div>}
                          {comments.map(c => (
                            <div key={c.id} className="text-[10px]">
                              <span className="text-cyan-400">{c.userName}</span>
                              <span className="text-slate-600 ml-1">{new Date(c.createdAt).toLocaleDateString()}</span>
                              <div className="text-slate-400 mt-0.5">{c.content}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addComment(task.id)}
                            placeholder="Add a comment..."
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white focus:border-cyan-500 focus:outline-none" />
                          <button onClick={() => addComment(task.id)}
                            className="text-[9px] px-2 py-1 rounded bg-cyan-600/20 text-cyan-400 pixel-font">POST</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          {filteredTasks.length === 0 && (
            <div className="text-center py-12 text-slate-600">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-sm">No {getTerminology('missions').toLowerCase()} found</div>
            </div>
          )}
        </div>
      </section>

      <TaskFormModal isOpen={showTaskForm} onClose={() => setShowTaskForm(false)} />
    </main>
  );
}
