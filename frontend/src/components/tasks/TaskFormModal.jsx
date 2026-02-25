import { useState } from 'react';
import { useTeam } from '../../contexts/TeamContext';
import { API } from '../../utils/api';
import Modal from '../common/Modal';

export default function TaskFormModal({ isOpen, onClose, editTask = null }) {
  const { currentTeam, teamMembers, refreshTasks, loadData } = useTeam();

  const [title, setTitle] = useState(editTask?.title || '');
  const [priority, setPriority] = useState(editTask?.priority || 'P2');
  const [category, setCategory] = useState(editTask?.category || '');
  const [assignedTo, setAssignedTo] = useState(editTask?.assignedTo || '');
  const [dueDate, setDueDate] = useState(editTask?.dueDate ? editTask.dueDate.slice(0, 10) : '');
  const [timeEstimate, setTimeEstimate] = useState(editTask?.timeEstimate || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const taskData = {
        title: title.trim(),
        priority,
        category: category.trim() || undefined,
        assignedTo: assignedTo ? Number(assignedTo) : undefined,
        dueDate: dueDate || undefined,
        timeEstimate: timeEstimate.trim() || undefined,
      };
      if (editTask) {
        await API.updateTask(currentTeam.id, editTask.id, taskData);
      } else {
        await API.createTask(currentTeam.id, taskData);
      }
      loadData();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editTask ? 'EDIT TASK' : 'NEW TASK'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Title *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-red-500 focus:outline-none"
            autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
              <option value="P0">P0 - Critical</option>
              <option value="P1">P1 - High</option>
              <option value="P2">P2 - Medium</option>
              <option value="P3">P3 - Low</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Category</label>
            <input type="text" value={category} onChange={e => setCategory(e.target.value)}
              placeholder="e.g., Frontend, Backend"
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Assign To</label>
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
              <option value="">Unassigned</option>
              {teamMembers.map(m => (
                <option key={m.userId} value={m.userId}>{m.displayName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Time Estimate</label>
          <input type="text" value={timeEstimate} onChange={e => setTimeEstimate(e.target.value)}
            placeholder="e.g., 2h, 1d, 30m"
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
        </div>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="text-xs px-4 py-2 rounded bg-slate-700 text-slate-300 pixel-font">CANCEL</button>
          <button type="submit" disabled={saving || !title.trim()}
            className="text-xs px-4 py-2 rounded bg-blue-600 text-white pixel-font disabled:opacity-50">
            {saving ? 'SAVING...' : editTask ? 'UPDATE' : 'CREATE'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
