import { useState, useRef, useEffect } from 'react';
import { Settings, ShieldCheck, Grid, LayoutGrid, User, Trophy, Activity, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTeam } from '../../contexts/TeamContext';
import { ChampAnimations } from '../../utils/animations';
import SettingsModal from '../settings/SettingsModal';
import KudosModal from '../social/KudosModal';

export default function LeftPanel() {
  const { user } = useAuth();
  const { activeTheme, getRank, getSpriteData, getTerminology } = useTheme();
  const { currentTeam, teamMembers, stats, activity, kudos, leaveTeam, loadData } = useTeam();
  const [taskFilter, setTaskFilter] = useState('all');
  const [showSettings, setShowSettings] = useState(false);
  const [showKudos, setShowKudos] = useState(false);
  const xpBarRef = useRef(null);

  const memberData = currentTeam ? teamMembers.find(m => m.userId === user?.id) : null;
  const xp = memberData?.xp || 0;
  const rank = getRank(xp);
  const sprite = getSpriteData(rank);

  // Calculate XP bar width
  const ranks = activeTheme.ranks;
  const currentRankIdx = ranks.findIndex(r => r.name === rank.name);
  const nextRank = ranks[currentRankIdx + 1];
  const xpInLevel = nextRank ? xp - rank.xp : xp;
  const xpForLevel = nextRank ? nextRank.xp - rank.xp : 1;
  const xpBarWidth = nextRank ? `${Math.min((xpInLevel / xpForLevel) * 100, 100)}%` : '100%';

  useEffect(() => {
    if (xpBarRef.current) {
      ChampAnimations.animateXPBar(xpBarRef.current, xpBarWidth);
    }
  }, [xpBarWidth]);

  const isAdmin = memberData?.role === 'admin' || user?.globalRole === 'superadmin';

  // Level from config (simplified)
  const level = rank.level || 1;

  // Top 5 leaderboard
  const leaderboard = [...teamMembers]
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
    .slice(0, 5);

  // Recent activity (5 items)
  const recentActivity = (activity || []).slice(0, 5);

  return (
    <aside className="left-panel p-5 flex flex-col">
      {/* User Profile */}
      <div className="mb-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border-2 flex items-center justify-center"
            style={{ borderColor: activeTheme.vars['--neon-primary'] }}>
            {sprite.isEmoji ? (
              <span className={`companion-emoji text-2xl companion-${activeTheme.id}`}>{sprite.emoji}</span>
            ) : (
              <img src={sprite.url} alt="Avatar" className="pokemon-sprite animate-float"
                onError={(e) => { if (sprite.fallback) { e.target.src = sprite.fallback; } else { e.target.style.display = 'none'; } }} />
            )}
          </div>
          <div>
            <h2 className="font-bold text-white truncate w-32">{user?.displayName || 'Loading...'}</h2>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-white px-1.5 rounded pixel-font"
                style={{ background: activeTheme.vars['--neon-primary'] }}>LV. {level}</span>
              <span className="text-[10px] text-slate-400 truncate">{rank.name}</span>
            </div>
          </div>
        </div>
        <div className="xp-bar-bg mb-1">
          <div ref={xpBarRef} className="xp-bar-fill" style={{ width: '5%' }} />
        </div>
        <div className="flex justify-between text-[10px] pixel-font text-slate-500">
          <span>{xp} {getTerminology('xp')}</span>
          <span>{nextRank?.xp || xp} {getTerminology('xp')}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-2">
        <div className="pixel-font text-[10px] text-slate-600 mb-2 mt-2">NAVIGATE</div>
        <button onClick={() => setTaskFilter('all')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-slate-800 group ${taskFilter === 'all' ? 'text-white bg-slate-800' : 'text-slate-400'}`}>
          <LayoutGrid className="w-4 h-4 group-hover:text-red-500" />
          <span>{getTerminology('missions') === 'Missions' ? 'Team Board' : getTerminology('missions')}</span>
        </button>
        <button onClick={() => setTaskFilter('mine')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-slate-800 group ${taskFilter === 'mine' ? 'text-white bg-slate-800' : 'text-slate-400'}`}>
          <User className="w-4 h-4 group-hover:text-red-500" />
          <span>My Assignments</span>
        </button>
      </nav>

      {/* Leaderboard */}
      <section className="glass-card p-3 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <h3 className="pixel-font text-[10px] text-amber-500">LEADERBOARD TOP 5</h3>
        </div>
        <div className="space-y-2 max-h-[160px] overflow-y-auto">
          {leaderboard.map((m, i) => (
            <motion.div key={m.userId || i} className="flex items-center gap-2 text-xs"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <span className={`w-4 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-slate-600'}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
              </span>
              <span className="text-white truncate flex-1">{m.displayName}</span>
              <span className="text-slate-500 pixel-font text-[9px]">{m.xp || 0}</span>
            </motion.div>
          ))}
          {leaderboard.length === 0 && <div className="text-slate-600 text-xs text-center py-2">No data yet</div>}
        </div>
      </section>

      {/* Team Pulse (Activity) */}
      <section className="glass-card p-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3.5 h-3.5 text-cyan-500" />
          <h3 className="pixel-font text-[10px] text-cyan-500">{getTerminology('teamPulse')}</h3>
        </div>
        <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
          {recentActivity.map((a, i) => (
            <div key={i} className="text-[10px] text-slate-500 truncate">
              <span className="text-slate-300">{a.userName}</span> {a.action?.replace(/_/g, ' ')}
            </div>
          ))}
          {recentActivity.length === 0 && <div className="text-slate-600 text-xs text-center py-2">No activity yet</div>}
        </div>
      </section>

      {/* Team Kudos */}
      <div className="mt-3 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500" />
            <h3 className="pixel-font text-[10px] text-pink-500">TEAM KUDOS</h3>
          </div>
          <button onClick={() => setShowKudos(true)}
            className="text-[9px] px-2 py-1 rounded bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 pixel-font transition-colors">
            + GIVE
          </button>
        </div>
        <div className="space-y-2 overflow-y-auto max-h-[120px] pr-1">
          {kudos.length > 0 ? kudos.slice(0, 5).map((k, i) => (
            <div key={i} className="text-[10px] text-slate-500">
              <span className="text-pink-400">{k.fromName}</span> {k.emoji} {k.message}
            </div>
          )) : (
            <div className="text-center text-slate-600 text-xs py-3">No kudos yet. Be the first!</div>
          )}
        </div>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <KudosModal isOpen={showKudos} onClose={() => setShowKudos(false)} />

      {/* Bottom Actions */}
      <div className="mt-auto space-y-2 border-t border-slate-800 pt-4">
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)}
            className="flex-1 glass-btn py-2 rounded text-xs text-slate-400 flex items-center justify-center gap-2 hover:text-white transition-colors">
            <Settings className="w-3 h-3" /> Settings
          </button>
          {isAdmin && (
            <button className="flex-1 glass-btn py-2 rounded text-xs text-slate-400 flex items-center justify-center gap-2 hover:text-white transition-colors">
              <ShieldCheck className="w-3 h-3" /> Admin
            </button>
          )}
          <button onClick={leaveTeam}
            className="flex-1 glass-btn py-2 rounded text-xs text-slate-400 flex items-center justify-center gap-2 hover:text-white transition-colors">
            <Grid className="w-3 h-3" /> Teams
          </button>
        </div>
      </div>
    </aside>
  );
}
