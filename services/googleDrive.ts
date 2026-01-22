
import { DriveFile } from '../types';

export class GoogleDriveService {
  private accessToken: string;
  private isDemo: boolean;

  constructor(token: string) {
    this.accessToken = token;
    this.isDemo = token === 'mock_token_xyz' || token === 'guest';
  }

  isDemoMode(): boolean {
    return this.isDemo;
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    if (this.isDemo) {
      console.warn("Running in Demo Mode - API calls are simulated.");
      return null;
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.accessToken}`);

    console.log('[drive:fetch] request', { url, method: options.method || 'GET' });
    const response = await fetch(url, { ...options, headers });
    console.log('[drive:fetch] response', { url, status: response.status });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      console.error('[drive:fetch] error', { url, status: response.status, error });
      throw new Error(error.error?.message || `HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    console.log('[drive:fetch] success', { url, keys: Object.keys(json || {}) });
    return json;
  }

  async createFolder(name: string): Promise<{ id: string }> {
    if (this.isDemo) {
      await new Promise(r => setTimeout(r, 800));
      return { id: `folder_${Math.random().toString(36).substr(2, 9)}` };
    }

    const body = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Created by Pull-Box app'
    };

    const data = await this.fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return { id: data.id };
  }

  async listFiles(folderId: string): Promise<DriveFile[]> {
    if (this.isDemo || folderId.startsWith('folder_')) {
      console.log('[drive:listFiles] demo mode', { folderId });
      await new Promise(r => setTimeout(r, 1000));
      const files = Array.from({ length: 5 }).map((_, i) => ({
        id: `file_${i}`,
        name: `Photo_${i + 1}.jpg`,
        thumbnailLink: `https://picsum.photos/seed/${folderId}${i}/300/200`,
        webContentLink: `https://picsum.photos/seed/${folderId}${i}/1200/800`,
        size: '1.2 MB',
        createdTime: new Date().toISOString()
      }));
      console.log('[drive:listFiles] demo result', { count: files.length });
      return files;
    }

    const query = `'${folderId}' in parents and trashed = false`;
    console.log('[drive:listFiles] start', { folderId, query });
    const data = await this.fetchWithAuth(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,thumbnailLink,webContentLink,size,createdTime)&orderBy=createdTime desc`
    );
    const files = data?.files || [];
    console.log('[drive:listFiles] success', { count: files.length, hasFiles: Array.isArray(data?.files) });
    return files;
  }

  async uploadFile(folderId: string, fileBlob: Blob, fileName: string): Promise<DriveFile> {
    if (this.isDemo) {
      await new Promise(r => setTimeout(r, 1500));
      return {
        id: `file_${Math.random().toString(36).substr(2, 9)}`,
        name: fileName,
        thumbnailLink: `https://picsum.photos/seed/${Math.random()}/300/200`,
        webContentLink: `https://picsum.photos/seed/${Math.random()}/1200/800`,
        size: `${(fileBlob.size / 1024 / 1024).toFixed(2)} MB`,
        createdTime: new Date().toISOString()
      };
    }

    // Multipart upload
    const metadata = {
      name: fileName,
      parents: [folderId]
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', fileBlob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,thumbnailLink,webContentLink,size,createdTime', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || 'Upload failed');
    }

    const responseText = await response.text().catch(() => '');
    if (!responseText) {
      return {
        id: `file_${Math.random().toString(36).substr(2, 9)}`,
        name: fileName,
        thumbnailLink: '',
        webContentLink: '',
        size: `${(fileBlob.size / 1024 / 1024).toFixed(2)} MB`,
        createdTime: new Date().toISOString()
      };
    }

    try {
      return JSON.parse(responseText);
    } catch {
      return {
        id: `file_${Math.random().toString(36).substr(2, 9)}`,
        name: fileName,
        thumbnailLink: '',
        webContentLink: '',
        size: `${(fileBlob.size / 1024 / 1024).toFixed(2)} MB`,
        createdTime: new Date().toISOString()
      };
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (this.isDemo) {
      await new Promise(r => setTimeout(r, 500));
      return;
    }

    await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE'
    });
  }

  async downloadFile(fileId: string): Promise<Blob> {
    if (this.isDemo) {
      throw new Error('Demo mode does not support authenticated downloads');
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    return response.blob();
  }

  async getUserInfo(): Promise<{ name: string; email: string; photo: string }> {
    const data = await this.fetchWithAuth('https://www.googleapis.com/oauth2/v3/userinfo');
    return {
      name: data.name,
      email: data.email,
      photo: data.picture
    };
  }
}
