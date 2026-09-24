import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { loadFaceModels, extractFaceData, findBestMatch, type FaceData } from '@/lib/faceApi';
import type { Student, RecognitionLog } from '@/lib/types';
import {
  Camera,
  CheckCircle,
  XCircle,
  Loader2,
  Upload,
  RefreshCw,
  Activity,
  Clock,
  Image as ImageIcon,
} from 'lucide-react';

/** Convert whatever Supabase gives us (jsonb string, number[], Float32Array) into a Float32Array */
function toFloat32(descriptor: unknown): Float32Array | null {
  if (!descriptor) return null;
  try {
    if (descriptor instanceof Float32Array) return descriptor;
    if (Array.isArray(descriptor)) return new Float32Array(descriptor);
    if (typeof descriptor === 'string') {
      const parsed = JSON.parse(descriptor);
      if (Array.isArray(parsed)) return new Float32Array(parsed);
    }
    if (typeof descriptor === 'object') {
      // some drivers wrap it in {0: .., 1: ..}
      const arr = Object.values(descriptor as Record<string, number>);
      if (arr.length && typeof arr[0] === 'number') return new Float32Array(arr);
    }
  } catch (err) {
    console.warn('Could not normalize descriptor', err);
  }
  return null;
}

interface TestResult {
  matched: boolean;
  student?: Student;
  confidence?: number;
  faceData?: FaceData;
  reason?: 'no-face' | 'no-students' | 'below-threshold' | 'error';
  errorMessage?: string;
}

export default function Recognition() {
  const [logs, setLogs] = useState<RecognitionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [testImage, setTestImage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const testImageRef = useRef<HTMLImageElement | null>(null);

  /* ---------------- data fetching ---------------- */

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    // Try the joined query first; if the FK isn't set up, fall back to plain logs.
    const joined = await supabase
      .from('recognition_logs')
      .select('*, student:students(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (joined.error) {
      console.warn('Joined log query failed, falling back:', joined.error.message);
      const plain = await supabase
        .from('recognition_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (plain.error) {
        console.error('Error fetching logs:', plain.error);
        setLogs([]);
      } else {
        setLogs((plain.data ?? []) as RecognitionLog[]);
      }
    } else {
      setLogs((joined.data ?? []) as RecognitionLog[]);
    }
    setLoading(false);
  }, []);

  const fetchStudents = useCallback(async () => {
    // ✅ FIX 1: proper "IS NOT NULL" filter (not .eq)
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .not('descriptor', 'is', null);

    if (error) {
      console.error('Error fetching students:', error);
      return;
    }
    setStudents((data ?? []) as Student[]);
  }, []);

  /* ---------------- init ---------------- */

  useEffect(() => {
    fetchLogs();
    fetchStudents();

    let cancelled = false;
    (async () => {
      try {
        await loadFaceModels();
        if (!cancelled) setModelsReady(true);
      } catch (err) {
        console.error('Failed to load face models:', err);
        if (!cancelled) setModelsError('Could not load face recognition models.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchLogs, fetchStudents]);

  // Clean up object URLs when the component unmounts
  useEffect(() => {
    return () => {
      if (testImage?.startsWith('blob:')) URL.revokeObjectURL(testImage);
    };
  }, [testImage]);

  /* ---------------- recognition ---------------- */

  const runRecognition = useCallback(async () => {
    const img = testImageRef.current;
    if (!img) return;

    // ✅ FIX 2: don't run until the image is actually decoded
    if (!img.complete || img.naturalWidth === 0) return;

    setProcessing(true);
    setTestResult(null);

    try {
      if (!modelsReady) {
        setTestResult({
          matched: false,
          reason: 'error',
          errorMessage: 'Face models are still loading. Please wait a moment and try again.',
        });
        return;
      }

      if (students.length === 0) {
        setTestResult({
          matched: false,
          reason: 'no-students',
          errorMessage: 'No enrolled students with a face descriptor were found.',
        });
        return;
      }

      const faceData = await extractFaceData(img, true);

      if (!faceData) {
        setTestResult({ matched: false, reason: 'no-face' });
        return;
      }

      // ✅ FIX 3: normalize descriptors to Float32Array before matching
      const probeDescriptor = toFloat32(faceData.descriptor);
      if (!probeDescriptor) {
        setTestResult({
          matched: false,
          faceData,
          reason: 'error',
          errorMessage: 'Extracted face descriptor was invalid.',
        });
        return;
      }

      const knownDescriptors = students
        .map((s) => {
          const d = toFloat32(s.descriptor);
          if (!d) return null;
          return { id: s.id, name: s.full_name, descriptor: d };
        })
        .filter((x): x is { id: string; name: string; descriptor: Float32Array } => x !== null);

      if (knownDescriptors.length === 0) {
        setTestResult({
          matched: false,
          faceData,
          reason: 'no-students',
          errorMessage: 'No enrolled students had a valid face descriptor.',
        });
        return;
      }

      const match = findBestMatch(probeDescriptor, knownDescriptors as any);

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
          reason: 'below-threshold',
          confidence: match?.confidence,
        });
      }
    } catch (err) {
      console.error('Recognition error:', err);
      setTestResult({
        matched: false,
        reason: 'error',
        errorMessage: err instanceof Error ? err.message : 'Unknown error during recognition.',
      });
    } finally {
      setProcessing(false);
    }
  }, [students, modelsReady]);

  const handleTestImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // revoke the previous preview
    if (testImage?.startsWith('blob:')) URL.revokeObjectURL(testImage);

    setTestResult(null);
    setTestImage(URL.createObjectURL(file));
    // The actual recognition is triggered by <img onLoad={runRecognition} />
  };

  const resetTest = () => {
    if (testImage?.startsWith('blob:')) URL.revokeObjectURL(testImage);
    setTestImage(null);
    setTestResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ---------------- helpers ---------------- */

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

  /* ---------------- render ---------------- */

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

      {modelsError && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          {modelsError}
        </div>
      )}

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
              // ✅ FIX 2 (cont.): trigger recognition on load, not on a timer
              <img
                ref={testImageRef}
                src={testImage}
                alt="Test capture"
                className="w-full h-full object-cover"
                onLoad={runRecognition}
                onError={() =>
                  setTestResult({
                    matched: false,
                    reason: 'error',
                    errorMessage: 'Could not load the selected image.',
                  })
                }
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

          {testImage && !processing && (
            <button
              onClick={resetTest}
              className="text-xs text-slate-400 hover:text-slate-200 transition"
            >
              Clear image
            </button>
          )}

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
                        {testResult.reason === 'no-face' &&
                          'No face detected in the image.'}
                        {testResult.reason === 'no-students' &&
                          (testResult.errorMessage ??
                            'No enrolled students with a valid face descriptor.')}
                        {testResult.reason === 'below-threshold' &&
                          `Face detected but the best match was below the confidence threshold${
                            testResult.confidence != null
                              ? ` (best: ${(testResult.confidence * 100).toFixed(1)}%)`
                              : ''
                          }.`}
                        {testResult.reason === 'error' &&
                          (testResult.errorMessage ?? 'An error occurred during recognition.')}
                        {!testResult.reason &&
                          'Face detected but no enrolled student matched.'}
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
                      <img
                        src={log.image_url}
                        alt="Capture"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-slate-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {log.matched && log.student ? (
                      <>
                        <p className="text-white font-medium truncate">
                          {log.student.full_name}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            Matched
                          </span>
                          {log.confidence !== null && log.confidence !== undefined && (
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
