import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Camera, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const TECH_AI_URL = "https://cgqmyqveqnvrmytmpbfh.supabase.co/functions/v1/tech-assist";

type Msg = { role: "user" | "assistant"; text: string; image?: string };

export function TechAssist({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("vehicles").select("id, registration_number, fridge_brand, fridge_model").eq("organisation_id", profile?.organisation_id).eq("is_active", true).order("registration_number");
      setVehicles(data || []);
    })();
  }, [profile?.organisation_id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const pickImage = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const send = async () => {
    if (!input.trim() && !image) return;
    const userMsg: Msg = { role: "user", text: input, image: image || undefined };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    const sentImage = image;
    setImage(null);
    setLoading(true);
    try {
      // build prior history (text only) for context
      const history = messages.map(m => ({ role: m.role, content: m.text }));
      const res = await fetch(TECH_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMsg.text || "What can you tell me about this?", vehicleId: vehicleId || null, organisationId: profile?.organisation_id, image: sentImage, history }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", text: data.answer || data.error || "Sorry, I couldn't answer that." }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", text: "Connection problem — try again." }]);
    }
    setLoading(false);
  };

  const quick = ["What was done on this unit last time?", "When is the next service due?", "How do I diagnose a unit not cooling?"];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"><Sparkles className="w-5 h-5 text-primary" /></div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-foreground">MARZ Assist</h2>
          <p className="text-xs text-muted-foreground">Ask about a unit, or send a photo for help</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground p-1"><X className="w-5 h-5" /></button>
      </div>

      {/* unit selector */}
      <div className="px-4 py-2 border-b border-border">
        <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground">
          <option value="">No specific unit (general help)</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.fridge_brand} {v.fridge_model}</option>)}
        </select>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">Pick a unit above, then ask anything — or snap a photo of a part you need help with.</p>
            <div className="space-y-2">
              {quick.map(q => (
                <button key={q} onClick={() => setInput(q)} className="w-full text-left text-sm bg-secondary/50 hover:bg-secondary text-foreground px-3 py-2.5 rounded-xl border border-border">{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
              {m.image && <img src={m.image} alt="" className="rounded-lg mb-2 max-h-40" />}
              <p className="text-sm whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-secondary rounded-2xl px-4 py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div></div>}
        <div ref={endRef} />
      </div>

      {/* input */}
      <div className="border-t border-border px-4 py-3 bg-card">
        {image && (
          <div className="relative inline-block mb-2">
            <img src={image} alt="" className="h-16 rounded-lg" />
            <button onClick={() => setImage(null)} className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={() => document.getElementById("tech-ai-photo")?.click()} className="text-muted-foreground p-2"><Camera className="w-5 h-5" /></button>
          <input id="tech-ai-photo" type="file" accept="image/*" capture="environment" className="hidden" onChange={pickImage} />
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask MARZ Assist..." className="flex-1 bg-secondary border border-border rounded-full px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={send} disabled={loading} className="bg-primary text-primary-foreground rounded-full p-2.5 disabled:opacity-50"><Send className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
}
