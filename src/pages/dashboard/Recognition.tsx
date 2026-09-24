import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { loadFaceModels, extractFaceData, findBestMatch, type FaceData } from '@/lib/faceApi';
import type { Student, RecognitionLog } from '@/lib/types';
import {
  Camera,
  ScanFace,
  CheckCircle,
  XCircle,
  Loader2,
  Upload,
  RefreshCw,
  Activity,
  Clock,
  User as UserIcon,
  Image as ImageIcon,
} from 'lucide-react';

export default function Recognition() {
  const [logs, setLogs] = useState<RecognitionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [testImage, setTestImage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    student?: Student;
    confidence?: number;
    faceData?: FaceData;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const testImageRef = useRef<HTMLImageElement | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('recognition_logs')
      .select('*, student:students(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setLogs(data as RecognitionLog[]);
    }
    setLoading(false);
  }, []);

  const fetchStudents = useCallback(async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('descriptor', 'not.null');

    if (!error && data) {
      setStudents(data as Student[]);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchStudents();
    loadFaceModels();
  }, [fetchLogs, fetchStudents]);

  const handleTestImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setTestResult(null);
    const url = URL.createObjectURL(file);
    setTestImage(url);

    // Wait for image to load, then process
    setTimeout(async () => {
      if (!testImageRef.current) {
        setProcessing(false);
        return;
      }

      try {
        const faceData = await extractFaceData(testImageRef.current, true);
        if (!faceData) {
          setTestResult({ matched: false, faceData: undefined });
          setProcessing(false);
          return;
        }

        // Find best match among enrolled students
        const knownDescriptors = students
          .filter((s) => s.descriptor)
          .map((s) => ({
            id: s.id,
            name: s.full_name,
            descriptor: s.descriptor!,
          }));

        const match = findBestMatch(faceData.descriptor, knownDescriptors);

        if (match && match.confidence > 0.5) {
          const matchedStudent = students.find((s) => s.id === match.id);
          setTestResult({
            matched: true,
            student: matchedStudent,
            confidence: match.confidence,
            faceData,
          });
        } else {
          setTestResult({
            matched: false,
            faceData,
          });
        }
      } catch (err) {
        console.error('Recognition error:', err);
      }
      setProcessing(false);
    }, 500);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
            <Camera className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Recognition Monitor</h1>
            <p className="text-sm text-slate-400">
              {students.length} enrolled face{students.length !== 1 ? 's' : ''} available for matching
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Test recognition */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Test Recognition</h2>
          <p className="text-sm text-slate-400">
            Upload an image (simulating an ESP32-CAM capture) to test face matching against enrolled students.
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative aspect-video rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-900 flex items-center justify-center cursor-pointer transition overflow-hidden group"
          >
            {testImage ? (
              <img
                ref={testImageRef}
                src={testImage}
                alt="Test capture"
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-500/10 transition">
                  <Upload className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 transition" />
                </div>
                <p className="text-white font-medium">Upload test image</p>
                <p className="text-sm text-slate-500 mt-1">Simulate ESP32-CAM capture</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleTestImage}
            className="hidden"
          />

          {processing && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <div>
                <p className="text-sm text-blue-400 font-medium">Processing image...</p>
                <p className="text-xs text-slate-400">Extracting landmarks and matching</p>
              </div>
            </div>
          )}

          {testResult && !processing && (
            <div
              className={`p-5 rounded-xl border ${
                testResult.matched
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-amber-500/10 border-amber-500/20'
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.matched ? (
                  <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
                )}
                <div className="flex-1">
                  {testResult.matched ? (
                    <>
                      <p className="text-emerald-400 font-semibold text-lg">
                        Match Found: {testResult.student?.full_name}
                      </p>
                      <p className="text-sm text-slate-300 mt-1">
                        Confidence: {(testResult.confidence! * 100).toFixed(1)}%
                      </p>
                      {testResult.student?.student_id && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Student ID: {testResult.student.student_id}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-amber-400 font-semibold text-lg">No Match Found</p>
                      <p className="text-sm text-slate-300 mt-1">
                        {testResult.faceData
                          ? 'Face detected but no enrolled student matched.'
                          : 'No face detected in the image.'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Recent recognition logs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Recognition Logs</h2>
            <button
              onClick={fetchLogs}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800">
              <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No recognition logs yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Logs from ESP32-CAM devices will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 ring-1 ring-slate-700">
                    {log.image_url ? (
                      <img src={log.image_url} alt="Capture" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-slate-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {log.matched && log.student ? (
                      <>
                        <p className="text-white font-medium truncate">{log.student.full_name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            Matched
                          </span>
                          {log.confidence !== null && (
                            <span className="text-xs text-slate-500">
                              {(log.confidence * 100).toFixed(1)}% confidence
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-slate-400 font-medium">Unknown person</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-amber-400">
                            <XCircle className="w-3 h-3" />
                            No match
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {log.device_id && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          {log.device_id}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(log.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
