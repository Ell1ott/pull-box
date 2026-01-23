
import React, { useState } from 'react';
import { Plus, Link, Trash2, Image as ImageIcon, CheckCircle2, HardDrive, Copy } from 'lucide-react';
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

  const storageData = [
    { name: 'Used', value: 4.2 },
    { name: 'Free', value: 10.8 },
  ];
  const COLORS = ['#4f46e5', '#e2e8f0'];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Collections</h1>
          <p className="text-gray-500 font-medium mt-1">Manage and share your active jars</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center justify-center px-6 py-3 bg-[#007AFF] text-white font-semibold rounded-2xl hover:bg-[#0062CC] transition-all shadow-md active:scale-[0.98]"
        >
          <Plus className="w-5 h-5 mr-2" strokeWidth={2.5} />
          New Collection
        </button>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Jars Card */}
        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex flex-col justify-between h-40 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-32 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-blue-100/50" />
          <div className="relative z-10">
            <div className="flex items-center space-x-2 text-gray-500 mb-2">
              <Link className="w-5 h-5" />
              <span className="font-semibold text-sm uppercase tracking-wide">Active Links</span>
            </div>
            <div className="text-5xl font-bold text-gray-900 tracking-tighter">{boxes.length}</div>
          </div>
          <div className="text-sm font-medium text-gray-400 relative z-10">
            Jars currently open
          </div>
        </div>

        {/* Total Photos Card */}
        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex flex-col justify-between h-40 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-32 bg-amber-50/50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-amber-100/50" />
          <div className="relative z-10">
            <div className="flex items-center space-x-2 text-gray-500 mb-2">
              <ImageIcon className="w-5 h-5" />
              <span className="font-semibold text-sm uppercase tracking-wide">Total Photos</span>
            </div>
            <div className="text-5xl font-bold text-gray-900 tracking-tighter">
              {boxes.reduce((acc, box) => acc + box.photoCount, 0)}
            </div>
          </div>
          <div className="text-sm font-medium text-gray-400 relative z-10">
            Collected across all jars
          </div>
        </div>

        {/* Storage Card */}
        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex items-center justify-between h-40 relative overflow-hidden hover:shadow-md transition-all">
            <div className="flex flex-col justify-between h-full z-10">
               <div className="flex items-center space-x-2 text-gray-500">
                  <HardDrive className="w-5 h-5" />
                  <span className="font-semibold text-sm uppercase tracking-wide">Drive Storage</span>
               </div>
               <div>
                  <div className="text-2xl font-bold text-gray-900">4.2 GB</div>
                  <div className="text-sm text-gray-400 font-medium">of 15 GB used</div>
               </div>
            </div>
            <div className="w-24 h-24 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={storageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={40}
                      paddingAngle={5}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      {storageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-400 pointer-events-none">
                   72%
                </div>
            </div>
        </div>
      </div>

      {/* Jars List */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white">
          <h3 className="text-lg font-bold text-gray-900">Your Jars</h3>
           <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-1 rounded-full uppercase tracking-wide">
             {boxes.length} Active
           </span>
        </div>
        
        {boxes.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Link className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Jars Yet</h3>
            <p className="text-gray-500 mb-8">Create your first collection to start receiving photos.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="text-[#007AFF] font-semibold hover:opacity-80 transition-opacity"
            >
              Create Collection
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {boxes.map((box) => (
              <div 
                key={box.id} 
                className="p-6 hover:bg-gray-50/80 transition-all group flex flex-col md:flex-row md:items-center gap-6 cursor-pointer"
                onClick={() => onViewBox(box.id)}
              >
                {/* Icon & Info */}
                <div className="flex items-center gap-5 flex-grow min-w-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0 border border-blue-100/50 shadow-sm">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-bold text-gray-900 truncate mb-1 group-hover:text-[#007AFF] transition-colors">{box.name}</h4>
                    <div className="flex items-center text-sm text-gray-500 font-medium space-x-1">
                      <span>{box.photoCount} items</span>
                      <span className="text-gray-300">•</span>
                      <span className={Math.ceil((box.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)) < 3 ? "text-amber-500" : ""}>
                        Exp {new Date(box.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                   <div className="hidden md:flex items-center text-xs font-mono text-gray-400 bg-gray-100/50 px-3 py-1.5 rounded-lg mr-2 max-w-[140px] truncate">
                      {window.location.origin}/#/box/{box.linkCode}
                   </div>
                   
                  <button
                    onClick={() => handleCopyLink(box.linkCode, box.id)}
                    className={`h-10 w-10 flex items-center justify-center rounded-xl border transition-all ${
                      copiedId === box.id 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    title="Copy Link"
                  >
                    {copiedId === box.id ? <CheckCircle2 className="w-5 h-5" /> : <Link className="w-5 h-5" />}
                  </button>
                  
                  <button
                    onClick={() => onViewBox(box.id)}
                    className="h-10 px-5 bg-white border border-gray-200 hover:border-[#007AFF] hover:text-[#007AFF] text-gray-700 font-semibold rounded-xl text-sm transition-all"
                  >
                    Open
                  </button>

                   <button
                    onClick={() => onDeleteBox(box.id)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl border border-transparent text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Delete Collection"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsCreating(false)} />
           
          <div className="relative bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center mb-8">
               <div className="w-16 h-16 bg-[#007AFF]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#007AFF]">
                  <Plus className="w-8 h-8" strokeWidth={3} />
               </div>
               <h2 className="text-2xl font-bold text-gray-900">New Jar</h2>
               <p className="text-gray-500 text-sm mt-1">Create a shared folder directly in your Drive</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Collection Name (e.g. Hawaii Trip)"
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-gray-900 placeholder:text-gray-400 font-medium focus:ring-2 focus:ring-[#007AFF]/20 focus:bg-white transition-all outline-none"
                  value={newBoxName}
                  onChange={(e) => setNewBoxName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="w-full h-12 bg-white text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full h-12 bg-[#007AFF] text-white font-bold rounded-xl hover:bg-[#0062CC] transition-colors shadow-lg shadow-blue-200"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
