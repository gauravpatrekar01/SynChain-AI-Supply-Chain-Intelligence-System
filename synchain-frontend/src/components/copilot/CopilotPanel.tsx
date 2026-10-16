import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquare, Send, Trash2, X } from 'lucide-react';
import { apiService } from '../../services/api';
import type { CopilotHistoryMessage, CopilotResponse } from '../../types/ai';
import { aiRequestError, retryDelaySeconds } from '../../utils/aiError';

interface ChatMessage extends CopilotHistoryMessage {
  id: string;
  status?: CopilotResponse['status'];
  provider?: string;
  fallbackReason?: string | null;
}

const SUGGESTED_PROMPTS = [
  'What needs attention in our supply chain today?',
  'Which inventory risks should I review first?',
  'Summarize supplier and shipment risks.',
];
const MESSAGE_LIMIT = 2000;

export function CopilotPanel({ currentPage }: { currentPage: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [retrySeconds, setRetrySeconds] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      dialog.showModal();
      inputRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
      launcherRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (isOpen && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setTimeout(() => setRetrySeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retrySeconds]);

  const sendMessage = async (text: string) => {
    const message = text.trim();
    if (!message || message.length > MESSAGE_LIMIT || requestRef.current || retrySeconds > 0) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const id = crypto.randomUUID();
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content: content.slice(0, MESSAGE_LIMIT) }));
    setMessages((previous) => [...previous, { id, role: 'user', content: message }]);
    setDraft('');
    setError('');
    setIsLoading(true);
    try {
      const response = await apiService.chatWithCopilot(message, history, { current_page: currentPage }, controller.signal);
      if (controller.signal.aborted) return;
      const reply = response.reply || response.response;
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('The copilot returned an empty reply. Please try again.');
      setMessages((previous) => [...previous, {
        id: crypto.randomUUID(), role: 'assistant', content: reply,
        status: response.status, provider: response.provider,
        fallbackReason: response.fallback_reason,
      }]);
      if (typeof response.retry_after === 'number' && Number.isFinite(response.retry_after)) {
        setRetrySeconds(Math.max(0, Math.ceil(response.retry_after)));
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      setMessages((previous) => previous.filter((entry) => entry.id !== id));
      setDraft(message);
      setError(aiRequestError(caught));
      setRetrySeconds(retryDelaySeconds(caught));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsLoading(false);
      }
    }
  };

  const clearChat = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setMessages([]);
    setDraft('');
    setError('');
    setIsLoading(false);
    inputRef.current?.focus();
  };

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="synchain-copilot"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-2xl border border-blue-300/40 bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/50 hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300 print:hidden"
      >
        <MessageSquare className="h-5 w-5" aria-hidden="true" />
        Ask SynChain
      </button>
      <dialog
        id="synchain-copilot"
        ref={dialogRef}
        aria-labelledby="copilot-title"
        aria-describedby="copilot-description"
        onCancel={() => setIsOpen(false)}
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setIsOpen(false);
        }}
        className="m-auto h-[min(44rem,calc(100dvh-2rem))] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-blue-400/30 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm print:hidden"
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
            <div>
              <h2 id="copilot-title" className="flex items-center gap-2 text-lg font-semibold text-white">
                <Bot className="h-5 w-5 text-blue-400" aria-hidden="true" /> SynChain Copilot
              </h2>
              <p id="copilot-description" className="mt-1 text-xs text-slate-400">
                Explore recorded supply-chain data and suggested next steps.
              </p>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={clearChat} aria-label="Clear conversation" title="Clear conversation" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close copilot" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div ref={transcriptRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="space-y-4 py-4">
                <p className="text-sm leading-relaxed text-slate-300">Ask about inventory coverage, supplier reliability, or delayed shipments. Replies use available workspace data; missing information is called out.</p>
                <div className="grid gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={isLoading || retrySeconds > 0} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-blue-200 hover:border-blue-400/50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-400">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions" className="space-y-4">
              {messages.map((message) => (
                <article key={message.id} className={`rounded-xl border p-3 ${message.role === 'user' ? 'ml-6 border-blue-500/20 bg-blue-500/10' : 'mr-3 border-white/10 bg-slate-900'}`}>
                  <p className="mb-1.5 text-xs font-semibold text-slate-400">{message.role === 'user' ? 'You' : 'SynChain Copilot'}</p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
                  {message.role === 'assistant' ? (
                    <p className={`mt-2 text-xs ${message.status === 'fallback' ? 'text-amber-300' : 'text-blue-300'}`}>
                      {message.status === 'fallback'
                        ? `Local snapshot · ${message.fallbackReason === 'rate_limited' ? 'Rate limit cooldown' : message.fallbackReason === 'cooldown' ? 'Key in cooldown' : message.fallbackReason === 'busy' ? 'Service busy' : 'Gemini unavailable'}`
                        : message.provider === 'gemini'
                        ? 'Generated with Gemini · Review before acting'
                        : 'Review before acting'}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
            {isLoading ? <p role="status" className="flex items-center gap-2 text-sm text-blue-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Reviewing available data…</p> : null}
          </div>

          <form onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }} className="space-y-2 border-t border-white/10 bg-slate-900/60 p-4">
            {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
            {retrySeconds > 0 ? <p role="status" className="text-xs text-amber-300">You can send another request in {retrySeconds}s.</p> : null}
            <label htmlFor="copilot-message" className="text-xs font-medium text-slate-300">Message</label>
            <textarea
              id="copilot-message"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void sendMessage(draft);
                }
              }}
              maxLength={MESSAGE_LIMIT}
              disabled={isLoading}
              rows={3}
              aria-describedby="copilot-input-help"
              placeholder="Ask a supply-chain question…"
              className="block w-full resize-none rounded-xl border border-white/15 bg-slate-950 p-3 text-sm placeholder:text-slate-500 focus:border-blue-400 focus:outline-none disabled:opacity-60"
            />
            <div className="flex items-center justify-between gap-3">
              <p id="copilot-input-help" className="text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line<br />{draft.length}/{MESSAGE_LIMIT} · Conversation kept for this session</p>
              <button type="submit" disabled={isLoading || !draft.trim() || retrySeconds > 0} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
                <Send className="h-4 w-4" aria-hidden="true" /> Send
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
