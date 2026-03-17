import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UploadCloud, CheckCircle2, AlertCircle, CreditCard, Copy, Check } from 'lucide-react';

export default function UserPortal() {
  const [email, setEmail] = useState('');
  const [jobCircular, setJobCircular] = useState('');
  const [trxId, setTrxId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const bkashNumber = '01775340641';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      setStatus('error');
      return;
    }
    
    if (!file) {
      setErrorMessage('Please upload your CV (PDF).');
      setStatus('error');
      return;
    }
    
    if (!trxId.trim()) {
      setErrorMessage('Please enter your bKash Transaction ID.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('email', email);
    formData.append('job_circular', jobCircular);
    formData.append('trx_id', trxId);
    formData.append('cv', file);

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      setStatus('success');
    } catch (err: any) {
      setErrorMessage(err.message);
      setStatus('error');
    }
  };

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText(bkashNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (status === 'success') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center"
      >
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Submission Received!</h2>
        <p className="text-slate-600 mb-6">
          Your CV and Transaction ID have been submitted. Once verified by our admin, your ATS analysis will begin.
        </p>
        <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 mb-6">
          <span className="font-medium block mb-1">Your Transaction ID:</span>
          <code className="font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{trxId}</code>
        </div>
        <p className="text-sm text-slate-500">
          Save this ID. You will need it to check your results later.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">
          ATS CV Analyzer
        </h1>
        <p className="text-lg text-slate-600">
          Get actionable, "done-for-you" CV rewrites. Optionally provide a job circular to match your CV against specific roles, or submit your CV alone to get personalized job recommendations.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-4 text-indigo-600">
              <CreditCard className="w-6 h-6" />
              <h3 className="font-semibold text-slate-900">Payment Instructions</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              To use this service, please complete the payment via bKash.
            </p>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">bKash Personal Number</p>
              <div className="flex items-center gap-2 justify-between">
                <p className="font-mono text-lg text-slate-900">{bkashNumber}</p>
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className={`p-2 rounded-lg transition-all ${
                    copied 
                      ? 'bg-emerald-100 text-emerald-600' 
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
              <li>Send Money: <strong>20 BDT</strong></li>
              <li>Save the Transaction ID (TrxID)</li>
              <li>Enter it in the form to verify</li>
            </ul>
          </div>
        </div>

        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            {status === 'error' && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-start gap-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Job Circular Text <span className="text-slate-500 font-normal">(Optional)</span></label>
              <textarea
                value={jobCircular}
                onChange={(e) => setJobCircular(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                placeholder="Paste the full job description here... (Leave blank to get job recommendations based on your CV)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Upload CV (PDF)</label>
              <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 hover:bg-slate-50 transition-colors text-center cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 font-medium">
                  {file ? file.name : 'Click or drag to upload PDF'}
                </p>
                {!file && <p className="text-xs text-slate-400 mt-1">Max file size: 5MB</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">bKash Transaction ID</label>
              <input
                type="text"
                required
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono uppercase"
                placeholder="e.g. 8A7B6C5D4E"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {status === 'submitting' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit for Analysis'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
