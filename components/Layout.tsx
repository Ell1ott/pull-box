
import React from 'react';
import { Camera, LogOut, LayoutDashboard, Settings } from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-600 rounded-lg">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                Pull-Box
              </span>
            </div>
            
            {user && (
              <div className="flex items-center space-x-4">
                <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600 mr-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold overflow-hidden">
                    {user.photoUrl ? (
                      <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.name.charAt(0)
                    )}
                  </div>
                  <span className="font-medium">{user.name}</span>
                </div>
                
                <button
                  onClick={onLogout}
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-white border-t py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} Pull-Box. Leveraging Google Drive™ storage.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
