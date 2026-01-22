import React, { useState, useRef } from 'react';
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

    const res = await fetch(`${supabaseUrl}/functions/v1/drive-upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Upload failed');
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
      <div className="max-w-xl mx-auto px-4 py-20 text-center animate-in fade-in zoom-in duration-300">
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
          className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-md"
        >
          Upload More Photos
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border shadow-xl overflow-hidden">
        <div className="bg-indigo-600 p-8 text-white">
          <h1 className="text-2xl font-bold mb-1">{box.name}</h1>
          <p className="opacity-80 text-sm">Collection active until {new Date(box.expiresAt).toLocaleDateString()}</p>
        </div>

        <div className="p-8">
          {files.length === 0 ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 bg-gray-50 group-hover:bg-white rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Select photos to upload</h3>
              <p className="text-gray-500 mt-1">Multi-selection supported. RAW or JPEG.</p>
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
            <div className="space-y-6">
              <div className="max-h-96 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                        <ImageIcon className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    {isUploading ? (
                      <div className="flex items-center space-x-2">
                        {uploads[file.name]?.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : uploads[file.name]?.status === 'error' ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <div className="text-indigo-600">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => removeFile(i)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isUploading && (
                <div className="flex space-x-4">
                  <button
                    onClick={() => setFiles([])}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={startUpload}
                    className="flex-[2] px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center space-x-2"
                  >
                    <Upload className="w-5 h-5" />
                    <span>Upload {files.length} Photos</span>
                  </button>
                </div>
              )}
              
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium text-gray-700">
                    <span>Uploading...</span>
                    <span>
                      {/* Fix: Adding explicit type casting to resolve 'unknown' property access error */}
                      {(Object.values(uploads) as UploadProgress[]).filter(u => u.status === 'completed').length} / {files.length}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{ 
                        /* Fix: Adding explicit type casting to resolve 'unknown' property access error */
                        width: `${((Object.values(uploads) as UploadProgress[]).filter(u => u.status === 'completed').length / files.length) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-start space-x-3 text-xs text-gray-500">
              <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p>
                Pull-Box automatically optimizes your images to save storage space while maintaining visual brilliance.
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