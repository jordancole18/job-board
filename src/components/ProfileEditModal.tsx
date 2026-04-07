import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { US_STATES } from '../constants/usStates';

interface ProfileEditModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileEditModal({ open, onClose }: ProfileEditModalProps) {
  const { user, refreshEmployer } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    title: '',
    companyName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (open && user) loadProfile();
  }, [open, user]);

  async function loadProfile() {
    setLoading(true);
    setError('');
    setSuccess('');
    setNewPassword('');
    setConfirmPassword('');

    const { data, error } = await supabase
      .from('employers')
      .select('first_name, last_name, title, company_name, address, city, state, zip')
      .eq('user_id', user!.id)
      .single();

    if (error) {
      setError('Failed to load profile');
      setLoading(false);
      return;
    }

    setForm({
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      title: data.title || '',
      companyName: data.company_name || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zip: data.zip || '',
    });
    setLoading(false);
  }

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Save profile fields via SECURITY DEFINER function
    const { error: profileError } = await supabase.rpc('update_employer_profile', {
      p_first_name: form.firstName || null,
      p_last_name: form.lastName || null,
      p_title: form.title || null,
      p_company_name: form.companyName || null,
      p_address: form.address || null,
      p_city: form.city || null,
      p_state: form.state || null,
      p_zip: form.zip || null,
    });

    if (profileError) {
      setError('Failed to save profile: ' + profileError.message);
      setSaving(false);
      return;
    }

    // Handle password change if requested
    if (newPassword) {
      if (newPassword.length < 6) {
        setError('Profile saved, but new password must be at least 6 characters.');
        setSaving(false);
        await refreshEmployer();
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Profile saved, but passwords do not match.');
        setSaving(false);
        await refreshEmployer();
        return;
      }
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) {
        setError('Profile saved, but password change failed: ' + pwError.message);
        setSaving(false);
        await refreshEmployer();
        return;
      }
    }

    await refreshEmployer();
    setSuccess('Profile updated successfully!');
    setSaving(false);
    setTimeout(() => onClose(), 1200);
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Profile</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="loading" style={{ padding: '2rem' }}>Loading...</div>
        ) : (
          <form onSubmit={handleSave} className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  className="input"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  className="input"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Title</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Executive Director"
              />
            </div>

            <div className="form-group">
              <label>Association Name</label>
              <input
                className="input"
                value={form.companyName}
                onChange={(e) => update('companyName', e.target.value)}
                placeholder="Association name"
              />
            </div>

            <div className="form-group">
              <label>Address</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="Street address"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="form-group">
                <label>State</label>
                <select
                  className="input"
                  value={form.state}
                  onChange={(e) => update('state', e.target.value)}
                >
                  <option value="">Select state...</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Zip</label>
                <input
                  className="input"
                  value={form.zip}
                  onChange={(e) => update('zip', e.target.value)}
                  placeholder="Zip"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="modal-divider" />

            <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Change Password</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Leave blank to keep your current password.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label>New Password</label>
                <input
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  className="input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}
            {success && <p className="success-text">{success}</p>}

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
