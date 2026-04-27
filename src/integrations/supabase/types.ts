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
      ai_conversations: {
        Row: {
          content: string
          created_at: string | null
          id: string
          organisation_id: string | null
          related_driver_id: string | null
          related_vehicle_id: string | null
          role: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          organisation_id?: string | null
          related_driver_id?: string | null
          related_vehicle_id?: string | null
          role: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          organisation_id?: string | null
          related_driver_id?: string | null
          related_vehicle_id?: string | null
          role?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_related_driver_id_fkey"
            columns: ["related_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_related_vehicle_id_fkey"
            columns: ["related_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
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
          certificate_category: string | null
          certificate_name: string | null
          certificate_number: string | null
          certificate_type: string
          created_at: string | null
          days_until_expiry: number | null
          expiry_date: string | null
          file_url: string | null
          id: string
          is_mandatory: boolean | null
          issue_date: string | null
          issuing_authority: string | null
          notes: string | null
          organisation_id: string | null
          reminder_sent_14_days: boolean | null
          reminder_sent_30_days: boolean | null
          reminder_sent_7_days: boolean | null
          renewal_cost: number | null
          renewed_by: string | null
          status: string | null
          updated_at: string | null
          uploaded_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          certificate_category?: string | null
          certificate_name?: string | null
          certificate_number?: string | null
          certificate_type: string
          created_at?: string | null
          days_until_expiry?: number | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          is_mandatory?: boolean | null
          issue_date?: string | null
          issuing_authority?: string | null
          notes?: string | null
          organisation_id?: string | null
          reminder_sent_14_days?: boolean | null
          reminder_sent_30_days?: boolean | null
          reminder_sent_7_days?: boolean | null
          renewal_cost?: number | null
          renewed_by?: string | null
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          certificate_category?: string | null
          certificate_name?: string | null
          certificate_number?: string | null
          certificate_type?: string
          created_at?: string | null
          days_until_expiry?: number | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          is_mandatory?: boolean | null
          issue_date?: string | null
          issuing_authority?: string | null
          notes?: string | null
          organisation_id?: string | null
          reminder_sent_14_days?: boolean | null
          reminder_sent_30_days?: boolean | null
          reminder_sent_7_days?: boolean | null
          renewal_cost?: number | null
          renewed_by?: string | null
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
      compliance_score_history: {
        Row: {
          created_at: string | null
          deduction_breakdown: Json | null
          driver_id: string | null
          id: string
          notes: string | null
          organisation_id: string | null
          score: number
          score_date: string
          score_type: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          deduction_breakdown?: Json | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          score: number
          score_date?: string
          score_type: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          deduction_breakdown?: Json | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          score?: number
          score_date?: string
          score_type?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_score_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_score_history_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_score_history_vehicle_id_fkey"
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
          repair_cost: number | null
          repair_date: string | null
          repair_notes: string | null
          repaired_by: string | null
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
          repair_cost?: number | null
          repair_date?: string | null
          repair_notes?: string | null
          repaired_by?: string | null
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
          repair_cost?: number | null
          repair_date?: string | null
          repair_notes?: string | null
          repaired_by?: string | null
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
          conducted_by: string | null
          created_at: string | null
          document_name: string | null
          document_number: string | null
          document_type: string | null
          driver_id: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          organisation_id: string | null
          status: string | null
          talk_topic: string | null
          uploaded_by: string | null
        }
        Insert: {
          conducted_by?: string | null
          created_at?: string | null
          document_name?: string | null
          document_number?: string | null
          document_type?: string | null
          driver_id?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          organisation_id?: string | null
          status?: string | null
          talk_topic?: string | null
          uploaded_by?: string | null
        }
        Update: {
          conducted_by?: string | null
          created_at?: string | null
          document_name?: string | null
          document_number?: string | null
          document_type?: string | null
          driver_id?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          organisation_id?: string | null
          status?: string | null
          talk_topic?: string | null
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
      driver_incidents: {
        Row: {
          actual_repair_cost: number | null
          branch_id: string | null
          closed_date: string | null
          corrective_action: string | null
          created_at: string | null
          description: string | null
          disciplinary_action: string | null
          driver_id: string | null
          estimated_damage_cost: number | null
          id: string
          incident_date: string
          incident_type: string
          injury_details: string | null
          injury_reported: boolean | null
          insurance_claim_number: string | null
          location: string | null
          notes: string | null
          organisation_id: string | null
          police_case_number: string | null
          preventable: boolean | null
          severity: string | null
          status: string | null
          third_party_details: string | null
          third_party_involved: boolean | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          actual_repair_cost?: number | null
          branch_id?: string | null
          closed_date?: string | null
          corrective_action?: string | null
          created_at?: string | null
          description?: string | null
          disciplinary_action?: string | null
          driver_id?: string | null
          estimated_damage_cost?: number | null
          id?: string
          incident_date?: string
          incident_type: string
          injury_details?: string | null
          injury_reported?: boolean | null
          insurance_claim_number?: string | null
          location?: string | null
          notes?: string | null
          organisation_id?: string | null
          police_case_number?: string | null
          preventable?: boolean | null
          severity?: string | null
          status?: string | null
          third_party_details?: string | null
          third_party_involved?: boolean | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          actual_repair_cost?: number | null
          branch_id?: string | null
          closed_date?: string | null
          corrective_action?: string | null
          created_at?: string | null
          description?: string | null
          disciplinary_action?: string | null
          driver_id?: string | null
          estimated_damage_cost?: number | null
          id?: string
          incident_date?: string
          incident_type?: string
          injury_details?: string | null
          injury_reported?: boolean | null
          insurance_claim_number?: string | null
          location?: string | null
          notes?: string | null
          organisation_id?: string | null
          police_case_number?: string | null
          preventable?: boolean | null
          severity?: string | null
          status?: string | null
          third_party_details?: string | null
          third_party_involved?: boolean | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_incidents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_incidents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          accidents_this_year: number | null
          address: string | null
          branch_id: string | null
          compliance_score: number | null
          created_at: string | null
          dangerous_goods_certified: boolean | null
          dangerous_goods_expiry: string | null
          date_of_birth: string | null
          defensive_driving_expiry: string | null
          demerit_points: number | null
          department: string | null
          email: string | null
          employee_number: string | null
          employment_start_date: string | null
          employment_status: string | null
          full_name: string
          id: string
          id_number: string | null
          induction_completed: boolean | null
          induction_date: string | null
          last_toolbox_talk_date: string | null
          licence_code: string | null
          licence_expiry: string | null
          licence_number: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          notes: string | null
          organisation_id: string | null
          performance_rating: string | null
          phone: string | null
          photo_url: string | null
          prdp_category: string | null
          prdp_expiry: string | null
          prdp_number: string | null
          shift_type: string | null
          total_demerits_this_year: number | null
          updated_at: string | null
          vehicle_types_authorised: string | null
        }
        Insert: {
          accidents_this_year?: number | null
          address?: string | null
          branch_id?: string | null
          compliance_score?: number | null
          created_at?: string | null
          dangerous_goods_certified?: boolean | null
          dangerous_goods_expiry?: string | null
          date_of_birth?: string | null
          defensive_driving_expiry?: string | null
          demerit_points?: number | null
          department?: string | null
          email?: string | null
          employee_number?: string | null
          employment_start_date?: string | null
          employment_status?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          induction_completed?: boolean | null
          induction_date?: string | null
          last_toolbox_talk_date?: string | null
          licence_code?: string | null
          licence_expiry?: string | null
          licence_number?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          notes?: string | null
          organisation_id?: string | null
          performance_rating?: string | null
          phone?: string | null
          photo_url?: string | null
          prdp_category?: string | null
          prdp_expiry?: string | null
          prdp_number?: string | null
          shift_type?: string | null
          total_demerits_this_year?: number | null
          updated_at?: string | null
          vehicle_types_authorised?: string | null
        }
        Update: {
          accidents_this_year?: number | null
          address?: string | null
          branch_id?: string | null
          compliance_score?: number | null
          created_at?: string | null
          dangerous_goods_certified?: boolean | null
          dangerous_goods_expiry?: string | null
          date_of_birth?: string | null
          defensive_driving_expiry?: string | null
          demerit_points?: number | null
          department?: string | null
          email?: string | null
          employee_number?: string | null
          employment_start_date?: string | null
          employment_status?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          induction_completed?: boolean | null
          induction_date?: string | null
          last_toolbox_talk_date?: string | null
          licence_code?: string | null
          licence_expiry?: string | null
          licence_number?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          notes?: string | null
          organisation_id?: string | null
          performance_rating?: string | null
          phone?: string | null
          photo_url?: string | null
          prdp_category?: string | null
          prdp_expiry?: string | null
          prdp_number?: string | null
          shift_type?: string | null
          total_demerits_this_year?: number | null
          updated_at?: string | null
          vehicle_types_authorised?: string | null
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
          dispute_date: string | null
          dispute_reason: string | null
          dispute_status: string | null
          driver_id: string | null
          enforcement_order: boolean | null
          enforcement_order_date: string | null
          fine_amount_rands: number | null
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
          redirect_date: string | null
          redirected_to_driver: boolean | null
          speed_recorded: number | null
          speed_zone_limit: number | null
          vehicle_id: string | null
        }
        Insert: {
          aarto_reference?: string | null
          amount?: number | null
          created_at?: string | null
          demerit_points_applied?: number | null
          dispute_date?: string | null
          dispute_reason?: string | null
          dispute_status?: string | null
          driver_id?: string | null
          enforcement_order?: boolean | null
          enforcement_order_date?: string | null
          fine_amount_rands?: number | null
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
          redirect_date?: string | null
          redirected_to_driver?: boolean | null
          speed_recorded?: number | null
          speed_zone_limit?: number | null
          vehicle_id?: string | null
        }
        Update: {
          aarto_reference?: string | null
          amount?: number | null
          created_at?: string | null
          demerit_points_applied?: number | null
          dispute_date?: string | null
          dispute_reason?: string | null
          dispute_status?: string | null
          driver_id?: string | null
          enforcement_order?: boolean | null
          enforcement_order_date?: string | null
          fine_amount_rands?: number | null
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
          redirect_date?: string | null
          redirected_to_driver?: boolean | null
          speed_recorded?: number | null
          speed_zone_limit?: number | null
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
      fuel_logs: {
        Row: {
          branch_id: string | null
          consumption_per_100km: number | null
          cost_per_litre: number | null
          created_at: string | null
          driver_id: string | null
          fuel_card_number: string | null
          fuel_date: string
          fuel_station: string | null
          fuel_type: string | null
          full_tank: boolean | null
          id: string
          litres_filled: number
          notes: string | null
          odometer_reading: number | null
          organisation_id: string | null
          total_cost: number | null
          vehicle_id: string | null
        }
        Insert: {
          branch_id?: string | null
          consumption_per_100km?: number | null
          cost_per_litre?: number | null
          created_at?: string | null
          driver_id?: string | null
          fuel_card_number?: string | null
          fuel_date?: string
          fuel_station?: string | null
          fuel_type?: string | null
          full_tank?: boolean | null
          id?: string
          litres_filled: number
          notes?: string | null
          odometer_reading?: number | null
          organisation_id?: string | null
          total_cost?: number | null
          vehicle_id?: string | null
        }
        Update: {
          branch_id?: string | null
          consumption_per_100km?: number | null
          cost_per_litre?: number | null
          created_at?: string | null
          driver_id?: string | null
          fuel_card_number?: string | null
          fuel_date?: string
          fuel_station?: string | null
          fuel_type?: string | null
          full_tank?: boolean | null
          id?: string
          litres_filled?: number
          notes?: string | null
          odometer_reading?: number | null
          organisation_id?: string | null
          total_cost?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cards: {
        Row: {
          approved_by: string | null
          breakdown_location: string | null
          completed_date: string | null
          created_at: string | null
          description: string | null
          downtime_hours: number | null
          driver_id: string | null
          id: string
          invoice_file_url: string | null
          invoice_number: string | null
          is_breakdown: boolean | null
          job_card_number: string | null
          job_priority: string | null
          job_type: string
          labour_cost: number | null
          odometer_reading: number | null
          organisation_id: string | null
          parts_cost: number | null
          parts_replaced: string | null
          purchase_order_number: string | null
          status: string
          total_cost: number | null
          updated_at: string | null
          vehicle_id: string
          vehicle_km_at_completion: number | null
          warranty_claim: boolean | null
          work_date: string
          workshop_contact: string | null
          workshop_name: string | null
        }
        Insert: {
          approved_by?: string | null
          breakdown_location?: string | null
          completed_date?: string | null
          created_at?: string | null
          description?: string | null
          downtime_hours?: number | null
          driver_id?: string | null
          id?: string
          invoice_file_url?: string | null
          invoice_number?: string | null
          is_breakdown?: boolean | null
          job_card_number?: string | null
          job_priority?: string | null
          job_type?: string
          labour_cost?: number | null
          odometer_reading?: number | null
          organisation_id?: string | null
          parts_cost?: number | null
          parts_replaced?: string | null
          purchase_order_number?: string | null
          status?: string
          total_cost?: number | null
          updated_at?: string | null
          vehicle_id: string
          vehicle_km_at_completion?: number | null
          warranty_claim?: boolean | null
          work_date?: string
          workshop_contact?: string | null
          workshop_name?: string | null
        }
        Update: {
          approved_by?: string | null
          breakdown_location?: string | null
          completed_date?: string | null
          created_at?: string | null
          description?: string | null
          downtime_hours?: number | null
          driver_id?: string | null
          id?: string
          invoice_file_url?: string | null
          invoice_number?: string | null
          is_breakdown?: boolean | null
          job_card_number?: string | null
          job_priority?: string | null
          job_type?: string
          labour_cost?: number | null
          odometer_reading?: number | null
          organisation_id?: string | null
          parts_cost?: number | null
          parts_replaced?: string | null
          purchase_order_number?: string | null
          status?: string
          total_cost?: number | null
          updated_at?: string | null
          vehicle_id?: string
          vehicle_km_at_completion?: number | null
          warranty_claim?: boolean | null
          work_date?: string
          workshop_contact?: string | null
          workshop_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          assigned_workshop: string | null
          branch_id: string | null
          created_at: string | null
          days_remaining: number | null
          description: string | null
          estimated_cost: number | null
          id: string
          interval_days: number | null
          interval_hours: number | null
          interval_km: number | null
          is_active: boolean | null
          km_remaining: number | null
          last_done_date: string | null
          last_done_hours: number | null
          last_done_km: number | null
          next_due_date: string | null
          next_due_hours: number | null
          next_due_km: number | null
          notes: string | null
          organisation_id: string | null
          priority: string | null
          service_type: string
          status: string | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          assigned_workshop?: string | null
          branch_id?: string | null
          created_at?: string | null
          days_remaining?: number | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          interval_km?: number | null
          is_active?: boolean | null
          km_remaining?: number | null
          last_done_date?: string | null
          last_done_hours?: number | null
          last_done_km?: number | null
          next_due_date?: string | null
          next_due_hours?: number | null
          next_due_km?: number | null
          notes?: string | null
          organisation_id?: string | null
          priority?: string | null
          service_type: string
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          assigned_workshop?: string | null
          branch_id?: string | null
          created_at?: string | null
          days_remaining?: number | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          interval_km?: number | null
          is_active?: boolean | null
          km_remaining?: number | null
          last_done_date?: string | null
          last_done_hours?: number | null
          last_done_km?: number | null
          next_due_date?: string | null
          next_due_hours?: number | null
          next_due_km?: number | null
          notes?: string | null
          organisation_id?: string | null
          priority?: string | null
          service_type?: string
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      odometer_history: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          odometer_km: number
          organisation_id: string | null
          reading_date: string
          recorded_by: string | null
          source: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          odometer_km: number
          organisation_id?: string | null
          reading_date?: string
          recorded_by?: string | null
          source?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          odometer_km?: number
          organisation_id?: string | null
          reading_date?: string
          recorded_by?: string | null
          source?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "odometer_history_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odometer_history_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odometer_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      odometer_readings: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          organisation_id: string | null
          reading_date: string
          reading_km: number
          recorded_by: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          reading_date?: string
          reading_km: number
          recorded_by?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          reading_date?: string
          reading_km?: number
          recorded_by?: string | null
          vehicle_id?: string
        }
        Relationships: []
      }
      organisations: {
        Row: {
          compliance_settings: Json
          created_at: string | null
          data_region: string | null
          data_retention_days: number | null
          id: string
          logo_url: string | null
          name: string
          popia_compliant: boolean | null
          popia_consent_date: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          registration_number: string | null
          security_tier: string | null
          subscription_plan: string | null
          subscription_status: string | null
        }
        Insert: {
          compliance_settings?: Json
          created_at?: string | null
          data_region?: string | null
          data_retention_days?: number | null
          id?: string
          logo_url?: string | null
          name: string
          popia_compliant?: boolean | null
          popia_consent_date?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          registration_number?: string | null
          security_tier?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
        }
        Update: {
          compliance_settings?: Json
          created_at?: string | null
          data_region?: string | null
          data_retention_days?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          popia_compliant?: boolean | null
          popia_consent_date?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          registration_number?: string | null
          security_tier?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          attempts: number | null
          blocked_until: string | null
          created_at: string | null
          id: string
          identifier: string
          window_start: string | null
        }
        Insert: {
          action: string
          attempts?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier: string
          window_start?: string | null
        }
        Update: {
          action?: string
          attempts?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier?: string
          window_start?: string | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          organisation_id: string | null
          resource_id: string | null
          resource_type: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          organisation_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          organisation_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      toolbox_talks: {
        Row: {
          conducted_by: string | null
          created_at: string | null
          date_conducted: string
          driver_id: string
          file_url: string | null
          id: string
          organisation_id: string | null
          topic: string
        }
        Insert: {
          conducted_by?: string | null
          created_at?: string | null
          date_conducted?: string
          driver_id: string
          file_url?: string | null
          id?: string
          organisation_id?: string | null
          topic: string
        }
        Update: {
          conducted_by?: string | null
          created_at?: string | null
          date_conducted?: string
          driver_id?: string
          file_url?: string | null
          id?: string
          organisation_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_talks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toolbox_talks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      tyre_management: {
        Row: {
          branch_id: string | null
          condition: string | null
          cost_per_tyre: number | null
          created_at: string | null
          current_km: number | null
          date_fitted: string | null
          date_removed: string | null
          id: string
          km_at_fitting: number | null
          km_at_removal: number | null
          km_travelled: number | null
          notes: string | null
          organisation_id: string | null
          removal_reason: string | null
          serial_number: string | null
          status: string | null
          supplier: string | null
          tread_depth_mm: number | null
          tyre_brand: string | null
          tyre_position: string
          tyre_size: string | null
          updated_at: string | null
          vehicle_id: string | null
          warranty_km: number | null
        }
        Insert: {
          branch_id?: string | null
          condition?: string | null
          cost_per_tyre?: number | null
          created_at?: string | null
          current_km?: number | null
          date_fitted?: string | null
          date_removed?: string | null
          id?: string
          km_at_fitting?: number | null
          km_at_removal?: number | null
          km_travelled?: number | null
          notes?: string | null
          organisation_id?: string | null
          removal_reason?: string | null
          serial_number?: string | null
          status?: string | null
          supplier?: string | null
          tread_depth_mm?: number | null
          tyre_brand?: string | null
          tyre_position: string
          tyre_size?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          warranty_km?: number | null
        }
        Update: {
          branch_id?: string | null
          condition?: string | null
          cost_per_tyre?: number | null
          created_at?: string | null
          current_km?: number | null
          date_fitted?: string | null
          date_removed?: string | null
          id?: string
          km_at_fitting?: number | null
          km_at_removal?: number | null
          km_travelled?: number | null
          notes?: string | null
          organisation_id?: string | null
          removal_reason?: string | null
          serial_number?: string | null
          status?: string | null
          supplier?: string | null
          tread_depth_mm?: number | null
          tyre_brand?: string | null
          tyre_position?: string
          tyre_size?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          warranty_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tyre_management_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyre_management_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyre_management_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_locked: boolean | null
          branch_id: string | null
          created_at: string | null
          email: string | null
          failed_login_attempts: number | null
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          last_login_at: string | null
          last_login_ip: string | null
          mfa_enabled: boolean | null
          organisation_id: string | null
          phone: string | null
          role: string | null
        }
        Insert: {
          account_locked?: boolean | null
          branch_id?: string | null
          created_at?: string | null
          email?: string | null
          failed_login_attempts?: number | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          last_login?: string | null
          last_login_at?: string | null
          last_login_ip?: string | null
          mfa_enabled?: boolean | null
          organisation_id?: string | null
          phone?: string | null
          role?: string | null
        }
        Update: {
          account_locked?: boolean | null
          branch_id?: string | null
          created_at?: string | null
          email?: string | null
          failed_login_attempts?: number | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          last_login_at?: string | null
          last_login_ip?: string | null
          mfa_enabled?: boolean | null
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
      vehicle_service_trackers: {
        Row: {
          created_at: string | null
          id: string
          interval_value: number
          last_done_date: string | null
          last_done_value: number | null
          next_due_date: string | null
          next_due_value: number | null
          notes: string | null
          organisation_id: string | null
          tracker_name: string
          tracking_type: string
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interval_value: number
          last_done_date?: string | null
          last_done_value?: number | null
          next_due_date?: string | null
          next_due_value?: number | null
          notes?: string | null
          organisation_id?: string | null
          tracker_name: string
          tracking_type?: string
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interval_value?: number
          last_done_date?: string | null
          last_done_value?: number | null
          next_due_date?: string | null
          next_due_value?: number | null
          notes?: string | null
          organisation_id?: string | null
          tracker_name?: string
          tracking_type?: string
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_status: {
        Row: {
          actual_return_date: string | null
          comments: string | null
          date_sent_for_repair: string | null
          estimated_return_date: string | null
          id: string
          organisation_id: string | null
          repair_cost: number | null
          repair_description: string | null
          status: string
          updated_at: string | null
          updated_by: string | null
          vehicle_id: string
          workshop_contact: string | null
          workshop_name: string | null
        }
        Insert: {
          actual_return_date?: string | null
          comments?: string | null
          date_sent_for_repair?: string | null
          estimated_return_date?: string | null
          id?: string
          organisation_id?: string | null
          repair_cost?: number | null
          repair_description?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id: string
          workshop_contact?: string | null
          workshop_name?: string | null
        }
        Update: {
          actual_return_date?: string | null
          comments?: string | null
          date_sent_for_repair?: string | null
          estimated_return_date?: string | null
          id?: string
          organisation_id?: string | null
          repair_cost?: number | null
          repair_description?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string
          workshop_contact?: string | null
          workshop_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_status_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_status_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_status_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          assigned_driver_id: string | null
          average_fuel_consumption: number | null
          branch_id: string | null
          client_name: string | null
          colour: string | null
          compliance_score: number | null
          compliance_status: string | null
          compliance_template_id: string | null
          contract_number: string | null
          created_at: string | null
          current_odometer_km: number | null
          current_value: number | null
          engine_number: string | null
          engine_type: string | null
          equipment: Json | null
          equipment_compliance_score: number | null
          equipment_list: Json | null
          fleet_number: string | null
          fuel_type: string | null
          gross_vehicle_mass_kg: number | null
          home_base: string | null
          id: string
          insurance_company: string | null
          insurance_expiry: string | null
          insurance_policy_number: string | null
          is_active: boolean | null
          km_until_service: number | null
          last_fuel_reading_litres: number | null
          last_odometer_update: string | null
          last_service_km: number | null
          make: string | null
          model: string | null
          next_service_due_km: number | null
          notes: string | null
          number_of_axles: number | null
          operating_area: string | null
          organisation_id: string | null
          payload_capacity_kg: number | null
          purchase_date: string | null
          purchase_price: number | null
          registration_number: string
          risk_score: number | null
          tare_weight_kg: number | null
          total_fuel_cost: number | null
          tracker_company: string | null
          tracker_installed: boolean | null
          tracker_unit_id: string | null
          transmission_type: string | null
          tyre_size: string | null
          updated_at: string | null
          vehicle_type: string | null
          vin_number: string | null
          year: number | null
        }
        Insert: {
          assigned_driver_id?: string | null
          average_fuel_consumption?: number | null
          branch_id?: string | null
          client_name?: string | null
          colour?: string | null
          compliance_score?: number | null
          compliance_status?: string | null
          compliance_template_id?: string | null
          contract_number?: string | null
          created_at?: string | null
          current_odometer_km?: number | null
          current_value?: number | null
          engine_number?: string | null
          engine_type?: string | null
          equipment?: Json | null
          equipment_compliance_score?: number | null
          equipment_list?: Json | null
          fleet_number?: string | null
          fuel_type?: string | null
          gross_vehicle_mass_kg?: number | null
          home_base?: string | null
          id?: string
          insurance_company?: string | null
          insurance_expiry?: string | null
          insurance_policy_number?: string | null
          is_active?: boolean | null
          km_until_service?: number | null
          last_fuel_reading_litres?: number | null
          last_odometer_update?: string | null
          last_service_km?: number | null
          make?: string | null
          model?: string | null
          next_service_due_km?: number | null
          notes?: string | null
          number_of_axles?: number | null
          operating_area?: string | null
          organisation_id?: string | null
          payload_capacity_kg?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          registration_number: string
          risk_score?: number | null
          tare_weight_kg?: number | null
          total_fuel_cost?: number | null
          tracker_company?: string | null
          tracker_installed?: boolean | null
          tracker_unit_id?: string | null
          transmission_type?: string | null
          tyre_size?: string | null
          updated_at?: string | null
          vehicle_type?: string | null
          vin_number?: string | null
          year?: number | null
        }
        Update: {
          assigned_driver_id?: string | null
          average_fuel_consumption?: number | null
          branch_id?: string | null
          client_name?: string | null
          colour?: string | null
          compliance_score?: number | null
          compliance_status?: string | null
          compliance_template_id?: string | null
          contract_number?: string | null
          created_at?: string | null
          current_odometer_km?: number | null
          current_value?: number | null
          engine_number?: string | null
          engine_type?: string | null
          equipment?: Json | null
          equipment_compliance_score?: number | null
          equipment_list?: Json | null
          fleet_number?: string | null
          fuel_type?: string | null
          gross_vehicle_mass_kg?: number | null
          home_base?: string | null
          id?: string
          insurance_company?: string | null
          insurance_expiry?: string | null
          insurance_policy_number?: string | null
          is_active?: boolean | null
          km_until_service?: number | null
          last_fuel_reading_litres?: number | null
          last_odometer_update?: string | null
          last_service_km?: number | null
          make?: string | null
          model?: string | null
          next_service_due_km?: number | null
          notes?: string | null
          number_of_axles?: number | null
          operating_area?: string | null
          organisation_id?: string | null
          payload_capacity_kg?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          registration_number?: string
          risk_score?: number | null
          tare_weight_kg?: number | null
          total_fuel_cost?: number | null
          tracker_company?: string | null
          tracker_installed?: boolean | null
          tracker_unit_id?: string | null
          transmission_type?: string | null
          tyre_size?: string | null
          updated_at?: string | null
          vehicle_type?: string | null
          vin_number?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
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
      cleanup_rate_limits: { Args: never; Returns: undefined }
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
