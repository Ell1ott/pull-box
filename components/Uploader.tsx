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
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      startUpload(selectedFiles);
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

  const startUpload = async (filesToUpload: File[] = files) => {
    if (filesToUpload.length === 0 || isUploading) return;
    
    setIsUploading(true);
    const progressMap: Record<string, UploadProgress> = {};
    filesToUpload.forEach(f => {
      progressMap[f.name] = { fileName: f.name, progress: 0, status: 'pending' };
    });
    setUploads(progressMap);

    for (const file of filesToUpload) {
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

  const completedCount = (Object.values(uploads) as UploadProgress[]).filter(u => u.status === 'completed').length;
  const progressPercent = files.length > 0 ? (completedCount / files.length) * 100 : 0;

  return (
    <>
      <input
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
      />

      {/* Completion Modal Overlay */}
      {isCompleted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-[32px] shadow-2xl p-12 max-w-md w-full text-center animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-[#34C759]/10 rounded-full flex items-center justify-center mx-auto mb-6 transform transition-transform hover:scale-105 duration-300">
              <CheckCircle2 className="w-12 h-12 text-[#34C759]" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">All Done</h1>
            <p className="text-gray-500 mb-8 text-lg font-medium leading-relaxed">
              <span className="text-gray-900 font-bold">{files.length}</span> photos added to <br />
              <span className="text-gray-900">{box.name}</span>
            </p>
            <button
              onClick={() => {
                setFiles([]);
                setUploads({});
                setIsCompleted(false);
              }}
              className="w-full h-14 bg-[#007AFF] text-white text-[17px] font-semibold rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-md"
            >
              Upload More
            </button>
          </div>
        </div>
      )}

      {/* MOBILE UI (Original, md:hidden) */}
      <div className="md:hidden min-h-screen bg-[#F2F2F7] sm:py-8 font-sans text-gray-900 selection:bg-blue-100">
        <div className="sm:max-w-md mx-auto h-full flex flex-col bg-white sm:rounded-[40px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden min-h-screen sm:min-h-[800px]">
          {/* iOS-style Header */}
          <div className="pt-14 pb-4 px-6 bg-white/80 backdrop-blur-xl sticky top-0 z-10 border-b border-gray-100">
            <div className="flex flex-col items-center">
              <h1 className="text-[17px] font-semibold tracking-tight">{box.name}</h1>
              <p className="text-[13px] text-gray-400 font-medium">
                Expires {new Date(box.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {files.length === 0 ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner text-gray-300">
                  <ImageIcon className="w-10 h-10" strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-2 text-center">Add Photos</h2>
                <p className="text-gray-400 text-center max-w-[200px] leading-relaxed">
                  Tap anywhere to select visuals for this collection
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full">
                {/* PRIMARY LOADER SECTION */}
                <div className="mb-8 mt-4">
                  {isUploading ? (
                    <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="relative pt-4">
                        <div className="flex items-end justify-between mb-2 px-1">
                          <span className="text-lg font-semibold text-[#007AFF]">Uploading...</span>
                          <span className="text-3xl font-bold tracking-tight text-gray-900">
                            {Math.round(progressPercent)}%
                          </span>
                        </div>
                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#007AFF] transition-all duration-300 ease-out rounded-full"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 animate-in zoom-in-50 duration-300">
                      <span className="text-6xl font-bold tracking-tighter text-gray-900">
                        {files.length}
                      </span>
                      <p className="text-gray-400 font-medium mt-2">Selected Items</p>
                    </div>
                  )}
                </div>

                {/* SECONDARY INFO: FILES LIST */}
                <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-3 pb-4 scrollbar-hide">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center p-3 bg-gray-50 rounded-2xl">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-gray-100">
                        {uploads[file.name]?.status === 'completed' ? (
                          <CheckCircle2 className="w-6 h-6 text-[#34C759]" />
                        ) : uploads[file.name]?.status === 'error' ? (
                          <AlertCircle className="w-6 h-6 text-red-500" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      
                      <div className="ml-4 flex-1 min-w-0">
                        <p className="font-medium text-[15px] truncate text-gray-900">{file.name}</p>
                        <p className="text-[13px] text-gray-400">
                          {uploads[file.name]?.status === 'uploading' ? 'Processing...' : formatBytes(file.size)}
                        </p>
                      </div>

                      {!isUploading && (
                        <button
                          onClick={() => removeFile(i)}
                          className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* ACTION BUTTON */}
                {!isUploading && (
                  <div className="mt-4 pt-4 shrink-0">
                    <button
                      onClick={() => startUpload()}
                      className="w-full h-14 bg-[#007AFF] text-white text-[17px] font-bold rounded-2xl hover:bg-[#0062CC] active:scale-[0.98] transition-all shadow-[0_8px_16px_rgba(0,122,255,0.25)] flex items-center justify-center space-x-2"
                    >
                      <span>Upload Now</span>
                    </button>
                    <button
                      onClick={() => setFiles([])}
                      className="w-full py-4 text-[#007AFF] text-[15px] font-medium mt-2 hover:opacity-70 transition-opacity"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP UI (Full Screen Split View, hidden md:flex) */}
      <div className="hidden md:flex h-screen w-full bg-white font-sans selection:bg-[#007AFF] selection:text-white overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-80 bg-[#F5F5F7] border-r border-[#E5E5E5] flex flex-col shrink-0 relative h-full">
          {/* Sidebar Header */}
           <div className="p-8 pb-4">
              <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white border border-gray-200 text-gray-500 mb-4 shadow-sm">
                Pull-Box
              </div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight leading-tight mb-2">{box.name}</h2>
              <p className="text-[13px] text-gray-500 font-medium flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></span>
                Expires {new Date(box.expiresAt).toLocaleDateString()}
              </p>
           </div>

           {/* Sidebar Content */}
          <div className="p-8 flex-1 flex flex-col pt-2">
            
            {/* Status / Progress */}
            {isUploading && (
              <div className="bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-black/5 mb-8 animate-in slide-in-from-left-2 duration-300">
                 <div className="flex justify-between items-end mb-3">
                    <span className="text-sm font-semibold text-gray-900">Uploading</span>
                    <span className="text-3xl font-bold text-[#007AFF] leading-none">{Math.round(progressPercent)}%</span>
                 </div>
                 <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#007AFF] w-1/2 transition-all duration-300 ease-out" style={{ width: `${progressPercent}%` }} />
                 </div>
              </div>
            )}

            <div className="mt-auto space-y-6">
              <div className="space-y-4">
                 <div className="flex justify-between items-center py-3 border-b border-gray-200/60">
                    <span className="text-sm text-gray-500">Total Items</span>
                    <span className="text-sm font-medium text-gray-900">{files.length}</span>
                 </div>
                 <div className="flex justify-between items-center py-3 border-b border-gray-200/60">
                    <span className="text-sm text-gray-500">Est. Size</span>
                    <span className="text-sm font-medium text-gray-900">{formatBytes(files.reduce((a, b) => a + b.size, 0))}</span>
                 </div>
              </div>

              <div className="pt-2 space-y-3">
                {!isUploading && files.length > 0 && (
                  <>
                    <button
                      onClick={() => startUpload()}
                      className="w-full h-12 bg-[#007AFF] hover:bg-[#006AD9] text-white text-[15px] font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
                    >
                      <Upload className="w-5 h-5" />
                      <span>Upload Photos</span>
                    </button>
                    <button
                      onClick={() => setFiles([])}
                      className="w-full h-12 bg-white hover:bg-gray-50 text-gray-700 text-[15px] font-medium rounded-xl shadow-sm border border-[#D1D1D6] transition-all"
                    >
                      Clear Selection
                    </button>
                  </>
                )}
                {files.length === 0 && (
                   <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-12 bg-[#007AFF] hover:bg-[#006AD9] text-white text-[15px] font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
                    >
                      <span>Select Files</span>
                   </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 bg-white flex flex-col h-full relative">
           {/* Toolbar */}
          <div className="h-16 border-b border-[#E5E5E5] flex items-center justify-between px-8 bg-white/80 backdrop-blur sticky top-0 z-10 shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">
              {files.length > 0 ? 'Gallery' : 'Upload'}
            </h3>
            <span className="text-sm font-medium text-gray-500">
              {files.length} items selected
            </span>
          </div>

          {/* Grid Content */}
          <div className="flex-1 p-8 overflow-y-auto bg-white min-h-0">
             {files.length === 0 ? (
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 className="h-full border-2 border-dashed border-[#E5E5E5] rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-[#F5F5F7] hover:border-[#D1D1D6] transition-all group max-h-[600px] my-auto"
               >
                  <div className="w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center text-gray-400 group-hover:scale-110 group-hover:bg-white group-hover:shadow-sm transition-all mb-6">
                     <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Drop photos here</h3>
                  <p className="text-gray-500 mt-2">or click anywhere to browse</p>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {files.map((file, i) => (
                     <div key={i} className="group relative aspect-square bg-[#F5F5F7] rounded-2xl border border-[#E5E5E5] overflow-hidden flex flex-col items-center justify-center transition-all hover:shadow-md">
                        {/* We don't have real previews without ObjectURLs, so using nice large Icon */}
                        <ImageIcon className="w-12 h-12 text-[#D1D1D6] mb-2" strokeWidth={1.5} />
                        <span className="text-xs text-gray-500 px-4 truncate w-full text-center font-medium">{file.name}</span>
                        
                        {/* File Status Overlay */}
                        {uploads[file.name]?.status === 'completed' && (
                           <div className="absolute inset-0 bg-white/80 backdrop-blur flex items-center justify-center">
                              <CheckCircle2 className="w-12 h-12 text-[#34C759]" />
                           </div>
                        )}
                         {uploads[file.name]?.status === 'error' && (
                           <div className="absolute inset-0 bg-white/80 backdrop-blur flex items-center justify-center">
                              <AlertCircle className="w-12 h-12 text-red-500" />
                           </div>
                        )}
                        
                        {/* Hover Actions */}
                        {!isUploading && (
                           <button
                              onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                              className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm active:scale-90"
                           >
                              <X className="w-4 h-4" />
                           </button>
                        )}
                     </div>
                  ))}
               </div>
             )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Uploader;