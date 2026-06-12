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
          mpesa_checkout_id: string | null;
          mpesa_phone: string | null;
          mpesa_receipt: string | null;
          payment_type: string;
          property_id: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          amount_kes: number;
          created_at?: string;
          id?: string;
          mpesa_checkout_id?: string | null;
          mpesa_phone?: string | null;
          mpesa_receipt?: string | null;
          payment_type: string;
          property_id?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          amount_kes?: number;
          created_at?: string;
          id?: string;
          mpesa_checkout_id?: string | null;
          mpesa_phone?: string | null;
          mpesa_receipt?: string | null;
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
          id: string;
          next_billing_date: string;
          payment_method: string;
          plan: string;
          start_date: string;
          status: string;
          user_id: string;
        };
        Insert: {
          amount_kes: number;
          billing_cycle?: string;
          created_at?: string;
          id?: string;
          next_billing_date: string;
          payment_method?: string;
          plan: string;
          start_date?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          amount_kes?: number;
          billing_cycle?: string;
          created_at?: string;
          id?: string;
          next_billing_date?: string;
          payment_method?: string;
          plan?: string;
          start_date?: string;
          status?: string;
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
      profiles: {
        Row: {
          active_portal: string | null;
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          is_portal_active: boolean;
          landlord_plan: string;
          phone: string | null;
          plus_expires_at: string | null;
          tenant_plan: string;
          updated_at: string;
        };
        Insert: {
          active_portal?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          is_portal_active?: boolean;
          landlord_plan?: string;
          phone?: string | null;
          plus_expires_at?: string | null;
          tenant_plan?: string;
          updated_at?: string;
        };
        Update: {
          active_portal?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          is_portal_active?: boolean;
          landlord_plan?: string;
          phone?: string | null;
          plus_expires_at?: string | null;
          tenant_plan?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          address: string | null;
          amenities: string[];
          area_sqm: number | null;
          authenticity_score: number;
          available_from: string | null;
          bathrooms: number;
          bedrooms: number;
          boost_package: string | null;
          created_at: string;
          deposit_kes: number | null;
          description: string | null;
          featured_until: string | null;
          health_score: number;
          id: string;
          images: string[];
          is_active: boolean;
          is_vacant: boolean;
          is_verified: boolean;
          latitude: number | null;
          longitude: number | null;
          neighborhood: string;
          nyumba_verified_at: string | null;
          organization_id: string | null;
          owner_id: string | null;
          property_type: Database["public"]["Enums"]["property_type"];
          rent_kes: number;
          title: string;
          tour_url: string | null;
          updated_at: string;
          video_url: string | null;
          views: number;
        };
        Insert: {
          address?: string | null;
          amenities?: string[];
          area_sqm?: number | null;
          authenticity_score?: number;
          available_from?: string | null;
          bathrooms?: number;
          bedrooms?: number;
          boost_package?: string | null;
          created_at?: string;
          deposit_kes?: number | null;
          description?: string | null;
          featured_until?: string | null;
          health_score?: number;
          id?: string;
          images?: string[];
          is_active?: boolean;
          is_vacant?: boolean;
          is_verified?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          neighborhood: string;
          nyumba_verified_at?: string | null;
          organization_id?: string | null;
          owner_id?: string | null;
          property_type: Database["public"]["Enums"]["property_type"];
          rent_kes: number;
          title: string;
          tour_url?: string | null;
          updated_at?: string;
          video_url?: string | null;
          views?: number;
        };
        Update: {
          address?: string | null;
          amenities?: string[];
          area_sqm?: number | null;
          authenticity_score?: number;
          available_from?: string | null;
          bathrooms?: number;
          bedrooms?: number;
          boost_package?: string | null;
          created_at?: string;
          deposit_kes?: number | null;
          description?: string | null;
          featured_until?: string | null;
          health_score?: number;
          id?: string;
          images?: string[];
          is_active?: boolean;
          is_vacant?: boolean;
          is_verified?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          neighborhood?: string;
          nyumba_verified_at?: string | null;
          organization_id?: string | null;
          owner_id?: string | null;
          property_type?: Database["public"]["Enums"]["property_type"];
          rent_kes?: number;
          title?: string;
          tour_url?: string | null;
          updated_at?: string;
          video_url?: string | null;
          views?: number;
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
      saved_searches: {
        Row: {
          alert_enabled: boolean;
          created_at: string;
          criteria: Json;
          filters: Json;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          alert_enabled?: boolean;
          created_at?: string;
          criteria?: Json;
          filters?: Json;
          id?: string;
          name: string;
          user_id: string;
        };
        Update: {
          alert_enabled?: boolean;
          created_at?: string;
          criteria?: Json;
          filters?: Json;
          id?: string;
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
        | "townhouse";
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
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
      ],
    },
  },
} as const;
