import { useRef, useState } from "react";
import {
  useListDeceasedPhotos,
  useAddDeceasedPhoto,
  useDeleteDeceasedPhoto,
  getListDeceasedPhotosQueryKey,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function PhotoGallery({ deceasedId }: { deceasedId: number }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: photos } = useListDeceasedPhotos(deceasedId, {
    query: { queryKey: getListDeceasedPhotosQueryKey(deceasedId) },
  });
  const { mutateAsync: addPhoto } = useAddDeceasedPhoto();
  const { mutateAsync: deletePhoto } = useDeleteDeceasedPhoto();

  const { uploadFile, isUploading } = useUpload({
    basePath: `${import.meta.env.BASE_URL}api/storage`,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListDeceasedPhotosQueryKey(deceasedId) });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const result = await uploadFile(file);
        if (!result) throw new Error("upload failed");
        await addPhoto({ id: deceasedId, data: { objectPath: result.objectPath } });
      }
      await refresh();
    } catch {
      setError("That photo could not be added. Please try again when you are ready.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (photoId: number) => {
    setError(null);
    try {
      await deletePhoto({ photoId });
      await refresh();
    } catch {
      setError("That photo could not be removed. Please try again when you are ready.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h2 className="text-xl font-serif">Photographs</h2>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
          {isUploading ? "Adding..." : "Add a photo"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        These images are private to you. Add the faces and moments you want to keep close.
      </p>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <AnimatePresence>
            {photos.map((photo) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/30"
              >
                <img
                  src={`${import.meta.env.BASE_URL}api/storage${photo.objectPath}`}
                  alt="A cherished photograph"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => void handleDelete(photo.id)}
                  aria-label="Remove photo"
                  title="Remove photo"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 py-12 text-center text-sm text-muted-foreground">
          No photographs yet. When you are ready, you can add one above.
        </div>
      )}
    </section>
  );
}
