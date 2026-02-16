import { useState } from 'react';
import { useTeam } from '../../contexts/TeamContext';
import { useAuth } from '../../contexts/AuthContext';
import { API } from '../../utils/api';
import Modal from '../common/Modal';

const KUDOS_EMOJIS = ['🌟', '🔥', '💪', '🎯', '🚀', '👏', '💡', '❤️'];

export default function KudosModal({ isOpen, onClose }) {
  const { currentTeam, teamMembers, loadData } = useTeam();
  const { user } = useAuth();
  const [toUserId, setToUserId] = useState('');
  const [message, setMessage] = useState('');
  const [emoji, setEmoji] = useState('🌟');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const otherMembers = teamMembers.filter(m => m.userId !== user?.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!toUserId || !message.trim()) return;
    setSending(true);
    setError('');
    try {
      await API.sendKudos(currentTeam.id, Number(toUserId), message.trim(), emoji);
      loadData();
      setToUserId('');
      setMessage('');
      setEmoji('🌟');
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="GIVE KUDOS">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">To *</label>
          <select value={toUserId} onChange={e => setToUserId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
            <option value="">Select teammate...</option>
            {otherMembers.map(m => (
              <option key={m.userId} value={m.userId}>{m.displayName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-2 block">Emoji</label>
          <div className="flex gap-2 flex-wrap">
            {KUDOS_EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => setEmoji(e)}
                className={`text-xl p-1.5 rounded transition-all ${emoji === e ? 'bg-pink-500/20 scale-110 ring-1 ring-pink-500' : 'hover:bg-slate-800'}`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Message *</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            rows={2} placeholder="Great work on..."
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white resize-none focus:border-pink-500 focus:outline-none" />
        </div>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="text-xs px-4 py-2 rounded bg-slate-700 text-slate-300 pixel-font">CANCEL</button>
          <button type="submit" disabled={sending || !toUserId || !message.trim()}
            className="text-xs px-4 py-2 rounded bg-pink-600 text-white pixel-font disabled:opacity-50">
            {sending ? 'SENDING...' : `${emoji} SEND KUDOS`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
