import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  value: string;
  onChange: (branchId: string) => void;
}

export function BranchFilter({ value, onChange }: Props) {
  const { profile } = useAuth();

  const { data: branches } = useQuery({
    queryKey: ["branches", profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  // Branch managers are locked to their branch
  if (profile?.role === "branchmanager" && profile.branch_id) {
    return null; // Auto-filtered, no dropdown needed
  }

  if (!branches || branches.length <= 1) return null;

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">All Branches</option>
      {branches.map(b => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  );
}
