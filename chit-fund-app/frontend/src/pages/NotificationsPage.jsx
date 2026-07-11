import React, { useState, useEffect, useContext } from 'react';
import { Card, Typography, List, ListItem, IconButton, Button, Chip, CircularProgress, Alert, Snackbar, Paper, TextField, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Notifications, Delete, CheckCircle, Warning, Info, Send, Campaign } from '@mui/icons-material';
import axios from 'axios';
import { AuthContext } from '../App';

export default function NotificationsPage() {
  const { notifications, fetchNotifications } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Form states
  const [form, setForm] = useState({ title: '', message: '', type: 'info' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchNotifications();
      } catch (err) {
        console.error(err);
        showSnackbar('Failed to load notifications inbox.', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleMarkAsRead = async (id) => {
    try {
      await axios.put(`/api/notifications/${id}/read`);
      showSnackbar('Notification marked as read.', 'success');
      fetchNotifications();
    } catch (err) {
      showSnackbar('Failed to update status.', 'error');
    }
  };

  const handleClearNotification = async (id) => {
    try {
      await axios.delete(`/api/notifications/${id}`);
      showSnackbar('Alert dismissed successfully.', 'success');
      fetchNotifications();
    } catch (err) {
      showSnackbar('Failed to delete notification.', 'error');
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!form.title || !form.message) {
      showSnackbar('Please enter title and message.', 'warning');
      return;
    }
    setSubmitLoading(true);
    try {
      await axios.post('/api/notifications', form);
      showSnackbar('Broadcast sent successfully!', 'success');
      setOpenModal(false);
      setForm({ title: '', message: '', type: 'info' });
      fetchNotifications();
    } catch (err) {
      showSnackbar('Failed to send broadcast.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="text-[#10B981]" />;
      case 'warning':
        return <Warning className="text-amber-500" />;
      case 'alert':
      case 'danger':
        return <Warning className="text-red-500" />;
      default:
        return <Info className="text-[#1E40AF] dark:text-[#3B82F6]" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <CircularProgress size={60} className="text-[#1E40AF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
            System Alerts Inbox
          </Typography>
          <Typography variant="caption" className="text-slate-400 block mt-0.5">
            Audit system actions, push broadcast notices to office users, and clear old items.
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<Campaign />}
          onClick={() => setOpenModal(true)}
          className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold py-2.5 px-4 rounded-xl text-xs"
        >
          Broadcast Alert
        </Button>
      </div>

      <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-3xl">
        {notifications.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <Notifications fontSize="large" className="mx-auto block text-slate-300" />
            <div className="font-semibold">All cleared! No new notifications.</div>
          </div>
        ) : (
          <List className="space-y-3 p-0">
            {notifications.map((n) => (
              <Paper 
                key={n.id} 
                elevation={0}
                className={`p-4 border rounded-2xl flex justify-between items-start transition-all ${
                  n.is_read 
                    ? 'bg-transparent border-slate-100 dark:border-slate-800/40 opacity-75' 
                    : 'bg-[#1E40AF]/5 border-[#1E40AF]/20 dark:bg-[#1E40AF]/10'
                }`}
              >
                <div className="flex gap-4 items-start">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-850 dark:text-slate-200">{n.title}</span>
                      {!n.is_read && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#1E40AF] text-white rounded-full">New</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-450 dark:text-slate-400 mt-1 max-w-xl">{n.message}</p>
                    <span className="text-[10px] text-slate-400 block mt-2 font-medium">
                      {new Date(n.created_date).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {!n.is_read && (
                    <Button 
                      size="small" 
                      onClick={() => handleMarkAsRead(n.id)}
                      className="text-[#1E40AF] dark:text-[#3B82F6] font-bold text-xs"
                    >
                      Mark Read
                    </Button>
                  )}
                  <IconButton 
                    size="small" 
                    onClick={() => handleClearNotification(n.id)}
                    className="text-slate-400 hover:text-red-500 rounded-full"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </div>
              </Paper>
            ))}
          </List>
        )}
      </Card>

      {/* Broadcast Modal */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} PaperProps={{ className: 'rounded-3xl p-4 w-full max-w-md' }}>
        <form onSubmit={handleBroadcast}>
          <DialogTitle className="font-extrabold text-slate-850 dark:text-white">Broadcast Alert</DialogTitle>
          <DialogContent className="space-y-4 pt-2">
            <TextField
              label="Alert Title"
              variant="outlined"
              fullWidth
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              InputProps={{ className: 'rounded-xl' }}
              required
            />

            <TextField
              label="Message Body"
              variant="outlined"
              multiline
              rows={3}
              fullWidth
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              InputProps={{ className: 'rounded-xl' }}
              required
            />

            <FormControl fullWidth required variant="outlined">
              <InputLabel id="type-select-label">Alert Severity</InputLabel>
              <Select
                labelId="type-select-label"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                label="Alert Severity"
                className="rounded-xl"
              >
                <MenuItem value="info">Info (Blue)</MenuItem>
                <MenuItem value="success">Success (Green)</MenuItem>
                <MenuItem value="warning">Warning (Amber)</MenuItem>
                <MenuItem value="danger">Danger (Red)</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={() => setOpenModal(false)} className="text-slate-500 font-bold">Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitLoading}
              endIcon={<Send />}
              className="bg-[#1E40AF] text-white font-bold px-5 rounded-xl"
            >
              {submitLoading ? 'Sending...' : 'Broadcast'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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
