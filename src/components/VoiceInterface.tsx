import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { RealtimeVoiceChat } from '@/utils/RealtimeVoice';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInterfaceProps {
  onSpeakingChange?: (speaking: boolean) => void;
  instructions?: string;
  voice?: string;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ 
  onSpeakingChange,
  instructions,
  voice = "alloy"
}) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatRef = useRef<RealtimeVoiceChat | null>(null);

  const handleMessage = (event: any) => {
    console.log('Received message:', event);
    
    if (event.type === 'response.audio.delta') {
      setIsSpeaking(true);
      onSpeakingChange?.(true);
    } else if (event.type === 'response.audio.done') {
      setIsSpeaking(false);
      onSpeakingChange?.(false);
    } else if (event.type === 'error') {
      toast({
        title: "Error",
        description: event.error?.message || 'An error occurred',
        variant: "destructive",
      });
    }
  };

  const startConversation = async () => {
    try {
      toast({
        title: "Connecting...",
        description: "Setting up voice connection",
      });

      chatRef.current = new RealtimeVoiceChat(handleMessage);
      await chatRef.current.init(instructions, voice);
      setIsConnected(true);
      
      toast({
        title: "Connected",
        description: "Voice interface is ready. Start speaking!",
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: "destructive",
      });
    }
  };

  const endConversation = () => {
    chatRef.current?.disconnect();
    setIsConnected(false);
    setIsSpeaking(false);
    onSpeakingChange?.(false);
    
    toast({
      title: "Disconnected",
      description: "Voice conversation ended",
    });
  };

  useEffect(() => {
    return () => {
      chatRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {!isConnected ? (
        <Button 
          onClick={startConversation}
          size="lg"
          className="rounded-full h-16 w-16 shadow-lg"
        >
          <Mic className="h-6 w-6" />
        </Button>
      ) : (
        <Button 
          onClick={endConversation}
          size="lg"
          variant={isSpeaking ? "default" : "secondary"}
          className={`rounded-full h-16 w-16 shadow-lg ${isSpeaking ? 'animate-pulse' : ''}`}
        >
          <MicOff className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};

export default VoiceInterface;
