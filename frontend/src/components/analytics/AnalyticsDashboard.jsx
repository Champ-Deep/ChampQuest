import { useState, useEffect } from 'react';
import { BarChart3, Trophy, Calendar, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useTeam } from '../../contexts/TeamContext';
import { API } from '../../utils/api';
import Modal from '../common/Modal';

export default function AnalyticsDashboard({ isOpen, onClose }) {
  const { currentTeam } = useTeam();
  const [tab, setTab] = useState('weekly');
  const [weeklyData, setWeeklyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentTeam) return;
    loadTab();
  }, [isOpen, tab, currentTeam]);

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === 'weekly') {
        const data = await API.getWeeklyAnalytics(currentTeam.id);
        setWeeklyData(data);
      } else if (tab === 'monthly') {
        const data = await API.getMonthlyAnalytics(currentTeam.id);
        setMonthlyData(data);
      } else if (tab === 'history') {
        const data = await API.getAnalyticsHistory(currentTeam.id);
        setHistory(data);
      }
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'weekly', label: 'THIS WEEK', icon: Calendar },
    { id: 'monthly', label: 'THIS MONTH', icon: TrendingUp },
    { id: 'history', label: 'HISTORY', icon: BarChart3 },
  ];

  const renderLeaderboard = (members, taskKey) => {
    if (!members || members.length === 0) {
      return <div className="text-center text-slate-600 py-8">No data yet</div>;
    }

    const maxTasks = Math.max(...members.map(m => m[taskKey] || 0), 1);

    return (
      <div className="space-y-3">
        {members.map((m, i) => (
          <motion.div key={m.id} className="glass-card p-3"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`w-6 text-center text-sm ${
                i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-slate-600'
              }`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
              </span>
              <span className="text-sm text-white font-medium flex-1">{m.displayName}</span>
              <span className="text-xs text-slate-400">{m.xp} XP</span>
              <span className="pixel-font text-[10px] text-green-400">{m[taskKey]} tasks</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#475569' }}
                initial={{ width: 0 }}
                animate={{ width: `${((m[taskKey] || 0) / maxTasks) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ANALYTICS" maxWidth="max-w-3xl">
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs pixel-font transition-colors ${
              tab === t.id ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-800 text-slate-500 hover:text-white'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center text-slate-500 py-8 text-sm animate-pulse">Loading analytics...</div>}

      {/* Weekly Tab */}
      {tab === 'weekly' && !loading && weeklyData && (
        <div>
          {weeklyData.mvp && (
            <div className="glass-card p-4 mb-4 flex items-center gap-3">
              <Trophy className="w-6 h-6 text-amber-400" />
              <div>
                <div className="text-[10px] pixel-font text-amber-500 mb-1">WEEKLY MVP</div>
                <div className="text-sm text-white font-medium">{weeklyData.mvp.displayName}</div>
                <div className="text-[10px] text-slate-500">
                  {weeklyData.mvp.tasksThisWeek} tasks completed &middot; {weeklyData.mvp.xp} XP
                </div>
              </div>
            </div>
          )}
          <div className="text-[10px] text-slate-500 mb-3">
            {new Date(weeklyData.periodStart).toLocaleDateString()} – {new Date(weeklyData.periodEnd).toLocaleDateString()}
          </div>
          {renderLeaderboard(weeklyData.members, 'tasksThisWeek')}
        </div>
      )}

      {/* Monthly Tab */}
      {tab === 'monthly' && !loading && monthlyData && (
        <div>
          {monthlyData.mvp && (
            <div className="glass-card p-4 mb-4 flex items-center gap-3">
              <Trophy className="w-6 h-6 text-emerald-400" />
              <div>
                <div className="text-[10px] pixel-font text-emerald-500 mb-1">MONTHLY MVP</div>
                <div className="text-sm text-white font-medium">{monthlyData.mvp.displayName}</div>
                <div className="text-[10px] text-slate-500">
                  {monthlyData.mvp.tasksThisMonth} tasks completed &middot; {monthlyData.mvp.xp} XP
                </div>
              </div>
            </div>
          )}
          <div className="text-[10px] text-slate-500 mb-3">
            {new Date(monthlyData.periodStart).toLocaleDateString()} – {new Date(monthlyData.periodEnd).toLocaleDateString()}
          </div>
          {renderLeaderboard(monthlyData.members, 'tasksThisMonth')}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && !loading && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {history.length === 0 && (
            <div className="text-center text-slate-600 py-8">No snapshots yet. Analytics snapshots are generated automatically each week.</div>
          )}
          {history.map(s => (
            <motion.div key={s.id} className="glass-card p-3"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] px-2 py-0.5 rounded pixel-font ${
                    s.period === 'weekly' ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'
                  }`}>
                    {s.period?.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {s.mvp && (
                <div className="text-xs text-slate-400">
                  MVP: <span className="text-white">{s.mvp}</span>
                  {s.mvpTasksCompleted > 0 && <span className="text-slate-500"> ({s.mvpTasksCompleted} tasks)</span>}
                </div>
              )}
              {s.data?.totalTasks !== undefined && (
                <div className="text-[10px] text-slate-600 mt-1">
                  {s.data.totalTasks} tasks &middot; {s.data.teamSize} members &middot; {s.data.totalXP} XP earned
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </Modal>
  );
}
