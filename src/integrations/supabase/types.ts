export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alerts_log: {
        Row: {
          alert_type: string | null
          id: string
          linked_to_id: string | null
          linked_to_type: string | null
          message: string | null
          organisation_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          sent_at: string | null
          sent_via: string | null
        }
        Insert: {
          alert_type?: string | null
          id?: string
          linked_to_id?: string | null
          linked_to_type?: string | null
          message?: string | null
          organisation_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          sent_at?: string | null
          sent_via?: string | null
        }
        Update: {
          alert_type?: string | null
          id?: string
          linked_to_id?: string | null
          linked_to_type?: string | null
          message?: string | null
          organisation_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          sent_at?: string | null
          sent_via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_log_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_log_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          organisation_id: string | null
          record_id: string | null
          table_name: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          organisation_id?: string | null
          record_id?: string | null
          table_name?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          organisation_id?: string | null
          record_id?: string | null
          table_name?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          id: string
          manager_email: string | null
          manager_name: string | null
          manager_phone: string | null
          name: string
          organisation_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          name: string
          organisation_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          name?: string
          organisation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_name: string | null
          certificate_number: string | null
          certificate_type: string
          created_at: string | null
          days_until_expiry: number | null
          expiry_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          issuing_authority: string | null
          notes: string | null
          organisation_id: string | null
          status: string | null
          updated_at: string | null
          uploaded_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          certificate_name?: string | null
          certificate_number?: string | null
          certificate_type: string
          created_at?: string | null
          days_until_expiry?: number | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          notes?: string | null
          organisation_id?: string | null
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          certificate_name?: string | null
          certificate_number?: string | null
          certificate_type?: string
          created_at?: string | null
          days_until_expiry?: number | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          notes?: string | null
          organisation_id?: string | null
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_custom: boolean | null
          organisation_id: string | null
          required_certificates: Json | null
          template_name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_custom?: boolean | null
          organisation_id?: string | null
          required_certificates?: Json | null
          template_name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_custom?: boolean | null
          organisation_id?: string | null
          required_certificates?: Json | null
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_templates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          created_at: string | null
          custom_field_id: string | null
          id: string
          organisation_id: string | null
          record_id: string | null
          record_type: string | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          custom_field_id?: string | null
          id?: string
          organisation_id?: string | null
          record_id?: string | null
          record_type?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          custom_field_id?: string | null
          id?: string
          organisation_id?: string | null
          record_id?: string | null
          record_type?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          applies_to: string | null
          created_at: string | null
          display_order: number | null
          dropdown_options: Json | null
          field_name: string
          field_type: string | null
          id: string
          is_required: boolean | null
          organisation_id: string | null
        }
        Insert: {
          applies_to?: string | null
          created_at?: string | null
          display_order?: number | null
          dropdown_options?: Json | null
          field_name: string
          field_type?: string | null
          id?: string
          is_required?: boolean | null
          organisation_id?: string | null
        }
        Update: {
          applies_to?: string | null
          created_at?: string | null
          display_order?: number | null
          dropdown_options?: Json | null
          field_name?: string
          field_type?: string | null
          id?: string
          is_required?: boolean | null
          organisation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_inspections: {
        Row: {
          branch_id: string | null
          created_at: string | null
          has_critical_damage: boolean | null
          id: string
          inspection_date: string | null
          inspector_id: string | null
          inspector_signature_url: string | null
          new_damage_items: number | null
          notes: string | null
          odometer_at_inspection: number | null
          organisation_id: string | null
          overall_condition: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          total_damage_items: number | null
          vehicle_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          has_critical_damage?: boolean | null
          id?: string
          inspection_date?: string | null
          inspector_id?: string | null
          inspector_signature_url?: string | null
          new_damage_items?: number | null
          notes?: string | null
          odometer_at_inspection?: number | null
          organisation_id?: string | null
          overall_condition?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          total_damage_items?: number | null
          vehicle_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          has_critical_damage?: boolean | null
          id?: string
          inspection_date?: string | null
          inspector_id?: string | null
          inspector_signature_url?: string | null
          new_damage_items?: number | null
          notes?: string | null
          odometer_at_inspection?: number | null
          organisation_id?: string | null
          overall_condition?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          total_damage_items?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_inspections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_inspections_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_inspections_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_items: {
        Row: {
          action_taken: string | null
          created_at: string | null
          damage_type: string | null
          description: string | null
          id: string
          inspection_id: string | null
          is_new_damage: boolean | null
          location: string | null
          organisation_id: string | null
          photo_urls: Json | null
          requires_immediate_action: boolean | null
          resolved: boolean | null
          resolved_at: string | null
          severity: string | null
          vehicle_id: string | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          damage_type?: string | null
          description?: string | null
          id?: string
          inspection_id?: string | null
          is_new_damage?: boolean | null
          location?: string | null
          organisation_id?: string | null
          photo_urls?: Json | null
          requires_immediate_action?: boolean | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          vehicle_id?: string | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          damage_type?: string | null
          description?: string | null
          id?: string
          inspection_id?: string | null
          is_new_damage?: boolean | null
          location?: string | null
          organisation_id?: string | null
          photo_urls?: Json | null
          requires_immediate_action?: boolean | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "damage_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_items_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string | null
          document_name: string | null
          document_number: string | null
          document_type: string | null
          driver_id: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          organisation_id: string | null
          status: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_name?: string | null
          document_number?: string | null
          document_type?: string | null
          driver_id?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          organisation_id?: string | null
          status?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_name?: string | null
          document_number?: string | null
          document_type?: string | null
          driver_id?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          organisation_id?: string | null
          status?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          branch_id: string | null
          created_at: string | null
          demerit_points: number | null
          email: string | null
          employment_status: string | null
          full_name: string
          id: string
          id_number: string | null
          licence_code: string | null
          licence_expiry: string | null
          licence_number: string | null
          notes: string | null
          organisation_id: string | null
          phone: string | null
          photo_url: string | null
          prdp_category: string | null
          prdp_expiry: string | null
          prdp_number: string | null
          shift_type: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          demerit_points?: number | null
          email?: string | null
          employment_status?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          licence_code?: string | null
          licence_expiry?: string | null
          licence_number?: string | null
          notes?: string | null
          organisation_id?: string | null
          phone?: string | null
          photo_url?: string | null
          prdp_category?: string | null
          prdp_expiry?: string | null
          prdp_number?: string | null
          shift_type?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          demerit_points?: number | null
          email?: string | null
          employment_status?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          licence_code?: string | null
          licence_expiry?: string | null
          licence_number?: string | null
          notes?: string | null
          organisation_id?: string | null
          phone?: string | null
          photo_url?: string | null
          prdp_category?: string | null
          prdp_expiry?: string | null
          prdp_number?: string | null
          shift_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      fines: {
        Row: {
          aarto_reference: string | null
          amount: number | null
          created_at: string | null
          demerit_points_applied: number | null
          driver_id: string | null
          fine_number: string | null
          id: string
          issuing_authority: string | null
          notes: string | null
          offence_date: string | null
          offence_description: string | null
          organisation_id: string | null
          payment_amount: number | null
          payment_date: string | null
          payment_status: string | null
          vehicle_id: string | null
        }
        Insert: {
          aarto_reference?: string | null
          amount?: number | null
          created_at?: string | null
          demerit_points_applied?: number | null
          driver_id?: string | null
          fine_number?: string | null
          id?: string
          issuing_authority?: string | null
          notes?: string | null
          offence_date?: string | null
          offence_description?: string | null
          organisation_id?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_status?: string | null
          vehicle_id?: string | null
        }
        Update: {
          aarto_reference?: string | null
          amount?: number | null
          created_at?: string | null
          demerit_points_applied?: number | null
          driver_id?: string | null
          fine_number?: string | null
          id?: string
          issuing_authority?: string | null
          notes?: string | null
          offence_date?: string | null
          offence_description?: string | null
          organisation_id?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_status?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fines_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          registration_number: string | null
          subscription_plan: string | null
          subscription_status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          registration_number?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          registration_number?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          branch_id: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          organisation_id: string | null
          phone: string | null
          role: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          last_login?: string | null
          organisation_id?: string | null
          phone?: string | null
          role?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          organisation_id?: string | null
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          branch_id: string | null
          colour: string | null
          compliance_status: string | null
          compliance_template_id: string | null
          created_at: string | null
          current_odometer_km: number | null
          fleet_number: string | null
          id: string
          is_active: boolean | null
          km_until_service: number | null
          last_service_km: number | null
          make: string | null
          model: string | null
          next_service_due_km: number | null
          notes: string | null
          organisation_id: string | null
          registration_number: string
          risk_score: number | null
          updated_at: string | null
          vehicle_type: string | null
          vin_number: string | null
          year: number | null
        }
        Insert: {
          branch_id?: string | null
          colour?: string | null
          compliance_status?: string | null
          compliance_template_id?: string | null
          created_at?: string | null
          current_odometer_km?: number | null
          fleet_number?: string | null
          id?: string
          is_active?: boolean | null
          km_until_service?: number | null
          last_service_km?: number | null
          make?: string | null
          model?: string | null
          next_service_due_km?: number | null
          notes?: string | null
          organisation_id?: string | null
          registration_number: string
          risk_score?: number | null
          updated_at?: string | null
          vehicle_type?: string | null
          vin_number?: string | null
          year?: number | null
        }
        Update: {
          branch_id?: string | null
          colour?: string | null
          compliance_status?: string | null
          compliance_template_id?: string | null
          created_at?: string | null
          current_odometer_km?: number | null
          fleet_number?: string | null
          id?: string
          is_active?: boolean | null
          km_until_service?: number | null
          last_service_km?: number | null
          make?: string | null
          model?: string | null
          next_service_due_km?: number | null
          notes?: string | null
          organisation_id?: string | null
          registration_number?: string
          risk_score?: number | null
          updated_at?: string | null
          vehicle_type?: string | null
          vin_number?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_compliance_template_id_fkey"
            columns: ["compliance_template_id"]
            isOneToOne: false
            referencedRelation: "compliance_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_organisation_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
