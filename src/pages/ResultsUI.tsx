import React, { useEffect, useRef, useState } from 'react';
import { Search, CheckCircle2, XCircle, FileText, ChevronRight, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function ResultsUI() {
  const [trxId, setTrxId] = useState('');
  const [activeTrxId, setActiveTrxId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const pollRef = useRef<number | null>(null);

  const clearPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchResults = async (id: string, showLoading = false) => {
    if (!id) return;

    if (showLoading) setLoading(true);

    try {
      const res = await fetch(`/api/results/${id}`);
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Failed to fetch results');

      setData(result);

      if (result.status !== 'Pending Verification' && result.status !== 'Processing') {
        clearPolling();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch results');
      clearPolling();
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = trxId.trim();
    if (!trimmed) return;

    clearPolling();
    setActiveTrxId(trimmed);
    setError('');
    setData(null);

    await fetchResults(trimmed, true);
  };

  useEffect(() => {
    if (!activeTrxId) return;

    if (data?.status === 'Pending Verification' || data?.status === 'Processing') {
      pollRef.current = window.setInterval(() => {
        fetchResults(activeTrxId);
      }, 5000);
    }

    return () => {
      clearPolling();
    };
  }, [activeTrxId, data?.status]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Check Your Results</h1>
        <p className="text-slate-600 max-w-lg mx-auto">
          Enter your bKash Transaction ID to view your ATS analysis and done-for-you CV rewrites.
        </p>
      </div>

      <form onSubmit={handleSearch} className="max-w-md mx-auto relative mb-12">
        <input
          type="text"
          value={trxId}
          onChange={(e) => setTrxId(e.target.value)}
          placeholder="Enter TrxID (e.g. 8A7B6C5D4E)"
          className="w-full pl-5 pr-14 py-4 rounded-2xl border border-slate-300 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono uppercase text-lg"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-70"
        >
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-5 h-5" />}
        </button>
      </form>

      {error && (
        <div className="max-w-md mx-auto bg-red-50 text-red-700 p-4 rounded-xl text-center mb-8">
          {error}
        </div>
      )}

      {data && data.status === 'Pending Verification' && (
        <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold text-amber-900 mb-2">Verification Pending</h3>
          <p className="text-amber-700 text-sm">
            Your payment is currently being verified by an admin. Please check back later.
          </p>
          <p className="text-amber-600 text-xs mt-3">This page refreshes automatically every 5 seconds.</p>
        </div>
      )}

      {data && data.status === 'Processing' && (
        <div className="max-w-md mx-auto bg-blue-50 border border-blue-200 p-8 rounded-2xl text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-blue-900 mb-2">Analyzing CV...</h3>
          <p className="text-blue-700 text-sm">
            Your payment is verified. Our AI is currently analyzing your CV. This usually takes about 30 seconds.
          </p>
          <p className="text-blue-600 text-xs mt-3">This page refreshes automatically every 5 seconds.</p>
        </div>
      )}

      {data && data.status === 'Failed' && (
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 p-8 rounded-2xl text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold text-red-900 mb-2">Analysis Failed</h3>
          <p className="text-red-700 text-sm">
            {data.results?.error || 'The AI analysis failed. Please contact admin to retry verification.'}
          </p>
        </div>
      )}

      {data && data.status === 'Verified' && data.results && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Top Stats Row */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Score Gauge */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center md:col-span-1">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">ATS Match Score</h3>
              <div className="relative w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { value: data.results.atsMatchScore },
                        { value: 100 - data.results.atsMatchScore }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill={data.results.atsMatchScore >= 70 ? '#10b981' : data.results.atsMatchScore >= 40 ? '#f59e0b' : '#ef4444'} />
                      <Cell fill="#f1f5f9" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-4xl font-bold text-slate-900">{data.results.atsMatchScore}%</span>
                </div>
              </div>
            </div>

            {/* Experience & Summary */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2 flex flex-col justify-center">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Calculated Experience</h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-bold text-indigo-600">{data.results.yearsOfExperience}</span>
                <span className="text-xl text-slate-600 font-medium">Years</span>
              </div>
              <p className="text-slate-600">
                Based on your CV, we calculated {data.results.yearsOfExperience} years of relevant experience. Make sure this aligns with the job requirements.
              </p>
            </div>
          </div>

          {/* Knockout Criteria */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-800 text-lg">Knockout Criteria Check</h3>
              <p className="text-sm text-slate-500 mt-1">Hard requirements extracted from the job circular.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {data.results.knockoutCriteria.map((item: any, i: number) => (
                <div key={i} className="p-6 flex gap-4">
                  <div className="shrink-0 mt-1">
                    {item.status.toLowerCase() === 'pass' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 mb-1">{item.criterion}</h4>
                    <p className="text-sm text-slate-600">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CV Section Completeness */}
          {data.results.missingCVSections && (
            <div className={`rounded-2xl shadow-sm border overflow-hidden ${
              data.results.missingCVSections.length === 0 
                ? 'bg-emerald-50 border-emerald-200' 
                : data.results.missingCVSections.length >= 5
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className={`px-6 py-5 border-b ${
                data.results.missingCVSections.length === 0 
                  ? 'bg-emerald-100 border-emerald-200' 
                  : data.results.missingCVSections.length >= 5
                  ? 'bg-red-100 border-red-200'
                  : 'bg-amber-100 border-amber-200'
              }`}>
                <div className="flex items-start gap-3">
                  {data.results.missingCVSections.length === 0 ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-emerald-900 text-lg">CV Structure Complete</h3>
                        <p className="text-sm text-emerald-700 mt-1">All major CV sections are present and accounted for.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className={`w-6 h-6 ${data.results.missingCVSections.length >= 5 ? 'text-red-600' : 'text-amber-600'} shrink-0 mt-0.5`} />
                      <div>
                        <h3 className={`font-semibold text-lg ${data.results.missingCVSections.length >= 5 ? 'text-red-900' : 'text-amber-900'}`}>
                          {data.results.missingCVSections.length >= 5 ? 'Missing Critical CV Sections' : 'Missing CV Sections'}
                        </h3>
                        <p className={`text-sm mt-1 ${data.results.missingCVSections.length >= 5 ? 'text-red-700' : 'text-amber-700'}`}>
                          {data.results.missingCVSections.length >= 5 
                            ? 'This document is missing too many sections to be considered a complete CV. Please add the missing sections.' 
                            : 'Below are the sections that should be included in a professional CV:'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {data.results.missingCVSections.length > 0 && (
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.results.missingCVSections.map((section: string, i: number) => (
                      <div 
                        key={i} 
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          data.results.missingCVSections.length >= 5
                            ? 'bg-red-100 border border-red-200'
                            : 'bg-white border border-amber-100'
                        }`}
                      >
                        <XCircle className={`w-5 h-5 shrink-0 ${
                          data.results.missingCVSections.length >= 5 ? 'text-red-600' : 'text-amber-600'
                        }`} />
                        <span className={`font-medium ${
                          data.results.missingCVSections.length >= 5 ? 'text-red-900' : 'text-amber-900'
                        }`}>{section}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggested Jobs - Only show if present */}
          {data.results.suggestedJobs && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-slate-800 text-lg">Recommended Job Roles</h3>
                <p className="text-sm text-slate-500 mt-1">Based on your skills and experience, these roles would be a great fit.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {data.results.suggestedJobs.map((job: any, i: number) => (
                  <div key={i} className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className="font-semibold text-slate-900 text-lg">{job.jobTitle}</h4>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full whitespace-nowrap">
                        {job.seniority}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm">{job.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rewrites - Section Based */}
          <div className="bg-slate-900 rounded-2xl shadow-sm overflow-hidden text-white">
            <div className="px-6 py-5 border-b border-slate-800">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                "Done-For-You" CV Rewrites
              </h3>
              <p className="text-sm text-slate-400 mt-1">Section-specific suggestions to optimize your CV. Copy and paste these into your CV.</p>
            </div>
            <div className="p-6 space-y-6">
              {data.results.sectionRewrites ? (
                // New section-based format
                Object.entries(data.results.sectionRewrites).map(([key, section]: [string, any]) => (
                  section.rewrites && section.rewrites.length > 0 && (
                    <div key={key} className="border-l-4 border-indigo-500 pl-4">
                      <h4 className="font-semibold text-indigo-300 mb-3 text-sm uppercase tracking-wide">{section.section}</h4>
                      <div className="space-y-3">
                        {section.rewrites.map((rewrite: string, i: number) => (
                          <div key={i} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex gap-3">
                            <ChevronRight className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-slate-200 leading-relaxed">{rewrite}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))
              ) : data.results.rewrites ? (
                // Fallback to old format
                data.results.rewrites.map((rewrite: string, i: number) => (
                  <div key={i} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex gap-3">
                    <ChevronRight className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-slate-200 leading-relaxed">{rewrite}</p>
                  </div>
                ))
              ) : null}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
