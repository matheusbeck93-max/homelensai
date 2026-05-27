import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, Download, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackOwnedPropertyEvent } from '@/lib/myProperties/telemetry';

const DOC_TYPES = [
  { value: 'lease', label: 'Lease' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'tax_bill', label: 'Tax bill' },
  { value: 'closing', label: 'Closing docs' },
  { value: 'receipt', label: 'Receipt / invoice' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface Doc {
  id: string;
  document_type: string;
  filename: string;
  storage_path: string;
  uploaded_at: string;
  size_bytes: number | null;
  mime_type: string | null;
  note: string | null;
}

interface PropertyDocumentsProps {
  propertyId: string;
  documents: Doc[];
  onChanged: () => void;
}

export function PropertyDocuments({ propertyId, documents, onChanged }: PropertyDocumentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('other');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) {
        toast.error('You must be signed in');
        return;
      }
      setUploading(true);
      let okCount = 0;
      for (const file of arr) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} is over 15 MB`);
          continue;
        }
        const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
        const path = `${uid}/${propertyId}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from('owned-property-documents')
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { error: rowErr } = await (supabase as any)
          .from('investor_owned_property_documents')
          .insert({
            property_id: propertyId,
            document_type: docType,
            filename: file.name,
            storage_path: path,
            size_bytes: file.size,
            mime_type: file.type || null,
          });
        if (rowErr) {
          await supabase.storage.from('owned-property-documents').remove([path]);
          toast.error(`${file.name}: ${rowErr.message}`);
          continue;
        }
        okCount++;
        trackOwnedPropertyEvent('owned_property_document_uploaded', {
          property_id: propertyId,
          document_type: docType,
          size_bytes: file.size,
        });
      }
      setUploading(false);
      if (okCount > 0) {
        toast.success(`${okCount} document${okCount > 1 ? 's' : ''} uploaded`);
        onChanged();
      }
      if (inputRef.current) inputRef.current.value = '';
    },
    [propertyId, docType, onChanged],
  );

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  async function download(doc: Doc) {
    setBusyId(doc.id);
    const { data, error } = await supabase.storage
      .from('owned-property-documents')
      .createSignedUrl(doc.storage_path, 60);
    setBusyId(null);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? 'Could not generate download link');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    trackOwnedPropertyEvent('owned_property_document_downloaded', {
      property_id: propertyId,
      document_type: doc.document_type,
    });
  }

  async function remove(doc: Doc) {
    if (!confirm(`Delete ${doc.filename}?`)) return;
    setBusyId(doc.id);
    await supabase.storage.from('owned-property-documents').remove([doc.storage_path]);
    const { error } = await (supabase as any)
      .from('investor_owned_property_documents')
      .delete()
      .eq('id', doc.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Document deleted');
    trackOwnedPropertyEvent('owned_property_document_deleted', {
      property_id: propertyId,
      document_type: doc.document_type,
    });
    onChanged();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Category</span>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="h-8"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-1" />
              )}
              Choose files
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed p-6 text-center text-sm transition ${
              dragActive
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-muted-foreground/30 text-muted-foreground'
            }`}
          >
            <Upload className="h-5 w-5 mx-auto mb-2 opacity-60" />
            Drag &amp; drop files here, or use the button above. Max 15 MB each.
          </div>
        </CardContent>
      </Card>

      {documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No documents yet. Upload leases, tax bills, insurance, closing docs and more.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{doc.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="capitalize">{doc.document_type.replace(/_/g, ' ')}</span>
                      {' · '}
                      {fmtDate(doc.uploaded_at)}
                      {doc.size_bytes ? ` · ${fmtBytes(doc.size_bytes)}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    disabled={busyId === doc.id}
                    onClick={() => download(doc)}
                    aria-label="Download"
                  >
                    {busyId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    disabled={busyId === doc.id}
                    onClick={() => remove(doc)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}