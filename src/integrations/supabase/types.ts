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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          performed_by: string | null
          timestamp: string
        }
        Insert: {
          action: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          timestamp?: string
        }
        Update: {
          action?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      bags: {
        Row: {
          bag_number: string
          created_at: string
          created_by: string | null
          id: string
          site_destination: string | null
          site_origin: string | null
          status: Database["public"]["Enums"]["bag_status"]
          updated_at: string
        }
        Insert: {
          bag_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          site_destination?: string | null
          site_origin?: string | null
          status?: Database["public"]["Enums"]["bag_status"]
          updated_at?: string
        }
        Update: {
          bag_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          site_destination?: string | null
          site_origin?: string | null
          status?: Database["public"]["Enums"]["bag_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bags_site_destination_fkey"
            columns: ["site_destination"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bags_site_origin_fkey"
            columns: ["site_origin"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      cod_reconciliation: {
        Row: {
          amount_collected: number
          amount_remitted: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          notes: string | null
          parcel_id: string
          remitted_at: string | null
          rider_id: string
          status: Database["public"]["Enums"]["cod_status"]
        }
        Insert: {
          amount_collected?: number
          amount_remitted?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          parcel_id: string
          remitted_at?: string | null
          rider_id: string
          status?: Database["public"]["Enums"]["cod_status"]
        }
        Update: {
          amount_collected?: number
          amount_remitted?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          parcel_id?: string
          remitted_at?: string | null
          rider_id?: string
          status?: Database["public"]["Enums"]["cod_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cod_reconciliation_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_status_logs: {
        Row: {
          cod_amount: number | null
          created_at: string
          exception_type: string | null
          id: string
          new_status: Database["public"]["Enums"]["parcel_status"] | null
          notes: string | null
          old_status: Database["public"]["Enums"]["parcel_status"] | null
          parcel_id: string
          photo_url: string | null
          site_from: string | null
          site_to: string | null
          status: Database["public"]["Enums"]["parcel_status"]
          task_order: string | null
          updated_by: string | null
        }
        Insert: {
          cod_amount?: number | null
          created_at?: string
          exception_type?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["parcel_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["parcel_status"] | null
          parcel_id: string
          photo_url?: string | null
          site_from?: string | null
          site_to?: string | null
          status: Database["public"]["Enums"]["parcel_status"]
          task_order?: string | null
          updated_by?: string | null
        }
        Update: {
          cod_amount?: number | null
          created_at?: string
          exception_type?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["parcel_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["parcel_status"] | null
          parcel_id?: string
          photo_url?: string | null
          site_from?: string | null
          site_to?: string | null
          status?: Database["public"]["Enums"]["parcel_status"]
          task_order?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcel_status_logs_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      parcels: {
        Row: {
          actual_freight: number
          amount: number
          approval_status: string | null
          approved_by: string | null
          assigned_rider_id: string | null
          bag_id: string | null
          carrier: string | null
          cash_received_by: string | null
          cod_amount: number
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_type: string
          description: string
          estimated_freight: number | null
          external_order_ref: string | null
          external_source: string | null
          external_tracking_number: string | null
          goods_type: string
          id: string
          insurance_fee: number
          insured_amount: number
          is_external: boolean
          notes: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          photo_url: string | null
          pod_photo_path: string | null
          pod_signature: string | null
          product_service: string
          qr_code_data: string
          quantity: number
          receiver_landmark: string | null
          receiver_lat: number | null
          receiver_lng: number | null
          receiver_location: string
          receiver_map_url: string | null
          receiver_name: string
          receiver_phone: string
          reverse_receipts: boolean
          scheduled_date: string | null
          sender_landmark: string | null
          sender_lat: number | null
          sender_lng: number | null
          sender_location: string
          sender_map_url: string | null
          sender_name: string
          sender_phone: string
          service_class: string
          settlement_type: string
          site_destination: string | null
          site_origin: string | null
          status: Database["public"]["Enums"]["parcel_status"]
          submitted_by_rider: boolean
          tracking_number: string
          updated_at: string
          waybill_mode: string
          weight: number
        }
        Insert: {
          actual_freight?: number
          amount?: number
          approval_status?: string | null
          approved_by?: string | null
          assigned_rider_id?: string | null
          bag_id?: string | null
          carrier?: string | null
          cash_received_by?: string | null
          cod_amount?: number
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_type?: string
          description?: string
          estimated_freight?: number | null
          external_order_ref?: string | null
          external_source?: string | null
          external_tracking_number?: string | null
          goods_type?: string
          id?: string
          insurance_fee?: number
          insured_amount?: number
          is_external?: boolean
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          photo_url?: string | null
          pod_photo_path?: string | null
          pod_signature?: string | null
          product_service?: string
          qr_code_data: string
          quantity?: number
          receiver_landmark?: string | null
          receiver_lat?: number | null
          receiver_lng?: number | null
          receiver_location: string
          receiver_map_url?: string | null
          receiver_name: string
          receiver_phone: string
          reverse_receipts?: boolean
          scheduled_date?: string | null
          sender_landmark?: string | null
          sender_lat?: number | null
          sender_lng?: number | null
          sender_location: string
          sender_map_url?: string | null
          sender_name: string
          sender_phone: string
          service_class?: string
          settlement_type?: string
          site_destination?: string | null
          site_origin?: string | null
          status?: Database["public"]["Enums"]["parcel_status"]
          submitted_by_rider?: boolean
          tracking_number: string
          updated_at?: string
          waybill_mode?: string
          weight?: number
        }
        Update: {
          actual_freight?: number
          amount?: number
          approval_status?: string | null
          approved_by?: string | null
          assigned_rider_id?: string | null
          bag_id?: string | null
          carrier?: string | null
          cash_received_by?: string | null
          cod_amount?: number
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_type?: string
          description?: string
          estimated_freight?: number | null
          external_order_ref?: string | null
          external_source?: string | null
          external_tracking_number?: string | null
          goods_type?: string
          id?: string
          insurance_fee?: number
          insured_amount?: number
          is_external?: boolean
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          photo_url?: string | null
          pod_photo_path?: string | null
          pod_signature?: string | null
          product_service?: string
          qr_code_data?: string
          quantity?: number
          receiver_landmark?: string | null
          receiver_lat?: number | null
          receiver_lng?: number | null
          receiver_location?: string
          receiver_map_url?: string | null
          receiver_name?: string
          receiver_phone?: string
          reverse_receipts?: boolean
          scheduled_date?: string | null
          sender_landmark?: string | null
          sender_lat?: number | null
          sender_lng?: number | null
          sender_location?: string
          sender_map_url?: string | null
          sender_name?: string
          sender_phone?: string
          service_class?: string
          settlement_type?: string
          site_destination?: string | null
          site_origin?: string | null
          status?: Database["public"]["Enums"]["parcel_status"]
          submitted_by_rider?: boolean
          tracking_number?: string
          updated_at?: string
          waybill_mode?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcels_bag_id_fkey"
            columns: ["bag_id"]
            isOneToOne: false
            referencedRelation: "bags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_site_destination_fkey"
            columns: ["site_destination"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_site_origin_fkey"
            columns: ["site_origin"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          staff_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          staff_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          staff_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rider_shifts: {
        Row: {
          created_at: string
          end_lat: number | null
          end_lng: number | null
          ended_at: string | null
          id: string
          notes: string | null
          rider_id: string
          start_lat: number | null
          start_lng: number | null
          started_at: string
        }
        Insert: {
          created_at?: string
          end_lat?: number | null
          end_lng?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          rider_id: string
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string
        }
        Update: {
          created_at?: string
          end_lat?: number | null
          end_lng?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          rider_id?: string
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          location: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_code_counters: {
        Row: {
          next_value: number
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          next_value?: number
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          next_value?: number
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_bag_number: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_staff_code: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: string
      }
    }
    Enums: {
      app_role: "super_admin" | "office" | "rider"
      bag_status: "open" | "sealed" | "in_transit" | "arrived"
      cod_status: "pending" | "remitted" | "confirmed"
      parcel_status:
        | "Created"
        | "Picked Up"
        | "Departed"
        | "Arrived"
        | "Ready for Collection"
        | "Out for Delivery"
        | "Delivered"
        | "Return Delivered"
        | "On Hold"
        | "Vehicle Sealed"
        | "Unsealed"
        | "Exception"
        | "Returned"
        | "Payment Collected"
        | "Rescheduled"
      payment_type: "cod" | "prepaid"
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
      app_role: ["super_admin", "office", "rider"],
      bag_status: ["open", "sealed", "in_transit", "arrived"],
      cod_status: ["pending", "remitted", "confirmed"],
      parcel_status: [
        "Created",
        "Picked Up",
        "Departed",
        "Arrived",
        "Ready for Collection",
        "Out for Delivery",
        "Delivered",
        "Return Delivered",
        "On Hold",
        "Vehicle Sealed",
        "Unsealed",
        "Exception",
        "Returned",
        "Payment Collected",
        "Rescheduled",
      ],
      payment_type: ["cod", "prepaid"],
    },
  },
} as const
