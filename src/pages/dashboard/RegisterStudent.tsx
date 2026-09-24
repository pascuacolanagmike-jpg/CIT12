import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { loadFaceModels, extractFaceData, drawLandmarksOnCanvas, type FaceData } from '@/lib/faceApi';
import {
  UserPlus,
  Upload,
  ScanFace,
  CheckCircle,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Save,
} from 'lucide-react';

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const sexOptions = ['Male', 'Female', 'Other'];

export default function RegisterStudent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [faceData, setFaceData] = useState<FaceData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    student_id: '',
    age: '',
    birthdate: '',
    sex: '',
    blood_type: '',
    baranggay: '',
    address: '',
    contact_number: '',
    guardian_name: '',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    setError(null);
    setPhotoFile(file);
    setFaceData(null);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
  };

  const processFace = useCallback(async () => {
    if (!imageRef.current) return;
    setProcessing(true);
    setError(null);
    try {
      // Ensure models are loaded
      setModelsLoading(true);
      await loadFaceModels();
      setModelsLoading(false);

      const data = await extractFaceData(imageRef.current, true);
      if (!data) {
        setError('No face detected in the uploaded image. Please use a clear, front-facing photo.');
        setFaceData(null);
        setProcessing(false);
        return;
      }

      setFaceData(data);
      if (canvasRef.current && imageRef.current) {
        drawLandmarksOnCanvas(canvasRef.current, imageRef.current, data);
      }
    } catch (err) {
      setError('Failed to process image: ' + (err as Error).message);
    }
    setProcessing(false);
  }, []);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!form.full_name.trim()) {
      setError('Full name is required');
      return;
    }
    if (!faceData) {
      setError('Please upload a photo and extract facial landmarks first');
      return;
    }
    if (!photoFile) {
      setError('No photo file found');
      return;
    }

    setSaving(true);
    try {
      // Upload photo to storage
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const fileName = `students/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('faces')
        .upload(fileName, photoFile, { contentType: photoFile.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('faces').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // Insert student record
      const { error: insertError } = await supabase.from('students').insert({
        full_name: form.full_name.trim(),
        student_id: form.student_id || null,
        age: form.age ? parseInt(form.age) : null,
        birthdate: form.birthdate || null,
        sex: form.sex || null,
        blood_type: form.blood_type || null,
        baranggay: form.baranggay || null,
        address: form.address || null,
        contact_number: form.contact_number || null,
        guardian_name: form.guardian_name || null,
        photo_url: publicUrl,
        landmarks: faceData.landmarks,
        descriptor: faceData.descriptor,
      });

      if (insertError) throw insertError;

      setSuccess('Student registered successfully! You can now register another student.');
      // Reset form
      setForm({
        full_name: '',
        student_id: '',
        age: '',
        birthdate: '',
        sex: '',
        blood_type: '',
        baranggay: '',
        address: '',
        contact_number: '',
        guardian_name: '',
      });
      setPhotoUrl(null);
      setPhotoFile(null);
      setFaceData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError('Failed to save student: ' + (err as Error).message);
    }
    setSaving(false);
  };

  const inputClass =
    'w-full rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5';

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
            <UserPlus className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Register Student</h1>
            <p className="text-sm text-slate-400">Upload a face photo and enter student details</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Photo upload + face extraction */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Face Photo</h2>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative aspect-square rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-900 flex items-center justify-center cursor-pointer transition overflow-hidden group"
          >
            {photoUrl ? (
              <>
                <img
                  ref={imageRef}
                  src={photoUrl}
                  alt="Uploaded"
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                  onLoad={() => {
                    // Auto-process face when image loads
                    if (imageRef.current && !faceData && !processing) {
                      processFace();
                    }
                  }}
                />
                {faceData && canvasRef.current && (
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
                )}
              </>
            ) : (
              <div className="text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-500/10 transition">
                  <Upload className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 transition" />
                </div>
                <p className="text-white font-medium">Click to upload photo</p>
                <p className="text-sm text-slate-500 mt-1">JPG, PNG up to 5MB</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Face processing status */}
          {(processing || modelsLoading) && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <div>
                <p className="text-sm text-blue-400 font-medium">
                  {modelsLoading ? 'Loading AI models...' : 'Extracting facial landmarks...'}
                </p>
                <p className="text-xs text-slate-400">This may take a few seconds</p>
              </div>
            </div>
          )}

          {faceData && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-emerald-400 font-medium">Face detected successfully</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {faceData.landmarks.length} landmark points + 128-value recognition descriptor extracted
                </p>
              </div>
              <ScanFace className="w-6 h-6 text-emerald-400" />
            </div>
          )}

          {photoUrl && !faceData && !processing && !modelsLoading && (
            <button
              onClick={processFace}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 text-sm transition"
            >
              <ScanFace className="w-4 h-4" />
              Re-extract Face Data
            </button>
          )}
        </div>

        {/* Right: Student details form */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Student Details</h2>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Full Name *</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className={inputClass}
                placeholder="Juan Dela Cruz"
              />
            </div>

            <div>
              <label className={labelClass}>Student ID</label>
              <input
                type="text"
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                className={inputClass}
                placeholder="2024-00123"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Birthdate</label>
                <input
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Age</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  className={inputClass}
                  placeholder="18"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Sex</label>
                <select
                  value={form.sex}
                  onChange={(e) => setForm({ ...form, sex: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  {sexOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Blood Type</label>
                <select
                  value={form.blood_type}
                  onChange={(e) => setForm({ ...form, blood_type: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  {bloodTypes.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Barangay</label>
              <input
                type="text"
                value={form.baranggay}
                onChange={(e) => setForm({ ...form, baranggay: e.target.value })}
                className={inputClass}
                placeholder="Barangay San Roque"
              />
            </div>

            <div>
              <label className={labelClass}>Full Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputClass}
                placeholder="123 Rizal St, Quezon City"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Contact Number</label>
                <input
                  type="text"
                  value={form.contact_number}
                  onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                  className={inputClass}
                  placeholder="0912 345 6789"
                />
              </div>
              <div>
                <label className={labelClass}>Guardian Name</label>
                <input
                  type="text"
                  value={form.guardian_name}
                  onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                  className={inputClass}
                  placeholder="Maria Dela Cruz"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !faceData}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 text-sm transition mt-6"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Register Student
                </>
              )}
            </button>
            {!faceData && (
              <p className="text-xs text-slate-500 text-center">
                Upload a photo and extract face data before saving
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
