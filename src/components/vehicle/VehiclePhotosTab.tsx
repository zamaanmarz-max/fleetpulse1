import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Plus, X, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

const PHOTO_TYPES = [
  { value: "pre-hire",      label: "Pre-Hire",       color: "text-primary" },
  { value: "current",       label: "Current State",   color: "text-success" },
  { value: "damage-before", label: "Damage – Before", color: "text-warning" },
  { value: "damage-after",  label: "Damage – After",  color: "text-success" },
  { value: "compliance",    label: "Compliance Doc",  color: "text-purple-400" },
  { value: "other",         label: "Other",           color: "text-muted-foreground" },
];

interface Props {
  vehicleId: string;
  registration: string;
}

export function VehiclePhotosTab({ vehicleId, registration }: Props) {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [uploadForm, setUploadForm] = useState({
    photo_type: "pre-hire",
    caption: "",
    uploaded_by: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const { data: photos, isLoading } = useQuery({
    queryKey: ["vehicle_photos", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_photos")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from("certificates").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUpload = async () => {
    if (!file) { toast.error("Please select a file"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `vehicle-photos/${vehicleId}/${uploadForm.photo_type}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("certificates").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error } = await supabase.from("vehicle_photos").insert({
      vehicle_id: vehicleId,
      photo_url: path,
      photo_type: uploadForm.photo_type,
      caption: uploadForm.caption || null,
      uploaded_by: uploadForm.uploaded_by || null,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Photo uploaded");
    setShowUpload(false);
    setFile(null);
    setUploadForm({ photo_type: "pre-hire", caption: "", uploaded_by: "" });
    queryClient.invalidateQueries({ queryKey: ["vehicle_photos", vehicleId] });
  };

  const handleDelete = async (id: string, path: string) => {
    await supabase.storage.from("certificates").remove([path]);
    const { error } = await supabase.from("vehicle_photos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Photo deleted");
    queryClient.invalidateQueries({ queryKey: ["vehicle_photos", vehicleId] });
  };

  const openPhoto = async (path: string) => {
    const url = await getSignedUrl(path);
    setLightbox(url);
  };

  // Group by photo_type
  const byType = PHOTO_TYPES.map(t => ({
    ...t,
    items: (photos || []).filter(p => p.photo_type === t.value),
  })).filter(t => t.items.length > 0);

  const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "block text-sm font-medium text-foreground mb-1";

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Vehicle Gallery — {registration}</h3>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90">
          <Upload className="w-3.5 h-3.5" /> Upload Photo / Doc
        </button>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      {!isLoading && (photos || []).length === 0 && (
        <div className="glass-card p-8 text-center space-y-3">
          <Camera className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No photos yet for {registration}</p>
          <p className="text-xs text-muted-foreground">Upload pre-hire photos, damage shots, or compliance documents</p>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90 mx-auto">
            <Plus className="w-4 h-4" /> Add First Photo
          </button>
        </div>
      )}

      {byType.map(group => (
        <div key={group.value} className="space-y-3">
          <h4 className={`text-sm font-semibold ${group.color} flex items-center gap-2`}>
            <Camera className="w-4 h-4" /> {group.label} ({group.items.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {group.items.map(photo => (
              <div key={photo.id} className="relative group glass-card p-0 overflow-hidden rounded-xl">
                <div
                  className="aspect-square bg-secondary flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => openPhoto(photo.photo_url)}
                >
                  {photo.photo_url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                    <PhotoThumbnail path={photo.photo_url} />
                  ) : (
                    <div className="flex flex-col items-center gap-2 p-4 text-center">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">PDF / Doc</span>
                    </div>
                  )}
                </div>
                {photo.caption && (
                  <p className="px-2 py-1.5 text-xs text-foreground truncate border-t border-border">{photo.caption}</p>
                )}
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDelete(photo.id, photo.photo_url)}
                    className="bg-destructive text-destructive-foreground rounded-full p-1 shadow-sm hover:opacity-90"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {photo.uploaded_at && (
                  <p className="absolute bottom-0 left-0 right-0 bg-background/70 text-xs text-muted-foreground px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {new Date(photo.uploaded_at).toLocaleDateString("en-ZA")}
                    {photo.uploaded_by ? ` · ${photo.uploaded_by}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Upload form */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row">
          <div className="flex-1 bg-background/50" onClick={() => setShowUpload(false)} />
          <div className="w-full md:w-[440px] bg-card border-l border-border p-4 md:p-6 overflow-y-auto space-y-4 max-h-screen">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Upload Photo / Document</h2>
              <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label className={labelCls}>Photo Type</label>
              <select value={uploadForm.photo_type} onChange={e => setUploadForm({ ...uploadForm, photo_type: e.target.value })} className={inputCls}>
                {PHOTO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>File *</label>
              <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-foreground" />
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, or PDF accepted</p>
            </div>

            <div>
              <label className={labelCls}>Caption (optional)</label>
              <input value={uploadForm.caption} onChange={e => setUploadForm({ ...uploadForm, caption: e.target.value })} placeholder="e.g. Pre-hire front view" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Uploaded By</label>
              <input value={uploadForm.uploaded_by} onChange={e => setUploadForm({ ...uploadForm, uploaded_by: e.target.value })} placeholder="Your name" className={inputCls} />
            </div>

            <button onClick={handleUpload} disabled={uploading} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl max-h-full">
            <button onClick={() => setLightbox(null)} className="absolute -top-10 right-0 text-foreground hover:opacity-70">
              <X className="w-6 h-6" />
            </button>
            <img src={lightbox} alt="Vehicle photo" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

// Async thumbnail loader
function PhotoThumbnail({ path }: { path: string }) {
  const { data: url } = useQuery({
    queryKey: ["photo_url", path],
    queryFn: async () => {
      const { data } = await supabase.storage.from("certificates").getPublicUrl(path);
      return data.publicUrl;
    },
    staleTime: Infinity,
  });
  if (!url) return <Camera className="w-8 h-8 text-muted-foreground" />;
  return <img src={url} alt="" className="w-full h-full object-cover" />;
}
