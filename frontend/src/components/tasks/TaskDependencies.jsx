/**
 * TaskDependencies – shows what a task blocks and what it's blocked by.
 * Renders inline within a task detail view. Allows adding/removing deps.
 */
import { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, X, ChevronRight, AlertCircle } from 'lucide-react';
import { API } from '../../utils/api';

const STATUS_COLORS = {
    done: 'text-green-400',
    in_progress: 'text-blue-400',
    blocked: 'text-red-400',
    in_review: 'text-yellow-400',
    todo: 'text-slate-400',
};

const PRIORITY_BADGE = {
    P0: 'bg-red-900/60 text-red-300',
    P1: 'bg-orange-900/60 text-orange-300',
    P2: 'bg-blue-900/40 text-blue-300',
    P3: 'bg-slate-700 text-slate-400',
};

export default function TaskDependencies({ teamId, task, allTasks = [], isAdmin }) {
    const [deps, setDeps] = useState({ blockedBy: [], blocking: [] });
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState('');
    const [error, setError] = useState('');

    const loadDeps = useCallback(async () => {
        if (!task?.id || !teamId) return;
        try {
            setLoading(true);
            const data = await API.getTaskDependencies(teamId, task.id);
            setDeps(data);
        } catch {
            // silently fail — feature degrades gracefully
        } finally {
            setLoading(false);
        }
    }, [task?.id, teamId]);

    useEffect(() => { loadDeps(); }, [loadDeps]);

    const addDependency = async () => {
        if (!selectedTaskId) return;
        setError('');
        try {
            await API.addTaskDependency(teamId, task.id, Number(selectedTaskId));
            setSelectedTaskId('');
            setAdding(false);
            loadDeps();
        } catch (e) {
            setError(e.message || 'Could not add dependency');
        }
    };

    const removeDependency = async (depId) => {
        try {
            await API.removeTaskDependency(teamId, task.id, depId);
            loadDeps();
        } catch (e) {
            setError(e.message || 'Could not remove dependency');
        }
    };

    // Tasks user can link to (exclude self and already-linked)
    const linkedIds = new Set([
        task.id,
        ...deps.blockedBy.map(d => d.id),
        ...deps.blocking.map(d => d.id),
    ]);
    const linkableOptions = allTasks.filter(t => !linkedIds.has(t.id) && !t.completed);

    if (loading) return null;
    if (deps.blockedBy.length === 0 && deps.blocking.length === 0 && !adding) {
        return (
            <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-slate-600">
                        <GitBranch className="w-3 h-3" />
                        <span className="text-[10px] pixel-font">DEPENDENCIES</span>
                    </div>
                    <button onClick={() => setAdding(true)}
                        className="text-[9px] px-2 py-0.5 rounded bg-slate-800 text-slate-500 hover:text-slate-300 pixel-font flex items-center gap-1">
                        <Plus className="w-2.5 h-2.5" /> LINK
                    </button>
                </div>
                {adding && <AddDepRow options={linkableOptions} value={selectedTaskId} onChange={setSelectedTaskId}
                    onAdd={addDependency} onCancel={() => { setAdding(false); setError(''); }} error={error} />}
            </div>
        );
    }

    return (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <GitBranch className="w-3 h-3 text-violet-400" />
                    <span className="text-[10px] pixel-font text-violet-400">DEPENDENCIES</span>
                </div>
                <button onClick={() => setAdding(v => !v)}
                    className="text-[9px] px-2 py-0.5 rounded bg-slate-800 text-slate-500 hover:text-slate-300 pixel-font flex items-center gap-1">
                    <Plus className="w-2.5 h-2.5" /> LINK
                </button>
            </div>

            {adding && <AddDepRow options={linkableOptions} value={selectedTaskId} onChange={setSelectedTaskId}
                onAdd={addDependency} onCancel={() => { setAdding(false); setError(''); }} error={error} />}

            {deps.blockedBy.length > 0 && (
                <div>
                    <div className="text-[9px] text-slate-600 mb-1 uppercase tracking-wider">Blocked by</div>
                    {deps.blockedBy.map(dep => (
                        <DepRow key={dep.depId} dep={dep} onRemove={() => removeDependency(dep.depId)} canRemove />
                    ))}
                </div>
            )}

            {deps.blocking.length > 0 && (
                <div>
                    <div className="text-[9px] text-slate-600 mb-1 uppercase tracking-wider">Blocking</div>
                    {deps.blocking.map(dep => (
                        <DepRow key={dep.depId} dep={dep} onRemove={() => removeDependency(dep.depId)} canRemove />
                    ))}
                </div>
            )}
        </div>
    );
}

function DepRow({ dep, onRemove, canRemove }) {
    return (
        <div className="flex items-center justify-between py-1 px-2 rounded bg-slate-900/60 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
                <ChevronRight className="w-2.5 h-2.5 text-slate-600 flex-shrink-0" />
                <span className={`text-[10px] truncate ${dep.status === 'done' ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                    {dep.title}
                </span>
                <span className={`text-[8px] px-1 rounded flex-shrink-0 ${PRIORITY_BADGE[dep.priority] || PRIORITY_BADGE.P2}`}>
                    {dep.priority}
                </span>
                <span className={`text-[8px] flex-shrink-0 ${STATUS_COLORS[dep.status] || STATUS_COLORS.todo}`}>
                    {dep.status}
                </span>
            </div>
            {canRemove && (
                <button onClick={onRemove} className="text-slate-700 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

function AddDepRow({ options, value, onChange, onAdd, onCancel, error }) {
    return (
        <div className="space-y-1">
            <div className="flex gap-2">
                <select value={value} onChange={e => onChange(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white focus:border-violet-500 focus:outline-none">
                    <option value="">— select a task to link —</option>
                    {options.map(t => (
                        <option key={t.id} value={t.id}>[{t.priority}] {t.title}</option>
                    ))}
                </select>
                <button onClick={onAdd} disabled={!value}
                    className="text-[10px] px-3 py-1 rounded bg-violet-600 text-white pixel-font disabled:opacity-40">
                    ADD
                </button>
                <button onClick={onCancel}
                    className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 pixel-font">
                    ✕
                </button>
            </div>
            {error && (
                <div className="flex items-center gap-1 text-[10px] text-red-400">
                    <AlertCircle className="w-3 h-3" /> {error}
                </div>
            )}
        </div>
    );
}
