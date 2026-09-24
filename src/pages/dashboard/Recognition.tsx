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
  Radio,
  FlaskConical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/** Normalize whatever Supabase returns into a Float32Array */
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
  reason?: 'no-face' | 'no-students' | 'below-threshold' | 'error';
  errorMessage?: string;
}

export default function Recognition() {
  // Data
  const [logs, setLogs] = useState<RecognitionLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Models
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Realtime
  const [liveConnected, setLiveConnected] = useState(false);

  // Manual test (kept as a debugging tool)
  const [showManualTest, setShowManualTest] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const testImageRef = useRef<HTMLImageElement | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());

  /* -------------------- data -------------------- */

  const fetchLogs = useCallback(async () => {
    const joined = await supabase
      .from('recognition_logs')
      .select('*, student:students(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (joined.error) {
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

  /* -------------------- init -------------------- */

  useEffect(() => {
    fetchLogs();
    fetchStudents();

    let cancelled = false;
    (async () => {
      try {
        await loadFaceModels();
        if (!cancelled) setModelsReady(true);
      } catch (err) {
        console.error('Face models failed to load:', err);
        if (!cancelled) setModelsError('Could not load face recognition models.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchLogs, fetchStudents]);

  /* -------------------- core: process one ESP32 log -------------------- */

  const processLog = useCallback(
    async (log: RecognitionLog) => {
      if (!log.image_url) return;
      if (processedIdsRef.current.has(log.id)) return;
      if (!modelsReady) {
        console.warn('Models not ready yet — skipping log', log.id);
        return;
      }
      if (log.matched) return; // already resolved

      processedIdsRef.current.add(log.id);

      try {
        // Download the captured image from Supabase Storage
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = log.image_url;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load capture'));
        });

        const faceData = await extractFaceData(img, true);
        if (!faceData) {
          console.log(`[${log.id}] No face detected in ESP32 capture`);
          return;
        }

        const probe = toFloat32(faceData.descriptor);
        if (!probe) return;

        const known = students
          .map((s) => {
            const d = toFloat32(s.descriptor);
            return d ? { id: s.id, name: s.full_name, descriptor: d } : null;
          })
          .filter(
            (x): x is { id: string; name: string; descriptor: Float32Array } => x !== null
          );

        if (known.length === 0) return;

        const match = findBestMatch(probe, known as any);
        if (match && match.confidence > 0.5) {
          await supabase
            .from('recognition_logs')
            .update({
              matched: true,
              student_id: match.id,
              confidence: match.confidence,
            })
            .eq('id', log.id);
          // The UPDATE subscription will refresh the list automatically
        }
      } catch (err) {
        console.error(`Failed to process log ${log.id}:`, err);
      }
    },
    [modelsReady, students]
  );

  /* -------------------- realtime subscription -------------------- */

  useEffect(() => {
    const channel = supabase
      .channel('recognition_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'recognition_logs' },
        (payload) => {
          const newLog = payload.new as RecognitionLog;
          fetchLogs();
          processLog(newLog);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'recognition_logs' },
        () => {
          fetchLogs();
        }
      )
      .subscribe((status) => {
        setLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs, processLog]);

  /* -------------------- manual test -------------------- */

  const runManualTest = useCallback(async () => {
    const img = testImageRef.current;
    if (!img) return;
    if (!img.complete || img.naturalWidth === 0) return;

    setProcessing(true);
    setTestResult(null);

    try {
      if (!modelsReady) {
        setTestResult({ matched: false, reason: 'error', errorMessage: 'Models still loading.' });
        return;
      }
      const faceData = await extractFaceData(img, true);
      if (!faceData) {
        setTestResult({ matched: false, reason: 'no-face' });
        return;
      }
      const probe = toFloat32(faceData.descriptor);
      if (!probe) {
        setTestResult({ matched: false, reason: 'error', errorMessage: 'Invalid descriptor.' });
        return;
      }
      const known = students
        .map((s) => {
          const d = toFloat32(s.descriptor);
          return d ? { id: s.id, name: s.full_name, descriptor: d } : null;
        })
        .filter(
          (x): x is { id: string; name: string; descriptor: Float32Array } => x !== null
        );
      if (known.length === 0) {
        setTestResult({ matched: false, reason: 'no-students' });
        return;
      }
      const match = findBestMatch(probe, known as any);
      if (match && match.confidence > 0.5) {
        setTestResult({
          matched: true,
          student: students.find((s) => s.id === match.id),
          confidence: match.confidence,
        });
      } else {
        setTestResult({ matched: false, reason: 'below-threshold', confidence: match?.confidence });
      }
    } catch (err) {
      console.error(err);
      setTestResult({
        matched: false,
        reason: 'error',
        errorMessage: err instanceof Error ? err.message : 'Recognition failed.',
      });
    } finally {
      setProcessing(false);
    }
  }, [students, modelsReady]);

  const handleTestImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (testImage?.startsWith('blob:')) URL.revokeObjectURL(testImage);
    setTestResult(null);
    setTestImage(URL.createObjectURL(file));
  };

  const resetTest = () => {
    if (testImage?.startsWith('blob:')) URL.revokeObjectURL(testImage);
    setTestImage(null);
    setTestResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* -------------------- helpers -------------------- */

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  };

  const latestLog = logs.find((l) => l.image_url);

  /* -------------------- render -------------------- */

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
            <Camera className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Recognition Monitor</h1>
            <p className="text-sm text-slate-400">
              {students.length} enrolled face{students.length !== 1 ? 's' : ''} · listening for ESP32 captures
            </p>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${
            liveConnected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          <Radio className={`w-4 h-4 ${liveConnected ? 'animate-pulse' : ''}`} />
          {liveConnected ? 'Live' : 'Connecting...'}
        </div>
      </div>

      {modelsError && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          {modelsError}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* ---------------- Left: Latest capture + manual test ---------------- */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Latest Capture</h2>
              <button
                onClick={fetchLogs}
                className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>

            {latestLog ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="relative aspect-video bg-black">
                  {latestLog.image_url && (
                    <img
                      src={latestLog.image_url}
                      alt="Latest ESP32 capture"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur text-xs text-white flex items-center gap-1.5">
                    <Radio className="w-3 h-3 text-emerald-400" />
                    {latestLog.device_id ?? 'ESP32-CAM'}
                  </div>
                </div>
                <div className="p-4">
                  {latestLog.matched && latestLog.student ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white font-semibold">{latestLog.student.full_name}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs">
                          <span className="text-emerald-400">
                            {latestLog.confidence != null
                              ? `${(latestLog.confidence * 100).toFixed(1)}% confidence`
                              : 'Matched'}
                          </span>
                          {latestLog.student.student_id && (
                            <span className="text-slate-500">
                              ID: {latestLog.student.student_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-slate-300 font-medium">No match</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Face not recognized or not detected
                        </p>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(latestLog.created_at)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/50 aspect-video flex flex-col items-center justify-center text-center p-8">
                <Activity className="w-10 h-10 text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">Waiting for ESP32 capture...</p>
                <p className="text-xs text-slate-500 mt-1">
                  Images will appear here automatically when your device uploads
                </p>
              </div>
            )}
          </div>

          {/* Manual test (debugging) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
            <button
              onClick={() => setShowManualTest((v) => !v)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition"
            >
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300 font-medium">Manual Test</span>
              </div>
              {showManualTest ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showManualTest && (
              <div className="p-4 pt-0 space-y-4">
                <p className="text-xs text-slate-500">
                  Upload an image to test the recognition pipeline without the ESP32.
                </p>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative aspect-video rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950 flex items-center justify-center cursor-pointer transition overflow-hidden group"
                >
                  {testImage ? (
                    <img
                      ref={testImageRef}
                      src={testImage}
                      alt="Test capture"
                      className="w-full h-full object-cover"
                      onLoad={runManualTest}
                    />
                  ) : (
                    <div className="text-center p-6">
                      <Upload className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Click to upload</p>
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
                  <div className="flex items-center gap-2 text-sm text-blue-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </div>
                )}

                {testResult && !processing && (
                  <div
                    className={`p-3 rounded-lg border text-sm ${
                      testResult.matched
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}
                  >
                    {testResult.matched
                      ? `Match: ${testResult.student?.full_name} (${(testResult.confidence! * 100).toFixed(1)}%)`
                      : testResult.reason === 'no-face'
                      ? 'No face detected'
                      : testResult.reason === 'no-students'
                      ? 'No enrolled students'
                      : testResult.reason === 'below-threshold'
                      ? `Below threshold${testResult.confidence != null ? ` (best ${(testResult.confidence * 100).toFixed(1)}%)` : ''}`
                      : testResult.errorMessage ?? 'No match'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---------------- Right: Recognition logs ---------------- */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Recognition History</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800">
              <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No recognition logs yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Logs will appear here when your ESP32 uploads
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
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
                        loading="lazy"
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
                        <p className="text-white font-medium truncate">{log.student.full_name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            Matched
                          </span>
                          {log.confidence != null && (
                            <span className="text-xs text-slate-500">
                              {(log.confidence * 100).toFixed(1)}% confidence
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-slate-400 font-medium">Unknown person</p>
                        <span className="flex items-center gap-1 text-xs text-amber-400 mt-0.5">
                          <XCircle className="w-3 h-3" />
                          No match
                        </span>
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
