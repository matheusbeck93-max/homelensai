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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alert_events: {
        Row: {
          created_at: string
          id: string
          message: string
          property_id: string
          property_snapshot: Json
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          property_id: string
          property_snapshot: Json
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          property_id?: string
          property_snapshot?: Json
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_preferences: {
        Row: {
          channels: Json
          created_at: string
          enabled: boolean
          frequency: string
          id: string
          last_run_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channels?: Json
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channels?: Json
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analyses: {
        Row: {
          analysis_json: Json | null
          created_at: string | null
          id: string
          pdf_url: string | null
          property_id: string
          user_id: string
        }
        Insert: {
          analysis_json?: Json | null
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          property_id: string
          user_id: string
        }
        Update: {
          analysis_json?: Json | null
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compare_sets: {
        Row: {
          created_at: string
          id: string
          property_ids: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_ids?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_ids?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      market_metrics: {
        Row: {
          created_at: string | null
          days_on_market: number | null
          geo_id: string
          id: string
          inventory: number | null
          list_to_sale_ratio: number | null
          month: string
          price_sqft: number | null
        }
        Insert: {
          created_at?: string | null
          days_on_market?: number | null
          geo_id: string
          id?: string
          inventory?: number | null
          list_to_sale_ratio?: number | null
          month: string
          price_sqft?: number | null
        }
        Update: {
          created_at?: string | null
          days_on_market?: number | null
          geo_id?: string
          id?: string
          inventory?: number | null
          list_to_sale_ratio?: number | null
          month?: string
          price_sqft?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_properties: {
        Row: {
          added_at: string
          created_at: string | null
          down_payment_pct: number
          id: string
          interest_rate_pct: number
          loan_term_years: number
          monthly_expenses: number
          monthly_rent: number
          notes: string | null
          property_id: string
          purchase_price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          created_at?: string | null
          down_payment_pct?: number
          id?: string
          interest_rate_pct?: number
          loan_term_years?: number
          monthly_expenses?: number
          monthly_rent?: number
          notes?: string | null
          property_id: string
          purchase_price: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          created_at?: string | null
          down_payment_pct?: number
          id?: string
          interest_rate_pct?: number
          loan_term_years?: number
          monthly_expenses?: number
          monthly_rent?: number
          notes?: string | null
          property_id?: string
          purchase_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alert_email_enabled: boolean | null
          alert_price_drops: boolean | null
          alert_status_changes: boolean | null
          budget_max: number | null
          budget_min: number | null
          buyer_type: string | null
          commute_preferences: Json | null
          created_at: string | null
          daily_analysis_count: number | null
          daily_analysis_last_reset: string | null
          desired_monthly_payment: number | null
          email: string | null
          full_name: string | null
          id: string
          location_preferences: Json | null
          max_price_range: number | null
          min_bedrooms: number | null
          onboarding_completed: boolean | null
          preferred_cities: string[] | null
          property_types: string[] | null
          risk_level: string | null
          subscription_cancel_at: string | null
          subscription_renews_at: string | null
          subscription_status: string | null
          updated_at: string | null
          user_profile: string | null
          weekly_picks_day: string | null
          weekly_picks_enabled: boolean | null
          weekly_picks_last_sent: string | null
        }
        Insert: {
          alert_email_enabled?: boolean | null
          alert_price_drops?: boolean | null
          alert_status_changes?: boolean | null
          budget_max?: number | null
          budget_min?: number | null
          buyer_type?: string | null
          commute_preferences?: Json | null
          created_at?: string | null
          daily_analysis_count?: number | null
          daily_analysis_last_reset?: string | null
          desired_monthly_payment?: number | null
          email?: string | null
          full_name?: string | null
          id: string
          location_preferences?: Json | null
          max_price_range?: number | null
          min_bedrooms?: number | null
          onboarding_completed?: boolean | null
          preferred_cities?: string[] | null
          property_types?: string[] | null
          risk_level?: string | null
          subscription_cancel_at?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          user_profile?: string | null
          weekly_picks_day?: string | null
          weekly_picks_enabled?: boolean | null
          weekly_picks_last_sent?: string | null
        }
        Update: {
          alert_email_enabled?: boolean | null
          alert_price_drops?: boolean | null
          alert_status_changes?: boolean | null
          budget_max?: number | null
          budget_min?: number | null
          buyer_type?: string | null
          commute_preferences?: Json | null
          created_at?: string | null
          daily_analysis_count?: number | null
          daily_analysis_last_reset?: string | null
          desired_monthly_payment?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          location_preferences?: Json | null
          max_price_range?: number | null
          min_bedrooms?: number | null
          onboarding_completed?: boolean | null
          preferred_cities?: string[] | null
          property_types?: string[] | null
          risk_level?: string | null
          subscription_cancel_at?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          user_profile?: string | null
          weekly_picks_day?: string | null
          weekly_picks_enabled?: boolean | null
          weekly_picks_last_sent?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string | null
          eligibility: string | null
          id: string
          jurisdiction: string
          link: string | null
          max_benefit: number | null
          name: string
        }
        Insert: {
          created_at?: string | null
          eligibility?: string | null
          id?: string
          jurisdiction: string
          link?: string | null
          max_benefit?: number | null
          name: string
        }
        Update: {
          created_at?: string | null
          eligibility?: string | null
          id?: string
          jurisdiction?: string
          link?: string | null
          max_benefit?: number | null
          name?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          arv: number | null
          baths: number
          beds: number
          city: string
          condition: string | null
          created_at: string | null
          description: string | null
          id: string
          image_urls: string[] | null
          list_date: string | null
          lot_size: number | null
          price: number
          rehab_cost: number | null
          roi_percent: number | null
          sqft: number
          state: string
          status: string | null
          taxes: number | null
          updated_at: string | null
          year_built: number | null
          zip: string
        }
        Insert: {
          address: string
          arv?: number | null
          baths: number
          beds: number
          city: string
          condition?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_urls?: string[] | null
          list_date?: string | null
          lot_size?: number | null
          price: number
          rehab_cost?: number | null
          roi_percent?: number | null
          sqft: number
          state: string
          status?: string | null
          taxes?: number | null
          updated_at?: string | null
          year_built?: number | null
          zip: string
        }
        Update: {
          address?: string
          arv?: number | null
          baths?: number
          beds?: number
          city?: string
          condition?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_urls?: string[] | null
          list_date?: string | null
          lot_size?: number | null
          price?: number
          rehab_cost?: number | null
          roi_percent?: number | null
          sqft?: number
          state?: string
          status?: string | null
          taxes?: number | null
          updated_at?: string | null
          year_built?: number | null
          zip?: string
        }
        Relationships: []
      }
      property_snapshots: {
        Row: {
          captured_at: string
          created_at: string | null
          id: string
          price: number
          property_id: string
          status: string
        }
        Insert: {
          captured_at?: string
          created_at?: string | null
          id?: string
          price: number
          property_id: string
          status: string
        }
        Update: {
          captured_at?: string
          created_at?: string | null
          id?: string
          price?: number
          property_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_vectors: {
        Row: {
          created_at: string | null
          embedding: string | null
          id: string
          property_id: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          property_id?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_vectors_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rates: {
        Row: {
          apr: number
          id: string
          lender: string | null
          points: number | null
          product: string
          updated_at: string | null
        }
        Insert: {
          apr: number
          id?: string
          lender?: string | null
          points?: number | null
          product: string
          updated_at?: string | null
        }
        Update: {
          apr?: number
          id?: string
          lender?: string | null
          points?: number | null
          product?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      saved_calculations: {
        Row: {
          calculation_type: string
          created_at: string
          data: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calculation_type: string
          created_at?: string
          data: Json
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calculation_type?: string
          created_at?: string
          data?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          alert_enabled: boolean | null
          alert_frequency: string | null
          created_at: string | null
          filters_json: Json | null
          id: string
          last_alert_sent: string | null
          query_text: string
          user_id: string
        }
        Insert: {
          alert_enabled?: boolean | null
          alert_frequency?: string | null
          created_at?: string | null
          filters_json?: Json | null
          id?: string
          last_alert_sent?: string | null
          query_text: string
          user_id: string
        }
        Update: {
          alert_enabled?: boolean | null
          alert_frequency?: string | null
          created_at?: string | null
          filters_json?: Json | null
          id?: string
          last_alert_sent?: string | null
          query_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_alerts: {
        Row: {
          alert_type: string
          id: string
          new_value: string | null
          old_value: string | null
          property_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          property_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          property_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_alerts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_picks_history: {
        Row: {
          created_at: string | null
          email_sent: boolean | null
          id: string
          property_ids: string[]
          sent_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_sent?: boolean | null
          id?: string
          property_ids: string[]
          sent_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_sent?: boolean | null
          id?: string
          property_ids?: string[]
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
