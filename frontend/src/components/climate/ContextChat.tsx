'use client';

import { Bot, MessageCircle, RotateCcw, Send, Sparkles, User } from 'lucide-react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

interface ContextChatProps {
  title: string;
  description: string;
  suggestions: string[];
  onSend: (messages: ChatMessage[]) => Promise<string>;
  className?: string;
}

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 19;

interface ChatEntry extends ChatMessage {
  id: number;
}

export function ContextChat({
  title,
  description,
  suggestions,
  onSend,
  className,
}: ContextChatProps) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const nextMessageId = useRef(0);

  useEffect(() => {
    if (messages.length > 0 || isSending) {
      conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isSending]);

  const requestReply = async (conversation: ChatEntry[]) => {
    setIsSending(true);
    setError(null);
    const recentHistory = conversation.slice(-MAX_HISTORY_LENGTH);
    if (recentHistory[0]?.role !== 'user') recentHistory.shift();
    try {
      const reply = await onSend(recentHistory.map(({ role, content }) => ({ role, content })));
      setMessages((current) => [
        ...current,
        { id: nextMessageId.current++, role: 'assistant', content: reply },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The assistant could not reply. Please try again.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const submitMessage = (value: string) => {
    const content = value.trim();
    if (!content || isSending) return;
    const nextMessages = [
      ...messages,
      { id: nextMessageId.current++, role: 'user' as const, content },
    ];
    setMessages(nextMessages);
    setDraft('');
    void requestReply(nextMessages);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitMessage(draft);
    }
  };

  return (
    <Card variant='elevated' className={cn('overflow-hidden', className)}>
      <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-theme-divider'>
        <div>
          <CardTitle className='flex items-center gap-2'>
            <MessageCircle className='h-5 w-5 text-theme-accent' aria-hidden='true' />
            {title}
          </CardTitle>
          <p className='mt-1 text-sm text-theme-text-muted'>{description}</p>
        </div>
        {messages.length > 0 && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            disabled={isSending}
            aria-label='Clear this conversation'
          >
            <RotateCcw className='h-4 w-4' aria-hidden='true' />
            New chat
          </Button>
        )}
      </CardHeader>

      <CardContent className='space-y-4 pt-4'>
        <div
          className='max-h-[26rem] min-h-24 space-y-3 overflow-y-auto pr-1'
          role='log'
          aria-relevant='additions'
          aria-label='Chat messages'
        >
          {messages.length === 0 ? (
            <div className='rounded-organic-sm border border-dashed border-theme-border bg-theme-bg-secondary/60 p-4'>
              <div className='flex items-start gap-3'>
                <span className='rounded-full bg-theme-accent/10 p-2 text-theme-accent'>
                  <Sparkles className='h-4 w-4' aria-hidden='true' />
                </span>
                <div>
                  <p className='font-medium text-theme-text-primary'>
                    Explore this place with ClimateOps AI
                  </p>
                  <p className='mt-1 text-sm leading-relaxed text-theme-text-secondary'>
                    Ask about the current conditions, what the risk scores mean, or practical next
                    steps.
                  </p>
                </div>
              </div>
              <div className='mt-4 flex flex-wrap gap-2'>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type='button'
                    onClick={() => submitMessage(suggestion)}
                    disabled={isSending}
                    className='rounded-full border border-theme-border bg-theme-bg-primary px-3 py-1.5 text-left text-xs text-theme-text-secondary transition-colors hover:border-theme-accent hover:text-theme-accent disabled:opacity-50'
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-start gap-2.5',
                  message.role === 'user' && 'flex-row-reverse'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    message.role === 'assistant'
                      ? 'bg-theme-accent/10 text-theme-accent'
                      : 'bg-theme-bg-accent text-theme-text-secondary'
                  )}
                  aria-hidden='true'
                >
                  {message.role === 'assistant' ? (
                    <Bot className='h-4 w-4' />
                  ) : (
                    <User className='h-4 w-4' />
                  )}
                </span>
                <p
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    message.role === 'assistant'
                      ? 'rounded-tl-sm border border-theme-border bg-theme-bg-secondary text-theme-text-primary'
                      : 'rounded-tr-sm bg-theme-accent text-white'
                  )}
                >
                  {message.content}
                </p>
              </div>
            ))
          )}
          {isSending && (
            <div className='flex items-center gap-2.5 text-sm text-theme-text-muted' role='status'>
              <span className='flex h-8 w-8 items-center justify-center rounded-full bg-theme-accent/10 text-theme-accent'>
                <Bot className='h-4 w-4' aria-hidden='true' />
              </span>
              <span className='animate-pulse'>ClimateOps AI is thinking…</span>
            </div>
          )}
          <div ref={conversationEndRef} />
        </div>

        {error && (
          <div
            className='flex flex-wrap items-center justify-between gap-3 rounded-organic-sm border border-risk-high/30 bg-risk-high/5 px-3 py-2.5'
            role='alert'
          >
            <p className='text-sm text-theme-text-secondary'>{error}</p>
            <Button
              variant='secondary'
              size='sm'
              onClick={() => void requestReply(messages)}
              disabled={isSending || messages[messages.length - 1]?.role !== 'user'}
            >
              Try again
            </Button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className='flex items-end gap-2 rounded-organic border border-theme-border bg-theme-bg-primary p-2 focus-within:border-theme-accent'
        >
          <label className='sr-only' htmlFor='climate-chat-message'>
            Ask a question
          </label>
          <textarea
            id='climate-chat-message'
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={2}
            placeholder='Ask a follow-up about this place…'
            className='max-h-32 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-theme-text-primary outline-none placeholder:text-theme-text-muted'
            disabled={isSending}
          />
          <Button
            type='submit'
            size='md'
            className='shrink-0'
            disabled={isSending || !draft.trim()}
            aria-label='Send message'
          >
            <Send className='h-4 w-4' aria-hidden='true' />
            <span className='sr-only sm:not-sr-only'>Send</span>
          </Button>
        </form>
        <div className='flex items-center justify-between text-xs text-theme-text-muted'>
          <span>Enter to send · Shift+Enter for a new line</span>
          <span>Conversation stays on this page only</span>
        </div>
      </CardContent>
    </Card>
  );
}
