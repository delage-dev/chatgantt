import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Phone, CheckCircle2, XCircle } from 'lucide-react';
import {
  saveVoiceConfig,
  getVoiceConfig,
  addCallerMapping,
  listCallerMappings,
  removeCallerMapping,
} from '../utils/voiceApi';
import type { VoiceConfigStatus, CallerMappingResponse } from '../utils/voiceApi';

interface VoiceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceSettings({ isOpen, onClose }: VoiceSettingsProps) {
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [status, setStatus] = useState<VoiceConfigStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Caller mappings
  const [callers, setCallers] = useState<CallerMappingResponse[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newProject, setNewProject] = useState('DEMO');
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    if (isOpen) {
      getVoiceConfig().then(setStatus).catch(() => {});
      listCallerMappings().then(setCallers).catch(() => {});
    }
  }, [isOpen]);

  const handleSaveConfig = useCallback(async () => {
    if (!accountSid.trim() || !authToken.trim() || !phoneNumber.trim() || !openaiKey.trim()) return;
    setSaving(true);
    setError('');
    try {
      const result = await saveVoiceConfig({
        twilio_account_sid: accountSid.trim(),
        twilio_auth_token: authToken.trim(),
        twilio_phone_number: phoneNumber.trim(),
        openai_api_key: openaiKey.trim(),
      });
      setStatus(result);
      setAccountSid('');
      setAuthToken('');
      setPhoneNumber('');
      setOpenaiKey('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [accountSid, authToken, phoneNumber, openaiKey]);

  const handleAddCaller = useCallback(async () => {
    if (!newPhone.trim() || !newName.trim() || !newProject.trim()) return;
    try {
      const result = await addCallerMapping({
        phone_number: newPhone.trim(),
        user_name: newName.trim(),
        project_key: newProject.trim(),
        pin: newPin.trim() || undefined,
      });
      setCallers((prev) => [...prev, result]);
      setNewPhone('');
      setNewName('');
      setNewPin('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add caller');
    }
  }, [newPhone, newName, newProject, newPin]);

  const handleRemoveCaller = useCallback(async (phone: string) => {
    try {
      await removeCallerMapping(phone);
      setCallers((prev) => prev.filter((c) => c.phone_number !== phone));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove caller');
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-h-[85vh] bg-[#F5EFE2] border-2 border-[#2C2824] shadow-[6px_6px_0_0_rgba(44,40,36,0.8)] z-[61] flex flex-col">
        {/* Header */}
        <div className="h-12 border-b-2 border-[#2C2824] flex items-center justify-between px-4 bg-[#E4DBCA] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest">
              Voice Settings
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Status */}
          {status && (
            <div className={`flex items-center gap-2 px-3 py-2 border-2 ${status.configured ? 'border-[#7FB5B0] bg-[#7FB5B0]/10' : 'border-[#C4453A]/30 bg-[#C4453A]/5'}`}>
              {status.configured ? (
                <CheckCircle2 className="w-4 h-4 text-[#7FB5B0]" />
              ) : (
                <XCircle className="w-4 h-4 text-[#C4453A]" />
              )}
              <span className="text-xs font-mono font-bold uppercase">
                {status.configured ? 'Configured' : 'Not configured'}
              </span>
              {status.configured && status.twilio_phone_number && (
                <span className="text-xs font-mono ml-auto text-[#8C8278]">
                  {status.twilio_phone_number}
                </span>
              )}
            </div>
          )}

          {/* Credentials form */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              Twilio Account SID
            </label>
            <input
              type="text"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              placeholder={status?.twilio_account_sid_last4 ? `****${status.twilio_account_sid_last4}` : 'AC...'}
              className="w-full px-3 py-2 bg-[#F5EFE2] border-2 border-[#2C2824] font-mono text-sm outline-none focus:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]"
            />

            <label className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              Twilio Auth Token
            </label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Auth token"
              className="w-full px-3 py-2 bg-[#F5EFE2] border-2 border-[#2C2824] font-mono text-sm outline-none focus:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]"
            />

            <label className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              Twilio Phone Number
            </label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+15551234567"
              className="w-full px-3 py-2 bg-[#F5EFE2] border-2 border-[#2C2824] font-mono text-sm outline-none focus:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]"
            />

            <label className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              OpenAI API Key (Realtime)
            </label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder={status?.openai_key_last4 ? `****${status.openai_key_last4}` : 'sk-...'}
              className="w-full px-3 py-2 bg-[#F5EFE2] border-2 border-[#2C2824] font-mono text-sm outline-none focus:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]"
            />

            <p className="text-[10px] text-[#8C8278]">
              Stored in server memory only. Lost on restart. Never written to disk.
            </p>

            {error && (
              <p className="text-[10px] text-[#C4453A] font-bold">{error}</p>
            )}

            <button
              onClick={handleSaveConfig}
              disabled={!accountSid.trim() || !authToken.trim() || !phoneNumber.trim() || !openaiKey.trim() || saving}
              className="w-full py-2 bg-[#2C2824] text-[#EDE5D4] font-mono text-xs uppercase font-bold tracking-wider border-2 border-[#2C2824] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Credentials'}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-[#2C2824]/20" />

          {/* Caller Mappings */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              Caller ID Mappings
            </span>

            {callers.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {callers.map((c) => (
                  <div
                    key={c.phone_number}
                    className="flex items-center gap-2 px-2 py-1.5 border border-[#2C2824]/20 bg-[#F5EFE2]"
                  >
                    <span className="font-mono text-[10px] font-bold bg-[#E4DBCA] px-1.5 py-0.5">
                      {c.phone_number}
                    </span>
                    <span className="text-[11px] flex-1 truncate">{c.user_name}</span>
                    <span className="text-[9px] font-mono text-[#8C8278]">{c.project_key}</span>
                    <button
                      onClick={() => handleRemoveCaller(c.phone_number)}
                      className="w-5 h-5 flex items-center justify-center text-[#8C8278] hover:text-[#C4453A] flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#8C8278]">No caller mappings configured</p>
            )}

            {/* Add mapping form */}
            <div className="border border-[#2C2824]/20 bg-[#F5EFE2] p-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+15551234567"
                  className="flex-1 px-2 py-1 bg-[#F5EFE2] border border-[#2C2824]/20 text-xs font-mono outline-none focus:border-[#2C2824]"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 px-2 py-1 bg-[#F5EFE2] border border-[#2C2824]/20 text-xs font-mono outline-none focus:border-[#2C2824]"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  placeholder="Project key"
                  className="flex-1 px-2 py-1 bg-[#F5EFE2] border border-[#2C2824]/20 text-xs font-mono outline-none focus:border-[#2C2824]"
                />
                <input
                  type="text"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="PIN (optional)"
                  maxLength={4}
                  className="w-20 px-2 py-1 bg-[#F5EFE2] border border-[#2C2824]/20 text-xs font-mono outline-none focus:border-[#2C2824]"
                />
                <button
                  onClick={handleAddCaller}
                  disabled={!newPhone.trim() || !newName.trim()}
                  className="px-2 py-1 bg-[#2C2824] text-[#EDE5D4] border border-[#2C2824] hover:shadow-[1px_1px_0_0_rgba(44,40,36,0.8)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
