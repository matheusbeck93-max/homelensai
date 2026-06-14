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
      ai_credit_ledger: {
        Row: {
          balance_after: number | null
          balance_before: number | null
          completion_tokens: number | null
          created_at: string
          credits_charged: number
          event_type: string
          function_name: string
          id: string
          model: string | null
          note: string | null
          prompt_tokens: number | null
          request_id: string | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          balance_after?: number | null
          balance_before?: number | null
          completion_tokens?: number | null
          created_at?: string
          credits_charged?: number
          event_type: string
          function_name: string
          id?: string
          model?: string | null
          note?: string | null
          prompt_tokens?: number | null
          request_id?: string | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          balance_after?: number | null
          balance_before?: number | null
          completion_tokens?: number | null
          created_at?: string
          credits_charged?: number
          event_type?: string
          function_name?: string
          id?: string
          model?: string | null
          note?: string | null
          prompt_tokens?: number | null
          request_id?: string | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          api_name: string
          attempt: string
          cost_usd: number
          created_at: string
          error_code: string | null
          id: string
          input_tokens: number
          latency_ms: number | null
          model_id: string
          output_tokens: number
          reasoning_tokens: number
          request_id: string | null
          status: string
          surface: string
          tier: string
          usage_date: string
          user_id: string
        }
        Insert: {
          api_name: string
          attempt: string
          cost_usd?: number
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          model_id: string
          output_tokens?: number
          reasoning_tokens?: number
          request_id?: string | null
          status?: string
          surface: string
          tier: string
          usage_date?: string
          user_id: string
        }
        Update: {
          api_name?: string
          attempt?: string
          cost_usd?: number
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          model_id?: string
          output_tokens?: number
          reasoning_tokens?: number
          request_id?: string | null
          status?: string
          surface?: string
          tier?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
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
      artifact_generation_log: {
        Row: {
          count: number
          created_at: string
          day: string
          id: string
          kind: string
          total_cost_usd: number
          total_input_tokens: number
          total_output_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          day?: string
          id?: string
          kind: string
          total_cost_usd?: number
          total_input_tokens?: number
          total_output_tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          day?: string
          id?: string
          kind?: string
          total_cost_usd?: number
          total_input_tokens?: number
          total_output_tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      artifacts: {
        Row: {
          created_at: string
          error: string | null
          filename: string
          id: string
          input: Json
          kind: string
          mime_type: string
          size_bytes: number | null
          source_thread_id: string | null
          status: string
          storage_path: string
          surface: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          filename: string
          id?: string
          input?: Json
          kind: string
          mime_type: string
          size_bytes?: number | null
          source_thread_id?: string | null
          status?: string
          storage_path: string
          surface?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          filename?: string
          id?: string
          input?: Json
          kind?: string
          mime_type?: string
          size_bytes?: number | null
          source_thread_id?: string | null
          status?: string
          storage_path?: string
          surface?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          client_thread_id: string | null
          created_at: string
          id: string
          property_url: string | null
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_thread_id?: string | null
          created_at?: string
          id?: string
          property_url?: string | null
          source?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_thread_id?: string | null
          created_at?: string
          id?: string
          property_url?: string | null
          source?: string
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
      investor_brief_cards: {
        Row: {
          brief_id: string
          card_type: string
          config: Json
          created_at: string
          data_snapshot: Json
          hidden: boolean
          id: string
          position: number
        }
        Insert: {
          brief_id: string
          card_type: string
          config?: Json
          created_at?: string
          data_snapshot?: Json
          hidden?: boolean
          id?: string
          position?: number
        }
        Update: {
          brief_id?: string
          card_type?: string
          config?: Json
          created_at?: string
          data_snapshot?: Json
          hidden?: boolean
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "investor_brief_cards_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "investor_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_brief_events: {
        Row: {
          brief_id: string | null
          card_type: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          brief_id?: string | null
          card_type?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          brief_id?: string | null
          card_type?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_brief_events_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "investor_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_briefs: {
        Row: {
          context_snapshot: Json
          created_at: string
          edited_at: string | null
          edited_insights: Json | null
          edited_intro: string | null
          followups: string[]
          generated_at: string
          id: string
          insights: Json
          intro_text: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context_snapshot?: Json
          created_at?: string
          edited_at?: string | null
          edited_insights?: Json | null
          edited_intro?: string | null
          followups?: string[]
          generated_at?: string
          id?: string
          insights?: Json
          intro_text?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context_snapshot?: Json
          created_at?: string
          edited_at?: string | null
          edited_insights?: Json | null
          edited_intro?: string | null
          followups?: string[]
          generated_at?: string
          id?: string
          insights?: Json
          intro_text?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investor_card_feedback: {
        Row: {
          brief_card_id: string | null
          card_type: string
          created_at: string
          id: string
          signal: string
          user_id: string
        }
        Insert: {
          brief_card_id?: string | null
          card_type: string
          created_at?: string
          id?: string
          signal: string
          user_id: string
        }
        Update: {
          brief_card_id?: string | null
          card_type?: string
          created_at?: string
          id?: string
          signal?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_card_feedback_brief_card_id_fkey"
            columns: ["brief_card_id"]
            isOneToOne: false
            referencedRelation: "investor_brief_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_chat_messages: {
        Row: {
          active_card_context: Json | null
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          tool_calls: Json
          tool_results: Json
        }
        Insert: {
          active_card_context?: Json | null
          content?: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          tool_calls?: Json
          tool_results?: Json
        }
        Update: {
          active_card_context?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          tool_calls?: Json
          tool_results?: Json
        }
        Relationships: [
          {
            foreignKeyName: "investor_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "investor_console_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_console_threads: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          property_id: string | null
          scope: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          property_id?: string | null
          scope?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          property_id?: string | null
          scope?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_console_threads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "investor_owned_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_owned_properties: {
        Row: {
          address_line1: string
          address_line2: string | null
          auto_refresh_enabled: boolean
          baths: number | null
          beds: number | null
          city: string
          closing_costs: number | null
          created_at: string
          current_value_confidence_high: number | null
          current_value_confidence_low: number | null
          current_value_estimate: number | null
          current_value_manual_expires_at: string | null
          current_value_manual_note: string | null
          current_value_manual_override: number | null
          current_value_refreshed_at: string | null
          current_value_source: string | null
          down_payment: number | null
          has_mortgage: boolean
          id: string
          is_primary_residence: boolean
          is_rented: boolean
          loan_current_balance: number | null
          loan_current_balance_as_of: string | null
          loan_original_principal: number | null
          loan_rate_apr: number | null
          loan_start_date: string | null
          loan_term_years: number | null
          lot_sqft: number | null
          primary_photo_url: string | null
          property_type: string
          purchase_date: string
          purchase_price: number
          sold_date: string | null
          sold_price: number | null
          sqft: number | null
          state: string
          status: string
          updated_at: string
          user_id: string
          year_built: number | null
          zip: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          auto_refresh_enabled?: boolean
          baths?: number | null
          beds?: number | null
          city: string
          closing_costs?: number | null
          created_at?: string
          current_value_confidence_high?: number | null
          current_value_confidence_low?: number | null
          current_value_estimate?: number | null
          current_value_manual_expires_at?: string | null
          current_value_manual_note?: string | null
          current_value_manual_override?: number | null
          current_value_refreshed_at?: string | null
          current_value_source?: string | null
          down_payment?: number | null
          has_mortgage?: boolean
          id?: string
          is_primary_residence?: boolean
          is_rented?: boolean
          loan_current_balance?: number | null
          loan_current_balance_as_of?: string | null
          loan_original_principal?: number | null
          loan_rate_apr?: number | null
          loan_start_date?: string | null
          loan_term_years?: number | null
          lot_sqft?: number | null
          primary_photo_url?: string | null
          property_type: string
          purchase_date: string
          purchase_price: number
          sold_date?: string | null
          sold_price?: number | null
          sqft?: number | null
          state: string
          status?: string
          updated_at?: string
          user_id: string
          year_built?: number | null
          zip: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          auto_refresh_enabled?: boolean
          baths?: number | null
          beds?: number | null
          city?: string
          closing_costs?: number | null
          created_at?: string
          current_value_confidence_high?: number | null
          current_value_confidence_low?: number | null
          current_value_estimate?: number | null
          current_value_manual_expires_at?: string | null
          current_value_manual_note?: string | null
          current_value_manual_override?: number | null
          current_value_refreshed_at?: string | null
          current_value_source?: string | null
          down_payment?: number | null
          has_mortgage?: boolean
          id?: string
          is_primary_residence?: boolean
          is_rented?: boolean
          loan_current_balance?: number | null
          loan_current_balance_as_of?: string | null
          loan_original_principal?: number | null
          loan_rate_apr?: number | null
          loan_start_date?: string | null
          loan_term_years?: number | null
          lot_sqft?: number | null
          primary_photo_url?: string | null
          property_type?: string
          purchase_date?: string
          purchase_price?: number
          sold_date?: string | null
          sold_price?: number | null
          sqft?: number | null
          state?: string
          status?: string
          updated_at?: string
          user_id?: string
          year_built?: number | null
          zip?: string
        }
        Relationships: []
      }
      investor_owned_property_alerts: {
        Row: {
          alert_type: string
          description: string
          dismissed_at: string | null
          expires_at: string | null
          id: string
          metadata: Json
          property_id: string
          severity: string
          status: string
          surfaced_at: string
          title: string
          user_id: string
        }
        Insert: {
          alert_type: string
          description: string
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          property_id: string
          severity: string
          status?: string
          surfaced_at?: string
          title: string
          user_id: string
        }
        Update: {
          alert_type?: string
          description?: string
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          property_id?: string
          severity?: string
          status?: string
          surfaced_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_owned_property_alerts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "investor_owned_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_owned_property_documents: {
        Row: {
          document_type: string
          filename: string
          id: string
          mime_type: string | null
          note: string | null
          property_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          document_type: string
          filename: string
          id?: string
          mime_type?: string | null
          note?: string | null
          property_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          document_type?: string
          filename?: string
          id?: string
          mime_type?: string | null
          note?: string | null
          property_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_owned_property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "investor_owned_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_owned_property_events: {
        Row: {
          created_at: string
          details: Json | null
          event_date: string
          event_type: string
          id: string
          note: string | null
          property_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_date: string
          event_type: string
          id?: string
          note?: string | null
          property_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_date?: string
          event_type?: string
          id?: string
          note?: string | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_owned_property_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "investor_owned_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_owned_property_improvements: {
        Row: {
          category: string | null
          cost: number
          created_at: string
          description: string
          id: string
          improvement_date: string
          property_id: string
        }
        Insert: {
          category?: string | null
          cost: number
          created_at?: string
          description: string
          id?: string
          improvement_date: string
          property_id: string
        }
        Update: {
          category?: string | null
          cost?: number
          created_at?: string
          description?: string
          id?: string
          improvement_date?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_owned_property_improvements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "investor_owned_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_owned_property_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          ordinal: number
          property_id: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          ordinal?: number
          property_id: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          ordinal?: number
          property_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_owned_property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "investor_owned_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_owned_property_rental: {
        Row: {
          hoa_monthly: number | null
          insurance_renewal_date: string | null
          insurance_yearly: number | null
          lease_end: string | null
          lease_start: string | null
          maintenance_pct_of_rent: number | null
          management_pct_of_rent: number | null
          monthly_rent: number | null
          property_id: string
          property_tax_yearly: number | null
          security_deposit: number | null
          updated_at: string
          vacancy_pct: number | null
        }
        Insert: {
          hoa_monthly?: number | null
          insurance_renewal_date?: string | null
          insurance_yearly?: number | null
          lease_end?: string | null
          lease_start?: string | null
          maintenance_pct_of_rent?: number | null
          management_pct_of_rent?: number | null
          monthly_rent?: number | null
          property_id: string
          property_tax_yearly?: number | null
          security_deposit?: number | null
          updated_at?: string
          vacancy_pct?: number | null
        }
        Update: {
          hoa_monthly?: number | null
          insurance_renewal_date?: string | null
          insurance_yearly?: number | null
          lease_end?: string | null
          lease_start?: string | null
          maintenance_pct_of_rent?: number | null
          management_pct_of_rent?: number | null
          monthly_rent?: number | null
          property_id?: string
          property_tax_yearly?: number | null
          security_deposit?: number | null
          updated_at?: string
          vacancy_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_owned_property_rental_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "investor_owned_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_owned_property_valuations: {
        Row: {
          confidence_high: number | null
          confidence_low: number | null
          id: string
          note: string | null
          observed_at: string
          property_id: string
          source: string
          source_payload: Json | null
          value: number
        }
        Insert: {
          confidence_high?: number | null
          confidence_low?: number | null
          id?: string
          note?: string | null
          observed_at?: string
          property_id: string
          source: string
          source_payload?: Json | null
          value: number
        }
        Update: {
          confidence_high?: number | null
          confidence_low?: number | null
          id?: string
          note?: string | null
          observed_at?: string
          property_id?: string
          source?: string
          source_payload?: Json | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "investor_owned_property_valuations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "investor_owned_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_persona_telemetry: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          persona: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          persona?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          persona?: string | null
          user_id?: string
        }
        Relationships: []
      }
      investor_talking_points: {
        Row: {
          id: string
          pinned_at: string
          source_card_id: string | null
          source_card_type: string | null
          status: string
          text: string
          user_id: string
        }
        Insert: {
          id?: string
          pinned_at?: string
          source_card_id?: string | null
          source_card_type?: string | null
          status?: string
          text: string
          user_id: string
        }
        Update: {
          id?: string
          pinned_at?: string
          source_card_id?: string | null
          source_card_type?: string | null
          status?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_talking_points_source_card_id_fkey"
            columns: ["source_card_id"]
            isOneToOne: false
            referencedRelation: "investor_brief_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_upgrade_nudges: {
        Row: {
          accepted_at: string | null
          created_at: string
          current_tier: string
          deferred_until: string | null
          dismissed_at: string | null
          id: string
          legacy_price_id: string
          new_stripe_session_id: string | null
          shown_at: string | null
          surface: string | null
          updated_at: string
          upgrade_completed_at: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          current_tier: string
          deferred_until?: string | null
          dismissed_at?: string | null
          id?: string
          legacy_price_id: string
          new_stripe_session_id?: string | null
          shown_at?: string | null
          surface?: string | null
          updated_at?: string
          upgrade_completed_at?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          current_tier?: string
          deferred_until?: string | null
          dismissed_at?: string | null
          id?: string
          legacy_price_id?: string
          new_stripe_session_id?: string | null
          shown_at?: string | null
          surface?: string | null
          updated_at?: string
          upgrade_completed_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      market_snapshots: {
        Row: {
          created_at: string
          id: string
          location_key: string
          snapshot: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_key: string
          snapshot?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_key?: string
          snapshot?: Json
          updated_at?: string
        }
        Relationships: []
      }
      market_stats: {
        Row: {
          active_listings: number | null
          appreciation_yoy: number | null
          days_on_market_median: number | null
          market: string
          median_list_price: number | null
          median_rent_monthly: number | null
          refreshed_at: string
          rent_growth_yoy: number | null
          source: string | null
          total_sfh_listings: number | null
          vacancy_rate: number | null
        }
        Insert: {
          active_listings?: number | null
          appreciation_yoy?: number | null
          days_on_market_median?: number | null
          market: string
          median_list_price?: number | null
          median_rent_monthly?: number | null
          refreshed_at?: string
          rent_growth_yoy?: number | null
          source?: string | null
          total_sfh_listings?: number | null
          vacancy_rate?: number | null
        }
        Update: {
          active_listings?: number | null
          appreciation_yoy?: number | null
          days_on_market_median?: number | null
          market?: string
          median_list_price?: number | null
          median_rent_monthly?: number | null
          refreshed_at?: string
          rent_growth_yoy?: number | null
          source?: string | null
          total_sfh_listings?: number | null
          vacancy_rate?: number | null
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
      preference_followup_dismissals: {
        Row: {
          dismissed_at: string
          mismatch_type: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          mismatch_type: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          mismatch_type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          about_me: string | null
          ai_credits_last_reset: string
          ai_credits_used_today: number
          alert_email_enabled: boolean | null
          alert_price_drops: boolean | null
          alert_status_changes: boolean | null
          brief_cadence: string
          brief_card_count: number
          budget_max: number | null
          budget_min: number | null
          buyer_type: string | null
          buyer_types: string[] | null
          cash_available: number | null
          children_ages: string[] | null
          climate_preference: string | null
          commute_preferences: Json | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          daily_analysis_count: number | null
          daily_analysis_last_reset: string | null
          desired_monthly_payment: number | null
          email: string | null
          extension_smart_suggestions_enabled: boolean
          financing_defaults: Json
          financing_preference: string | null
          financing_preferences: string[] | null
          full_name: string | null
          has_children: boolean | null
          hold_period_years: number | null
          id: string
          investment_strategies: string[] | null
          investment_strategy: string | null
          is_staff: boolean
          location_preferences: Json | null
          max_price_range: number | null
          max_sqft: number | null
          min_bathrooms: number | null
          min_bedrooms: number | null
          min_sqft: number | null
          must_have_features: string[] | null
          onboarding_completed: boolean | null
          persona: string | null
          persona_secondary: string[] | null
          persona_set_at: string | null
          plan_credits_allowance_usd: number
          plan_credits_remaining_usd: number
          preferences: Json
          preferred_cities: string[] | null
          primary_goal: string | null
          property_types: string[] | null
          risk_level: string | null
          safety_priority: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          stripe_subscription_item_id: string | null
          subscription_cancel_at: string | null
          subscription_renews_at: string | null
          subscription_status: string | null
          target_cap_rate: number | null
          trial_used_at: string | null
          updated_at: string | null
          user_profile: string | null
          weekly_picks_day: string | null
          weekly_picks_enabled: boolean | null
          weekly_picks_last_sent: string | null
        }
        Insert: {
          about_me?: string | null
          ai_credits_last_reset?: string
          ai_credits_used_today?: number
          alert_email_enabled?: boolean | null
          alert_price_drops?: boolean | null
          alert_status_changes?: boolean | null
          brief_cadence?: string
          brief_card_count?: number
          budget_max?: number | null
          budget_min?: number | null
          buyer_type?: string | null
          buyer_types?: string[] | null
          cash_available?: number | null
          children_ages?: string[] | null
          climate_preference?: string | null
          commute_preferences?: Json | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          daily_analysis_count?: number | null
          daily_analysis_last_reset?: string | null
          desired_monthly_payment?: number | null
          email?: string | null
          extension_smart_suggestions_enabled?: boolean
          financing_defaults?: Json
          financing_preference?: string | null
          financing_preferences?: string[] | null
          full_name?: string | null
          has_children?: boolean | null
          hold_period_years?: number | null
          id: string
          investment_strategies?: string[] | null
          investment_strategy?: string | null
          is_staff?: boolean
          location_preferences?: Json | null
          max_price_range?: number | null
          max_sqft?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_sqft?: number | null
          must_have_features?: string[] | null
          onboarding_completed?: boolean | null
          persona?: string | null
          persona_secondary?: string[] | null
          persona_set_at?: string | null
          plan_credits_allowance_usd?: number
          plan_credits_remaining_usd?: number
          preferences?: Json
          preferred_cities?: string[] | null
          primary_goal?: string | null
          property_types?: string[] | null
          risk_level?: string | null
          safety_priority?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          subscription_cancel_at?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string | null
          target_cap_rate?: number | null
          trial_used_at?: string | null
          updated_at?: string | null
          user_profile?: string | null
          weekly_picks_day?: string | null
          weekly_picks_enabled?: boolean | null
          weekly_picks_last_sent?: string | null
        }
        Update: {
          about_me?: string | null
          ai_credits_last_reset?: string
          ai_credits_used_today?: number
          alert_email_enabled?: boolean | null
          alert_price_drops?: boolean | null
          alert_status_changes?: boolean | null
          brief_cadence?: string
          brief_card_count?: number
          budget_max?: number | null
          budget_min?: number | null
          buyer_type?: string | null
          buyer_types?: string[] | null
          cash_available?: number | null
          children_ages?: string[] | null
          climate_preference?: string | null
          commute_preferences?: Json | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          daily_analysis_count?: number | null
          daily_analysis_last_reset?: string | null
          desired_monthly_payment?: number | null
          email?: string | null
          extension_smart_suggestions_enabled?: boolean
          financing_defaults?: Json
          financing_preference?: string | null
          financing_preferences?: string[] | null
          full_name?: string | null
          has_children?: boolean | null
          hold_period_years?: number | null
          id?: string
          investment_strategies?: string[] | null
          investment_strategy?: string | null
          is_staff?: boolean
          location_preferences?: Json | null
          max_price_range?: number | null
          max_sqft?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_sqft?: number | null
          must_have_features?: string[] | null
          onboarding_completed?: boolean | null
          persona?: string | null
          persona_secondary?: string[] | null
          persona_set_at?: string | null
          plan_credits_allowance_usd?: number
          plan_credits_remaining_usd?: number
          preferences?: Json
          preferred_cities?: string[] | null
          primary_goal?: string | null
          property_types?: string[] | null
          risk_level?: string | null
          safety_priority?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          subscription_cancel_at?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string | null
          target_cap_rate?: number | null
          trial_used_at?: string | null
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
      saved_analyses: {
        Row: {
          analysis_summary: string
          created_at: string
          id: string
          investment_score: number | null
          key_metrics: Json | null
          notes: string | null
          property_address: string | null
          property_price: number | null
          property_url: string | null
          score_label: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_summary: string
          created_at?: string
          id?: string
          investment_score?: number | null
          key_metrics?: Json | null
          notes?: string | null
          property_address?: string | null
          property_price?: number | null
          property_url?: string | null
          score_label?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_summary?: string
          created_at?: string
          id?: string
          investment_score?: number | null
          key_metrics?: Json | null
          notes?: string | null
          property_address?: string | null
          property_price?: number | null
          property_url?: string | null
          score_label?: string | null
          source?: string
          updated_at?: string
          user_id?: string
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
      saved_properties: {
        Row: {
          ai_analysis: Json | null
          baths: number | null
          beds: number | null
          city: string | null
          created_at: string
          id: string
          image_url: string | null
          price: number | null
          property_address: string
          property_url: string
          source: string
          sqft: number | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          baths?: number | null
          beds?: number | null
          city?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number | null
          property_address: string
          property_url: string
          source?: string
          sqft?: number | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          baths?: number | null
          beds?: number | null
          city?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number | null
          property_address?: string
          property_url?: string
          source?: string
          sqft?: number | null
          state?: string | null
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
      search_cache: {
        Row: {
          created_at: string
          id: string
          normalized_query: string
          params: Json
          results: Json
          source: string
          ttl_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_query: string
          params?: Json
          results?: Json
          source: string
          ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          normalized_query?: string
          params?: Json
          results?: Json
          source?: string
          ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
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
      state_tax_cache: {
        Row: {
          fetched_at: string
          rate: number
          source: string
          state_code: string
        }
        Insert: {
          fetched_at?: string
          rate: number
          source: string
          state_code: string
        }
        Update: {
          fetched_at?: string
          rate?: number
          source?: string
          state_code?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          monthly_credit_allowance_usd: number | null
          stripe_price_id_annual: string | null
          stripe_price_id_monthly: string | null
          tier: string
          trial_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          monthly_credit_allowance_usd?: number | null
          stripe_price_id_annual?: string | null
          stripe_price_id_monthly?: string | null
          tier: string
          trial_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          monthly_credit_allowance_usd?: number | null
          stripe_price_id_annual?: string | null
          stripe_price_id_monthly?: string | null
          tier?: string
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      tool_call_telemetry: {
        Row: {
          branch: string
          created_at: string
          had_prose: boolean
          id: string
          match_score: number | null
          model: string | null
          tool_call_count: number
          tool_call_emitted: boolean
        }
        Insert: {
          branch: string
          created_at?: string
          had_prose?: boolean
          id?: string
          match_score?: number | null
          model?: string | null
          tool_call_count?: number
          tool_call_emitted: boolean
        }
        Update: {
          branch?: string
          created_at?: string
          had_prose?: boolean
          id?: string
          match_score?: number | null
          model?: string | null
          tool_call_count?: number
          tool_call_emitted?: boolean
        }
        Relationships: []
      }
      topup_events: {
        Row: {
          created_at: string
          credit_usd: number | null
          event_type: string
          id: string
          metadata: Json | null
          pack_size: string | null
          price_usd: number | null
          remaining_balance_usd: number | null
          stripe_session_id: string | null
          surface: string | null
          tier: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          credit_usd?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          pack_size?: string | null
          price_usd?: number | null
          remaining_balance_usd?: number | null
          stripe_session_id?: string | null
          surface?: string | null
          tier?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          credit_usd?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          pack_size?: string | null
          price_usd?: number | null
          remaining_balance_usd?: number | null
          stripe_session_id?: string | null
          surface?: string | null
          tier?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      upgrade_cta_events: {
        Row: {
          cap_session_id: string
          clicked_at: string
          converted_at: string | null
          from_tier: string
          id: string
          source: string
          stripe_session_id: string | null
          to_tier: string | null
          user_id: string
        }
        Insert: {
          cap_session_id: string
          clicked_at?: string
          converted_at?: string | null
          from_tier: string
          id?: string
          source: string
          stripe_session_id?: string | null
          to_tier?: string | null
          user_id: string
        }
        Update: {
          cap_session_id?: string
          clicked_at?: string
          converted_at?: string | null
          from_tier?: string
          id?: string
          source?: string
          stripe_session_id?: string | null
          to_tier?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          amount_usd: number
          consumed_usd: number
          created_at: string
          expires_at: string
          id: string
          pack_size: string
          purchased_at: string
          source: string
          status: string
          stripe_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          consumed_usd?: number
          created_at?: string
          expires_at: string
          id?: string
          pack_size: string
          purchased_at?: string
          source?: string
          status?: string
          stripe_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          consumed_usd?: number
          created_at?: string
          expires_at?: string
          id?: string
          pack_size?: string
          purchased_at?: string
          source?: string
          status?: string
          stripe_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_exception_properties: {
        Row: {
          created_at: string
          id: string
          listing_snapshot: Json
          note: string | null
          property_url: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_snapshot?: Json
          note?: string | null
          property_url: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_snapshot?: Json
          note?: string | null
          property_url?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      v_user_usage_daily: {
        Row: {
          calls: number | null
          day: string | null
          surface: string | null
          usage_usd: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
