import { cn } from '@/lib/utils';
import { Wrench } from 'lucide-react';
import type { ChatTurn } from '@/contexts/InvestorBriefContext';
import { getAiTool } from '@/lib/investorBrief/aiTools';

interface Props {
  turns: ChatTurn[];
  pending?: boolean;
}

export function ChatMessageList({ turns, pending }: Props) {
  const visible = turns.filter((t) => t.role !== 'system');
  return (
    <div className="space-y-3">
      {visible.map((t) => (
        <div key={t.id} className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
          <div
            className={cn(
              'max-w-[90%] rounded-md px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
              t.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/40 text-foreground',
            )}
          >
            {t.content}
            {t.toolCalls && t.toolCalls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {t.toolCalls.map((id) => {
                  const tool = getAiTool(id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-medium"
                      title={tool?.description}
                    >
                      <Wrench className="h-3 w-3" /> {tool?.label ?? id}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
      {pending && (
        <div className="flex justify-start">
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Thinking…
          </div>
        </div>
      )}
    </div>
  );
}