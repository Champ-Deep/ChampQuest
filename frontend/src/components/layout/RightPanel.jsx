import { useState, useEffect, useRef } from 'react';
import { Zap, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTeam } from '../../contexts/TeamContext';
import { useAuth } from '../../contexts/AuthContext';
import { API } from '../../utils/api';
import { ChampAnimations } from '../../utils/animations';
import GlassCard from '../common/GlassCard';
import AIChatAssistant from '../ai/AIChatAssistant';

export default function RightPanel() {
  const { activeTheme, getRank, getSpriteData, getQuote, getTerminology } = useTheme();
  const { user } = useAuth();
  const { currentTeam, teamMembers, tasks } = useTeam();
  const companionRef = useRef(null);

  const memberData = currentTeam ? teamMembers.find(m => m.userId === user?.id) : null;
  const xp = memberData?.xp || 0;
  const rank = getRank(xp);
  const sprite = getSpriteData(rank);
  const level = rank.level || 1;
  const quote = getQuote(level);

  // Evolution progress
  const ranks = activeTheme.ranks;
  const currentRankIdx = ranks.findIndex(r => r.name === rank.name);
  const nextRank = ranks[currentRankIdx + 1];
  const progressPct = nextRank
    ? Math.min(((xp - rank.xp) / (nextRank.xp - rank.xp)) * 100, 100)
    : 100;

  useEffect(() => {
    if (companionRef.current) {
      ChampAnimations.animateCompanionEntrance(companionRef.current);
    }
  }, [rank.name]);

  return (
    <aside className="right-panel p-5 space-y-6">
      {/* Companion Status */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-amber-500" />
          <h3 className="pixel-font text-[10px] text-amber-500">{getTerminology('companion')} STATUS</h3>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <motion.div ref={companionRef} whileHover={{ scale: 1.05, rotate: 2 }} transition={{ type: 'spring', stiffness: 300 }}
            className="w-20 h-20 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800 relative overflow-hidden">
            {sprite.isEmoji ? (
              <span className={`companion-emoji text-5xl companion-${activeTheme.id}`}>{sprite.emoji}</span>
            ) : (
              <img src={sprite.url} alt={rank.spriteName}
                className={`pokemon-sprite relative z-10 animate-float companion-${activeTheme.id}`}
                style={{ width: 68, height: 68 }}
                onError={(e) => { if (sprite.fallback) e.target.src = sprite.fallback; else e.target.style.display = 'none'; }} />
            )}
          </motion.div>
          <div>
            <div className="font-bold text-white text-lg">{rank.spriteName}</div>
            <div className="evolution-stage pixel-font">STG {currentRankIdx + 1} Evolution</div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] pixel-font text-slate-500">
            <span>EVOLUTION PROGRESS</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="xp-bar-bg h-2">
            <div className="xp-bar-fill shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[10px] text-slate-500 mt-2 italic">{quote}</p>
        </div>
      </GlassCard>

      {/* Daily Challenges */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-red-500" />
            <h3 className="pixel-font text-[10px] text-red-500">{getTerminology('challenges')}</h3>
          </div>
        </div>
        <div className="space-y-4">
          <DailyChallengesList />
        </div>
      </GlassCard>

      {/* AI Chat Assistant */}
      <AIChatAssistant />
    </aside>
  );
}

function DailyChallengesList() {
  const { currentTeam } = useTeam();
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    if (!currentTeam) return;
    API.getChallenges(currentTeam.id)
      .then(setChallenges)
      .catch(() => {
        // Fallback to hardcoded challenges
        setChallenges([
          { id: 'hc1', title: 'Complete 3 tasks', type: 'task', xpReward: 15, completedToday: false },
          { id: 'hc2', title: 'Give kudos to a teammate', type: 'social', xpReward: 10, completedToday: false },
          { id: 'hc3', title: 'Keep your streak going', type: 'streak', xpReward: 20, completedToday: false },
        ]);
      });
  }, [currentTeam]);

  const handleComplete = async (id) => {
    try {
      await API.completeChallenge(currentTeam.id, id);
      setChallenges(prev => prev.map(c => c.id === id ? { ...c, completedToday: true } : c));
    } catch (e) {
      console.error('Failed to complete challenge:', e);
    }
  };

  return challenges.map(c => (
    <motion.div key={c.id} whileHover={{ x: 2 }} transition={{ duration: 0.15 }}
      className={`flex items-center justify-between p-2 rounded ${c.completedToday ? 'opacity-50' : ''}`}>
      <div>
        <div className="text-xs text-white">{c.title}</div>
        <div className="text-[9px] text-slate-500">+{c.xpReward} XP &middot; {c.type}</div>
      </div>
      {!c.completedToday && typeof c.id === 'number' && (
        <button onClick={() => handleComplete(c.id)}
          className="text-[9px] px-2 py-1 rounded bg-green-600/20 text-green-400 pixel-font hover:bg-green-600/30 transition-colors">
          DONE
        </button>
      )}
      {c.completedToday && <span className="text-[9px] text-green-500 pixel-font">✓</span>}
    </motion.div>
  ));
}
