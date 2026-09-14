import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Settings as SettingsIcon } from 'lucide-react';
import { apiService } from '../../services/api';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';
import { EnterpriseIntegration, IntegrationSystemType } from '../../types';

export const IntegrationsManager: React.FC = () => {
  const [integrations, setIntegrations] = useState<EnterpriseIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [systemType, setSystemType] = useState<IntegrationSystemType>('ERPNext' as any);
  const [baseUrl, setBaseUrl] = useState('');
  const [authType, setAuthType] = useState('api_key');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [syncStatus, setSyncStatus] = useState<Record<string, 'idle' | 'syncing' | 'success' | 'error'>>({});

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const data = await apiService.getIntegrations();
      setIntegrations(data);
    } catch (err) {
      console.error('Failed to load integrations', err);
    }
  };

  const handleTest = async () => {
    soundFX.playClick();
    setTestStatus('testing');
    try {
      const res = await apiService.testIntegration({
        name,
        system_type: systemType,
        base_url: baseUrl,
        auth_type: authType,
        api_key: apiKey,
        api_secret: apiSecret
      });
      if (res.success) {
        soundFX.playSuccess();
        setTestStatus('success');
      } else {
        soundFX.playError();
        setTestStatus('error');
      }
    } catch {
      soundFX.playError();
      setTestStatus('error');
    }
  };

  const handleSave = async () => {
    soundFX.playClick();
    try {
      await apiService.createIntegration({
        name,
        system_type: systemType,
        base_url: baseUrl,
        auth_type: authType,
        api_key: apiKey,
        api_secret: apiSecret
      });
      soundFX.playSuccess();
      setIsAdding(false);
      resetForm();
      fetchIntegrations();
    } catch (err) {
      soundFX.playError();
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    soundFX.playClick();
    if (!window.confirm("Delete this integration?")) return;
    try {
      await apiService.deleteIntegration(id);
      fetchIntegrations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSync = async (id: string) => {
    soundFX.playClick();
    setSyncStatus(prev => ({ ...prev, [id]: 'syncing' }));
    try {
      const res = await apiService.syncIntegration(id);
      if (res.success) {
        soundFX.playSuccess();
        setSyncStatus(prev => ({ ...prev, [id]: 'success' }));
        setTimeout(() => setSyncStatus(prev => ({ ...prev, [id]: 'idle' })), 3000);
        alert(`Sync complete. \nItems: ${res.results?.items || 0}\nSuppliers: ${res.results?.suppliers || 0}\nInventory: ${res.results?.inventory || 0}\nWarehouses: ${res.results?.warehouses || 0}`);
      }
    } catch (err) {
      soundFX.playError();
      setSyncStatus(prev => ({ ...prev, [id]: 'error' }));
      setTimeout(() => setSyncStatus(prev => ({ ...prev, [id]: 'idle' })), 3000);
      alert('Sync failed.');
    }
  };

  const resetForm = () => {
    setName('');
    setBaseUrl('');
    setApiKey('');
    setApiSecret('');
    setTestStatus('idle');
  };

  return (
    <div className="rounded-2xl glass-panel border border-white/10 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Integration Hub</span>
        </h3>
        {!isAdding && (
          <Button variant="glow" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsAdding(true)}>
            Add Integration
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="p-5 rounded-xl bg-slate-900/90 border border-white/10 space-y-4">
          <h4 className="text-sm font-bold text-white mb-2">New Integration</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Integration Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white text-sm" placeholder="e.g. My ERP" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Provider</label>
              <select value={systemType} onChange={e => setSystemType(e.target.value as any)} className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white text-sm">
                <option value="ERPNext">ERPNext</option>
                <option value="Generic REST">Generic REST API</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">Base URL</label>
            <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white text-sm" placeholder="https://erp.example.com or http://localhost:8080" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
              <label className="block text-xs text-slate-400 mb-1">Auth Type</label>
              <select value={authType} onChange={e => setAuthType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white text-sm">
                <option value="api_key">API Key (Token)</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">API Key / Username</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white text-sm" />
            </div>
            {authType !== 'bearer' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">API Secret / Password</label>
                <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white text-sm" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/10 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); resetForm(); }}>Cancel</Button>
            <Button variant="secondary" size="sm" onClick={handleTest} isLoading={testStatus === 'testing'}>
              {testStatus === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : testStatus === 'error' ? <XCircle className="w-4 h-4 text-red-400" /> : 'Test Connection'}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!name || !baseUrl || !apiKey}>Save Integration</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {integrations.map(integration => (
          <div key={integration.id} className="p-4 rounded-xl bg-slate-900/80 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-bold text-white">{integration.name}</h4>
                <NeonBadge variant={integration.status === 'connected' ? 'optimal' : 'warning'} size="sm">
                  {integration.system_type}
                </NeonBadge>
              </div>
              <p className="text-xs text-slate-400">{integration.base_url}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="secondary" 
                size="sm" 
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${syncStatus[integration.id] === 'syncing' ? 'animate-spin' : ''}`} />} 
                onClick={() => handleSync(integration.id)}
                disabled={syncStatus[integration.id] === 'syncing'}
              >
                {syncStatus[integration.id] === 'success' ? 'Synced!' : 'Sync Now'}
              </Button>
              <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(integration.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {integrations.length === 0 && !isAdding && (
          <div className="text-center p-8 border border-dashed border-white/10 rounded-xl text-slate-500 text-sm">
            No integrations configured. Connect your ERP or WMS to sync operational data.
          </div>
        )}
      </div>
    </div>
  );
};
