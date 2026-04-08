import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, Truck, FileText, Gauge } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { recalculateAllVehicleCompliance } from "@/lib/compliance";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Papa from "papaparse";

type ImportResult = { imported: number; skipped: number; errors: string[] };

const REG_ALIASES = ["reg", "registration", "vehicle reg", "reg no", "plate", "registration_number", "registration number"];
const KM_ALIASES = ["km", "odometer", "current km", "mileage", "kms", "current_odometer_km"];

function findColumn(headers: string[], aliases: string[]): string | null {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function parseFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => resolve(r.data as Record<string, string>[]),
        error: (e: Error) => reject(e),
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
        resolve(data);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
  });
}

// ─── KM Import Tab ─────────────────────────────────────────────
function KMImportTab() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<any[]>([]);
  const [regCol, setRegCol] = useState<string | null>(null);
  const [kmCol, setKmCol] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setResult(null);
    const data = await parseFile(file);
    if (!data.length) { toast.error("File is empty"); return; }
    const headers = Object.keys(data[0]);
    const r = findColumn(headers, REG_ALIASES);
    const k = findColumn(headers, KM_ALIASES);
    if (!r || !k) { toast.error(`Could not find registration or KM column. Found: ${headers.join(", ")}`); return; }
    setRegCol(r); setKmCol(k);
    const { data: vList } = await supabase.from("vehicles").select("id, registration_number, current_odometer_km");
    setVehicles(vList || []);
    const preview = data.map(row => {
      const reg = String(row[r]).trim().toUpperCase();
      const km = parseInt(String(row[k]).replace(/\D/g, "")) || 0;
      const match = (vList || []).find(v => v.registration_number.toUpperCase() === reg);
      return { reg, newKm: km, prevKm: match?.current_odometer_km ?? 0, change: km - (match?.current_odometer_km ?? 0), vehicleId: match?.id, found: !!match };
    });
    setRows(preview);
  }, []);

  const handleImport = async () => {
    setImporting(true); setProgress(0);
    let imported = 0, skipped = 0; const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.found) { skipped++; errors.push(`${row.reg}: not found`); }
      else if (row.change <= 0) { skipped++; }
      else {
        const { error } = await supabase.from("vehicles").update({ current_odometer_km: row.newKm }).eq("id", row.vehicleId);
        if (error) { errors.push(`${row.reg}: ${error.message}`); } else { imported++; }
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }
    await recalculateAllVehicleCompliance();
    qc.invalidateQueries({ queryKey: ["vehicles"] });
    setResult({ imported, skipped, errors });
    setImporting(false);
    toast.success(`Imported ${imported} KM readings`);
  };

  return (
    <div className="space-y-4">
      <DropZone onFile={handleFile} label="Upload KM readings (.xlsx, .csv)" />
      {rows.length > 0 && !result && (
        <>
          <div className="glass-card overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Reg Number</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">New KM</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Previous KM</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Change</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-4 py-2 font-mono text-foreground">{r.reg}</td>
                    <td className="px-4 py-2 text-right text-foreground">{r.newKm.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{r.prevKm.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${r.change > 0 ? "text-success" : r.change < 0 ? "text-destructive" : "text-muted-foreground"}`}>{r.change > 0 ? "+" : ""}{r.change.toLocaleString()}</td>
                    <td className="px-4 py-2 text-center">{!r.found ? <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">Not Found</span> : r.change <= 0 ? <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">No Change</span> : <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded">Ready</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {importing && <Progress value={progress} className="h-2" />}
          <button onClick={handleImport} disabled={importing} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><CheckCircle className="w-4 h-4" /> Confirm Import</>}
          </button>
        </>
      )}
      {result && <ResultSummary result={result} onReset={() => { setRows([]); setResult(null); }} />}
    </div>
  );
}

// ─── Certificate Import Tab ────────────────────────────────────
function CertImportTab() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const CERT_TYPE_ALIASES = ["cert type", "certificate type", "type", "certificate_type"];
  const CERT_NUM_ALIASES = ["cert number", "certificate number", "number", "certificate_number", "cert no"];
  const EXPIRY_ALIASES = ["expiry date", "expiry", "expiry_date", "expires", "exp date"];
  const AUTHORITY_ALIASES = ["issuing authority", "authority", "issuing_authority", "issuer", "issued by"];

  const handleFile = useCallback(async (file: File) => {
    setResult(null);
    const data = await parseFile(file);
    if (!data.length) { toast.error("File is empty"); return; }
    const headers = Object.keys(data[0]);
    const regC = findColumn(headers, REG_ALIASES);
    const typeC = findColumn(headers, CERT_TYPE_ALIASES);
    const numC = findColumn(headers, CERT_NUM_ALIASES);
    const expC = findColumn(headers, EXPIRY_ALIASES);
    const authC = findColumn(headers, AUTHORITY_ALIASES);
    if (!regC || !typeC) { toast.error(`Need at least Registration and Certificate Type columns. Found: ${headers.join(", ")}`); return; }
    const { data: vList } = await supabase.from("vehicles").select("id, registration_number");
    const now = new Date();
    const preview = data.map(row => {
      const reg = String(row[regC]).trim().toUpperCase();
      const certType = String(row[typeC]).trim();
      const certNum = numC ? String(row[numC]).trim() : "";
      const expiry = expC ? String(row[expC]).trim() : "";
      const authority = authC ? String(row[authC]).trim() : "";
      const match = (vList || []).find(v => v.registration_number.toUpperCase() === reg);
      let parsedExpiry = "";
      if (expiry) {
        const d = new Date(expiry);
        if (!isNaN(d.getTime())) parsedExpiry = d.toISOString().split("T")[0];
      }
      const days = parsedExpiry ? Math.ceil((new Date(parsedExpiry).getTime() - now.getTime()) / 86400000) : null;
      return { reg, certType, certNum, expiry: parsedExpiry, authority, vehicleId: match?.id, found: !!match, days, expired: days !== null && days <= 0 };
    });
    setRows(preview);
  }, []);

  const handleImport = async () => {
    if (!profile?.organisation_id) return;
    setImporting(true); setProgress(0);
    let imported = 0, skipped = 0; const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.found) { skipped++; errors.push(`${row.reg}: vehicle not found`); }
      else {
        const days = row.expiry ? Math.ceil((new Date(row.expiry).getTime() - Date.now()) / 86400000) : null;
        const status = days !== null ? (days <= 0 ? "expired" : days <= 30 ? "expiring" : "valid") : "valid";
        const { error } = await supabase.from("certificates").insert({
          organisation_id: profile.organisation_id,
          vehicle_id: row.vehicleId,
          certificate_type: row.certType,
          certificate_number: row.certNum || null,
          expiry_date: row.expiry || null,
          issuing_authority: row.authority || null,
          status,
          days_until_expiry: days,
        });
        if (error) { errors.push(`${row.reg}: ${error.message}`); } else { imported++; }
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }
    await recalculateAllVehicleCompliance();
    qc.invalidateQueries({ queryKey: ["certificates"] });
    qc.invalidateQueries({ queryKey: ["vehicles"] });
    setResult({ imported, skipped, errors });
    setImporting(false);
    toast.success(`Imported ${imported} certificates`);
  };

  return (
    <div className="space-y-4">
      <DropZone onFile={handleFile} label="Upload certificates (.xlsx, .csv)" />
      {rows.length > 0 && !result && (
        <>
          <div className="glass-card overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Reg</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Number</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Expiry</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Authority</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-border/50 ${r.expired ? "bg-destructive/5" : ""}`}>
                    <td className="px-4 py-2 font-mono text-foreground">{r.reg}</td>
                    <td className="px-4 py-2 text-foreground">{r.certType}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.certNum || "-"}</td>
                    <td className={`px-4 py-2 ${r.expired ? "text-destructive font-semibold" : "text-foreground"}`}>{r.expiry || "-"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.authority || "-"}</td>
                    <td className="px-4 py-2 text-center">{!r.found ? <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">Not Found</span> : r.expired ? <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">Expired</span> : <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded">Ready</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {importing && <Progress value={progress} className="h-2" />}
          <button onClick={handleImport} disabled={importing} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><CheckCircle className="w-4 h-4" /> Confirm Import</>}
          </button>
        </>
      )}
      {result && <ResultSummary result={result} onReset={() => { setRows([]); setResult(null); }} />}
    </div>
  );
}

// ─── Vehicle Import Tab ────────────────────────────────────────
function VehicleImportTab() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const FLEET_ALIASES = ["fleet number", "fleet no", "fleet_number", "fleet"];
  const MAKE_ALIASES = ["make", "manufacturer", "brand"];
  const MODEL_ALIASES = ["model"];
  const YEAR_ALIASES = ["year"];
  const VIN_ALIASES = ["vin", "vin_number", "vin number", "chassis"];
  const CUR_KM_ALIASES = ["current km", "km", "odometer", "current_odometer_km", "mileage"];
  const LAST_SVC_ALIASES = ["last service km", "last_service_km", "last service"];
  const NEXT_SVC_ALIASES = ["next service km", "next_service_due_km", "next service"];

  const handleFile = useCallback(async (file: File) => {
    setResult(null);
    const data = await parseFile(file);
    if (!data.length) { toast.error("File is empty"); return; }
    const headers = Object.keys(data[0]);
    const regC = findColumn(headers, REG_ALIASES);
    if (!regC) { toast.error(`Registration column not found. Found: ${headers.join(", ")}`); return; }
    const fleetC = findColumn(headers, FLEET_ALIASES);
    const makeC = findColumn(headers, MAKE_ALIASES);
    const modelC = findColumn(headers, MODEL_ALIASES);
    const yearC = findColumn(headers, YEAR_ALIASES);
    const vinC = findColumn(headers, VIN_ALIASES);
    const curKmC = findColumn(headers, CUR_KM_ALIASES);
    const lastSvcC = findColumn(headers, LAST_SVC_ALIASES);
    const nextSvcC = findColumn(headers, NEXT_SVC_ALIASES);
    const { data: existing } = await supabase.from("vehicles").select("registration_number");
    const existingRegs = new Set((existing || []).map(v => v.registration_number.toUpperCase()));
    const preview = data.map(row => {
      const reg = String(row[regC]).trim().toUpperCase();
      return {
        reg,
        fleet: fleetC ? String(row[fleetC]).trim() : "",
        make: makeC ? String(row[makeC]).trim() : "",
        model: modelC ? String(row[modelC]).trim() : "",
        year: yearC ? parseInt(String(row[yearC])) || null : null,
        vin: vinC ? String(row[vinC]).trim() : "",
        curKm: curKmC ? parseInt(String(row[curKmC]).replace(/\D/g, "")) || 0 : 0,
        lastSvc: lastSvcC ? parseInt(String(row[lastSvcC]).replace(/\D/g, "")) || 0 : 0,
        nextSvc: nextSvcC ? parseInt(String(row[nextSvcC]).replace(/\D/g, "")) || 0 : 0,
        duplicate: existingRegs.has(reg),
      };
    });
    setRows(preview);
  }, []);

  const handleImport = async () => {
    if (!profile?.organisation_id) return;
    setImporting(true); setProgress(0);
    let imported = 0, skipped = 0; const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.duplicate) { skipped++; errors.push(`${row.reg}: duplicate`); }
      else {
        const { error } = await supabase.from("vehicles").insert({
          organisation_id: profile.organisation_id,
          registration_number: row.reg,
          fleet_number: row.fleet || null,
          make: row.make || null,
          model: row.model || null,
          year: row.year,
          vin_number: row.vin || null,
          current_odometer_km: row.curKm,
          last_service_km: row.lastSvc,
          next_service_due_km: row.nextSvc,
        });
        if (error) { errors.push(`${row.reg}: ${error.message}`); } else { imported++; }
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }
    qc.invalidateQueries({ queryKey: ["vehicles"] });
    setResult({ imported, skipped, errors });
    setImporting(false);
    toast.success(`Imported ${imported} vehicles`);
  };

  return (
    <div className="space-y-4">
      <DropZone onFile={handleFile} label="Upload vehicles (.xlsx, .csv)" />
      {rows.length > 0 && !result && (
        <>
          <div className="glass-card overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Fleet</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Reg</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Make</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Model</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Year</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">VIN</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">KM</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-border/50 ${r.duplicate ? "bg-warning/5" : ""}`}>
                    <td className="px-3 py-2 text-foreground">{r.fleet || "-"}</td>
                    <td className="px-3 py-2 font-mono text-foreground">{r.reg}</td>
                    <td className="px-3 py-2 text-foreground">{r.make || "-"}</td>
                    <td className="px-3 py-2 text-foreground">{r.model || "-"}</td>
                    <td className="px-3 py-2 text-right text-foreground">{r.year || "-"}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{r.vin || "-"}</td>
                    <td className="px-3 py-2 text-right text-foreground">{r.curKm.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">{r.duplicate ? <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Duplicate</span> : <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded">Ready</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {importing && <Progress value={progress} className="h-2" />}
          <button onClick={handleImport} disabled={importing} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><CheckCircle className="w-4 h-4" /> Confirm Import</>}
          </button>
        </>
      )}
      {result && <ResultSummary result={result} onReset={() => { setRows([]); setResult(null); }} />}
    </div>
  );
}

// ─── Shared Components ─────────────────────────────────────────
function DropZone({ onFile, label }: { onFile: (f: File) => void; label: string }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
    >
      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <label className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:opacity-90">
        <FileSpreadsheet className="w-4 h-4" /> Choose File
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />
      </label>
    </div>
  );
}

function ResultSummary({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <div className="stat-card space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Import Complete</h3>
      <div className="flex gap-4">
        <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-success" /><span className="text-lg font-bold text-success">{result.imported}</span><span className="text-sm text-muted-foreground">imported</span></div>
        <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" /><span className="text-lg font-bold text-warning">{result.skipped}</span><span className="text-sm text-muted-foreground">skipped</span></div>
      </div>
      {result.errors.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View errors ({result.errors.length})</summary>
          <div className="mt-2 max-h-40 overflow-y-auto bg-secondary/50 rounded p-2 space-y-1">
            {result.errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
          </div>
        </details>
      )}
      <button onClick={onReset} className="text-sm text-primary hover:underline">Import another file</button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export default function DataImport() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data Import</h1>
        <p className="text-muted-foreground text-sm">Bulk import vehicles, KM readings, and certificates</p>
      </div>
      <Tabs defaultValue="km" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="km" className="flex items-center gap-2"><Gauge className="w-4 h-4" /> KM Readings</TabsTrigger>
          <TabsTrigger value="certs" className="flex items-center gap-2"><FileText className="w-4 h-4" /> Certificates</TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center gap-2"><Truck className="w-4 h-4" /> Vehicles</TabsTrigger>
        </TabsList>
        <TabsContent value="km"><KMImportTab /></TabsContent>
        <TabsContent value="certs"><CertImportTab /></TabsContent>
        <TabsContent value="vehicles"><VehicleImportTab /></TabsContent>
      </Tabs>
    </div>
  );
}
