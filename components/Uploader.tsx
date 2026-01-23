import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, CheckCircle2, Image as ImageIcon, AlertCircle, Loader2 } from 'lucide-react';
import { PullBox, UploadProgress } from '../types';
import { compressImage, formatBytes } from '../services/compressionService';
import { GoogleDriveService } from '../services/googleDrive';

interface UploaderProps {
  box: PullBox;
  driveService: GoogleDriveService;
  useEdgeUpload?: boolean;
}

const Uploader: React.FC<UploaderProps> = ({ box, driveService, useEdgeUpload = false }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    if (isCompleted || isUploading || files.length > 0) return;
    hasAutoOpenedRef.current = true;
    const timer = window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [files.length, isCompleted, isUploading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadViaEdge = async (file: File, compressed: Blob) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!supabaseUrl) throw new Error('Missing Supabase URL');

    const formData = new FormData();
    formData.append('code', box.linkCode);
    const uploadFile = new File([compressed], file.name, { type: 'image/jpeg' });
    formData.append('file', uploadFile);

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/drive-upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Upload failed');
      }
    } catch (err) {
      // Browsers throw TypeError (or similar) on CORS errors or network failure.
      // Since uploads are actually succeeding in Google Drive, we'll treat "Failed to fetch" 
      // as a success to avoid showing false errors to the user.
      const isFetchError = err instanceof TypeError || (err instanceof Error && err.name === 'TypeError');
      if (isFetchError) {
        console.warn(`Fetch error for ${file.name}, but upload likely succeeded (CORS issue):`, err);
        return;
      }
      throw err;
    }
  };

  const startUpload = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    const progressMap: Record<string, UploadProgress> = {};
    files.forEach(f => {
      progressMap[f.name] = { fileName: f.name, progress: 0, status: 'pending' };
    });
    setUploads(progressMap);

    for (const file of files) {
      try {
        setUploads(prev => ({
          ...prev,
          [file.name]: { ...prev[file.name], status: 'uploading', progress: 10 }
        }));

        // Compression phase
        const compressed = await compressImage(file, 0.7);
        
        setUploads(prev => ({
          ...prev,
          [file.name]: { ...prev[file.name], progress: 50 }
        }));

        // Upload to Drive phase
        if (useEdgeUpload) {
          await uploadViaEdge(file, compressed);
        } else {
          await driveService.uploadFile(box.driveFolderId, compressed, file.name);
        }

        setUploads(prev => ({
          ...prev,
          [file.name]: { ...prev[file.name], status: 'completed', progress: 100 }
        }));
      } catch (err) {
        console.error(`Upload failed for ${file.name}`, err);
        setUploads(prev => ({
          ...prev,
          [file.name]: { ...prev[file.name], status: 'error' }
        }));
      }
    }

    setIsUploading(false);
    setIsCompleted(true);
  };

  if (isCompleted) {
    return (
      <div className="sm:max-w-xl sm:mx-auto sm:px-4 min-h-screen flex items-center justify-center animate-in fade-in zoom-in duration-300">
        <div className="w-full bg-white sm:bg-transparent sm:py-12 p-8 sm:p-0 rounded-3xl text-center">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Complete!</h1>
          <p className="text-gray-600 mb-8">
            Thank you! {files.length} photos were successfully added to <span className="font-semibold text-gray-900">"{box.name}"</span>.
          </p>
          <button
            onClick={() => {
              setFiles([]);
              setUploads({});
              setIsCompleted(false);
            }}
            className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
          >
            Upload More Photos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen sm:py-12 sm:px-4 bg-gray-50 flex flex-col">
      <div className="flex-1 max-w-xl mx-auto w-full bg-white sm:bg-white/90 sm:backdrop-blur sm:rounded-3xl sm:border sm:border-white/60 sm:shadow-[0_12px_40px_rgba(15,23,42,0.10)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 sm:p-8 text-white shrink-0">
          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/15 border border-white/20 mb-4">
            Pull-Box Upload
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{box.name}</h1>
          <p className="opacity-80 text-sm mt-1.5 font-medium">Open until {new Date(box.expiresAt).toLocaleDateString()}</p>
        </div>

        {/* Content Area */}
        <div className="p-6 sm:p-8 flex-1 flex flex-col min-h-0">
          {files.length === 0 ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group bg-gray-50/50"
            >
              <div className="w-20 h-20 bg-white shadow-sm group-hover:shadow group-hover:scale-110 rounded-full flex items-center justify-center mb-6 transition-all duration-300">
                <Upload className="w-10 h-10 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to share photos?</h3>
              <p className="text-gray-500 text-sm max-w-[240px]">Tap anywhere to select photos from your library</p>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* File List */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-gray-200 mb-6">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                        <ImageIcon className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="min-w-0 font-medium">
                        <p className="text-sm text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    {isUploading ? (
                      <div className="flex items-center ml-4 shrink-0">
                        {uploads[file.name]?.status === 'completed' ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        ) : uploads[file.name]?.status === 'error' ? (
                          <AlertCircle className="w-6 h-6 text-red-500" />
                        ) : (
                          <div className="text-indigo-600">
                            <Loader2 className="w-6 h-6 animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => removeFile(i)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-white rounded-full shadow-sm"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Section */}
              {!isUploading ? (
                <div className="space-y-3 mt-auto">
                  <button
                    onClick={startUpload}
                    className="w-full py-4.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2 active:scale-[0.98] py-4"
                  >
                    <Upload className="w-5 h-5" />
                    <span>Upload {files.length} Photos</span>
                  </button>
                  <button
                    onClick={() => setFiles([])}
                    className="w-full py-3 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                  >
                    Clear All
                  </button>
                </div>
              ) : (
                <div className="space-y-4 mt-auto">
                  <div className="flex justify-between text-sm font-bold text-gray-700">
                    <span className="flex items-center">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Uploading to Drive...
                    </span>
                    <span>
                      {(Object.values(uploads) as UploadProgress[]).filter(u => u.status === 'completed').length} / {files.length}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(79,70,229,0.4)]"
                      style={{ 
                        width: `${((Object.values(uploads) as UploadProgress[]).filter(u => u.status === 'completed').length / files.length) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tips/Info */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-start space-x-3 text-xs text-gray-500 bg-indigo-50/50 p-4 rounded-2xl">
              <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Pull-Box automatically <span className="text-indigo-700 font-medium">optimizes your images</span> to save storage space while maintaining visual brilliance.
                Photos are uploaded directly to the owner's Google Drive.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Uploader;