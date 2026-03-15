import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { FileText, CheckCircle, Clock, ShieldCheck, Key } from 'lucide-react';
import { motion } from 'motion/react';
import UserPortal from './pages/UserPortal';
import AdminDashboard from './pages/AdminDashboard';
import ResultsUI from './pages/ResultsUI';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg text-indigo-600">
            <FileText className="w-6 h-6" />
            <span>ATS CV Analyzer</span>
          </Link>
          <nav className="flex gap-6 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-indigo-600 transition-colors">Submit CV</Link>
            <Link to="/results" className="hover:text-indigo-600 transition-colors">Check Results</Link>
            <Link to="/admin" className="hover:text-indigo-600 transition-colors">Admin</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </main>
      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} ATS CV Analyzer. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    // @ts-ignore
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      // @ts-ignore
      window.aistudio.hasSelectedApiKey().then(setHasKey);
    } else {
      setHasKey(true); // Fallback if not in AI Studio
    }
  }, []);

  const handleSelectKey = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasKey(true);
    } catch (err) {
      console.error('Failed to select key:', err);
    }
  };

  if (hasKey === null) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <Key className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">API Key Required</h2>
          <p className="text-slate-600 mb-6">
            This application requires a valid API key to perform ATS analysis.
            Please select your API key to continue.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
          >
            Select API Key
          </button>
          <p className="mt-4 text-xs text-slate-500">
            You must select an API key. Without it, the application cannot function properly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<UserPortal />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/results" element={<ResultsUI />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
