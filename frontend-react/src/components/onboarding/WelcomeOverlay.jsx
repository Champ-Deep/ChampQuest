import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, Users, Zap } from 'lucide-react';

const STEPS = [
  {
    icon: Swords,
    title: 'WELCOME TO CHAMP QUEST',
    description: 'Your team\'s gamified task tracker. Complete missions, earn XP, level up your rank, and compete on the leaderboard.',
    color: '#ef4444',
  },
  {
    icon: Users,
    title: 'JOIN OR CREATE A TEAM',
    description: 'Create a new team and share the invite code, or join an existing team with a code from your lead.',
    color: '#3b82f6',
  },
  {
    icon: Zap,
    title: 'BRAIN DUMP & GO',
    description: 'Paste your notes, meeting minutes, or ideas into the scanner. AI extracts tasks and assigns them to the right people.',
    color: '#10b981',
  },
];

export default function WelcomeOverlay({ onDismiss }) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('champWelcomeSeen', 'true');
      onDismiss();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('champWelcomeSeen', 'true');
    onDismiss();
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="glass-card p-8 max-w-md w-full text-center"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
              style={{ background: `${current.color}20` }}>
              <Icon className="w-8 h-8" style={{ color: current.color }} />
            </div>
            <h2 className="pixel-font text-lg text-white mb-3">{current.title}</h2>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">{current.description}</p>
          </motion.div>
        </AnimatePresence>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
              i === step ? 'bg-red-500' : i < step ? 'bg-red-500/50' : 'bg-slate-700'
            }`} />
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={handleSkip}
            className="flex-1 py-2 rounded-lg text-xs text-slate-500 hover:text-white transition-colors">
            Skip
          </button>
          <button onClick={handleNext}
            className="flex-1 py-2.5 rounded-lg pixel-font text-sm text-white bg-red-600 hover:bg-red-500 transition-colors">
            {step < STEPS.length - 1 ? 'NEXT' : 'GET STARTED'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
