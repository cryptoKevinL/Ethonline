import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types based on your existing schema
export interface Employer {
  id: string
  name: string
  email: string
  created_at?: string
  updated_at?: string
}

export interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string
  created_at?: string
  updated_at?: string
}

export interface Employment {
  id: string
  employer_id: string
  employee_id: string
  status: string
  role: string
  payment_amount?: string // Now decimal type - stored as string to preserve precision
  payment_frequency?: string
  chain?: string
  token?: string
  token_contract?: string
  token_decimals?: number
  created_at?: string
  updated_at?: string
}

export interface Wallet {
  id: string
  employment_id: string
  chain: string
  token: string
  token_contract?: string
  token_decimals?: number
  account_address: string
  is_default: boolean
  created_at?: string
}

export interface EmployerProfileData {
  name: string
  email: string
}

export interface Payment {
  id: string
  employment_id: string
  employer_id: string
  employee_id: string
  chain: string
  token: string
  token_contract?: string
  token_decimals?: number
  amount_token: string // Numeric amount with precision (78, 18)
  period_start?: string // Date
  period_end?: string // Date
  pay_date: string // Date, defaults to CURRENT_DATE
  recipient: string // Employee wallet address
  tx_hash?: string // Transaction hash
  status: 'pending' | 'confirmed' | 'failed'
  created_at: string
  updated_at: string
}

export interface EmployeeProfileData {
  first_name: string
  last_name: string
  email: string
  wallet_address: string
  preferred_chain: string
  preferred_token: string
}
