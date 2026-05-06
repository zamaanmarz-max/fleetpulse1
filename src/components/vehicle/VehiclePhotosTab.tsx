import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Camera, X, Loader2, Upload, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const PHOTO_TYPES = [
  { value: "pre-hire",      label: "Pre-Hire",        color: "text-primary",          bg: "bg-primary/20" },
  { value: "current",       label: "Current State",    color: "text-success",          bg: "bg-success/20" },
  { value: "damage-before", label: "Damage – Before",  color: "text-warning",          bg: "bg-warning/20" },
  { value: "damage-after",  label: "Damage – After",   color: "text-green-400",        bg: "bg-green-500/20" },
  { value: "compliance",    label: "Compliance Doc",   color: "text-purple-400",       bg: "bg-purple-500/20" },
  { value: "other",         label: "Other",            color: "text-muted-foreground", bg: "bg-muted" },
];

interface Props { vehicleId: string; registration: string; }

export function VehiclePhotosTab({ vehicleId, registration }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [form, setForm] = useState({ photo_type: "current", caption: "", uploaded_by: "" });

  const { data: photos, isLoading } = useQuery({
    queryKey: ["vehicle_photos", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_photos").select("*").eq("vehicle_id", vehicleId).order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0, refetchOnMount: "always",
  });

  // Monthly fleet update tracking
  const thisMonth = new Date().toISOString().substring(0, 7);
  const currentPhotos = (photos || []).filter(p => p.photo_type === "current");
  const lastCurrentUpdate = currentPhotos[0]?.uploaded_at;
  const lastCurrentMonth = lastCurrentUpdate?.substring(0, 7);
  const fleetUpdateDue = lastCurrentMonth !== thisMonth;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedFiles(prev => [...prev, ...files]);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeFile = (i: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) { toast.error("Select at least one photo"); return; }
    setUploading(true);
    let done = 0;
    const errors: string[] = [];

    for (const file of selectedFiles) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `vehicle-photos/${vehicleId}/${form.photo_type}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("certificates").upload(path, file);
      if (upErr) { errors.push(file.name); continue; }
      await supabase.from("vehicle_photos").insert({
        vehicle_id: vehicleId,
        photo_url: path,
        photo_type: form.photo_type,
        caption: form.caption || null,
        uploaded_by: form.uploaded_by || null,
      });
      done++;
      setUploadProgress(Math.round((done / selectedFiles.length) * 100));
    }

    setUploading(false);
    setUploadProgress(0);
    if (errors.length) toast.error(`${errors.length} file(s) failed: ${errors.join(", ")}`);
    if (done > 0) toast.success(`${done} photo${done > 1 ? "s" : ""} uploaded`);
    setShowUpload(false);
    setSelectedFiles([]);
    setPreviews([]);
    setForm({ photo_type: "current", caption: "", uploaded_by: "" });
    queryClient.invalidateQueries({ queryKey: ["vehicle_photos", vehicleId] });
  };

  const handleDelete = async (id: string, path: string) => {
    await supabase.storage.from("certificates").remove([path]);
    await supabase.from("vehicle_photos").delete().eq("id", id);
    toast.success("Deleted");
    queryClient.invalidateQueries({ queryKey: ["vehicle_photos", vehicleId] });
  };

  const openPhoto = async (path: string) => {
    const isPdf = path.toLowerCase().endsWith(".pdf");
    const { data } = await supabase.storage.from("certificates").getPublicUrl(path);
    if (isPdf) window.open(data.publicUrl, "_blank");
    else setLightbox(data.publicUrl);
  };

  const byType = PHOTO_TYPES.map(t => ({
    ...t,
    items: (photos || []).filter(p => p.photo_type === t.value),
  })).filter(t => t.items.length > 0);

  const inputCls = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "block text-sm font-medium text-foreground mb-1";

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Vehicle Gallery — {registration}</h3>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90">
          <Upload className="w-3.5 h-3.5" /> Upload Photos
        </button>
      </div>

      {/* Monthly fleet update banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${fleetUpdateDue ? "bg-warning/10 border-warning/30 text-warning" : "bg-success/10 border-success/30 text-success"}`}>
        {fleetUpdateDue ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
        <div>
          <span className="font-semibold">{fleetUpdateDue ? "Fleet Photo Update Due" : "Fleet Photos Up to Date"}</span>
          <span className="text-xs ml-2 opacity-75">
            {lastCurrentUpdate ? `Last updated: ${new Date(lastCurrentUpdate).toLocaleDateString("en-ZA")}` : "No current photos uploaded yet"}
          </span>
        </div>
        {fleetUpdateDue && (
          <button onClick={() => { setForm(f => ({ ...f, photo_type: "current" })); setShowUpload(true); }}
            className="ml-auto text-xs bg-warning/20 hover:bg-warning/30 text-warning px-2 py-1 rounded-lg font-semibold">
            Upload Now
          </button>
        )}
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      {!isLoading && (photos || []).length === 0 && (
        <div className="glass-card p-8 text-center space-y-3">
          <Camera className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No photos yet for {registration}</p>
          <p className="text-xs text-muted-foreground">Upload pre-hire photos, damage shots, or compliance documents</p>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90 mx-auto">
            <Upload className="w-4 h-4" /> Upload First Photos
          </button>
        </div>
      )}

      {byType.map(group => (
        <div key={group.value} className="space-y-2">
          <h4 className={`text-sm font-semibold ${group.color} flex items-center gap-2`}>
            <Camera className="w-4 h-4" /> {group.label} ({group.items.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {group.items.map(photo => (
              <div key={photo.id} className="relative group glass-card p-0 overflow-hidden rounded-xl">
                <div className="aspect-square bg-secondary flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => openPhoto(photo.photo_url)}>
                  {photo.photo_url.match(/\.(jpg|jpeg|png|webp|gif)$/i)
                    ? <PhotoThumbnail path={photo.photo_url} />
                    : <div className="flex flex-col items-center gap-2 p-4 text-center"><Camera className="w-8 h-8 text-muted-foreground" /><span className="text-xs text-muted-foreground">PDF / Doc</span></div>
                  }
                </div>
                {photo.caption && <p className="px-2 py-1.5 text-xs text-foreground truncate border-t border-border">{photo.caption}</p>}
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDelete(photo.id, photo.photo_url)} className="bg-destructive text-destructive-foreground rounded-full p-1 shadow-sm hover:opacity-90">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-background/70 text-xs text-muted-foreground px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {photo.uploaded_at ? new Date(photo.uploaded_at).toLocaleDateString("en-ZA") : ""}
                  {photo.uploaded_by ? ` · ${photo.uploaded_by}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Bulk Upload Form */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => !uploading && setShowUpload(false)} />
          <div className="w-full max-w-lg bg-card border-l border-border flex flex-col max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <h2 className="text-base font-bold text-foreground">Upload Photos — {registration}</h2>
              {!uploading && <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className={labelCls}>Photo Type</label>
                <select value={form.photo_type} onChange={e => setForm({ ...form, photo_type: e.target.value })} className={inputCls}>
                  {PHOTO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Drop zone */}
              <div>
                <label className={labelCls}>Select Photos (multiple allowed)</label>
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                  <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">Tap to select photos</p>
                  <p className="text-xs text-muted-foreground mt-1">Select as many as you want — JPG, PNG, PDF</p>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileSelect} />
              </div>

              {/* Previews grid */}
              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-secondary">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removeFile(i)} className="absolute top-1 right-1 bg-destructive text-white rounded-full p-0.5 hover:opacity-90">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => fileInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors text-xs gap-1">
                    <Camera className="w-5 h-5" />Add more
                  </button>
                </div>
              )}

              <div>
                <label className={labelCls}>Caption (applies to all)</label>
                <input value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })} placeholder="e.g. Monthly fleet update – May 2026" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Uploaded By</label>
                <input value={form.uploaded_by} onChange={e => setForm({ ...form, uploaded_by: e.target.value })} placeholder="Your name" className={inputCls} />
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">Uploading {uploadProgress}%...</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={handleUpload} disabled={uploading || !selectedFiles.length}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? `Uploading ${uploadProgress}%...` : `Upload ${selectedFiles.length || ""} Photo${selectedFiles.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-foreground hover:opacity-70 bg-secondary rounded-full p-2"><X className="w-5 h-5" /></button>
          <img src={lightbox} alt="Vehicle photo" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain" />
        </div>
      )}
    </div>
  );
}

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
