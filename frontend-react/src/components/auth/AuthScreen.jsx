import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function AuthScreen() {
  const { login, register, forgotPassword } = useAuth();
  const { activeTheme } = useTheme();
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(email, password, displayName);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setMessage('If that email exists, a reset link has been sent.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="glass-card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="pixel-font text-2xl mb-2" style={{ color: activeTheme.vars['--neon-primary'] }}>
            {activeTheme.emoji} CHAMP QUEST {activeTheme.emoji}
          </h1>
          <p className="text-slate-400 text-sm">Gamified Team Task Tracker</p>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-red-500 focus:outline-none" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-red-500 focus:outline-none" />
            {error && <div className="text-red-500 text-xs">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg pixel-font text-sm text-white" style={{ background: activeTheme.vars['--neon-primary'] }}>
              {loading ? 'LOGGING IN...' : 'LOGIN'}
            </button>
            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => { setMode('register'); setError(''); }} className="text-slate-400 hover:text-white">
                Create Account
              </button>
              <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="text-slate-400 hover:text-white">
                Forgot Password?
              </button>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Display Name" required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-red-500 focus:outline-none" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-red-500 focus:outline-none" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)" required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-red-500 focus:outline-none" />
            {error && <div className="text-red-500 text-xs">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg pixel-font text-sm text-white" style={{ background: activeTheme.vars['--neon-primary'] }}>
              {loading ? 'CREATING...' : 'CREATE ACCOUNT'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-slate-400 hover:text-white text-xs">
              Back to Login
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-red-500 focus:outline-none" />
            {error && <div className="text-red-500 text-xs">{error}</div>}
            {message && <div className="text-green-500 text-xs">{message}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg pixel-font text-sm text-white" style={{ background: activeTheme.vars['--neon-primary'] }}>
              {loading ? 'SENDING...' : 'SEND RESET LINK'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="text-slate-400 hover:text-white text-xs">
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
