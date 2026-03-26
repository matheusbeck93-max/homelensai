import React, { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Plus, X, FileText, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { VoiceInputButton } from "@/components/chat/VoiceInputButton";
import { useToast } from "@/hooks/use-toast";

const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const MAX_FILES = 5;
const LARGE_PDF_WARNING_PAGES = 50;

export interface ChatAttachment {
  name: string;
  mimeType: string;
  data: string; // base64
}

interface StickyChatProps {
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface AttachmentWithFile {
  attachment: ChatAttachment;
  file: File;
  hasLargePdfWarning: boolean;
}

export function StickyChat({ 
  onSend, 
  loading, 
  placeholder = "Ask something",
  showVoice = false
}: StickyChatProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentWithFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || loading) return;
    const chatAttachments = attachments.map(a => a.attachment);
    onSend(input.trim(), chatAttachments.length > 0 ? chatAttachments : undefined);
    setInput("");
    setAttachments([]);
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
    fileInputRef.current?.click();
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const remainingSlots = MAX_FILES - attachments.length;
    if (remainingSlots <= 0) {
      toast({ title: "Maximum files reached", description: `You can attach up to ${MAX_FILES} files per message.`, variant: "destructive" });
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast({ title: "Some files skipped", description: `Only ${remainingSlots} more file(s) can be added (max ${MAX_FILES}).` });
    }

    const newAttachments: AttachmentWithFile[] = [];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.svg'];

    for (const file of filesToProcess) {
      const hasImageExtension = imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      const isSupportedType = file.type === "application/pdf" || file.type.startsWith("image/") || hasImageExtension;
      if (!isSupportedType) {
        if (file.name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          toast({ title: "DOCX not supported yet", description: "Please export as PDF.", variant: "destructive" });
        } else {
          toast({ title: `Unsupported: ${file.name}`, description: `Upload PDF or image files.`, variant: "destructive" });
        }
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: `File too large: ${file.name}`, description: `Max ${formatFileSize(MAX_FILE_SIZE)}.`, variant: "destructive" });
        continue;
      }
      if (file.size === 0) {
        toast({ title: `Empty file: ${file.name}`, description: "Skipped.", variant: "destructive" });
        continue;
      }

      const hasLargePdfWarning = file.type === "application/pdf" && file.size > LARGE_PDF_WARNING_PAGES * 10 * 1024;
      const mimeType = file.type || (hasImageExtension ? 'image/jpeg' : 'application/octet-stream');

      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          attachment: { name: file.name, mimeType, data: base64 },
          file,
          hasLargePdfWarning,
        });
      } catch (err) {
        toast({ title: `Error reading: ${file.name}`, description: "Please try again.", variant: "destructive" });
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    await processFiles(selectedFiles);
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    await processFiles(droppedFiles);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const hasLargePdf = attachments.some(a => a.hasLargePdfWarning);

  return (
    <div
      ref={dropZoneRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50 pb-safe transition-colors ${isDragging ? 'ring-2 ring-primary ring-inset bg-primary/5' : ''}`}
    >
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-blur-sm z-10 pointer-events-none rounded">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Plus className="h-8 w-8 animate-bounce" />
            <p className="text-sm font-medium">Drop files here</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-2 sm:py-3">
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-2 space-y-1.5">
            <div className="flex flex-wrap gap-2">
              {attachments.map((item, index) => (
                <div key={index} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm max-w-[200px]">
                  {getFileIcon(item.attachment.mimeType)}
                  <span className="truncate font-medium text-xs">{item.attachment.name}</span>
                  <span className="text-muted-foreground text-[10px] flex-shrink-0">
                    {formatFileSize(item.file.size)}
                  </span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="ml-0.5 p-0.5 rounded hover:bg-accent transition-colors flex-shrink-0"
                    aria-label={`Remove ${item.attachment.name}`}
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            {hasLargePdf && (
              <div className="flex items-center gap-1.5 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Large documents may be partially analyzed.</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground px-1">
              Documents are processed securely and not stored. ({attachments.length}/{MAX_FILES})
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleFileClick}
            disabled={loading || attachments.length >= MAX_FILES}
            className="h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] md:h-[60px] md:w-[60px] flex-shrink-0"
            title={`Upload files (${attachments.length}/${MAX_FILES})`}
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={attachments.length > 0 ? "Ask a question about these files..." : placeholder}
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
            disabled={loading || (!input.trim() && attachments.length === 0)}
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
  );
}
