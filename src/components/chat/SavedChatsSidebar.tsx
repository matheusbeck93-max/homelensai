import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  LogIn, 
  ChevronLeft,
  ChevronRight,
  Save,
  Pencil,
  Check,
  X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface SavedChatsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  user: any;
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation?: (id: string, newTitle: string) => Promise<boolean>;
  onClearAllConversations?: () => void;
  onLogin: () => void;
}

export function SavedChatsSidebar({
  isOpen,
  onToggle,
  user,
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onClearAllConversations,
  onLogin
}: SavedChatsSidebarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (conversationToDelete) {
      onDeleteConversation(conversationToDelete);
      setConversationToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const confirmClearAll = () => {
    if (onClearAllConversations) {
      onClearAllConversations();
    }
    setClearAllDialogOpen(false);
  };

  const startEditing = (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditTitle("");
  };

  const saveEditing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingId && editTitle.trim() && onRenameConversation) {
      const success = await onRenameConversation(editingId, editTitle);
      if (success) {
        setEditingId(null);
        setEditTitle("");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingId && editTitle.trim() && onRenameConversation) {
        onRenameConversation(editingId, editTitle).then(success => {
          if (success) {
            setEditingId(null);
            setEditTitle("");
          }
        });
      }
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this conversation and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all chat history?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all your saved conversations and messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="fixed left-2 top-20 z-40 h-8 w-8 rounded-full bg-background border shadow-sm md:hidden"
      >
        {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-background border-r z-30 transition-transform duration-200",
        "md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b">
            <Button 
              onClick={onNewChat} 
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>

          {/* Auto-save indicator and Clear History */}
          {user && (
            <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Save className="h-3 w-3" />
                <span>Auto-saved</span>
              </div>
              {conversations.length > 0 && onClearAllConversations && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => setClearAllDialogOpen(true)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              )}
            </div>
          )}

          {/* Content */}
          {!user ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Sign in to save your chat history
              </p>
              <Button onClick={onLogin} variant="default" size="sm">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                No saved chats yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Start a conversation to save it
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-md p-2 hover:bg-accent cursor-pointer transition-colors",
                      currentConversationId === conversation.id && "bg-accent"
                    )}
                    onClick={() => editingId !== conversation.id && onSelectConversation(conversation.id)}
                  >
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {editingId === conversation.id ? (
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 text-sm"
                          autoFocus
                        />
                      ) : (
                        <>
                          <p className="text-sm font-medium truncate">
                            {conversation.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                          </p>
                        </>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    {editingId === conversation.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-primary/10"
                          onClick={saveEditing}
                        >
                          <Check className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-destructive/10"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                        {onRenameConversation && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 min-w-[28px] hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => startEditing(e, conversation)}
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 min-w-[28px] hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setConversationToDelete(conversation.id);
                            setDeleteDialogOpen(true);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </>
  );
}
