import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Clock, AlertCircle, BadgeCheck } from 'lucide-react';

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [approved, setApproved] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') { // Simple hardcoded password for MVP
      setIsAuthenticated(true);
      fetchPending();
    } else {
      setError('Invalid password');
    }
  };

  const fetchPending = async () => {
    setLoading(true);
    setError('');
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        fetch('/api/admin/pending'),
        fetch('/api/admin/approved')
      ]);
      const pendingData = await pendingRes.json();
      const approvedData = await approvedRes.json();
      setPending(pendingData);
      setApproved(approvedData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (trxId: string) => {
    setError('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trx_id: trxId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Remove from pending list and re-fetch approved
      setPending(pending.filter(p => p.trx_id !== trxId));
      fetchPending();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
        <ShieldCheck className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-6">Admin Login</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-600 mt-1">Manage pending ATS analysis requests.</p>
        </div>
        <button onClick={fetchPending} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          Refresh List
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Pending Verifications ({pending.length})</h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : pending.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">All caught up!</p>
            <p className="text-sm text-slate-400">No pending transactions to verify.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pending.map((item) => (
              <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-sm font-medium">
                      {item.trx_id}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{item.email}</p>
                </div>
                <button
                  onClick={() => handleVerify(item.trx_id)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Verify & Process
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Submissions Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-emerald-600" /> Previously Approved ({approved.length})</h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : approved.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No approved transactions yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {approved.map((item) => (
              <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-sm font-medium">
                      {item.trx_id}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{item.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
