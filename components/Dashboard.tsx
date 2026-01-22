
import React, { useState } from 'react';
import { Plus, Link, Trash2, ExternalLink, Image as ImageIcon, Copy, CheckCircle2, ChevronRight, HardDrive } from 'lucide-react';
import { PullBox, User } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DashboardProps {
  user: User;
  boxes: PullBox[];
  onCreateBox: (name: string) => void;
  onDeleteBox: (id: string) => void;
  onViewBox: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, boxes, onCreateBox, onDeleteBox, onViewBox }) => {
  const [newBoxName, setNewBoxName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (code: string, id: string) => {
    const url = `${window.location.origin}/#/box/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoxName.trim()) return;
    onCreateBox(newBoxName);
    setNewBoxName('');
    setIsCreating(false);
  };

  // Mock stats for chart
  const storageData = [
    { name: 'Used', value: 4.2 },
    { name: 'Free', value: 10.8 },
  ];
  const COLORS = ['#4f46e5', '#e2e8f0'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Pull-Boxes</h1>
          <p className="text-gray-500">Manage your active photo collection links</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Pull-Box
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <Link className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{boxes.length}</div>
            <div className="text-sm text-gray-500">Active Links</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {boxes.reduce((acc, box) => acc + box.photoCount, 0)}
            </div>
            <div className="text-sm text-gray-500">Total Photos Received</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">Drive Storage</div>
              <div className="text-sm text-gray-500">15GB Total</div>
            </div>
          </div>
          <div className="w-20 h-20">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={storageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={35}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {storageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Creation Modal / Form Overlay */}
      {isCreating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-4">Create a new Pull-Box</h2>
            <p className="text-gray-500 mb-6 text-sm">
              This will create a dedicated folder in your Google Drive. You can share the link with anyone to receive high-quality photos.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collection Name
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g., Sarah's Wedding Photos"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newBoxName}
                  onChange={(e) => setNewBoxName(e.target.value)}
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List of Pull Boxes */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-gray-50/50">
          <h3 className="font-semibold text-gray-900">Active Pull-Boxes</h3>
        </div>
        {boxes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">You haven't created any Pull-Boxes yet.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-4 text-indigo-600 font-medium hover:underline"
            >
              Create your first collection link
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {boxes.map((box) => (
              <div key={box.id} className="p-6 hover:bg-gray-50 transition-colors group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-gray-900 truncate">{box.name}</h4>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full">
                        {box.photoCount} photos
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <span>Created {new Date(box.createdAt).toLocaleDateString()}</span>
                      <span className="mx-2">•</span>
                      <span>Expires in {Math.ceil((box.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))} days</span>
                    </div>
                    <div className="mt-2 flex items-center space-x-2 text-xs font-mono bg-gray-100 p-2 rounded max-w-sm truncate text-gray-600">
                      <span className="truncate">{window.location.origin}/#/box/{box.linkCode}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleCopyLink(box.linkCode, box.id)}
                      className={`p-2 rounded-lg border transition-all ${
                        copiedId === box.id 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                        : 'bg-white hover:bg-gray-50 text-gray-600'
                      }`}
                      title="Copy public link"
                    >
                      {copiedId === box.id ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                    
                    <button
                      onClick={() => onViewBox(box.id)}
                      className="p-2 bg-white border hover:border-indigo-600 text-indigo-600 rounded-lg transition-all"
                      title="View gallery"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </button>
                    
                    <button
                      onClick={() => onDeleteBox(box.id)}
                      className="p-2 bg-white border hover:bg-red-50 hover:text-red-600 text-gray-400 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
