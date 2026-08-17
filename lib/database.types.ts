export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string | null; full_name: string | null; created_at: string }
        Insert: { id: string; email?: string | null; full_name?: string | null; created_at?: string }
        Update: { id?: string; email?: string | null; full_name?: string | null; created_at?: string }
        Relationships: []
      }
      organizations: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      organization_members: {
        Row: { organization_id: string; user_id: string; role: string; created_at: string }
        Insert: { organization_id: string; user_id: string; role?: string; created_at?: string }
        Update: { organization_id?: string; user_id?: string; role?: string; created_at?: string }
        Relationships: [{ foreignKeyName: 'organization_members_organization_id_fkey'; columns: ['organization_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] }]
      }
      employees: {
        Row: { id: string; organization_id: string; name: string; role: string; goal: string; status: string; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; organization_id: string; name: string; role: string; goal: string; status?: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; role?: string; goal?: string; status?: string; created_by?: string; created_at?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: 'employees_organization_id_fkey'; columns: ['organization_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] }]
      }
      employee_versions: {
        Row: { id: string; employee_id: string; version: number; specification: Json; created_by: string; created_at: string }
        Insert: { id?: string; employee_id: string; version: number; specification: Json; created_by: string; created_at?: string }
        Update: { id?: string; employee_id?: string; version?: number; specification?: Json; created_by?: string; created_at?: string }
        Relationships: [{ foreignKeyName: 'employee_versions_employee_id_fkey'; columns: ['employee_id']; isOneToOne: false; referencedRelation: 'employees'; referencedColumns: ['id'] }]
      }
      ai_usage_events: {
        Row: { id: string; organization_id: string; employee_id: string | null; task: string; model: string; input_tokens: number; cached_input_tokens: number; output_tokens: number; estimated_cost_usd: number; created_by: string; created_at: string }
        Insert: { id?: string; organization_id: string; employee_id?: string | null; task: string; model: string; input_tokens?: number; cached_input_tokens?: number; output_tokens?: number; estimated_cost_usd?: number; created_by: string; created_at?: string }
        Update: { id?: string; organization_id?: string; employee_id?: string | null; task?: string; model?: string; input_tokens?: number; cached_input_tokens?: number; output_tokens?: number; estimated_cost_usd?: number; created_by?: string; created_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_employee_with_version: {
        Args: { p_organization_id: string; p_name: string; p_role: string; p_goal: string; p_specification: Json }
        Returns: string
      }
      is_org_member: { Args: { target_org: string }; Returns: boolean }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
