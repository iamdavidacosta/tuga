export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type MedicationRow = {
  id: string
  user_id: string
  name: string
  dosage_amount: number
  dosage_unit: string
  instructions: string | null
  notes: string | null
  start_date: string
  end_date: string | null
  duration_config: Json
  status: string
  created_at: string
  updated_at: string
}

type MedicationScheduleRow = {
  id: string
  medication_id: string
  user_id: string
  schedule_type: string
  local_times: string[]
  timezone: string
  recurrence_config: Json
  retired_at: string | null
  effective_from: string
  effective_until: string | null
  treatment_start: string
  treatment_end: string | null
  medication_name: string
  dosage_amount: number
  dosage_unit: string
  created_at: string
  updated_at: string
}

type DoseOccurrenceRow = {
  id: string
  medication_id: string
  schedule_id: string
  user_id: string
  scheduled_at: string
  status: 'pending' | 'taken' | 'skipped'
  taken_at: string | null
  medication_name: string
  dosage_amount: number
  dosage_unit: string
  created_at: string
  updated_at: string
}

type DoseOccurrenceResult = {
  id: string
  medication_id: string
  schedule_id: string
  medication_name: string
  dosage_amount: number
  dosage_unit: string
  scheduled_at: string
  status: string
  taken_at: string | null
  updated_at: string
  local_date: string
  local_time: string
  display_timezone: string
}

type DoseTransitionResult = {
  occurrence_id: string
  occurrence_status: string
  confirmed_at: string | null
  changed_at: string
}

type PushStatusResult = {
  current_device_active: boolean
  active_devices: number
  last_test_at: string | null
  last_test_status: string | null
}

export type Database = {
  public: {
    Tables: {
      medications: {
        Row: MedicationRow
        ComputedFields: never
        Insert: Omit<MedicationRow, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'duration_config' | 'status'> & {
          id?: string
          user_id?: string
          duration_config?: Json
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<MedicationRow>
        Relationships: []
      }
      medication_schedules: {
        Row: MedicationScheduleRow
        ComputedFields: never
        Insert: Omit<MedicationScheduleRow, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'retired_at'> & {
          id?: string
          user_id?: string
          retired_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<MedicationScheduleRow>
        Relationships: []
      }
      medication_versions: {
        Row: {
          id: string
          medication_id: string
          user_id: string
          name: string
          dosage_amount: number
          dosage_unit: string
          instructions: string | null
          notes: string | null
          start_date: string
          end_date: string | null
          duration_config: Json
          status: string
          valid_from: string
          valid_to: string
          created_at: string
        }
        ComputedFields: never
        Insert: never
        Update: never
        Relationships: []
      }
      dose_occurrences: {
        Row: DoseOccurrenceRow
        ComputedFields: never
        Insert: never
        Update: never
        Relationships: []
      }
      dose_occurrence_events: {
        Row: {
          id: string
          occurrence_id: string
          medication_id: string
          user_id: string
          previous_status: string
          new_status: string
          previous_taken_at: string | null
          new_taken_at: string | null
          created_at: string
        }
        ComputedFields: never
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      create_medication_with_schedule: {
        Args: MedicationMutationArguments
        Returns: string
      }
      update_medication_with_schedule: {
        Args: MedicationMutationArguments
        Returns: string
      }
      suspend_medication: {
        Args: { p_medication_id: string }
        Returns: string
      }
      ensure_dose_occurrences: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      list_dose_occurrences: {
        Args: { p_from: string; p_to: string }
        Returns: DoseOccurrenceResult[]
      }
      get_dose_occurrence: {
        Args: { p_occurrence_id: string }
        Returns: DoseOccurrenceResult[]
      }
      get_dose_context: {
        Args: Record<never, never>
        Returns: { display_timezone: string; local_date: string }[]
      }
      confirm_dose_occurrence: {
        Args: { p_occurrence_id: string }
        Returns: DoseTransitionResult[]
      }
      skip_dose_occurrence: {
        Args: { p_occurrence_id: string }
        Returns: DoseTransitionResult[]
      }
      correct_dose_occurrence: {
        Args: { p_occurrence_id: string }
        Returns: DoseTransitionResult[]
      }
      upsert_push_subscription: {
        Args: {
          p_endpoint: string
          p_p256dh: string
          p_auth_key: string
          p_expiration_time: number | null
          p_device_label: string | null
        }
        Returns: string
      }
      deactivate_push_subscription: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      get_push_notification_status: {
        Args: { p_endpoint: string }
        Returns: PushStatusResult[]
      }
      postpone_dose_occurrence: {
        Args: { p_occurrence_id: string }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type MedicationMutationArguments = {
  p_medication_id: string
  p_name: string
  p_dosage_amount: number
  p_dosage_unit: string
  p_start_date: string
  p_end_date: string | null
  p_duration_config: Json
  p_schedule_type: string
  p_local_times: string[]
  p_timezone: string
  p_recurrence_config: Json
}
