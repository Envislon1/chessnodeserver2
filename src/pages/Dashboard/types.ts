
export interface InverterSystem {
  id: string;
  name: string;
  location: string;
  model: string;
  system_id?: string;
  firebase_id?: string; // Adding as optional property since it's derived
  capacity?: number;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface InverterSystemParameters {
  battery_percentage: number;
  battery_voltage: number;
  output_capacity: number;
  output_voltage: number;
  output_power: number;
  frequency: number;
  power_factor: number;
  mains_present: boolean;
  solar_present: boolean;
  energy_kwh: number;
  apparent_power: number;
  reactive_power: number;
  real_power: number;
  acv_rms: number;
  acv_peak_peak: number;
  acc_rms: number;
  acc_peak_peak: number;
}
