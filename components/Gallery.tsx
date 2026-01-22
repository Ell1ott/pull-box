
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Download, Trash2, Maximize2, X, Image as ImageIcon } from 'lucide-react';
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
  const [selectedImage, setSelectedImage] = useState<DriveFile | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

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
    if (!confirm('Are you sure you want to delete this photo from your Google Drive?')) return;
    
    try {
      await driveService.deleteFile(fileId);
      setFiles(files.filter(f => f.id !== fileId));
      if (selectedImage?.id === fileId) setSelectedImage(null);
    } catch (err) {
      alert('Delete failed. Please try again.');
    }
  };

  const handleDownloadAll = async () => {
    if (files.length === 0 || downloadingAll) return;
    setDownloadingAll(true);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const isMobileDevice = () => {
      if (typeof navigator === 'undefined') return false;
      return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    };

    const canShareFiles = () => {
      if (typeof navigator === 'undefined') return false;
      return typeof (navigator as any).share === 'function' && typeof (navigator as any).canShare === 'function';
    };

    const tryShareToGallery = async (fileList: DriveFile[]) => {
      if (!isMobileDevice() || !canShareFiles()) return false;

      const sharedFiles: File[] = [];
      for (const file of fileList) {
        try {
          const blob = await driveService.downloadFile(file.id);
          const fileName = file.name || `image-${Date.now()}.jpg`;
          const mimeType = blob.type || 'image/jpeg';
          sharedFiles.push(new File([blob], fileName, { type: mimeType }));
        } catch (err) {
          console.error('[gallery] share download failed', { fileId: file.id, err });
        }
      }

      if (sharedFiles.length === 0) return false;

      try {
        const sharePayload = { files: sharedFiles, title: `${box.name} Photos` } as any;
        if ((navigator as any).canShare(sharePayload)) {
          await (navigator as any).share(sharePayload);
          return true;
        }
      } catch (err) {
        console.error('[gallery] share failed', err);
      }

      return false;
    };

    const downloadFilesSequentially = async (fileList: DriveFile[]) => {
      for (const file of fileList) {
        try {
          let blob: Blob | null = null;

          try {
            blob = await driveService.downloadFile(file.id);
          } catch (err) {
            if (!file.webContentLink) throw err;
            const response = await fetch(file.webContentLink);
            if (!response.ok) throw err;
            blob = await response.blob();
          }

          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = file.name || `image-${Date.now()}.jpg`;
          link.rel = 'noopener';

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          await delay(500);
        } catch (err) {
          console.error('[gallery] download failed', { fileId: file.id, err });
        }
      }
    };

    try {
      const shared = await tryShareToGallery(files);
      if (shared) return;
      await downloadFilesSequentially(files);
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{box.name}</h1>
            <p className="text-gray-500 text-sm">Stored in Google Drive folder ID: {box.driveFolderId}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadAll}
            disabled={loading || files.length === 0 || downloadingAll}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingAll ? 'Downloading...' : 'Download All'}</span>
          </button>
          <div className="px-4 py-2 bg-indigo-50 text-indigo-700 font-semibold rounded-lg text-sm">
            {files.length} Photos
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="aspect-square bg-gray-200 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <ImageIcon className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No photos yet</h3>
          <p className="text-gray-500 mt-1 max-w-sm">
            Share the public link with your friends to start collecting photos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border shadow-sm transition-all hover:shadow-md"
            >
              <img
                src={file.thumbnailLink}
                alt={file.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                <button
                  onClick={() => setSelectedImage(file)}
                  className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
                <a
                  href={file.webContentLink}
                  download={file.name}
                  className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  onClick={() => handleDelete(file.id)}
                  className="p-2 bg-red-500/20 hover:bg-red-500/40 text-white rounded-full backdrop-blur-md"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-200">
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="max-w-[90vw] max-h-[90vh] relative">
            <img
              src={selectedImage.webContentLink}
              alt={selectedImage.name}
              className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl"
            />
            <div className="mt-4 flex items-center justify-between text-white">
              <div>
                <h3 className="font-medium">{selectedImage.name}</h3>
                <p className="text-gray-400 text-sm">Uploaded {new Date(selectedImage.createdTime || '').toLocaleDateString()}</p>
              </div>
              <div className="flex space-x-3">
                <a
                  href={selectedImage.webContentLink}
                  download
                  className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Download className="w-5 h-5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => handleDelete(selectedImage.id)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
