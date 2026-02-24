import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TeamProvider, useTeam } from './contexts/TeamContext';
import AuthScreen from './components/auth/AuthScreen';
import TeamSelectorScreen from './components/auth/TeamSelectorScreen';
import DashboardLayout from './components/layout/DashboardLayout';
import WelcomeOverlay from './components/onboarding/WelcomeOverlay';

const pageTransition = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.25, ease: 'easeOut' },
};

function AppContent() {
  const { user, isLoading } = useAuth();
  const { currentTeam, userTeams } = useTeam();
  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem('champWelcomeSeen')
  );

  if (isLoading) {
    return (
      <motion.div key="loading" {...pageTransition}
        className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="pixel-font text-2xl text-red-500 mb-4">CHAMP QUEST</h1>
          <div className="text-slate-500 text-sm animate-pulse">Loading...</div>
        </div>
      </motion.div>
    );
  }

  // Determine which screen to show
  const screenKey = !user ? 'auth' : !currentTeam ? 'teams' : 'dashboard';

  // Show welcome overlay for new users who just registered (no teams yet)
  const shouldShowWelcome = showWelcome && user && userTeams.length === 0;

  return (
    <>
      <AnimatePresence mode="wait">
        {screenKey === 'auth' && (
          <motion.div key="auth" {...pageTransition}><AuthScreen /></motion.div>
        )}
        {screenKey === 'teams' && (
          <motion.div key="teams" {...pageTransition}><TeamSelectorScreen /></motion.div>
        )}
        {screenKey === 'dashboard' && (
          <motion.div key="dashboard" {...pageTransition}><DashboardLayout /></motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {shouldShowWelcome && <WelcomeOverlay onDismiss={() => setShowWelcome(false)} />}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <TeamProvider>
          <AppContent />
        </TeamProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
