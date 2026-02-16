import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTeam } from '../../contexts/TeamContext';
import { API } from '../../utils/api';
import Modal from '../common/Modal';

export default function SettingsModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { activeTheme, changeTheme, themes } = useTheme();
  const { currentTeam, teamMembers } = useTeam();

  const memberData = teamMembers.find(m => m.userId === user?.id);
  const isAdmin = memberData?.role === 'admin' || user?.globalRole === 'superadmin';

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState({ taskCompleted: true, levelUp: true, kudosGiven: false, taskCreated: false });
  const [webhookStatus, setWebhookStatus] = useState('');

  // Reminder state
  const [dailyDigest, setDailyDigest] = useState(false);
  const [priorityAlerts, setPriorityAlerts] = useState(false);
  const [staleThreshold, setStaleThreshold] = useState(3);
  const [reminderStatus, setReminderStatus] = useState('');

  // Telegram state
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramStatus, setTelegramStatus] = useState('');

  // Challenge state
  const [challenges, setChallenges] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('task');
  const [newXp, setNewXp] = useState(20);

  useEffect(() => {
    if (isOpen && currentTeam && isAdmin) {
      loadSettings();
      loadChallenges();
    }
  }, [isOpen, currentTeam, isAdmin]);

  const loadSettings = async () => {
    try {
      const settings = await API.getTeamSettings(currentTeam.id);
      if (settings.webhook) {
        setWebhookUrl(settings.webhook.url || '');
        setWebhookEnabled(settings.webhook.enabled || false);
        setWebhookEvents(settings.webhook.events || webhookEvents);
      }
      if (settings.reminders) {
        setDailyDigest(settings.reminders.dailyDigest || false);
        setPriorityAlerts(settings.reminders.priorityAlerts || false);
        setStaleThreshold(settings.reminders.staleThresholdDays || 3);
      }
      if (settings.telegram) {
        setTelegramChatId(settings.telegram.chatId || '');
      }
    } catch (e) { /* ignore */ }
  };

  const loadChallenges = async () => {
    try {
      const data = await API.getAllChallenges(currentTeam.id);
      setChallenges(data);
    } catch (e) { /* ignore */ }
  };

  const saveWebhook = async () => {
    try {
      await API.updateTeamSettings(currentTeam.id, {
        webhook: { url: webhookUrl, enabled: webhookEnabled, events: webhookEvents }
      });
      setWebhookStatus('Saved!');
      setTimeout(() => setWebhookStatus(''), 2000);
    } catch (e) {
      setWebhookStatus('Error: ' + e.message);
    }
  };

  const testWebhook = async () => {
    try {
      await API.testWebhook(currentTeam.id);
      setWebhookStatus('Test sent!');
      setTimeout(() => setWebhookStatus(''), 2000);
    } catch (e) {
      setWebhookStatus('Error: ' + e.message);
    }
  };

  const saveReminders = async () => {
    try {
      await API.updateTeamSettings(currentTeam.id, {
        reminders: { dailyDigest, priorityAlerts, staleThresholdDays: staleThreshold }
      });
      setReminderStatus('Saved!');
      setTimeout(() => setReminderStatus(''), 2000);
    } catch (e) {
      setReminderStatus('Error: ' + e.message);
    }
  };

  const saveTelegram = async () => {
    try {
      await API.updateTeamSettings(currentTeam.id, {
        telegram: { chatId: telegramChatId }
      });
      setTelegramStatus('Saved!');
      setTimeout(() => setTelegramStatus(''), 2000);
    } catch (e) {
      setTelegramStatus('Error: ' + e.message);
    }
  };

  const createChallenge = async () => {
    if (!newTitle.trim()) return;
    try {
      await API.createChallenge(currentTeam.id, {
        title: newTitle, description: newDesc, type: newType, xpReward: newXp
      });
      setNewTitle(''); setNewDesc(''); setNewType('task'); setNewXp(20);
      loadChallenges();
    } catch (e) { console.error(e); }
  };

  const toggleChallenge = async (id, active) => {
    try {
      await API.updateChallenge(currentTeam.id, id, { active: !active });
      loadChallenges();
    } catch (e) { console.error(e); }
  };

  const deleteChallenge = async (id) => {
    if (!confirm('Delete this challenge?')) return;
    try {
      await API.deleteChallenge(currentTeam.id, id);
      loadChallenges();
    } catch (e) { console.error(e); }
  };

  const toggleEvent = (key) => {
    setWebhookEvents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SETTINGS">
      <div className="space-y-6">
        {/* Profile */}
        <div>
          <h3 className="pixel-font text-[10px] text-slate-500 mb-3">PROFILE</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Display Name</label>
              <div className="text-sm text-white">{user?.displayName || '-'}</div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Theme</label>
              <select value={activeTheme.id} onChange={(e) => changeTheme(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
                {Object.values(themes).map(t => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Admin sections */}
        {isAdmin && (
          <>
            {/* Webhooks */}
            <div>
              <h3 className="pixel-font text-[10px] text-slate-500 mb-3">WEBHOOKS (ADMIN)</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Webhook URL (Slack/Discord)</label>
                  <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={webhookEnabled} onChange={e => setWebhookEnabled(e.target.checked)} />
                  Enabled
                </label>
                <div className="text-xs text-slate-500 mb-1">Events</div>
                {[
                  ['taskCompleted', 'Task Completed'],
                  ['levelUp', 'Level Up'],
                  ['kudosGiven', 'Kudos Given'],
                  ['taskCreated', 'Task Created'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-slate-400">
                    <input type="checkbox" checked={webhookEvents[key] || false} onChange={() => toggleEvent(key)} />
                    {label}
                  </label>
                ))}
                <div className="flex gap-2">
                  <button onClick={saveWebhook} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white pixel-font">SAVE</button>
                  <button onClick={testWebhook} className="text-xs px-3 py-1.5 rounded bg-slate-700 text-white pixel-font">TEST WEBHOOK</button>
                </div>
                {webhookStatus && <div className="text-xs text-green-400">{webhookStatus}</div>}
              </div>
            </div>

            {/* Reminders */}
            <div>
              <h3 className="pixel-font text-[10px] text-slate-500 mb-3">REMINDERS (ADMIN)</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={dailyDigest} onChange={e => setDailyDigest(e.target.checked)} />
                  Daily Digest (9 AM UTC)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={priorityAlerts} onChange={e => setPriorityAlerts(e.target.checked)} />
                  P0/P1 Priority Alerts
                </label>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Stale Task Threshold (days)</label>
                  <input type="number" value={staleThreshold} onChange={e => setStaleThreshold(Number(e.target.value))}
                    min={1} max={30}
                    className="w-20 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
                </div>
                <button onClick={saveReminders} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white pixel-font">SAVE REMINDERS</button>
                {reminderStatus && <div className="text-xs text-green-400">{reminderStatus}</div>}
              </div>
            </div>

            {/* Telegram */}
            <div>
              <h3 className="pixel-font text-[10px] text-slate-500 mb-3">TELEGRAM (ADMIN)</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Telegram Chat ID</label>
                  <input type="text" value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)}
                    placeholder="-1001234567890"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
                  <div className="text-[10px] text-slate-600 mt-1">Add the bot to a group, then use /chatid to get the ID</div>
                </div>
                <button onClick={saveTelegram} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white pixel-font">SAVE</button>
                {telegramStatus && <div className="text-xs text-green-400">{telegramStatus}</div>}
              </div>
            </div>

            {/* Challenges */}
            <div>
              <h3 className="pixel-font text-[10px] text-slate-500 mb-3">DAILY CHALLENGES (ADMIN)</h3>
              <div className="space-y-3">
                <div className="max-h-[200px] overflow-y-auto space-y-2">
                  {challenges.length === 0 && <div className="text-xs text-slate-600 italic">No custom challenges yet</div>}
                  {challenges.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-slate-900 rounded text-xs">
                      <div>
                        <span className={c.active ? 'text-white' : 'text-slate-600'}>{c.title}</span>
                        <span className="text-slate-600 ml-2">+{c.xpReward}XP</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => toggleChallenge(c.id, c.active)}
                          className={`text-[9px] px-2 py-0.5 rounded ${c.active ? 'bg-amber-600/20 text-amber-400' : 'bg-green-600/20 text-green-400'}`}>
                          {c.active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => deleteChallenge(c.id)}
                          className="text-[9px] px-2 py-0.5 rounded bg-red-600/10 text-red-400">Del</button>
                      </div>
                    </div>
                  ))}
                </div>
                <h4 className="pixel-font text-[9px] text-slate-600 mt-3">ADD NEW CHALLENGE</h4>
                <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="Challenge title"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
                <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
                <div className="flex gap-2">
                  <select value={newType} onChange={e => setNewType(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
                    <option value="task">Task</option>
                    <option value="social">Social</option>
                    <option value="streak">Streak</option>
                  </select>
                  <input type="number" value={newXp} onChange={e => setNewXp(Number(e.target.value))}
                    min={5} max={100}
                    className="w-20 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
                  <button onClick={createChallenge} className="text-xs px-3 py-1.5 rounded bg-green-600 text-white pixel-font">ADD</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
