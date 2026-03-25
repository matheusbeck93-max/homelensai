import React, { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Paperclip, X, FileText, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { VoiceInputButton } from "@/components/chat/VoiceInputButton";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { useToast } from "@/hooks/use-toast";

const SUPPORTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const LARGE_PDF_WARNING_PAGES = 50; // approximate

export interface ChatAttachment {
  name: string;
  mimeType: string;
  data: string; // base64
}

interface StickyChatProps {
  onSend: (message: string, attachment?: ChatAttachment) => void;
  loading?: boolean;
  placeholder?: string;
  showVoice?: boolean;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-primary" />;
  return <FileText className="h-4 w-4 text-primary" />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StickyChat({ 
  onSend, 
  loading, 
  placeholder = "Ask about properties, mortgages, investments, or paste a property link...",
  showVoice = false
}: StickyChatProps) {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [largePdfWarning, setLargePdfWarning] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isFree } = useSubscription();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || loading) return;
    onSend(input.trim(), attachment || undefined);
    setInput("");
    setAttachment(null);
    setAttachmentFile(null);
    setLargePdfWarning(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleVoiceTranscript = (transcript: string) => {
    setInput(transcript);
  };

  const handleFileClick = () => {
    if (isFree) {
      setShowUpgradeModal(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    // Validate type
    if (!SUPPORTED_TYPES.includes(file.type)) {
      if (file.name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        toast({
          title: "DOCX not supported yet",
          description: "Please export your document as PDF and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Unsupported file type",
          description: "Please upload a PDF, JPG, PNG, or WEBP file.",
          variant: "destructive",
        });
      }
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${formatFileSize(MAX_FILE_SIZE)}. Your file is ${formatFileSize(file.size)}.`,
        variant: "destructive",
      });
      return;
    }

    // Validate not empty
    if (file.size === 0) {
      toast({
        title: "Empty file",
        description: "The selected file appears to be empty.",
        variant: "destructive",
      });
      return;
    }

    // Large PDF warning heuristic (~10KB per page avg for text PDFs)
    if (file.type === "application/pdf" && file.size > LARGE_PDF_WARNING_PAGES * 10 * 1024) {
      setLargePdfWarning(true);
    } else {
      setLargePdfWarning(false);
    }

    // Convert to base64
    try {
      const base64 = await fileToBase64(file);
      setAttachment({
        name: file.name,
        mimeType: file.type,
        data: base64,
      });
      setAttachmentFile(file);
    } catch {
      toast({
        title: "Error reading file",
        description: "Could not read the selected file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachmentFile(null);
    setLargePdfWarning(false);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50 pb-safe">
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-2 sm:py-3">
          {/* Attachment preview */}
          {attachment && (
            <div className="mb-2 flex items-center gap-2">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm max-w-xs">
                {getFileIcon(attachment.mimeType)}
                <span className="truncate font-medium">{attachment.name}</span>
                {attachmentFile && (
                  <span className="text-muted-foreground text-xs flex-shrink-0">
                    {formatFileSize(attachmentFile.size)}
                  </span>
                )}
                <button
                  onClick={removeAttachment}
                  className="ml-1 p-0.5 rounded hover:bg-accent transition-colors flex-shrink-0"
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              {largePdfWarning && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Large documents may be partially analyzed.</span>
                </div>
              )}
            </div>
          )}

          {/* Disclaimer when attachment is present */}
          {attachment && (
            <p className="text-[10px] text-muted-foreground mb-1.5 px-1">
              Documents are processed securely and not stored.
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2">
            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleFileClick}
              disabled={loading || !!attachment}
              className="h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] md:h-[60px] md:w-[60px] flex-shrink-0"
              title="Upload document or image"
            >
              <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={attachment ? "Ask a question about this document..." : placeholder}
              disabled={loading}
              className="min-h-[44px] sm:min-h-[52px] md:min-h-[60px] max-h-[80px] sm:max-h-[100px] md:max-h-[120px] resize-none text-xs sm:text-sm md:text-base"
              rows={2}
            />
            {showVoice && (
              <VoiceInputButton 
                onTranscript={handleVoiceTranscript}
                disabled={loading}
              />
            )}
            <Button 
              type="submit"
              disabled={loading || (!input.trim() && !attachment)}
              size="icon"
              className="h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] md:h-[60px] md:w-[60px] flex-shrink-0"
            >
              {loading ? (
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-pulse" />
              ) : (
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              )}
            </Button>
          </form>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason="Unlock document analysis to ask questions about contracts, inspection reports, and more."
        feature="Document Upload & Analysis"
      />
    </>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g. "data:application/pdf;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
