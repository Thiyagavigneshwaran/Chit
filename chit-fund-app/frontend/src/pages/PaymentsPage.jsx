import React, { useState, useEffect } from 'react';
import { Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, Button, TextField, Select, MenuItem, InputLabel, FormControl, CircularProgress, Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Payment, Add, CalendarMonth, LocalAtm } from '@mui/icons-material';
import axios from 'axios';
import CustomGrid from '../components/CustomGrid';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Form states
  const [form, setForm] = useState({ customerId: '', chitGroupId: '', amount: '', paymentMethod: 'Bank Transfer', transactionRef: '', type: 'Chit Payout' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = async () => {
    try {
      const [paymentsRes, groupsRes, customersRes] = await Promise.all([
        axios.get('/api/payments'),
        axios.get('/api/chits'),
        axios.get('/api/customers')
      ]);
      setPayments(paymentsRes.data);
      setGroups(groupsRes.data);
      setCustomers(customersRes.data);
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to load disbursements.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleRecordPayout = async (e) => {
    e.preventDefault();
    if (!form.customerId || !form.chitGroupId || !form.amount || !form.paymentMethod || !form.transactionRef) {
      showSnackbar('Please fill in all fields.', 'warning');
      return;
    }
    setSubmitLoading(true);
    try {
      await axios.post('/api/payments', form);
      showSnackbar('Payout logged successfully!', 'success');
      setOpenModal(false);
      setForm({ customerId: '', chitGroupId: '', amount: '', paymentMethod: 'Bank Transfer', transactionRef: '', type: 'Chit Payout' });
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to log payout.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const columns = [
    { id: 'transaction_ref', label: 'Transaction Ref', render: (row) => <span className="font-bold text-xs text-slate-600 dark:text-slate-400">{row.transaction_ref}</span> },
    { id: 'customer_name', label: 'Customer Name', render: (row) => <span className="font-bold text-slate-850 dark:text-white text-sm">{row.customer_name}</span> },
    { id: 'chit_group_id', label: 'Chit Group', render: (row) => <span className="font-bold text-xs text-[#1E40AF]">{row.chit_group_id}</span> },
    { id: 'amount', label: 'Disbursed Amount', render: (row) => <span className="font-extrabold text-[#1E40AF] text-sm">{formatCurrency(row.amount)}</span> },
    { id: 'payment_method', label: 'Method', render: (row) => <span className="text-xs font-semibold text-slate-650 dark:text-slate-400">{row.payment_method}</span> },
    { id: 'payment_date', label: 'Date', render: (row) => (
      <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
        <CalendarMonth fontSize="inherit" />
        {row.payment_date}
      </div>
    ) },
    { id: 'type', label: 'Payout Type', render: (row) => (
      <span className={`font-bold px-2.5 py-1 rounded-full text-xs ${row.type === 'Chit Payout' ? 'bg-[#1E40AF]/10 text-[#1E40AF]' : 'bg-amber-500/10 text-amber-500'}`}>
        {row.type}
      </span>
    ) }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <CircularProgress size={60} className="text-[#1E40AF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-2">
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenModal(true)}
          className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
        >
          Disburse Payout
        </Button>
      </div>

      <div className="space-y-4">
        <CustomGrid
          columns={columns}
          data={payments}
          keyField="id"
          showCheckboxes={true}
          initialRowsPerPage={13}
          emptyMessage="No disbursements logged yet."
        />
      </div>

      {/* Disburse Modal */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} PaperProps={{ className: 'rounded-3xl p-4 w-full max-w-md' }}>
        <form onSubmit={handleRecordPayout}>
          <DialogTitle className="font-extrabold text-slate-850 dark:text-white">Record Payout</DialogTitle>
          <DialogContent className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Beneficiary Customer</label>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                required
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              >
                <option value="" className="text-slate-400 dark:text-slate-500">Select Beneficiary</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id} className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">{c.name} ({c.mobile})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chit Group</label>
              <select
                value={form.chitGroupId}
                onChange={(e) => setForm({ ...form, chitGroupId: e.target.value })}
                required
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              >
                <option value="" className="text-slate-400 dark:text-slate-500">Select Chit Group</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id} className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">{g.id} - {g.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payout Amount (INR)</label>
              <input
                type="number"
                required
                placeholder="Enter payout amount"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Disbursement Method</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                required
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              >
                <option value="Bank Transfer" className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">Bank Transfer</option>
                <option value="Cheque" className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">Cheque</option>
                <option value="Cash" className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">Cash</option>
                <option value="UPI" className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">UPI</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Transaction Reference / Cheque No</label>
              <input
                type="text"
                required
                placeholder="Enter reference number"
                value={form.transactionRef}
                onChange={(e) => setForm({ ...form, transactionRef: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payout Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              >
                <option value="Chit Payout" className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">Chit Payout (Prize Amount)</option>
                <option value="Dividend Distribution" className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">Dividend Distribution</option>
              </select>
            </div>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={() => setOpenModal(false)} className="text-slate-500 font-bold">Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitLoading}
              className="bg-[#1E40AF] text-white font-bold px-5 rounded-xl"
            >
              {submitLoading ? 'Disbursing...' : 'Log Payout'}
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
