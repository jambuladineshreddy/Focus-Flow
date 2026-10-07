import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentApi, type Conversation, type Message } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Send, Zap, ChevronRight, Plus, MessageSquare, Loader2, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const SUGGESTIONS = [
  'Plan my day',
  'What should I work on first?',
  'Create a study plan for my exam',
  'Show me my overdue tasks',
  'Help me break down a goal',
  'Find time in my calendar this week',
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <Zap className="w-3 h-3 text-indigo-600" />
      </div>
      <div className="flex gap-1 ml-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400 typing-dot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const sources = msg.sources ? JSON.parse(msg.sources) as string[] : [];

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-indigo-600' : 'bg-indigo-50'
      }`}>
        {isUser
          ? <span className="text-white text-xs font-bold">U</span>
          : <Zap className="w-3.5 h-3.5 text-indigo-600" />
        }
      </div>

      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-white border border-slate-200 shadow-sm rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="text-sm text-white">{msg.content}</p>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {sources.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sources.map((src: string) => (
              <div key={src} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100">
                <FileText className="w-3 h-3 text-indigo-500" />
                <span className="text-xs text-indigo-600 font-medium">{src}</span>
              </div>
            ))}
          </div>
        )}

        <span className="text-xs text-slate-400 mt-1.5">
          {format(parseISO(msg.created_at), 'h:mm a')}
        </span>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isTyping, setIsTyping] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => agentApi.getConversations().then(r => r.data),
  });

  // Load a conversation
  const loadConversation = async (id: string) => {
    setSelectedConvId(id);
    const res = await agentApi.getConversation(id);
    setMessages(res.data.messages || []);
    setConversationId(id);
  };

  const sendMutation = useMutation({
    mutationFn: (msg: string) => agentApi.chat(msg, conversationId),
    onMutate: (msg) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        conversation_id: conversationId || '',
        role: 'user',
        content: msg,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);
    },
    onSuccess: (res) => {
      const { conversation_id, message } = res.data;
      setConversationId(conversation_id);
      setIsTyping(false);
      setMessages(prev => [...prev, message]);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => {
      setIsTyping(false);
      toast.error('Failed to send message. Please try again.');
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput('');
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setSelectedConvId(undefined);
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex h-full">
      {/* Conversation sidebar */}
      <div className="hidden md:flex flex-col w-56 border-r border-slate-200 bg-white flex-shrink-0">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversations</span>
          <button onClick={startNewChat} className="text-slate-400 hover:text-indigo-600 transition-colors" title="New chat">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {conversations?.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6 px-4">No conversations yet</p>
          )}
          {conversations?.map((c: Conversation) => (
            <button
              key={c.id}
              onClick={() => loadConversation(c.id)}
              className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors ${
                selectedConvId === c.id ? 'bg-indigo-50' : ''
              }`}
            >
              <p className={`text-sm truncate ${selectedConvId === c.id ? 'text-indigo-700 font-medium' : 'text-slate-700'}`}>
                {c.title || 'New conversation'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {format(parseISO(c.updated_at), 'MMM d, h:mm a')}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-800">FocusFlow AI</span>
              <span className="hidden sm:inline text-xs text-slate-400 ml-2">· Always on</span>
            </div>
          </div>
          <button onClick={startNewChat} className="btn-ghost text-xs">
            <Plus className="w-3.5 h-3.5" /> New chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">
                {greeting}. What would you like to accomplish today?
              </h2>
              <p className="text-sm text-slate-500 mb-8 max-w-sm">
                I can create tasks, plan your day, search your documents, and schedule your work.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="px-3 py-1.5 rounded-full text-sm border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-2">
              {messages.map(msg => (
                <ChatMessage key={msg.id} msg={msg} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              id="chat-input"
              className="flex-1 resize-none input max-h-32 min-h-[44px] leading-5 py-2.5"
              placeholder="Ask me anything about your tasks, schedule, or documents..."
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              id="send-btn"
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="btn-primary flex-shrink-0 h-10 w-10 p-0 rounded-lg disabled:opacity-40"
            >
              {sendMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
