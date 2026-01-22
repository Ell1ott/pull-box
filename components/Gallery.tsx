
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
    <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div className="flex items-center space-x-3 md:space-x-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{box.name}</h1>
            <p className="text-gray-500 text-xs md:text-sm truncate">Folder ID: {box.driveFolderId}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 md:space-x-3">
          <button
            onClick={handleDownloadAll}
            disabled={loading || files.length === 0 || downloadingAll}
            className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-3 md:px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="whitespace-nowrap">{downloadingAll ? 'Downloading...' : 'Download All'}</span>
          </button>
          <div className="px-3 md:px-4 py-2 bg-indigo-50 text-indigo-700 font-semibold rounded-lg text-sm whitespace-nowrap">
            {files.length} Photos
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
            <div key={i} className="aspect-square bg-gray-200 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-20 text-center">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <ImageIcon className="w-8 h-8 md:w-10 md:h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No photos yet</h3>
          <p className="text-gray-500 mt-1 max-w-xs md:max-w-sm text-sm">
            Share the public link with your friends to start collecting photos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {files.map((file, index) => (
            <div
              key={file.id}
              onClick={() => setSelectedIndex(index)}
              className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border shadow-sm transition-all hover:shadow-md cursor-pointer"
            >
              <img
                src={file.thumbnailLink}
                alt={file.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute top-2 right-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-1.5 md:p-2 bg-black/40 text-white rounded-full backdrop-blur-md">
                  <Maximize2 className="w-4 h-4 md:w-5 md:h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 sm:bg-black/90 flex flex-col items-center justify-center animate-in fade-in duration-200">
          {/* Top Bar */}
          <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between text-white z-10 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex flex-col">
              <span className="font-medium text-sm md:text-base truncate max-w-[200px] md:max-w-md">
                {selectedImage.name}
              </span>
              <span className="text-xs text-gray-400">
                {selectedIndex! + 1} of {files.length}
              </span>
            </div>
            <button
              onClick={() => setSelectedIndex(null)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6 md:w-8 md:h-8" />
            </button>
          </div>

          {/* Navigation Buttons - Hidden on small mobile, use swipe feel or just arrows on larger */}
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 md:p-3 text-white hover:bg-white/10 rounded-full transition-colors z-10 hidden sm:block"
          >
            <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 md:p-3 text-white hover:bg-white/10 rounded-full transition-colors z-10 hidden sm:block"
          >
            <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
          </button>
          
          <div 
            className="w-full h-full flex items-center justify-center p-4 md:p-12"
            onClick={() => setSelectedIndex(null)}
          >
            <img
              src={selectedImage.webContentLink}
              alt={selectedImage.name}
              className="max-w-full max-h-full object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Bottom Actions */}
          <div className="absolute bottom-0 inset-x-0 p-6 flex flex-col sm:flex-row items-center justify-center gap-4 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
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
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors border border-white/20"
                  title="Share"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              )}
              <a
                href={selectedImage.webContentLink}
                download
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-5 h-5" />
                <span>Download</span>
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(selectedImage.id); }}
                className="flex items-center justify-center p-3 md:px-6 md:py-3 bg-red-500/20 md:bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors border border-red-500/30"
              >
                <Trash2 className="w-5 h-5 md:mr-2" />
                <span className="hidden md:inline">Delete</span>
              </button>
            </div>
            
            {/* Mobile Nav Helper */}
            <div className="flex sm:hidden items-center justify-center space-x-8 text-white w-full">
              <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="p-2">
                <ChevronLeft className="w-8 h-8" />
              </button>
              <span className="text-sm font-medium">{selectedIndex! + 1} / {files.length}</span>
              <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="p-2">
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
