import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, KeyRound, Link2, Loader2, Network, ShieldCheck, SkipForward } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { IntegrationSystemType } from '../../types';

const systemTypes: IntegrationSystemType[] = ['ERP', 'WMS', 'CRM', 'Custom API'];

type FormState = {
  name: string;
  system_type: IntegrationSystemType;
  base_url: string;
  api_key: string;
  api_secret: string;
  api_version: string;
};

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { completeOnboarding } = useAuth();
  const [form, setForm] = useState<FormState>({ name: '', system_type: 'ERP', base_url: '', api_key: '', api_secret: '', api_version: '' });
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState<'test' | 'save' | 'skip' | null>(null);

  const update = <Field extends keyof FormState>(field: Field, value: FormState[Field]) => setForm((current) => ({ ...current, [field]: value }));
  const isValid = Boolean(form.name.trim() && form.base_url.trim() && form.api_key.trim());

  const testConnection = async () => {
    setStatus(null);
    setLoading('test');
    try {
      const result = await apiService.testIntegration(form);
      setStatus({ type: result.success ? 'success' : 'error', message: result.message });
    } catch {
      setStatus({ type: 'error', message: 'Connection failed. Please check your API URL and credentials.' });
    } finally { setLoading(null); }
  };

  const saveConnection = async () => {
    setStatus(null);
    setLoading('save');
    try {
      await apiService.createIntegration(form);
      completeOnboarding();
      setStatus({ type: 'success', message: 'Enterprise connected successfully.' });
    } catch (error: any) {
      setStatus({ type: 'error', message: error.response?.data?.detail || 'Unable to save this connection.' });
    } finally { setLoading(null); }
  };

  const skip = async () => {
    setLoading('skip');
    try {
      await apiService.skipOnboarding();
      completeOnboarding();
      navigate('/');
    } catch {
      setStatus({ type: 'error', message: 'Unable to skip onboarding right now.' });
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,.25),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,.18),transparent_35%)]" />
      <main className="relative z-10 w-full max-w-3xl glass-panel rounded-2xl border border-white/10 p-6 sm:p-10">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3"><Network className="text-cyan-400" /><span className="font-semibold tracking-wide">SYNCHAIN AI</span></div>
          <span className="text-xs uppercase tracking-widest text-slate-500">Setup 1 of 1</span>
        </div>
        <div className="mb-8"><div className="h-1 rounded-full bg-slate-800"><div className="h-1 w-1/2 rounded-full bg-cyan-400" /></div></div>
        <div className="max-w-2xl">
          <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">Enterprise data connection</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Connect Your Enterprise</h1>
          <p className="text-slate-400 leading-7 mb-8">Connect your enterprise systems to allow SynChain AI to analyze supply-chain data and generate risk insights.</p>
          {status && <div className={`mb-6 rounded-xl border p-4 text-sm ${status.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}><div className="flex items-center gap-2">{status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}{status.message}</div>{status.message === 'Enterprise connected successfully.' && <button onClick={() => navigate('/')} className="mt-4 inline-flex items-center gap-2 font-semibold text-emerald-200 hover:text-white">Continue to Dashboard <ArrowRight className="w-4 h-4" /></button>}</div>}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Connection name" value={form.name} onChange={(value) => update('name', value)} placeholder="Primary ERP" />
            <label className="block"><span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">System Type</span><select value={form.system_type} onChange={(event) => update('system_type', event.target.value as IntegrationSystemType)} className="field">{systemTypes.map((systemType) => <option key={systemType} className="bg-slate-900">{systemType}</option>)}</select></label>
            <Field label="API Base URL" value={form.base_url} onChange={(value) => update('base_url', value)} placeholder="https://api.example.com" type="url" />
            <Field label="API Version (optional)" value={form.api_version} onChange={(value) => update('api_version', value)} placeholder="v1" />
            <Field label="API Key" value={form.api_key} onChange={(value) => update('api_key', value)} placeholder="Enter API key" type="password" />
            <Field label="API Secret (if required)" value={form.api_secret} onChange={(value) => update('api_secret', value)} placeholder="Enter API secret" type="password" />
          </div>
          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-between"><button onClick={skip} disabled={!!loading} className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm text-slate-400 hover:text-white disabled:opacity-50"><SkipForward className="w-4 h-4" />Skip for Now</button><div className="flex flex-col sm:flex-row gap-3"><button onClick={testConnection} disabled={!isValid || !!loading} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-50"><Link2 className="w-4 h-4" />{loading === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test Connection'}</button><button onClick={saveConnection} disabled={!isValid || !!loading} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-300 disabled:opacity-50"><KeyRound className="w-4 h-4" />{loading === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Connection'}</button></div></div>
        </div>
      </main>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }> = ({ label, value, onChange, placeholder, type = 'text' }) => <label className="block"><span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</span><input className="field" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={label !== 'API Version (optional)' && label !== 'API Secret (if required)'} /></label>;
