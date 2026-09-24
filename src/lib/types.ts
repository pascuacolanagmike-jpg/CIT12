export interface Student {
  id: string;
  user_id: string;
  full_name: string;
  age: number | null;
  birthdate: string | null;
  sex: string | null;
  blood_type: string | null;
  baranggay: string | null;
  address: string | null;
  contact_number: string | null;
  guardian_name: string | null;
  student_id: string | null;
  photo_url: string | null;
  landmarks: { x: number; y: number }[] | null;
  descriptor: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface RecognitionLog {
  id: string;
  user_id: string;
  student_id: string | null;
  image_url: string | null;
  landmarks: { x: number; y: number }[] | null;
  descriptor: number[] | null;
  confidence: number | null;
  matched: boolean;
  device_id: string | null;
  created_at: string;
  student?: Student | null;
}

export interface StudentInput {
  full_name: string;
  age?: number | null;
  birthdate?: string | null;
  sex?: string | null;
  blood_type?: string | null;
  baranggay?: string | null;
  address?: string | null;
  contact_number?: string | null;
  guardian_name?: string | null;
  student_id?: string | null;
  photo_url?: string | null;
  landmarks?: { x: number; y: number }[] | null;
  descriptor?: number[] | null;
}
