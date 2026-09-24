import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import type { Student } from '@/lib/types';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileUp,
  Table,
  Users,
  ScanFace,
} from 'lucide-react';

// Mapping from DB fields to display headers
const defaultColumns: { key: keyof Student; label: string }[] = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'student_id', label: 'Student ID' },
  { key: 'age', label: 'Age' },
  { key: 'birthdate', label: 'Birthdate' },
  { key: 'sex', label: 'Sex' },
  { key: 'blood_type', label: 'Blood Type' },
  { key: 'baranggay', label: 'Barangay' },
  { key: 'address', label: 'Address' },
  { key: 'contact_number', label: 'Contact Number' },
  { key: 'guardian_name', label: 'Guardian Name' },
  { key: 'photo_url', label: 'Photo URL' },
  { key: 'created_at', label: 'Date Registered' },
];

export default function ExportData() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateHeaders, setTemplateHeaders] = useState<string[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError('Failed to load students: ' + error.message);
    } else {
      setStudents(data as Student[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    setTemplateFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        if (rows.length > 0) {
          const headers = (rows[0] ?? []).map((h) => String(h));
          setTemplateHeaders(headers);
        } else {
          setError('Template file appears to be empty');
        }
      } catch {
        setError('Failed to read template file. Please ensure it is a valid Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Try to match a template header to a DB field
  function matchHeaderToField(header: string): keyof Student | null {
    const lower = header.toLowerCase().replace(/[^a-z]/g, '');
    const mappings: Record<string, keyof Student> = {
      fullname: 'full_name',
      name: 'full_name',
      studentid: 'student_id',
      idnumber: 'student_id',
      id: 'student_id',
      age: 'age',
      birthdate: 'birthdate',
      birthday: 'birthdate',
      dob: 'birthdate',
      sex: 'sex',
      gender: 'sex',
      bloodtype: 'blood_type',
      blood: 'blood_type',
      baranggay: 'baranggay',
      barangay: 'baranggay',
      address: 'address',
      contactnumber: 'contact_number',
      contact: 'contact_number',
      phone: 'contact_number',
      guardianname: 'guardian_name',
      guardian: 'guardian_name',
      photourl: 'photo_url',
      photo: 'photo_url',
      dateregistered: 'created_at',
      registered: 'created_at',
      createdat: 'created_at',
    };
    return mappings[lower] ?? null;
  }

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      let wb: XLSX.WorkBook;
      let useSheet: XLSX.WorkSheet;

      if (templateFile) {
        // Read template, fill in student data
        const buf = await templateFile.arrayBuffer();
        wb = XLSX.read(buf, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const existingRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        const headers = (existingRows[0] ?? []).map((h) => String(h));

        // Build new rows: keep template header row, then fill student data
        const dataRows: unknown[][] = [];
        for (const student of students) {
          const row: unknown[] = headers.map((header) => {
            const field = matchHeaderToField(header);
            if (!field) return '';
            const val = student[field];
            if (field === 'birthdate' && val) {
              return new Date(val as string).toLocaleDateString();
            }
            if (field === 'created_at' && val) {
              return new Date(val as string).toLocaleString();
            }
            return val ?? '';
          });
          dataRows.push(row);
        }

        const allRows = [headers, ...dataRows];
        useSheet = XLSX.utils.aoa_to_sheet(allRows);
        wb.Sheets[sheetName] = useSheet;
      } else {
        // Default export with all fields
        const rows = students.map((s) => {
          const row: Record<string, unknown> = {};
          for (const col of defaultColumns) {
            if (col.key === 'birthdate' && s.birthdate) {
              row[col.label] = new Date(s.birthdate).toLocaleDateString();
            } else if (col.key === 'created_at' && s.created_at) {
              row[col.label] = new Date(s.created_at).toLocaleString();
            } else {
              row[col.label] = s[col.key] ?? '';
            }
          }
          return row;
        });
        useSheet = XLSX.utils.json_to_sheet(rows);
        wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, useSheet, 'Students');
      }

      XLSX.writeFile(wb, `students_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setSuccess(`Exported ${students.length} student${students.length !== 1 ? 's' : ''} successfully!`);
    } catch (err) {
      setError('Export failed: ' + (err as Error).message);
    }
    setExporting(false);
  };

  const handleDownloadDefaultTemplate = () => {
    const headers = defaultColumns.map((c) => c.label);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'student_export_template.xlsx');
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Export Data</h1>
            <p className="text-sm text-slate-400">
              Export student data to Excel, optionally using your own template
            </p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{loading ? '—' : students.length}</p>
              <p className="text-xs text-slate-400">Total Students</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ScanFace className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {loading ? '—' : students.filter((s) => s.descriptor).length}
              </p>
              <p className="text-xs text-slate-400">Faces Enrolled</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Table className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{templateHeaders.length || '—'}</p>
              <p className="text-xs text-slate-400">Template Columns</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Template upload */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Excel Template (Optional)</h2>
          <p className="text-sm text-slate-400 mb-6">
            Upload a custom Excel template. The system will read the column headers from row 1 and fill
            in matching student data.
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950 p-6 text-center cursor-pointer transition group"
          >
            <FileUp className="w-10 h-10 text-slate-500 group-hover:text-emerald-400 transition mx-auto mb-3" />
            <p className="text-white font-medium text-sm">
              {templateFile ? templateFile.name : 'Click to upload template'}
            </p>
            <p className="text-xs text-slate-500 mt-1">.xlsx or .xls file</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleTemplateUpload}
            className="hidden"
          />

          {templateHeaders.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Detected Columns ({templateHeaders.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {templateHeaders.map((h, i) => {
                  const matched = matchHeaderToField(h);
                  return (
                    <span
                      key={i}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        matched
                          ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {h}
                      {matched && ' ✓'}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-3">Don't have a template? Download the default one:</p>
            <button
              onClick={handleDownloadDefaultTemplate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              <Download className="w-4 h-4" />
              Download Default Template
            </button>
          </div>
        </div>

        {/* Export action */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Export Students</h2>
          <p className="text-sm text-slate-400 mb-6">
            {templateFile
              ? 'Export will use your uploaded template structure.'
              : 'Export will use the default column layout.'}
          </p>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950">
              <span className="text-sm text-slate-300">Records to export</span>
              <span className="text-sm font-bold text-white">{students.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950">
              <span className="text-sm text-slate-300">Export format</span>
              <span className="text-sm font-bold text-white">Excel (.xlsx)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950">
              <span className="text-sm text-slate-300">Using template</span>
              <span className={`text-sm font-bold ${templateFile ? 'text-emerald-400' : 'text-slate-400'}`}>
                {templateFile ? 'Yes' : 'No (default)'}
              </span>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting || students.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 text-sm transition"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export {students.length} Student{students.length !== 1 ? 's' : ''}
              </>
            )}
          </button>

          {students.length === 0 && !loading && (
            <p className="text-xs text-slate-500 text-center mt-3">
              No students to export. Register students first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

