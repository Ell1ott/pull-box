
export interface User {
  id: string;
  email: string;
  name: string;
  photoUrl?: string;
  accessToken?: string;
}

export interface PullBox {
  id: string;
  ownerId: string;
  name: string;
  driveFolderId: string;
  linkCode: string;
  createdAt: number;
  expiresAt: number;
  photoCount: number;
}

export interface DriveFile {
  id: string;
  name: string;
  thumbnailLink: string;
  webContentLink: string;
  size?: string;
  createdTime?: string;
}

export enum AppStatus {
  LOADING = 'LOADING',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  AUTHENTICATED = 'AUTHENTICATED',
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}
