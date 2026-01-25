
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Trash2, Maximize2, X, Image as ImageIcon, Share2 } from 'lucide-react';
import { PullBox, DriveFile } from '../types';
import { GoogleDriveService } from '../services/googleDrive';

interface GalleryProps {
  box: PullBox;
  driveService: GoogleDriveService;
  onBack: () => void;
}

const Gallery: React.FC<GalleryProps> = ({ box, driveService, onBack }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedImage = selectedIndex !== null ? files[selectedIndex] : null;
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') setSelectedIndex(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex]);

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      console.log('[gallery] fetch:start', { boxId: box.id, folderId: box.driveFolderId });
      try {
        const result = await driveService.listFiles(box.driveFolderId);
        console.log('[gallery] fetch:success', { count: result.length, boxId: box.id });
        setFiles(result);
      } catch (err) {
        console.error('Failed to fetch files', err);
        console.log('[gallery] fetch:error', { boxId: box.id });
      } finally {
        setLoading(false);
        console.log('[gallery] fetch:done', { boxId: box.id });
      }
    };

    fetchFiles();
  }, [box.driveFolderId, driveService]);

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    try {
      await driveService.deleteFile(fileId);
      setFiles(files.filter(f => f.id !== fileId));
      if (selectedImage?.id === fileId) setSelectedIndex(null);
    } catch (err) {
      alert('Delete failed. Please try again.');
    }
  };

  const handlePrev = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + files.length) % files.length);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % files.length);
    }
  };

  const handleDownloadAll = async () => {
    if (files.length === 0 || downloadingAll) return;
    setDownloadingAll(true);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const downloadImage = async (file: DriveFile, index: number) => {
      let blob: Blob | null = null;
      try {
        blob = await driveService.downloadFile(file.id);
      } catch (err) {
        if (!file.webContentLink) throw err;
        const response = await fetch(file.webContentLink);
        if (!response.ok) throw err;
        blob = await response.blob();
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.name || `image-${index + 1}.jpg`;
      link.rel = 'noopener';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    };

    const downloadFilesSequentially = async (fileList: DriveFile[]) => {
      for (let i = 0; i < fileList.length; i += 1) {
        const file = fileList[i];
        try {
          await downloadImage(file, i);
          await delay(500);
        } catch (err) {
          console.error('[gallery] download failed', { fileId: file.id, err });
        }
      }
    };

    try {
      await downloadFilesSequentially(files);
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] font-sans selection:bg-[#007AFF]/20 selection:text-[#007AFF]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4 min-w-0">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
              aria-label="Back"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight truncate">{box.name}</h1>
              <div className="flex items-center text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                {files.length} Items Collected
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadAll}
              disabled={loading || files.length === 0 || downloadingAll}
              className="flex items-center justify-center space-x-2 px-4 md:px-6 py-2 md:py-3 bg-[#007AFF] text-white font-bold rounded-2xl text-[13px] md:text-[15px] hover:bg-[#0062CC] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-200 active:scale-[0.98]"
            >
              <Download className="w-4 h-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">{downloadingAll ? 'Preparing...' : 'Download All'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Gallery Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
              <div key={i} className="aspect-square bg-white rounded-3xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 md:py-32 text-center bg-white rounded-[40px] shadow-sm border border-gray-100">
            <div className="w-24 h-24 bg-[#F5F5F7] rounded-full flex items-center justify-center mb-6 text-gray-300">
              <ImageIcon className="w-10 h-10" strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Empty Jar</h3>
            <p className="text-gray-500 mt-2 max-w-sm mx-auto font-medium">
              Share the collection link with others to start filling this jar with memories.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {files.map((file, index) => (
              <div
                key={file.id}
                onClick={() => setSelectedIndex(index)}
                className="group relative aspect-square rounded-[28px] overflow-hidden bg-white border border-gray-100 shadow-sm transition-all hover:shadow-xl hover:shadow-black/5 cursor-pointer"
              >
                <img
                  src={file.thumbnailLink}
                  alt={file.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                
                {/* Selection Overlay */}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 transform scale-90 group-hover:scale-100 transition-transform">
                    <Maximize2 className="w-5 h-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modern Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex flex-col animate-in fade-in duration-300">
          {/* Backdrop with Blur */}
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
          
          {/* Controls Bar */}
          <div className="relative z-10 p-6 flex items-center justify-between text-white">
            <div className="flex flex-col bg-black/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
              <span className="font-bold text-sm tracking-tight truncate max-w-[200px] md:max-w-md">
                {selectedImage.name}
              </span>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                {selectedIndex! + 1} of {files.length}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedIndex(null)}
                className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Visual */}
          <div 
            className="flex-1 relative flex items-center justify-center p-4 md:p-12 mb-20"
            onClick={() => setSelectedIndex(null)}
          >
            {/* Nav Arrows */}
            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              className="absolute left-6 hidden md:flex w-14 h-14 items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10 z-20 backdrop-blur-sm"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="absolute right-6 hidden md:flex w-14 h-14 items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10 z-20 backdrop-blur-sm"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
            
            <img
              src={selectedImage.webContentLink}
              alt={selectedImage.name}
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Bottom Action Tray */}
          <div className="absolute bottom-8 inset-x-0 z-10 flex justify-center px-6">
            <div className="bg-white/10 backdrop-blur-2xl px-2 py-2 rounded-[28px] border border-white/20 flex items-center space-x-1 shadow-2xl">
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="md:hidden w-12 h-12 flex items-center justify-center text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div className="h-8 w-[1px] bg-white/10 mx-1 md:hidden" />
              
              <a
                href={selectedImage.webContentLink}
                download
                className="flex items-center space-x-2 px-6 py-3 bg-[#007AFF] text-white font-bold rounded-[22px] hover:bg-[#0062CC] transition-all active:scale-95"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-4 h-4" strokeWidth={3} />
                <span className="text-[14px]">Download</span>
              </a>

              {typeof navigator !== 'undefined' && (navigator as any).share && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const blob = await driveService.downloadFile(selectedImage.id);
                      const file = new File([blob], selectedImage.name || 'photo.jpg', { type: blob.type });
                      await (navigator as any).share({
                        files: [file],
                        title: selectedImage.name,
                      });
                    } catch (err) {
                      console.error('Share failed', err);
                    }
                  }}
                  className="w-12 h-12 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              )}
              
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(selectedImage.id); }}
                className="w-12 h-12 flex items-center justify-center text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <div className="h-8 w-[1px] bg-white/10 mx-1 md:hidden" />

              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="md:hidden w-12 h-12 flex items-center justify-center text-white"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
