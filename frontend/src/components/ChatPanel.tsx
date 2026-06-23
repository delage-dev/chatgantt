import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useGanttStore } from '../store/ganttStore';
import { useResourceStore } from '../store/resourceStore';
import { useBlockerStore } from '../store/blockerStore';
import { sendChatMessage, fetchBlockers, type ChatMessage, type ChatTaskSummary, type ChatResourceSummary, type ChatBlockerSummary, type ToolCallExecution } from '../utils/api';

interface ChatMessageWithTools extends ChatMessage {
  tool_executions?: ToolCallExecution[];
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageWithTools[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const buildProjectContext = useCallback(() => {
    const tasks = useGanttStore.getState().tasks;
    const taskSummaries: ChatTaskSummary[] = tasks.map((t) => ({
      id: t.id,
      summary: t.summary,
      type: t.ticket_type,
      status: t.status,
      assignee: t.assignee?.display_name || null,
      parent_id: t.parent_id,
      start_date: t.start_date,
      end_date: t.end_date,
      provider_meta: t.provider_meta,
    }));

    // Include fetched project resources in chat context
    const projectResources = useResourceStore.getState().projectResources;
    const resources: ChatResourceSummary[] = projectResources.map((r) => ({
      title: r.title,
      source_url: r.source_url,
      content: r.content.slice(0, 4000),
    }));

    // Include current blockers
    const blockers: ChatBlockerSummary[] = useBlockerStore.getState().blockers.map((b) => ({
      id: b.id,
      blocked_task_id: b.blocked_task_id,
      blocking_task_id: b.blocking_task_id,
      external_blocker: b.external_blocker,
      reason: b.reason,
      severity: b.severity,
      status: b.status,
    }));

    return {
      project_key: 'DEMO',
      tasks: taskSummaries,
      ...(resources.length > 0 ? { resources } : {}),
      ...(blockers.length > 0 ? { blockers } : {}),
    };
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setError(null);
    const userMessage: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        messages: newMessages,
        project_context: buildProjectContext(),
      });
      const assistantMessage: ChatMessageWithTools = {
        ...response.message,
        tool_executions: response.tool_executions,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // If any blocker-mutating tools ran, refresh the store immediately
      const mutatedBlockers = response.tool_executions.some((e) =>
        ['create_blocker', 'resolve_blocker', 'delete_blocker'].includes(e.name) && e.succeeded
      );
      if (mutatedBlockers) {
        try {
          const fresh = await fetchBlockers();
          useBlockerStore.getState().setBlockers(fresh);
        } catch {
          // ignore — next poll will catch up
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get response';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, buildProjectContext]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 bg-[#2C2824] text-[#EDE5D4] flex items-center justify-center border-2 border-[#2C2824] shadow-[4px_4px_0_0_rgba(44,40,36,0.8)] hover:shadow-[6px_6px_0_0_rgba(44,40,36,0.8)] hover:-translate-y-0.5 transition-all"
        title="Open chat assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30 w-[400px] h-[550px] bg-[#F5EFE2] border-2 border-[#2C2824] shadow-[4px_4px_0_0_rgba(44,40,36,0.8)] flex flex-col">
        {/* Header */}
        <div className="h-12 border-b-2 border-[#2C2824] flex items-center justify-between px-4 bg-[#E4DBCA] flex-shrink-0">
          <span className="font-mono text-xs font-bold uppercase tracking-widest">
            Project Assistant
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 flex items-center justify-center hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center p-4">
              <div>
                <MessageCircle className="w-8 h-8 mx-auto mb-3 text-[#8C8278]" />
                <p className="text-sm text-[#8C8278] font-medium">
                  Ask me about your project's tasks, timeline, or assignments.
                </p>
                <p className="text-[10px] text-[#8C8278] mt-2 font-mono uppercase">
                  I have context on all {useGanttStore.getState().tasks.length} tasks
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-[#2C2824] text-[#EDE5D4] border-2 border-[#2C2824]'
                    : 'bg-[#E4DBCA] text-[#2C2824] border border-[#2C2824]/20'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="markdown-prose text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.tool_executions && msg.tool_executions.length > 0 && (
                <div className="mt-1 max-w-[85%] flex flex-col gap-1">
                  {msg.tool_executions.map((e, j) => (
                    <div
                      key={j}
                      className={`flex items-start gap-1.5 text-[10px] font-mono px-2 py-1 border ${
                        e.succeeded ? 'bg-[#7FB5B0]/10 border-[#7FB5B0]/30 text-[#4A8A84]' : 'bg-[#C4453A]/10 border-[#C4453A]/30 text-[#C4453A]'
                      }`}
                    >
                      {e.succeeded ? <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                      <div className="flex-1">
                        <span className="font-bold uppercase">{e.name}</span>
                        <span className="ml-1">{e.result}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#E4DBCA] border border-[#2C2824]/20 px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#8C8278]" />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[#C4453A]/10 border border-[#C4453A]/30 px-3 py-2 text-xs text-[#C4453A]">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t-2 border-[#2C2824] p-3 flex gap-2 bg-[#F5EFE2] flex-shrink-0">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the project..."
            rows={1}
            className="flex-1 px-3 py-2 bg-[#F5EFE2] border border-[#2C2824]/30 font-sans text-sm resize-none outline-none focus:border-[#2C2824] transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="w-9 h-9 flex items-center justify-center bg-[#2C2824] text-[#EDE5D4] border-2 border-[#2C2824] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] transition-shadow disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

    </>
  );
}
