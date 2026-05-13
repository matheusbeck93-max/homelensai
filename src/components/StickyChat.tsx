import React, { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, X, FileText, Image as ImageIcon, AlertTriangle, AudioLines } from "lucide-react";
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
  /** External value to populate the input (e.g., when editing a previous user message). */
  value?: string;
  /** Notify parent when the user clears/edits the controlled value. */
  onValueChange?: (value: string) => void;
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
  placeholder = "Ask something...",
  showVoice = false,
  value,
  onValueChange,
}: StickyChatProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentWithFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);
  const { toast } = useToast();

  // Allow parent to inject text (e.g., when editing a prior user message)
  useEffect(() => {
    if (typeof value === "string" && value !== input) {
      setInput(value);
      // Focus textarea so user can immediately edit
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        const len = value.length;
        textareaRef.current?.setSelectionRange(len, len);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const updateInput = (next: string) => {
    setInput(next);
    onValueChange?.(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || loading) return;
    const chatAttachments = attachments.map(a => a.attachment);
    onSend(input.trim(), chatAttachments.length > 0 ? chatAttachments : undefined);
    updateInput("");
    setAttachments([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleVoiceTranscript = (transcript: string) => {
    updateInput(transcript);
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
      className={`fixed bottom-0 left-0 right-0 z-50 pb-safe pointer-events-none transition-colors ${isDragging ? 'bg-primary/5' : ''}`}
    >
      {/* Soft fade so messages dissolve into the input area instead of hitting a hard border */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-background"
      />
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-blur-sm z-10 pointer-events-none rounded">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Plus className="h-8 w-8 animate-bounce" />
            <p className="text-sm font-medium">Drop files here</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-3xl mx-auto px-4 pb-3 pt-1 pointer-events-auto bg-background">
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

        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-1.5 sm:gap-[8px] bg-muted/50 border border-border/60 rounded-3xl px-[10px] sm:px-[11px] py-1.5 sm:py-2 focus-within:bg-muted/70 focus-within:border-border transition-colors w-full"
        >
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
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-background"
            title={`Add attachment (${attachments.length}/${MAX_FILES})`}
            aria-label="Add attachment"
          >
            <Plus className="h-5 w-5" />
          </Button>

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => updateInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={attachments.length > 0 ? "Ask a question about these files..." : placeholder}
            disabled={loading}
            className="flex-1 min-h-[40px] sm:min-h-[44px] max-h-[140px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-2 text-sm sm:text-base placeholder:text-muted-foreground/70"
            rows={1}
          />

          {showVoice && (
            <div className="flex-shrink-0">
              <VoiceInputButton
                onTranscript={handleVoiceTranscript}
                disabled={loading}
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || (!input.trim() && attachments.length === 0)}
            size="icon"
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            aria-label="Send message"
            title="Send"
          >
            {loading ? (
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse" />
            ) : (
              <AudioLines className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
