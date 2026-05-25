import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  data: { stepsRemaining: number };
}

export function SetupCard({ data }: Props) {
  const navigate = useNavigate();
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Complete {data.stepsRemaining} quick step{data.stepsRemaining === 1 ? '' : 's'} to start
        receiving daily insights tailored to your goals.
      </p>
      <Button size="sm" onClick={() => navigate('/profile-setup')} className="gap-1.5">
        Set up preferences <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
