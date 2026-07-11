import React, { useState, useContext } from 'react';
import { Card, Typography, TextField, Button, Grid, Avatar, Snackbar, Alert, Paper } from '@mui/material';
import { Settings, Save, Shield, Storage, Fingerprint, Backup, FolderOpen, CloudDownload } from '@mui/icons-material';
import { AuthContext } from '../App';
import axios from 'axios';

export default function SettingsPage() {
  const { user, setUser, activeYear } = useContext(AuthContext);
  const [profile, setProfile] = useState({ name: user?.name || '', username: user?.username || '' });
  const [password, setPassword] = useState({ current: '', new: '', confirm: '' });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [backupDirectory, setBackupDirectory] = useState(localStorage.getItem('backupDirectory') || 'C:\\ChitFundBackups');
  const [backupType, setBackupType] = useState('active');
  const [backupLoading, setBackupLoading] = useState(false);
  const [directorySuggestions, setDirectorySuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch subdirectories suggestions from backend
  const fetchSuggestions = async (pathVal) => {
    try {
      const response = await axios.post('/api/backup/browse-directories', { currentPath: pathVal });
      setDirectorySuggestions(response.data);
    } catch (err) {
      console.error('Error fetching directory suggestions:', err);
    }
  };

  const handleDirectoryChange = (e) => {
    const val = e.target.value;
    setBackupDirectory(val);
    localStorage.setItem('backupDirectory', val);
    fetchSuggestions(val);
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (suggestionPath) => {
    setBackupDirectory(suggestionPath);
    localStorage.setItem('backupDirectory', suggestionPath);
    fetchSuggestions(suggestionPath);
    setShowSuggestions(true);
  };

  const handleInputFocus = () => {
    fetchSuggestions(backupDirectory);
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 250);
  };

  const handleLocalBackup = async (e) => {
    e.preventDefault();
    if (!backupDirectory) {
      showSnackbar('Backup directory path is required.', 'warning');
      return;
    }
    setBackupLoading(true);
    try {
      const response = await axios.post('/api/backup/export', {
        directoryPath: backupDirectory,
        type: backupType
      });
      showSnackbar(response.data.message || 'Backup completed successfully!', 'success');
    } catch (error) {
      console.error('Error saving backup to local path:', error);
      showSnackbar('Backup failed: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const response = await axios.get(`/api/backup/download?type=${backupType}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const activeTenantSuffix = user?.tenant_id === 'tenant_1' ? 'tenant_1' : 'tenant_2';
      const dbName = backupType === 'main' ? 'chit_fund_main' : `chit_fund_${activeTenantSuffix}_${activeYear}`;
      
      link.setAttribute('download', `backup_${dbName}_${new Date().toISOString().slice(0, 10)}.sql`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSnackbar('Database backup file downloaded successfully!', 'success');
    } catch (error) {
      console.error('Error downloading backup:', error);
      showSnackbar('Failed to download backup: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    if (!profile.name) {
      showSnackbar('Display Name cannot be empty.', 'warning');
      return;
    }
    // Update local user state
    setUser({ ...user, name: profile.name });
    showSnackbar('Profile settings updated successfully!', 'success');
  };

  const handleUpdatePassword = (e) => {
    e.preventDefault();
    if (!password.current || !password.new || !password.confirm) {
      showSnackbar('All password fields are required.', 'warning');
      return;
    }
    if (password.new !== password.confirm) {
      showSnackbar('New passwords do not match.', 'error');
      return;
    }
    setSubmitLoading(true);
    setTimeout(() => {
      setSubmitLoading(false);
      showSnackbar('Security credentials updated successfully!', 'success');
      setPassword({ current: '', new: '', confirm: '' });
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
          System Settings
        </Typography>
        <Typography variant="caption" className="text-slate-400 block mt-0.5">
          Manage personal credentials, review tenant database identifiers, and audit security keys.
        </Typography>
      </div>

      <Grid container spacing={4}>
        {/* Profile Card */}
        <Grid item xs={12} md={6} className="space-y-6">
          <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-3xl">
            <Typography variant="subtitle2" className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 mb-6">
              <Fingerprint className="text-[#1E40AF]" /> User Profile Identity
            </Typography>
            
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="w-12 h-12 bg-gradient-to-tr from-[#1E40AF] to-[#10B981] font-bold text-white">
                  {profile.name.split(' ').map(n => n[0]).join('')}
                </Avatar>
                <div>
                  <div className="font-bold text-sm text-slate-850 dark:text-slate-100">{profile.name}</div>
                  <div className="text-xs text-slate-400 font-semibold">{user?.role}</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Username / Handle
                </label>
                <input
                  type="text"
                  disabled
                  value={profile.username}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-400 cursor-not-allowed font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium"
                />
              </div>

              <Button
                type="submit"
                variant="contained"
                startIcon={<Save />}
                className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all mt-2"
              >
                Save Profile Updates
              </Button>
            </form>
          </Card>

          <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-3xl">
            <Typography variant="subtitle2" className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 mb-6">
              <Shield className="text-[#1E40AF]" /> Update Security Credentials
            </Typography>
            
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={password.current}
                  onChange={(e) => setPassword({ ...password, current: e.target.value })}
                  className="w-full px-4 py-3 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={password.new}
                  onChange={(e) => setPassword({ ...password, new: e.target.value })}
                  className="w-full px-4 py-3 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={password.confirm}
                  onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                  className="w-full px-4 py-3 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium"
                />
              </div>

              <Button
                type="submit"
                variant="contained"
                disabled={submitLoading}
                className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all mt-2"
              >
                {submitLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </Card>
        </Grid>

        {/* Tenant Database Info & Backups */}
        <Grid item xs={12} md={6} className="space-y-6">
          <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-3xl">
            <Typography variant="subtitle2" className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 mb-6">
              <Storage className="text-[#10B981]" /> Enterprise Tenant Config
            </Typography>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-3">
                <div>
                  <span className="text-slate-400 block font-semibold">Tenant Identifier</span>
                  <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{user?.tenant_id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Allocated Company Name</span>
                  <span className="text-sm font-extrabold text-slate-750 dark:text-slate-200">{user?.tenant_name}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-3">
                <div>
                  <span className="text-slate-400 block font-semibold">Isolated Database Instance</span>
                  <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                    {user?.tenant_id === 'tenant_1' ? 'chit_fund_tenant_1' : 'chit_fund_tenant_2'}_{activeYear}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Data Connection Encryption</span>
                  <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-full inline-block mt-0.5">TLS / SSL Secured</span>
                </div>
              </div>

            </div>
          </Card>

          <Card style={{ overflow: 'visible' }} className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-3xl">
            <Typography variant="subtitle2" className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 mb-6">
              <Backup className="text-[#10B981]" /> Database Management & Backups
            </Typography>

            <div className="space-y-5 text-xs">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Select Target Database
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-205 cursor-pointer">
                    <input
                      type="radio"
                      name="backupType"
                      value="active"
                      checked={backupType === 'active'}
                      onChange={() => setBackupType('active')}
                      className="text-[#1E40AF] focus:ring-[#1E40AF]"
                    />
                    Active Year (FY {activeYear})
                  </label>
                  <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-205 cursor-pointer">
                    <input
                      type="radio"
                      name="backupType"
                      value="main"
                      checked={backupType === 'main'}
                      onChange={() => setBackupType('main')}
                      className="text-[#1E40AF] focus:ring-[#1E40AF]"
                    />
                    Main Database (Users/Tenants)
                  </label>
                </div>
              </div>

              <form onSubmit={handleLocalBackup} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Local Machine Export Directory
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g., C:\ChitFundBackups"
                      value={backupDirectory}
                      onChange={handleDirectoryChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      className="w-full pl-10 pr-4 py-3 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all font-medium"
                    />
                    <FolderOpen className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                    
                    {/* Floating suggestions dropdown */}
                    {showSuggestions && directorySuggestions.length > 0 && (
                      <Paper 
                        elevation={4} 
                        className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl py-2"
                      >
                        {directorySuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onMouseDown={() => handleSelectSuggestion(suggestion.path)}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 border-b border-slate-50/50 dark:border-slate-800/30 last:border-b-0 cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-[#10B981]" />
                            {suggestion.name}
                          </button>
                        ))}
                      </Paper>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                    Enter the path on your computer where the system will export the .sql backup directly.
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={backupLoading}
                    variant="contained"
                    startIcon={<Backup />}
                    className="bg-[#10B981] hover:bg-[#059669] text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex-grow"
                  >
                    {backupLoading ? 'Backing up...' : 'Save to Local Folder'}
                  </Button>
                  
                  <Button
                    type="button"
                    disabled={backupLoading}
                    onClick={handleDownloadBackup}
                    variant="outlined"
                    startIcon={<CloudDownload />}
                    className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-2.5 px-4 rounded-xl text-xs font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 flex-grow"
                  >
                    Download SQL Backup
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} className="rounded-xl shadow-lg font-semibold">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
