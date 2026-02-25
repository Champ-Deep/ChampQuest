/**
 * SimilarTasksBanner – subtle banner shown on task detail when
 * cross-team collaboration is enabled and similar tasks are found elsewhere.
 */
import { useState, useEffect } from 'react';
import { Lightbulb, X, ChevronDown, ChevronUp } from 'lucide-react';
import { API } from '../../utils/api';

export default function SimilarTasksBanner({ teamId, taskId }) {
    const [data, setData] = useState(null);
    const [dismissed, setDismissed] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        setData(null);
        setDismissed(false);
        setExpanded(false);
        if (!taskId || !teamId) return;

        let cancelled = false;
        API.getSimilarTasks(taskId).then(res => {
            if (!cancelled && res?.enabled && res?.matches?.length > 0) {
                setData(res);
            }
        }).catch(() => { /* silent – collab feature is optional */ });

        return () => { cancelled = true; };
    }, [taskId, teamId]);

    if (!data || dismissed) return null;

    const { matches } = data;

    return (
        <div className="mt-3 rounded-lg border border-violet-800/50 bg-violet-950/30 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between px-3 py-2">
                <button
                    className="flex items-center gap-2 flex-1 text-left"
                    onClick={() => setExpanded(v => !v)}
                >
                    <Lightbulb className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                    <span className="text-[11px] text-violet-300 font-medium">
                        {matches.length === 1
                            ? '1 other team is working on something similar'
                            : `${matches.length} other teams are working on something similar`}
                    </span>
                    <span className="ml-auto text-violet-600">
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </span>
                </button>
                <button onClick={() => setDismissed(true)} className="ml-2 text-violet-700 hover:text-violet-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-violet-900/40 pt-2">
                    <p className="text-[10px] text-violet-500 mb-2">
                        You may want to connect with them to avoid duplicate work or share progress. 💡
                    </p>
                    {matches.map((m, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded bg-violet-950/50 border border-violet-900/30">
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] text-slate-200 truncate">{m.taskTitle}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[9px] text-violet-500">{m.teamLabel}</span>
                                    {m.category && (
                                        <span className="text-[9px] text-slate-600">• {m.category}</span>
                                    )}
                                    <span className="text-[9px] text-slate-600">• {m.similarityScore}% match</span>
                                </div>
                            </div>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded flex-shrink-0 ${m.status === 'done' ? 'bg-green-900/40 text-green-400'
                                    : m.status === 'blocked' ? 'bg-red-900/40 text-red-400'
                                        : m.status === 'in_progress' ? 'bg-blue-900/40 text-blue-400'
                                            : 'bg-slate-800 text-slate-500'
                                }`}>
                                {m.status || 'todo'}
                            </span>
                        </div>
                    ))}
                    <p className="text-[9px] text-slate-700 italic">
                        Team identities are partially masked. Reach out via your org's usual channels.
                    </p>
                </div>
            )}
        </div>
    );
}
