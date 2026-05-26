import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { getPersona, type PersonaId } from '@/lib/personas/personaRegistry';

interface Props {
  persona: PersonaId;
  to?: string;
  className?: string;
}

export function PersonaSummary({ persona, to = '/profile-setup', className }: Props) {
  const def = getPersona(persona);
  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] text-muted-foreground ${className ?? ''}`}>
      <Target className="h-3 w-3 text-primary" />
      <span>Tuned for:</span>
      <span className="font-medium text-foreground">{def.displayName}</span>
      <Link to={to} className="text-primary hover:underline">change</Link>
    </div>
  );
}