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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      citizen_verifications: {
        Row: {
          citizen_id: string
          complaint_id: string
          created_at: string
          deadline_at: string
          decided_at: string | null
          decision: string
          evidence_id: string | null
          id: string
          lat: number | null
          lng: number | null
          opened_at: string
          photo_path: string | null
          reason: string | null
          updated_at: string
        }
        Insert: {
          citizen_id: string
          complaint_id: string
          created_at?: string
          deadline_at: string
          decided_at?: string | null
          decision?: string
          evidence_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          opened_at?: string
          photo_path?: string | null
          reason?: string | null
          updated_at?: string
        }
        Update: {
          citizen_id?: string
          complaint_id?: string
          created_at?: string
          deadline_at?: string
          decided_at?: string | null
          decision?: string
          evidence_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          opened_at?: string
          photo_path?: string | null
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "citizen_verifications_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citizen_verifications_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "complaint_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_assignments: {
        Row: {
          accepted_at: string | null
          active: boolean
          arrived_at: string | null
          assigned_at: string
          complaint_id: string
          completed_at: string | null
          created_at: string
          dest_lat: number | null
          dest_lng: number | null
          id: string
          last_distance_m: number | null
          last_ping_at: string | null
          officer_id: string
          sla_deadline: string
          stage: string
          travel_started_at: string | null
          updated_at: string
          work_started_at: string | null
          worker_id: string
        }
        Insert: {
          accepted_at?: string | null
          active?: boolean
          arrived_at?: string | null
          assigned_at?: string
          complaint_id: string
          completed_at?: string | null
          created_at?: string
          dest_lat?: number | null
          dest_lng?: number | null
          id?: string
          last_distance_m?: number | null
          last_ping_at?: string | null
          officer_id: string
          sla_deadline: string
          stage?: string
          travel_started_at?: string | null
          updated_at?: string
          work_started_at?: string | null
          worker_id: string
        }
        Update: {
          accepted_at?: string | null
          active?: boolean
          arrived_at?: string | null
          assigned_at?: string
          complaint_id?: string
          completed_at?: string | null
          created_at?: string
          dest_lat?: number | null
          dest_lng?: number | null
          id?: string
          last_distance_m?: number | null
          last_ping_at?: string | null
          officer_id?: string
          sla_deadline?: string
          stage?: string
          travel_started_at?: string | null
          updated_at?: string
          work_started_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_assignments_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_comments: {
        Row: {
          body: string
          complaint_id: string
          created_at: string
          id: string
          pseudonym: string
          user_id: string
          ward_verified: boolean
        }
        Insert: {
          body: string
          complaint_id: string
          created_at?: string
          id?: string
          pseudonym: string
          user_id: string
          ward_verified?: boolean
        }
        Update: {
          body?: string
          complaint_id?: string
          created_at?: string
          id?: string
          pseudonym?: string
          user_id?: string
          ward_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "complaint_comments_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_events: {
        Row: {
          actor_label: string
          complaint_id: string
          created_at: string
          event_type: string
          id: string
          note: string | null
        }
        Insert: {
          actor_label: string
          complaint_id: string
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
        }
        Update: {
          actor_label?: string
          complaint_id?: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_events_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_evidence: {
        Row: {
          ai_confidence: number | null
          ai_explanation: string | null
          ai_observed_issue: string | null
          ai_relevance: string | null
          ai_state: string
          assignment_id: string | null
          complaint_id: string
          created_at: string
          description: string
          exif_distance_m: number | null
          exif_lat: number | null
          exif_lng: number | null
          exif_state: string
          gps_distance_m: number | null
          gps_state: string
          id: string
          image_path: string
          officer_decided_at: string | null
          officer_id: string | null
          officer_reason: string | null
          officer_state: string
          updated_at: string
          worker_id: string
          worker_lat: number | null
          worker_lng: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_explanation?: string | null
          ai_observed_issue?: string | null
          ai_relevance?: string | null
          ai_state?: string
          assignment_id?: string | null
          complaint_id: string
          created_at?: string
          description?: string
          exif_distance_m?: number | null
          exif_lat?: number | null
          exif_lng?: number | null
          exif_state?: string
          gps_distance_m?: number | null
          gps_state?: string
          id?: string
          image_path: string
          officer_decided_at?: string | null
          officer_id?: string | null
          officer_reason?: string | null
          officer_state?: string
          updated_at?: string
          worker_id: string
          worker_lat?: number | null
          worker_lng?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_explanation?: string | null
          ai_observed_issue?: string | null
          ai_relevance?: string | null
          ai_state?: string
          assignment_id?: string | null
          complaint_id?: string
          created_at?: string
          description?: string
          exif_distance_m?: number | null
          exif_lat?: number | null
          exif_lng?: number | null
          exif_state?: string
          gps_distance_m?: number | null
          gps_state?: string
          id?: string
          image_path?: string
          officer_decided_at?: string | null
          officer_id?: string | null
          officer_reason?: string | null
          officer_state?: string
          updated_at?: string
          worker_id?: string
          worker_lat?: number | null
          worker_lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_evidence_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "complaint_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_evidence_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_evidence_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_likes: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_likes_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_reposts: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_reposts_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          assigned_officer: string | null
          author_id: string
          author_pseudonym: string
          captured_at: string | null
          category: string
          clock_offset_hours: number
          complainant_approved: boolean | null
          created_at: string
          current_tier: string
          description: string
          escalated_at: string | null
          frozen_fake: boolean
          geo_verified: boolean
          id: string
          lat: number | null
          lng: number | null
          photo_url: string | null
          priority: Database["public"]["Enums"]["complaint_priority"]
          resolution_photo_url: string | null
          sla_hours: number
          status: Database["public"]["Enums"]["complaint_status"]
          street_address: string | null
          title: string
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          assigned_officer?: string | null
          author_id: string
          author_pseudonym: string
          captured_at?: string | null
          category: string
          clock_offset_hours?: number
          complainant_approved?: boolean | null
          created_at?: string
          current_tier?: string
          description: string
          escalated_at?: string | null
          frozen_fake?: boolean
          geo_verified?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          resolution_photo_url?: string | null
          sla_hours?: number
          status?: Database["public"]["Enums"]["complaint_status"]
          street_address?: string | null
          title: string
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          assigned_officer?: string | null
          author_id?: string
          author_pseudonym?: string
          captured_at?: string | null
          category?: string
          clock_offset_hours?: number
          complainant_approved?: boolean | null
          created_at?: string
          current_tier?: string
          description?: string
          escalated_at?: string | null
          frozen_fake?: boolean
          geo_verified?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          resolution_photo_url?: string | null
          sla_hours?: number
          status?: Database["public"]["Enums"]["complaint_status"]
          street_address?: string | null
          title?: string
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_alerts: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          lat: number
          lng: number
          radius_m: number
          severity: string
          title_en: string
          title_ta: string
          ward_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          lat: number
          lng: number
          radius_m?: number
          severity?: string
          title_en: string
          title_ta: string
          ward_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          lat?: number
          lng?: number
          radius_m?: number
          severity?: string
          title_en?: string
          title_ta?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_flags: {
        Row: {
          complaint_id: string
          created_at: string
          flagged_by: string
          id: string
          reason: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          flagged_by: string
          id?: string
          reason: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          flagged_by?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      judicial_overrides: {
        Row: {
          case_reference: string
          complaint_id: string | null
          created_at: string
          granted: boolean
          id: string
          reason: string | null
          requester_id: string
        }
        Insert: {
          case_reference: string
          complaint_id?: string | null
          created_at?: string
          granted: boolean
          id?: string
          reason?: string | null
          requester_id: string
        }
        Update: {
          case_reference?: string
          complaint_id?: string | null
          created_at?: string
          granted?: boolean
          id?: string
          reason?: string | null
          requester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judicial_overrides_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          read_at: string | null
          report_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          report_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          report_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "sla_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          digilocker_verified: boolean
          frozen: boolean
          id: string
          language: string
          pseudonym: string
          ward_id: string | null
        }
        Insert: {
          created_at?: string
          digilocker_verified?: boolean
          frozen?: boolean
          id: string
          language?: string
          pseudonym: string
          ward_id?: string | null
        }
        Update: {
          created_at?: string
          digilocker_verified?: boolean
          frozen?: boolean
          id?: string
          language?: string
          pseudonym?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      resolution_votes: {
        Row: {
          approve: boolean
          complaint_id: string
          created_at: string
          id: string
          voter_id: string
          zkp_token: string
        }
        Insert: {
          approve: boolean
          complaint_id: string
          created_at?: string
          id?: string
          voter_id: string
          zkp_token: string
        }
        Update: {
          approve?: boolean
          complaint_id?: string
          created_at?: string
          id?: string
          voter_id?: string
          zkp_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "resolution_votes_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_reports: {
        Row: {
          avg_resolution_hours: number | null
          breached_tickets: number
          created_at: string
          department_csv: string
          escalated_tickets: number
          generated_by: string
          id: string
          officer_csv: string
          period_end: string
          period_label: string
          period_start: string
          resolved_tickets: number
          sla_compliance_pct: number
          total_tickets: number
          ward_csv: string
        }
        Insert: {
          avg_resolution_hours?: number | null
          breached_tickets?: number
          created_at?: string
          department_csv?: string
          escalated_tickets?: number
          generated_by?: string
          id?: string
          officer_csv?: string
          period_end: string
          period_label: string
          period_start: string
          resolved_tickets?: number
          sla_compliance_pct?: number
          total_tickets?: number
          ward_csv?: string
        }
        Update: {
          avg_resolution_hours?: number | null
          breached_tickets?: number
          created_at?: string
          department_csv?: string
          escalated_tickets?: number
          generated_by?: string
          id?: string
          officer_csv?: string
          period_end?: string
          period_label?: string
          period_start?: string
          resolved_tickets?: number
          sla_compliance_pct?: number
          total_tickets?: number
          ward_csv?: string
        }
        Relationships: []
      }
      user_identities: {
        Row: {
          aadhaar_masked: string
          created_at: string
          digilocker_ref: string
          legal_name: string
          phone_encrypted: string
          user_id: string
        }
        Insert: {
          aadhaar_masked: string
          created_at?: string
          digilocker_ref: string
          legal_name: string
          phone_encrypted: string
          user_id: string
        }
        Update: {
          aadhaar_masked?: string
          created_at?: string
          digilocker_ref?: string
          legal_name?: string
          phone_encrypted?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          ward_id: string | null
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          ward_id?: string | null
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      wards: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          ulb_name_en: string
          ulb_name_ta: string
          ulb_type: Database["public"]["Enums"]["ulb_type"]
          ward_name_en: string
          ward_name_ta: string
          ward_number: number
          zone: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          ulb_name_en: string
          ulb_name_ta: string
          ulb_type: Database["public"]["Enums"]["ulb_type"]
          ward_name_en: string
          ward_name_ta: string
          ward_number: number
          zone: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          ulb_name_en?: string
          ulb_name_ta?: string
          ulb_type?: Database["public"]["Enums"]["ulb_type"]
          ward_name_en?: string
          ward_name_ta?: string
          ward_number?: number
          zone?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          active: boolean
          created_at: string
          department: string
          display_name: string
          id: string
          phone_masked: string | null
          updated_at: string
          user_id: string
          ward_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          department?: string
          display_name: string
          id?: string
          phone_masked?: string | null
          updated_at?: string
          user_id: string
          ward_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          department?: string
          display_name?: string
          id?: string
          phone_masked?: string | null
          updated_at?: string
          user_id?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_config: {
        Row: {
          description: string
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          description?: string
          key: string
          updated_at?: string
          value: number
        }
        Update: {
          description?: string
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      geo_distance_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      nearby_unresolved_complaints: {
        Args: {
          _category?: string
          _exclude?: string
          _lat: number
          _lng: number
          _radius_m?: number
        }
        Returns: {
          category: string
          created_at: string
          distance_m: number
          id: string
          lat: number
          lng: number
          priority: Database["public"]["Enums"]["complaint_priority"]
          status: Database["public"]["Enums"]["complaint_status"]
          title: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "citizen"
        | "field_officer"
        | "zonal_commissioner"
        | "commissioner"
        | "councillor"
        | "admin"
        | "worker"
      complaint_priority: "emergency" | "high" | "medium" | "low"
      complaint_status:
        | "submitted"
        | "assigned"
        | "in_progress"
        | "verification"
        | "resolved"
        | "escalated"
        | "joint_task_force"
        | "rejected"
        | "worker_accepted"
        | "travelling"
        | "arrived"
        | "evidence_submitted"
        | "officer_review"
        | "officer_approved"
        | "citizen_verification"
        | "reopened"
        | "auto_closed_no_response"
        | "resolved_by_citizen"
      ulb_type: "corporation" | "municipality" | "town_panchayat"
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
    Enums: {
      app_role: [
        "citizen",
        "field_officer",
        "zonal_commissioner",
        "commissioner",
        "councillor",
        "admin",
        "worker",
      ],
      complaint_priority: ["emergency", "high", "medium", "low"],
      complaint_status: [
        "submitted",
        "assigned",
        "in_progress",
        "verification",
        "resolved",
        "escalated",
        "joint_task_force",
        "rejected",
        "worker_accepted",
        "travelling",
        "arrived",
        "evidence_submitted",
        "officer_review",
        "officer_approved",
        "citizen_verification",
        "reopened",
        "auto_closed_no_response",
        "resolved_by_citizen",
      ],
      ulb_type: ["corporation", "municipality", "town_panchayat"],
    },
  },
} as const
