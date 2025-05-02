export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_settings: {
        Row: {
          created_at: string | null
          firebase_api_key: string
          firebase_url: string
          id: string
          password_hash: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          firebase_api_key: string
          firebase_url: string
          id: string
          password_hash: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          firebase_api_key?: string
          firebase_url?: string
          id?: string
          password_hash?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_settings_log: {
        Row: {
          action: string
          id: string
          new_url: string | null
          previous_url: string | null
          timestamp: string | null
        }
        Insert: {
          action: string
          id?: string
          new_url?: string | null
          previous_url?: string | null
          timestamp?: string | null
        }
        Update: {
          action?: string
          id?: string
          new_url?: string | null
          previous_url?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      business_data: {
        Row: {
          content: Json
          created_at: string | null
          data_type: string
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content?: Json
          created_at?: string | null
          data_type: string
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          data_type?: string
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_logs: {
        Row: {
          ai_response: string | null
          created_at: string | null
          customer_number: string
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          ai_response?: string | null
          created_at?: string | null
          customer_number: string
          id?: string
          message: string
          user_id?: string | null
        }
        Update: {
          ai_response?: string | null
          created_at?: string | null
          customer_number?: string
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      device_data: {
        Row: {
          data: string | null
          device_id: string
          id: string
          timestamp: string | null
        }
        Insert: {
          data?: string | null
          device_id: string
          id?: string
          timestamp?: string | null
        }
        Update: {
          data?: string | null
          device_id?: string
          id?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      display_name: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      inverter_loads: {
        Row: {
          created_at: string | null
          id: string
          inverter_id: string | null
          load_number: number
          name: string
          state: boolean | null
          system_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inverter_id?: string | null
          load_number: number
          name: string
          state?: boolean | null
          system_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inverter_id?: string | null
          load_number?: number
          name?: string
          state?: boolean | null
          system_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inverter_loads_inverter_id_fkey"
            columns: ["inverter_id"]
            isOneToOne: false
            referencedRelation: "inverter_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      inverter_parameters: {
        Row: {
          acc_peak_peak: number | null
          acc_rms: number | null
          acv_peak_peak: number | null
          acv_rms: number | null
          apparent_power: number | null
          battery_percentage: number | null
          battery_voltage: number | null
          energy_kwh: number | null
          frequency: number | null
          id: string
          inverter_id: string
          mains_present: boolean | null
          output_capacity: number | null
          output_power: number | null
          output_voltage: number | null
          power_factor: number | null
          reactive_power: number | null
          real_power: number | null
          solar_present: boolean | null
          timestamp: string
        }
        Insert: {
          acc_peak_peak?: number | null
          acc_rms?: number | null
          acv_peak_peak?: number | null
          acv_rms?: number | null
          apparent_power?: number | null
          battery_percentage?: number | null
          battery_voltage?: number | null
          energy_kwh?: number | null
          frequency?: number | null
          id?: string
          inverter_id: string
          mains_present?: boolean | null
          output_capacity?: number | null
          output_power?: number | null
          output_voltage?: number | null
          power_factor?: number | null
          reactive_power?: number | null
          real_power?: number | null
          solar_present?: boolean | null
          timestamp?: string
        }
        Update: {
          acc_peak_peak?: number | null
          acc_rms?: number | null
          acv_peak_peak?: number | null
          acv_rms?: number | null
          apparent_power?: number | null
          battery_percentage?: number | null
          battery_voltage?: number | null
          energy_kwh?: number | null
          frequency?: number | null
          id?: string
          inverter_id?: string
          mains_present?: boolean | null
          output_capacity?: number | null
          output_power?: number | null
          output_voltage?: number | null
          power_factor?: number | null
          reactive_power?: number | null
          real_power?: number | null
          solar_present?: boolean | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "inverter_parameters_inverter_id_fkey"
            columns: ["inverter_id"]
            isOneToOne: false
            referencedRelation: "inverter_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      inverter_schedules: {
        Row: {
          created_at: string
          days_of_week: string[]
          id: string
          is_active: boolean
          state: boolean
          system_id: string
          trigger_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_of_week: string[]
          id?: string
          is_active?: boolean
          state: boolean
          system_id: string
          trigger_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_of_week?: string[]
          id?: string
          is_active?: boolean
          state?: boolean
          system_id?: string
          trigger_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      inverter_sharing: {
        Row: {
          can_control: boolean
          id: string
          shared_at: string
          shared_by: string | null
          shared_with: string
          system_id: string
        }
        Insert: {
          can_control?: boolean
          id?: string
          shared_at?: string
          shared_by?: string | null
          shared_with: string
          system_id: string
        }
        Update: {
          can_control?: boolean
          id?: string
          shared_at?: string
          shared_by?: string | null
          shared_with?: string
          system_id?: string
        }
        Relationships: []
      }
      inverter_systems: {
        Row: {
          capacity: number | null
          created_at: string
          firebase_id: string | null
          id: string
          location: string | null
          model: string | null
          name: string
          system_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          firebase_id?: string | null
          id?: string
          location?: string | null
          model?: string | null
          name: string
          system_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          firebase_id?: string | null
          id?: string
          location?: string | null
          model?: string | null
          name?: string
          system_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          gaming_preferences: Json | null
          id: string
          is_demo: boolean | null
          rating: number | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          gaming_preferences?: Json | null
          id?: string
          is_demo?: boolean | null
          rating?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          gaming_preferences?: Json | null
          id?: string
          is_demo?: boolean | null
          rating?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      schedule_executions: {
        Row: {
          error: string | null
          executed_at: string
          id: string
          result: Json | null
          schedule_id: string
          success: boolean
          system_id: string
        }
        Insert: {
          error?: string | null
          executed_at?: string
          id?: string
          result?: Json | null
          schedule_id: string
          success: boolean
          system_id: string
        }
        Update: {
          error?: string | null
          executed_at?: string
          id?: string
          result?: Json | null
          schedule_id?: string
          success?: boolean
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_executions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "inverter_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_actions_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          system_id: string
          triggered_by: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          system_id: string
          triggered_by: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          system_id?: string
          triggered_by?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          auto_reply_enabled: boolean | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_reply_enabled?: boolean | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_reply_enabled?: boolean | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string | null
          display_preferences: Json | null
          id: string
          language: string | null
          notification_preferences: Json | null
          privacy_settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_preferences?: Json | null
          id: string
          language?: string | null
          notification_preferences?: Json | null
          privacy_settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_preferences?: Json | null
          id?: string
          language?: string | null
          notification_preferences?: Json | null
          privacy_settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          business_name: string
          created_at: string | null
          id: string
          last_active: string | null
          whatsapp_number: string
        }
        Insert: {
          business_name: string
          created_at?: string | null
          id?: string
          last_active?: string | null
          whatsapp_number: string
        }
        Update: {
          business_name?: string
          created_at?: string | null
          id?: string
          last_active?: string | null
          whatsapp_number?: string
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          phone_number_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          phone_number_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          phone_number_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_time: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
