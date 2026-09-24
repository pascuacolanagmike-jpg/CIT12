import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/lib/types';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  Droplet,
  MapPin,
  Phone,
  UserCircle,
  IdCard,
  Image as ImageIcon,
  Loader2,
  Trash2,
  ScanFace,
} from 'lucide-react';

export default function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching students:', error);
    } else {
      setStudents(data as Student[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.student_id?.toLowerCase().includes(q) ||
        s.baranggay?.toLowerCase().includes(q)
    );
  }, [students, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student? This cannot be undone.')) return;
    setDeleting(id);
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) {
      alert('Failed to delete student: ' + error.message);
    } else {
      setStudents((prev) => prev.filter((s) => s.id !== id));
    }
    setDeleting(null);
  };

  const detailRows = (student: Student) => [
    { icon: IdCard, label: 'Student ID', value: student.student_id },
    { icon: Calendar, label: 'Birthdate', value: student.birthdate ? new Date(student.birthdate).toLocaleDateString() : null },
    { icon: UserCircle, label: 'Age', value: student.age?.toString() },
    { icon: UserCircle, label: 'Sex', value: student.sex },
    { icon: Droplet, label: 'Blood Type', value: student.blood_type },
    { icon: MapPin, label: 'Barangay', value: student.baranggay },
    { icon: MapPin, label: 'Address', value: student.address },
    { icon: Phone, label: 'Contact Number', value: student.contact_number },
    { icon: UserCircle, label: 'Guardian', value: student.guardian_name },
    { icon: Calendar, label: 'Registered', value: new Date(student.created_at).toLocaleString() },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Student List</h1>
            <p className="text-sm text-slate-400">
              {students.length} student{students.length !== 1 ? 's' : ''} registered
            </p>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, student ID, or barangay..."
            className="w-full rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Student list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">
            {search ? 'No students match your search.' : 'No students registered yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((student) => {
            const isExpanded = expandedId === student.id;
            return (
              <div
                key={student.id}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden transition hover:border-slate-700"
              >
                {/* Collapsed row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : student.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-800/50 transition"
                >
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 ring-1 ring-slate-700">
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt={student.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-slate-600" />
                      </div>
                    )}
                  </div>

                  {/* Name + ID */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold truncate">{student.full_name}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      {student.student_id && (
                        <span className="text-xs text-slate-500 font-mono">{student.student_id}</span>
                      )}
                      {student.baranggay && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {student.baranggay}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Landmarks badge */}
                  {student.descriptor && (
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium ring-1 ring-emerald-500/20">
                      <ScanFace className="w-3.5 h-3.5" />
                      Enrolled
                    </div>
                  )}

                  {/* Chevron */}
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-800 p-5 bg-slate-950/50">
                    <div className="grid lg:grid-cols-2 gap-6">
                      {/* Left: details grid */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          Student Details
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {detailRows(student).map((row) => {
                            const Icon = row.icon;
                            return (
                              <div
                                key={row.label}
                                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/50"
                              >
                                <Icon className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-500">{row.label}</p>
                                  <p className="text-sm text-white truncate">
                                    {row.value || '—'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-3">
                          <button
                            onClick={() => handleDelete(student.id)}
                            disabled={deleting === student.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition disabled:opacity-50"
                          >
                            {deleting === student.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Right: photo + landmarks info */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                            Registered Photo
                          </h4>
                          {student.photo_url ? (
                            <div className="rounded-xl overflow-hidden ring-1 ring-slate-800 max-w-xs">
                              <img
                                src={student.photo_url}
                                alt={student.full_name}
                                className="w-full h-auto"
                              />
                            </div>
                          ) : (
                            <div className="w-full max-w-xs h-48 rounded-xl bg-slate-900 flex items-center justify-center ring-1 ring-slate-800">
                              <ImageIcon className="w-8 h-8 text-slate-600" />
                            </div>
                          )}
                        </div>
                        {student.landmarks && (
                          <div className="p-3 rounded-lg bg-slate-900/50">
                            <p className="text-xs text-slate-500 mb-1">Facial Landmarks</p>
                            <p className="text-sm text-emerald-400">
                              {student.landmarks.length} points extracted
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


