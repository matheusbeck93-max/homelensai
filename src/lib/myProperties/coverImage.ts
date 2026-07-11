import { supabase } from '@/integrations/supabase/client';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function extFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && EXT_TO_MIME[fromName]) return fromName;
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/')) return t.split('/')[1] || 'jpg';
  return 'jpg';
}

export function inferContentType(file: File): string | undefined {
  if (file.type) return file.type;
  const ext = extFromFile(file);
  return EXT_TO_MIME[ext];
}

export function isHeic(file: File): boolean {
  const ext = extFromFile(file);
  return ext === 'heic' || ext === 'heif';
}

/**
 * Uploads a cover image to the owned-property-photos bucket and returns
 * the storage path (to be stored in investor_owned_properties.primary_photo_url).
 * Throws with a descriptive message on failure.
 */
export async function uploadCoverImage(params: {
  file: File;
  userId: string;
  propertyId: string;
}): Promise<string> {
  const { file, userId, propertyId } = params;
  const ext = extFromFile(file);
  const path = `${userId}/${propertyId}/cover-${Date.now()}.${ext}`;
  const contentType = inferContentType(file);
  const { error } = await supabase.storage
    .from('owned-property-photos')
    .upload(path, file, {
      upsert: true,
      ...(contentType ? { contentType } : {}),
    });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[cover-image] upload failed', error);
    throw error;
  }
  return path;
}