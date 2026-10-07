import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, type Document } from '../lib/api';
import { Upload, Trash2, Loader2, BookOpen, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function DocStatusIcon({ doc }: { doc: Document }) {
  if (!doc.is_processed && doc.processing_error) {
    return (
      <span title={doc.processing_error}>
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      </span>
    );
  }
  if (!doc.is_processed) {
    return (
      <span title="Processing...">
        <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin-slow" />
      </span>
    );
  }
  return (
    <span title="Ready">
      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
    </span>
  );
}

function DocTypeIcon({ type }: { type: string }) {
  const cls = "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0";
  const colors: Record<string, string> = {
    pdf: 'bg-red-50 text-red-500',
    txt: 'bg-slate-100 text-slate-500',
    md: 'bg-blue-50 text-blue-500',
    docx: 'bg-indigo-50 text-indigo-500',
  };
  return (
    <div className={`${cls} ${colors[type] || 'bg-slate-100 text-slate-500'}`}>
      {type.toUpperCase().slice(0, 3)}
    </div>
  );
}

export default function KnowledgePage() {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => documentsApi.getAll().then(r => r.data),
    refetchInterval: 5000, // Poll while docs are processing
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded and processing...');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Upload failed. Check file type and size.';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Document removed'); },
    onError: () => toast.error('Failed to delete document'),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(f => uploadMutation.mutate(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const processedCount = docs.filter(d => d.is_processed).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Knowledge Base</h1>
        <p className="page-subtitle">
          {docs.length} document{docs.length !== 1 ? 's' : ''} · {processedCount} indexed and ready for AI search
        </p>
      </div>

      {/* Upload zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-all cursor-pointer ${
          dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          id="file-upload"
          type="file"
          multiple
          accept=".pdf,.txt,.md,.docx"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          {uploadMutation.isPending ? (
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Upload className="w-6 h-6 text-indigo-500" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-700">
              {uploadMutation.isPending ? 'Uploading...' : 'Drop files here or click to upload'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports PDF, TXT, Markdown, DOCX · Max {20}MB per file
            </p>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="card p-4 mb-6 flex items-start gap-3 bg-indigo-50/50 border-indigo-100">
        <BookOpen className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-indigo-800">How it works</p>
          <p className="text-xs text-indigo-600/80 mt-0.5">
            Upload your notes, syllabus, project documentation, or any text. FocusFlow AI will index them and use them automatically when you ask relevant questions in the AI Assistant.
          </p>
        </div>
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
      ) : docs.length === 0 ? (
        <div className="empty-state">
          <BookOpen className="empty-state-icon" />
          <p className="empty-state-title">No documents yet.</p>
          <p className="empty-state-subtitle mb-4">
            Add your notes, syllabus, or project documents so FocusFlow can use them when planning.
          </p>
          <button onClick={() => fileRef.current?.click()} className="btn-primary">
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
              <DocTypeIcon type={doc.file_type} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">{doc.original_name}</p>
                  <DocStatusIcon doc={doc} />
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-400">{formatBytes(doc.file_size)}</span>
                  {doc.page_count && (
                    <span className="text-xs text-slate-400">{doc.page_count} pages</span>
                  )}
                  {doc.chunk_count > 0 && (
                    <span className="text-xs text-slate-400">{doc.chunk_count} chunks indexed</span>
                  )}
                  <span className="text-xs text-slate-400">
                    Uploaded {format(parseISO(doc.created_at), 'MMM d')}
                  </span>
                </div>
                {doc.processing_error && (
                  <p className="text-xs text-red-500 mt-0.5">{doc.processing_error}</p>
                )}
              </div>

              <button
                onClick={() => deleteMutation.mutate(doc.id)}
                className="text-slate-300 hover:text-red-400 transition-colors p-1.5 flex-shrink-0"
                title="Remove document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
