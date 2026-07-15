export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string;
          admin_id: string | null;
          created_at: string;
          details: string | null;
          id: string;
          target_id: string | null;
        };
        Insert: {
          action: string;
          admin_id?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          target_id?: string | null;
        };
        Update: {
          action?: string;
          admin_id?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          target_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_log: {
        Row: {
          id: string;
          severity: string;
          category: string;
          title: string;
          body: string | null;
          context: Json;
          resolved: boolean;
          notified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          severity: string;
          category: string;
          title: string;
          body?: string | null;
          context?: Json;
          resolved?: boolean;
          notified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          severity?: string;
          category?: string;
          title?: string;
          body?: string | null;
          context?: Json;
          resolved?: boolean;
          notified?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      caretaker_property_assignments: {
        Row: {
          caretaker_id: string;
          created_at: string;
          id: string;
          property_id: string;
        };
        Insert: {
          caretaker_id: string;
          created_at?: string;
          id?: string;
          property_id: string;
        };
        Update: {
          caretaker_id?: string;
          created_at?: string;
          id?: string;
          property_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "caretaker_property_assignments_caretaker_id_fkey";
            columns: ["caretaker_id"];
            isOneToOne: false;
            referencedRelation: "caretakers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caretaker_property_assignments_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      caretaker_sessions: {
        Row: {
          caretaker_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          token_hash: string;
        };
        Insert: {
          caretaker_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          token_hash: string;
        };
        Update: {
          caretaker_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "caretaker_sessions_caretaker_id_fkey";
            columns: ["caretaker_id"];
            isOneToOne: false;
            referencedRelation: "caretakers";
            referencedColumns: ["id"];
          },
        ];
      };
      caretakers: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          landlord_id: string;
          last_login_at: string | null;
          phone: string;
          pin_hash: string;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id?: string;
          is_active?: boolean;
          landlord_id: string;
          last_login_at?: string | null;
          phone: string;
          pin_hash: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          landlord_id?: string;
          last_login_at?: string | null;
          phone?: string;
          pin_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "caretakers_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caretakers_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fraud_signals: {
        Row: {
          created_at: string;
          details: Json | null;
          id: string;
          property_id: string | null;
          resolved: boolean;
          severity: string;
          signal_type: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          details?: Json | null;
          id?: string;
          property_id?: string | null;
          resolved?: boolean;
          severity?: string;
          signal_type: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          details?: Json | null;
          id?: string;
          property_id?: string | null;
          resolved?: boolean;
          severity?: string;
          signal_type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fraud_signals_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fraud_signals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fraud_signals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      inquiries: {
        Row: {
          created_at: string;
          id: string;
          landlord_id: string | null;
          message: string;
          property_id: string;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          landlord_id?: string | null;
          message: string;
          property_id: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          landlord_id?: string | null;
          message?: string;
          property_id?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiries_landlord_profile_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_landlord_profile_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_tenant_profile_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_tenant_profile_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      import_batches: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          file_type: string;
          total_rows: number;
          imported_rows: number;
          failed_rows: number;
          duplicate_rows: number;
          status: string;
          error_report: Json | null;
          property_ids: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          filename: string;
          file_type?: string;
          total_rows?: number;
          imported_rows?: number;
          failed_rows?: number;
          duplicate_rows?: number;
          status?: string;
          error_report?: Json | null;
          property_ids?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          filename?: string;
          file_type?: string;
          total_rows?: number;
          imported_rows?: number;
          failed_rows?: number;
          duplicate_rows?: number;
          status?: string;
          error_report?: Json | null;
          property_ids?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      integration_api_keys: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scope: string;
          created_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scope?: string;
          created_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          scope?: string;
          created_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      integration_webhooks: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          events: string[];
          secret: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          events?: string[];
          secret?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          url?: string;
          events?: string[];
          secret?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      inquiry_messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          inquiry_id: string;
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          inquiry_id: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          inquiry_id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiry_messages_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
        ];
      };
      neighborhood_reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          neighborhood: string;
          noise_level: number | null;
          reviewer_id: string;
          safety: number | null;
          security: number | null;
          traffic: number | null;
          water_availability: number | null;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          neighborhood: string;
          noise_level?: number | null;
          reviewer_id: string;
          safety?: number | null;
          security?: number | null;
          traffic?: number | null;
          water_availability?: number | null;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          neighborhood?: string;
          noise_level?: number | null;
          reviewer_id?: string;
          safety?: number | null;
          security?: number | null;
          traffic?: number | null;
          water_availability?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "neighborhood_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "neighborhood_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          logo_url: string | null;
          name: string;
          slug: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          slug: string;
          type?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          slug?: string;
          type?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_kes: number;
          created_at: string;
          id: string;
          idempotency_key: string | null;
          metadata: Record<string, unknown>;
          mpesa_checkout_id: string | null;
          mpesa_phone: string | null;
          mpesa_receipt: string | null;
          payment_method: string | null;
          payment_type: string;
          property_id: string | null;
          status: string;
          trial_end: string | null;
          user_id: string;
        };
        Insert: {
          amount_kes: number;
          created_at?: string;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Record<string, unknown>;
          mpesa_checkout_id?: string | null;
          mpesa_phone?: string | null;
          mpesa_receipt?: string | null;
          payment_method?: string | null;
          payment_type: string;
          property_id?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          amount_kes?: number;
          created_at?: string;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Record<string, unknown>;
          mpesa_checkout_id?: string | null;
          mpesa_phone?: string | null;
          mpesa_receipt?: string | null;
          payment_method?: string | null;
          payment_type?: string;
          property_id?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_webhook_log: {
        Row: {
          id: string;
          provider: string;
          payment_id: string | null;
          raw_payload: Json;
          signature_valid: boolean;
          processed: boolean;
          received_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          payment_id?: string | null;
          raw_payload: Json;
          signature_valid?: boolean;
          processed?: boolean;
          received_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          payment_id?: string | null;
          raw_payload?: Json;
          signature_valid?: boolean;
          processed?: boolean;
          received_at?: string;
        };
        Relationships: [];
      };
      report_purchases: {
        Row: {
          id: string;
          user_id: string;
          report_type: string;
          payment_id: string;
          unlocked_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          report_type: string;
          payment_id: string;
          unlocked_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          report_type?: string;
          payment_id?: string;
          unlocked_at?: string;
        };
        Relationships: [];
      };
      listing_boosts: {
        Row: {
          amount_paid_kes: number;
          created_at: string;
          end_date: string;
          id: string;
          listing_id: string;
          package: string;
          placements: string[];
          start_date: string;
          user_id: string;
        };
        Insert: {
          amount_paid_kes: number;
          created_at?: string;
          end_date: string;
          id?: string;
          listing_id: string;
          package: string;
          placements?: string[];
          start_date?: string;
          user_id: string;
        };
        Update: {
          amount_paid_kes?: number;
          created_at?: string;
          end_date?: string;
          id?: string;
          listing_id?: string;
          package?: string;
          placements?: string[];
          start_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_boosts_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_boosts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          amount_kes: number;
          billing_cycle: string;
          created_at: string;
          grace_period_end: string | null;
          id: string;
          next_billing_date: string;
          payment_method: string;
          plan: string;
          start_date: string;
          status: string;
          trial_end: string | null;
          user_id: string;
        };
        Insert: {
          amount_kes: number;
          billing_cycle?: string;
          created_at?: string;
          grace_period_end?: string | null;
          id?: string;
          next_billing_date: string;
          payment_method?: string;
          plan: string;
          start_date?: string;
          status?: string;
          trial_end?: string | null;
          user_id: string;
        };
        Update: {
          amount_kes?: number;
          billing_cycle?: string;
          created_at?: string;
          grace_period_end?: string | null;
          id?: string;
          next_billing_date?: string;
          payment_method?: string;
          plan?: string;
          start_date?: string;
          status?: string;
          trial_end?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_unlocks: {
        Row: {
          fee_charged: number;
          id: string;
          listing_id: string;
          method: string;
          payment_id: string | null;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          fee_charged?: number;
          id?: string;
          listing_id: string;
          method: string;
          payment_id?: string | null;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          fee_charged?: number;
          id?: string;
          listing_id?: string;
          method?: string;
          payment_id?: string | null;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cookie_consent: {
        Row: {
          id: string;
          ip_hash: string;
          necessary: boolean;
          analytics: boolean;
          marketing: boolean;
          preferences: boolean;
          consent_version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ip_hash: string;
          necessary?: boolean;
          analytics?: boolean;
          marketing?: boolean;
          preferences?: boolean;
          consent_version?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ip_hash?: string;
          necessary?: boolean;
          analytics?: boolean;
          marketing?: boolean;
          preferences?: boolean;
          consent_version?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      email_log: {
        Row: {
          created_at: string;
          id: string;
          metadata: Json | null;
          provider_id: string | null;
          status: string;
          subject: string;
          template_id: string;
          to_email: string;
          to_name: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          provider_id?: string | null;
          status?: string;
          subject: string;
          template_id: string;
          to_email: string;
          to_name?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          provider_id?: string | null;
          status?: string;
          subject?: string;
          template_id?: string;
          to_email?: string;
          to_name?: string | null;
        };
        Relationships: [];
      };
      marketing_email_log: {
        Row: {
          id: string;
          sent_at: string;
          template_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          sent_at?: string;
          template_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          sent_at?: string;
          template_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      service_providers: {
        Row: {
          areas_served: Json;
          business_name: string;
          categories: Json;
          counties: Json;
          created_at: string;
          description: string | null;
          id: string;
          phone: string | null;
          photo_url: string | null;
          price_range: string | null;
          source_url: string | null;
          status: string;
          subscription_id: string | null;
          tier: string;
          user_id: string | null;
          verified: number;
        };
        Insert: {
          areas_served?: Json;
          business_name: string;
          categories?: Json;
          counties?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          phone?: string | null;
          photo_url?: string | null;
          price_range?: string | null;
          source_url?: string | null;
          status?: string;
          subscription_id?: string | null;
          tier?: string;
          user_id?: string | null;
          verified?: number;
        };
        Update: {
          areas_served?: Json;
          business_name?: string;
          categories?: Json;
          counties?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          phone?: string | null;
          photo_url?: string | null;
          price_range?: string | null;
          source_url?: string | null;
          status?: string;
          subscription_id?: string | null;
          tier?: string;
          user_id?: string | null;
          verified?: number;
        };
        Relationships: [];
      };
      provider_counties: {
        Row: {
          code: string;
          name: string;
        };
        Insert: {
          code: string;
          name: string;
        };
        Update: {
          code?: string;
          name?: string;
        };
        Relationships: [];
      };
      provider_analytics_events: {
        Row: {
          id: string;
          provider_id: string;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          event_type?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      provider_inquiries: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          provider_id: string;
          tenant_user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          provider_id: string;
          tenant_user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          provider_id?: string;
          tenant_user_id?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          created_at: string;
          id: string;
          landlord_id: string;
          listing_id: string;
          quality_score: number;
          source: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          landlord_id: string;
          listing_id: string;
          quality_score?: number;
          source: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          landlord_id?: string;
          listing_id?: string;
          quality_score?: number;
          source?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_transactions: {
        Row: {
          created_at: string;
          id: string;
          landlord_id: string;
          listing_id: string;
          platform_fee_kes: number;
          rent_amount_kes: number;
          status: string;
          tenant_id: string | null;
          transaction_date: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          landlord_id: string;
          listing_id: string;
          platform_fee_kes: number;
          rent_amount_kes: number;
          status?: string;
          tenant_id?: string | null;
          transaction_date?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          landlord_id?: string;
          listing_id?: string;
          platform_fee_kes?: number;
          rent_amount_kes?: number;
          status?: string;
          tenant_id?: string | null;
          transaction_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_transactions_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_requests: {
        Row: {
          amount_paid_kes: number;
          created_at: string;
          id: string;
          listing_id: string | null;
          listing_url: string | null;
          paid: boolean;
          payment_id: string | null;
          property_address: string;
          report_url: string | null;
          requester_email: string;
          requester_name: string;
          requester_phone: string;
          status: string;
          tier: string;
        };
        Insert: {
          amount_paid_kes: number;
          created_at?: string;
          id?: string;
          listing_id?: string | null;
          listing_url?: string | null;
          paid?: boolean;
          payment_id?: string | null;
          property_address: string;
          report_url?: string | null;
          requester_email: string;
          requester_name: string;
          requester_phone: string;
          status?: string;
          tier: string;
        };
        Update: {
          amount_paid_kes?: number;
          created_at?: string;
          id?: string;
          listing_id?: string | null;
          listing_url?: string | null;
          paid?: boolean;
          payment_id?: string | null;
          property_address?: string;
          report_url?: string | null;
          requester_email?: string;
          requester_name?: string;
          requester_phone?: string;
          status?: string;
          tier?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          created_at: string;
          due_date: string;
          id: string;
          line_items: Json;
          status: string;
          total_kes: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          due_date: string;
          id?: string;
          line_items?: Json;
          status?: string;
          total_kes: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          due_date?: string;
          id?: string;
          line_items?: Json;
          status?: string;
          total_kes?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partnership_inquiries: {
        Row: {
          company: string | null;
          contact_name: string;
          created_at: string;
          email: string | null;
          id: string;
          inquiry_type: string;
          message: string;
          metadata: Json;
          phone: string;
          subject: string;
        };
        Insert: {
          company?: string | null;
          contact_name: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          inquiry_type: string;
          message: string;
          metadata?: Json;
          phone: string;
          subject: string;
        };
        Update: {
          company?: string | null;
          contact_name?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          inquiry_type?: string;
          message?: string;
          metadata?: Json;
          phone?: string;
          subject?: string;
        };
        Relationships: [];
      };
      portal_applications: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          organization_name: string | null;
          phone: string | null;
          rejection_reason: string | null;
          requested_role: Database["public"]["Enums"]["app_role"];
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          organization_name?: string | null;
          phone?: string | null;
          rejection_reason?: string | null;
          requested_role: Database["public"]["Enums"]["app_role"];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          organization_name?: string | null;
          phone?: string | null;
          rejection_reason?: string | null;
          requested_role?: Database["public"]["Enums"]["app_role"];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_applications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_applications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_applications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_applications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      promo_campaigns: {
        Row: {
          active: boolean;
          bonus_listings: number;
          created_at: string;
          id: string;
          max_slots: number;
          role: string;
          slots_claimed: number;
          slots_confirmed: number;
        };
        Insert: {
          active?: boolean;
          bonus_listings: number;
          created_at?: string;
          id: string;
          max_slots: number;
          role: string;
          slots_claimed?: number;
          slots_confirmed?: number;
        };
        Update: {
          active?: boolean;
          bonus_listings?: number;
          created_at?: string;
          id?: string;
          max_slots?: number;
          role?: string;
          slots_claimed?: number;
          slots_confirmed?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          active_portal: string | null;
          admin_listing_limit_override: number | null;
          avatar_url: string | null;
          bonus_listing_slots: number;
          created_at: string;
          founding_member_campaign_id: string | null;
          founding_member_claimed_at: string | null;
          founding_member_confirmed_at: string | null;
          founding_member_slot_number: number | null;
          founding_member_status: string;
          full_name: string | null;
          id: string;
          is_portal_active: boolean;
          landlord_plan: string;
          lead_pack_balance: number;
          phone: string | null;
          plus_expires_at: string | null;
          tenant_plan: string;
          trial_unlocks_remaining: number;
          trial_started_at: string | null;
          trial_ends_at: string | null;
          email_marketing_opt_in: boolean;
          email_message_opt_in: boolean;
          email_transactional_opt_in: boolean;
          updated_at: string;
        };
        Insert: {
          active_portal?: string | null;
          admin_listing_limit_override?: number | null;
          avatar_url?: string | null;
          bonus_listing_slots?: number;
          created_at?: string;
          founding_member_campaign_id?: string | null;
          founding_member_claimed_at?: string | null;
          founding_member_confirmed_at?: string | null;
          founding_member_slot_number?: number | null;
          founding_member_status?: string;
          full_name?: string | null;
          id: string;
          is_portal_active?: boolean;
          landlord_plan?: string;
          lead_pack_balance?: number;
          phone?: string | null;
          plus_expires_at?: string | null;
          tenant_plan?: string;
          trial_unlocks_remaining?: number;
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          email_marketing_opt_in?: boolean;
          email_message_opt_in?: boolean;
          email_transactional_opt_in?: boolean;
          updated_at?: string;
        };
        Update: {
          active_portal?: string | null;
          admin_listing_limit_override?: number | null;
          avatar_url?: string | null;
          bonus_listing_slots?: number;
          created_at?: string;
          founding_member_campaign_id?: string | null;
          founding_member_claimed_at?: string | null;
          founding_member_confirmed_at?: string | null;
          founding_member_slot_number?: number | null;
          founding_member_status?: string;
          full_name?: string | null;
          id?: string;
          is_portal_active?: boolean;
          landlord_plan?: string;
          lead_pack_balance?: number;
          phone?: string | null;
          plus_expires_at?: string | null;
          tenant_plan?: string;
          trial_unlocks_remaining?: number;
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          email_marketing_opt_in?: boolean;
          email_message_opt_in?: boolean;
          email_transactional_opt_in?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_founding_member_campaign_id_fkey";
            columns: ["founding_member_campaign_id"];
            isOneToOne: false;
            referencedRelation: "promo_campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      properties: {
        Row: {
          address: string | null;
          amenities: string[];
          area_sqm: number | null;
          area_sqm_max: number | null;
          authenticity_score: number;
          available_from: string | null;
          bathrooms: number;
          bedrooms: number;
          boost_package: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          deposit_kes: number | null;
          description: string | null;
          duplicate_hash: string | null;
          featured_until: string | null;
          health_score: number;
          id: string;
          images: string[];
          import_batch_id: string | null;
          is_active: boolean;
          is_vacant: boolean;
          is_verified: boolean;
          latitude: number | null;
          longitude: number | null;
          minimum_rent_period_months: number | null;
          neighborhood: string;
          nyumba_verified_at: string | null;
          organization_id: string | null;
          owner_id: string | null;
          price_period: Database["public"]["Enums"]["price_period"] | null;
          pricing_mode: Database["public"]["Enums"]["pricing_mode"];
          property_type: Database["public"]["Enums"]["property_type"];
          rent_kes: number;
          rent_kes_max: number | null;
          title: string;
          tour_url: string | null;
          updated_at: string;
          video_url: string | null;
          views: number;
          whatsapp_inquiries: boolean;
        };
        Insert: {
          address?: string | null;
          amenities?: string[];
          area_sqm?: number | null;
          area_sqm_max?: number | null;
          authenticity_score?: number;
          available_from?: string | null;
          bathrooms?: number;
          bedrooms?: number;
          boost_package?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          deposit_kes?: number | null;
          description?: string | null;
          duplicate_hash?: string | null;
          featured_until?: string | null;
          health_score?: number;
          id?: string;
          images?: string[];
          import_batch_id?: string | null;
          is_active?: boolean;
          is_vacant?: boolean;
          is_verified?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          minimum_rent_period_months?: number | null;
          neighborhood: string;
          nyumba_verified_at?: string | null;
          organization_id?: string | null;
          owner_id?: string | null;
          price_period?: Database["public"]["Enums"]["price_period"] | null;
          pricing_mode?: Database["public"]["Enums"]["pricing_mode"];
          property_type: Database["public"]["Enums"]["property_type"];
          rent_kes: number;
          rent_kes_max: number | null;
          title: string;
          tour_url?: string | null;
          updated_at?: string;
          video_url?: string | null;
          views?: number;
          whatsapp_inquiries?: boolean;
        };
        Update: {
          address?: string | null;
          amenities?: string[];
          area_sqm?: number | null;
          area_sqm_max?: number | null;
          authenticity_score?: number;
          available_from?: string | null;
          bathrooms?: number;
          bedrooms?: number;
          boost_package?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          deposit_kes?: number | null;
          description?: string | null;
          duplicate_hash?: string | null;
          featured_until?: string | null;
          health_score?: number;
          id?: string;
          images?: string[];
          import_batch_id?: string | null;
          is_active?: boolean;
          is_vacant?: boolean;
          is_verified?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          neighborhood?: string;
          nyumba_verified_at?: string | null;
          organization_id?: string | null;
          owner_id?: string | null;
          minimum_rent_period_months?: number | null;
          price_period?: Database["public"]["Enums"]["price_period"] | null;
          pricing_mode?: Database["public"]["Enums"]["pricing_mode"];
          property_type?: Database["public"]["Enums"]["property_type"];
          rent_kes?: number;
          rent_kes_max?: number | null;
          title?: string;
          tour_url?: string | null;
          updated_at?: string;
          video_url?: string | null;
          views?: number;
          whatsapp_inquiries?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      property_attributes: {
        Row: {
          has_backup_power: boolean | null;
          has_borehole: boolean | null;
          internet_providers: string[] | null;
          parking: boolean | null;
          pet_friendly: boolean | null;
          property_id: string;
          security_rating: number | null;
          updated_at: string;
          water_reliability: number | null;
        };
        Insert: {
          has_backup_power?: boolean | null;
          has_borehole?: boolean | null;
          internet_providers?: string[] | null;
          parking?: boolean | null;
          pet_friendly?: boolean | null;
          property_id: string;
          security_rating?: number | null;
          updated_at?: string;
          water_reliability?: number | null;
        };
        Update: {
          has_backup_power?: boolean | null;
          has_borehole?: boolean | null;
          internet_providers?: string[] | null;
          parking?: boolean | null;
          pet_friendly?: boolean | null;
          property_id?: string;
          security_rating?: number | null;
          updated_at?: string;
          water_reliability?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_attributes_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_quality_reports: {
        Row: {
          created_at: string;
          grade: string;
          id: string;
          improvements: Json;
          media_count: number;
          model: string | null;
          owner_id: string;
          property_id: string;
          score: number;
          strengths: Json;
          summary: string;
        };
        Insert: {
          created_at?: string;
          grade: string;
          id?: string;
          improvements?: Json;
          media_count?: number;
          model?: string | null;
          owner_id: string;
          property_id: string;
          score: number;
          strengths?: Json;
          summary: string;
        };
        Update: {
          created_at?: string;
          grade?: string;
          id?: string;
          improvements?: Json;
          media_count?: number;
          model?: string | null;
          owner_id?: string;
          property_id?: string;
          score?: number;
          strengths?: Json;
          summary?: string;
        };
        Relationships: [];
      };
      property_reviews: {
        Row: {
          accessibility: number | null;
          cleanliness: number | null;
          comment: string | null;
          created_at: string;
          electricity_reliability: number | null;
          id: string;
          internet_reliability: number | null;
          property_id: string;
          rating_overall: number;
          reviewer_id: string;
          security_rating: number | null;
          water_reliability: number | null;
        };
        Insert: {
          accessibility?: number | null;
          cleanliness?: number | null;
          comment?: string | null;
          created_at?: string;
          electricity_reliability?: number | null;
          id?: string;
          internet_reliability?: number | null;
          property_id: string;
          rating_overall: number;
          reviewer_id: string;
          security_rating?: number | null;
          water_reliability?: number | null;
        };
        Update: {
          accessibility?: number | null;
          cleanliness?: number | null;
          comment?: string | null;
          created_at?: string;
          electricity_reliability?: number | null;
          id?: string;
          internet_reliability?: number | null;
          property_id?: string;
          rating_overall?: number;
          reviewer_id?: string;
          security_rating?: number | null;
          water_reliability?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_reviews_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      property_views: {
        Row: {
          created_at: string;
          id: string;
          property_id: string;
          session_id: string | null;
          source: string | null;
          viewer_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          property_id: string;
          session_id?: string | null;
          source?: string | null;
          viewer_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          property_id?: string;
          session_id?: string | null;
          source?: string | null;
          viewer_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_views_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      push_tokens: {
        Row: {
          created_at: string;
          id: string;
          platform: string;
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          platform: string;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          platform?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_log: {
        Row: {
          id: string;
          identifier: string;
          endpoint: string;
          request_count: number;
          window_start: string;
          blocked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          identifier: string;
          endpoint: string;
          request_count?: number;
          window_start?: string;
          blocked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          identifier?: string;
          endpoint?: string;
          request_count?: number;
          window_start?: string;
          blocked?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      saved_properties: {
        Row: {
          created_at: string;
          id: string;
          property_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          property_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          property_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_properties_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      search_events: {
        Row: {
          created_at: string;
          id: string;
          neighborhood: string | null;
          query: string | null;
          result_count: number | null;
          session_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          neighborhood?: string | null;
          query?: string | null;
          result_count?: number | null;
          session_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          neighborhood?: string | null;
          query?: string | null;
          result_count?: number | null;
          session_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      saved_searches: {
        Row: {
          alert_enabled: boolean;
          created_at: string;
          criteria: Json;
          filters: Json;
          id: string;
          last_notified_at: string | null;
          name: string;
          user_id: string;
        };
        Insert: {
          alert_enabled?: boolean;
          created_at?: string;
          criteria?: Json;
          filters?: Json;
          id?: string;
          last_notified_at?: string | null;
          name: string;
          user_id: string;
        };
        Update: {
          alert_enabled?: boolean;
          created_at?: string;
          criteria?: Json;
          filters?: Json;
          id?: string;
          last_notified_at?: string | null;
          name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_searches_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      scam_reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          property_id: string;
          reason: string;
          reporter_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          property_id: string;
          reason: string;
          reporter_id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          property_id?: string;
          reason?: string;
          reporter_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scam_reports_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scam_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scam_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tenancies: {
        Row: {
          created_at: string;
          end_date: string | null;
          id: string;
          property_id: string;
          start_date: string;
          status: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          property_id: string;
          start_date: string;
          status?: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          property_id?: string;
          start_date?: string;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenancies_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenancies_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenancies_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      verifications: {
        Row: {
          created_at: string;
          documents: string[] | null;
          id: string;
          notes: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          verification_type: string;
        };
        Insert: {
          created_at?: string;
          documents?: string[] | null;
          id?: string;
          notes?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          verification_type: string;
        };
        Update: {
          created_at?: string;
          documents?: string[] | null;
          id?: string;
          notes?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          verification_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_sessions: {
        Row: {
          id: string;
          wa_phone: string;
          user_id: string | null;
          role: string;
          state: string;
          context: Json;
          last_message_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          wa_phone: string;
          user_id?: string | null;
          role?: string;
          state?: string;
          context?: Json;
          last_message_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          wa_phone?: string;
          user_id?: string | null;
          role?: string;
          state?: string;
          context?: Json;
          last_message_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_message_log: {
        Row: {
          id: string;
          wa_phone: string;
          direction: string;
          message_type: string;
          body: string | null;
          wa_message_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          wa_phone: string;
          direction: string;
          message_type?: string;
          body?: string | null;
          wa_message_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          wa_phone?: string;
          direction?: string;
          message_type?: string;
          body?: string | null;
          wa_message_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      whatsapp_link_events: {
        Row: {
          id: string;
          wa_phone: string;
          user_id: string;
          linked_at: string;
        };
        Insert: {
          id?: string;
          wa_phone: string;
          user_id: string;
          linked_at?: string;
        };
        Update: {
          id?: string;
          wa_phone?: string;
          user_id?: string;
          linked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_link_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_otp: {
        Row: {
          wa_phone: string;
          otp: string;
          user_id: string;
          expires_at: string;
        };
        Insert: {
          wa_phone: string;
          otp: string;
          user_id: string;
          expires_at: string;
        };
        Update: {
          wa_phone?: string;
          otp?: string;
          user_id?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_otp_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_reminder_log: {
        Row: {
          id: string;
          reminder_type: string;
          reference_id: string;
          wa_phone: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          reminder_type: string;
          reference_id: string;
          wa_phone: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          reminder_type?: string;
          reference_id?: string;
          wa_phone?: string;
          sent_at?: string;
        };
        Relationships: [];
      };
      viewings: {
        Row: {
          created_at: string;
          id: string;
          landlord_id: string;
          notes: string | null;
          property_id: string;
          scheduled_at: string;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          landlord_id: string;
          notes?: string | null;
          property_id: string;
          scheduled_at: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          landlord_id?: string;
          notes?: string | null;
          property_id?: string;
          scheduled_at?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "viewings_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewings_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewings_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "viewings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null;
          full_name: string | null;
          id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          full_name?: string | null;
          id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          full_name?: string | null;
          id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_founding_member_slot: {
        Args: { p_user_id: string; p_campaign_id: string };
        Returns: { claimed: boolean; slot_number: number | null }[];
      };
      confirm_founding_member_bonus: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      release_founding_member_slot: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      compute_authenticity_score: {
        Args: { _property_id: string };
        Returns: number;
      };
      compute_health_score: { Args: { _property_id: string }; Returns: number };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      record_property_view: {
        Args: {
          _property_id: string;
          _session_id?: string;
          _source?: string;
          _viewer_id?: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "tenant" | "landlord" | "manager" | "caretaker" | "admin" | "agency";
      property_type:
        | "bedsitter"
        | "single_room"
        | "one_bedroom"
        | "two_bedroom"
        | "three_bedroom"
        | "studio"
        | "hostel"
        | "maisonette"
        | "bungalow"
        | "townhouse"
        | "four_bedroom"
        | "penthouse"
        | "guest_house"
        | "commercial"
        | "bnb"
        | "hotel"
        | "villa";
      price_period: "night" | "week" | "month";
      pricing_mode: "rent" | "sale" | "booking";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  },
  CompositeTypeName extends
    keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"],
> = DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName];

export const Constants = {
  public: {
    Enums: {
      app_role: ["tenant", "landlord", "manager", "caretaker", "admin", "agency"],
      property_type: [
        "bedsitter",
        "single_room",
        "one_bedroom",
        "two_bedroom",
        "three_bedroom",
        "studio",
        "hostel",
        "maisonette",
        "bungalow",
        "townhouse",
        "four_bedroom",
        "penthouse",
        "guest_house",
        "commercial",
        "bnb",
        "hotel",
        "villa",
      ],
      price_period: ["night", "week", "month"],
      pricing_mode: ["rent", "sale", "booking"],
    },
  },
} as const;
