import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useTeam } from '../../contexts/TeamContext';
import { API } from '../../utils/api';
import GlassCard from '../common/GlassCard';

export default function AIChatAssistant() {
  const { currentTeam } = useTeam();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hey! I\'m your team AI assistant. Ask me about tasks, blockers, workload, or anything about your team.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading || !currentTeam) return;

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await API.aiChat(currentTeam.id, newMessages.slice(1)); // skip initial greeting

      if (res.headers?.get('content-type')?.includes('text/event-stream')) {
        // Handle SSE streaming
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  assistantContent += delta;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                    return updated;
                  });
                }
              } catch {}
            }
          }
        }
      } else {
        // Handle regular JSON response
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || data.message || 'Sorry, I couldn\'t process that.';
        setMessages(prev => [...prev, { role: 'assistant', content }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: e.message?.includes('503') || e.message?.includes('API key')
          ? 'AI assistant is not configured yet. Ask your admin to set the THESYS_API_KEY.'
          : `Sorry, something went wrong: ${e.message}`
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <GlassCard className="p-4 flex flex-col" style={{ height: '350px' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-purple-500"><Bot className="w-4 h-4" /></span>
        <h3 className="pixel-font text-[10px] text-purple-500">AI ASSISTANT</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3 h-3 text-purple-400" />
              </div>
            )}
            <div className={`text-xs leading-relaxed max-w-[85%] rounded-lg px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-blue-600/20 text-blue-200'
                : 'bg-slate-800/50 text-slate-300'
            }`}>
              {msg.content || (isLoading && i === messages.length - 1 ? (
                <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
              ) : '')}
            </div>
            {msg.role === 'user' && (
              <div className="w-5 h-5 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3 h-3 text-blue-400" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your team..."
          disabled={isLoading}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="px-3 py-2 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 disabled:opacity-30 transition-colors"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </GlassCard>
  );
}
