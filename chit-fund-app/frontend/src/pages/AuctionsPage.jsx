import React, { useState, useEffect } from 'react';
import { Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, Button, TextField, Select, MenuItem, InputLabel, FormControl, CircularProgress, Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Gavel, Add, CalendarMonth, CurrencyExchange } from '@mui/icons-material';
import axios from 'axios';
import CustomGrid from '../components/CustomGrid';

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form states
  const [form, setForm] = useState({ chitGroupId: '', installmentNo: '', winningBidderId: '', bidAmount: '' });
  const [calculations, setCalculations] = useState({ payout: 0, dividend: 0 });
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = async () => {
    try {
      const [auctionsRes, groupsRes, customersRes] = await Promise.all([
        axios.get('/api/auctions'),
        axios.get('/api/chits'),
        axios.get('/api/customers')
      ]);
      setAuctions(auctionsRes.data);
      setGroups(groupsRes.data);
      setCustomers(customersRes.data);
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to load auctions database.', 'error');
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

  const updateCalculationsAndBid = (groupId, installmentNo, bidAmountVal) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      setForm(prev => ({
        ...prev,
        chitGroupId: groupId,
        installmentNo: installmentNo,
        bidAmount: bidAmountVal
      }));
      setCalculations({ payout: 0, dividend: 0 });
      return;
    }

    let finalBidAmount = bidAmountVal;
    let schedule = [];
    if (group.installment_schedule) {
      try {
        schedule = typeof group.installment_schedule === 'string'
          ? JSON.parse(group.installment_schedule)
          : group.installment_schedule;
      } catch (e) {
        console.error('Failed to parse installment schedule:', e);
      }
    }

    const instNum = parseInt(installmentNo);
    const matchedRow = Array.isArray(schedule) ? schedule.find(row => row.month === instNum) : null;

    if (matchedRow && bidAmountVal === '') {
      const scheduledPayout = parseFloat(matchedRow.bidAmount) || 0;
      const calculatedDiscount = Math.max(0, parseFloat(group.value) - scheduledPayout);
      finalBidAmount = calculatedDiscount.toString();
    }

    const bid = finalBidAmount !== '' ? parseFloat(finalBidAmount) || 0 : 0;
    const payout = parseFloat(group.value) - bid;

    let dividend = 0;
    if (matchedRow) {
      dividend = parseFloat(matchedRow.repaymentAmount) || 0;
    } else {
      const members = group.active_members || group.installments;
      dividend = bid / (members || 1);
    }

    setForm(prev => ({
      ...prev,
      chitGroupId: groupId,
      installmentNo: installmentNo,
      bidAmount: finalBidAmount
    }));

    setCalculations({
      payout: Math.max(0, payout),
      dividend: Math.max(0, dividend)
    });
  };

  const handleGroupChange = async (groupId) => {
    updateCalculationsAndBid(groupId, form.installmentNo, '');
    
    if (!groupId) {
      setFilteredCustomers([]);
      setForm(prev => ({ ...prev, winningBidderId: '' }));
      return;
    }

    try {
      const res = await axios.get(`/api/chits/${groupId}`);
      setFilteredCustomers(res.data.members || []);
      setForm(prev => ({ ...prev, winningBidderId: '' })); // reset winning bidder selection when group changes
    } catch (err) {
      console.error('Failed to load group members:', err);
      showSnackbar('Failed to load group members.', 'error');
    }
  };

  const handleInstallmentChange = (instNo) => {
    updateCalculationsAndBid(form.chitGroupId, instNo, '');
  };

  const handleBidChange = (bidVal) => {
    updateCalculationsAndBid(form.chitGroupId, form.installmentNo, bidVal);
  };

  const handleRecordAuction = async (e) => {
    e.preventDefault();
    if (!form.chitGroupId || !form.installmentNo || !form.winningBidderId || !form.bidAmount) {
      showSnackbar('All fields are required.', 'warning');
      return;
    }
    setSubmitLoading(true);
    try {
      await axios.post('/api/auctions', form);
      showSnackbar('Auction recorded and payout dispatched successfully!', 'success');
      setOpenModal(false);
      setForm({ chitGroupId: '', installmentNo: '', winningBidderId: '', bidAmount: '' });
      setCalculations({ payout: 0, dividend: 0 });
      setFilteredCustomers([]);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to record auction.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  const columns = [
    { id: 'installment_no', label: 'Installment', render: (row) => <span className="font-bold text-xs text-slate-600 dark:text-slate-400">Installment #{row.installment_no}</span> },
    { id: 'chit_group_id', label: 'Chit Group', render: (row) => <span className="font-bold text-slate-800 dark:text-white text-sm">{row.chit_group_id}</span> },
    { id: 'winning_bidder_name', label: 'Winning Bidder', render: (row) => <span className="font-bold text-xs text-[#1E40AF]">{row.winning_bidder_name}</span> },
    { id: 'bid_amount', label: 'Winning Bid discount', render: (row) => <span className="font-extrabold text-red-500 text-sm">{formatCurrency(row.bid_amount)}</span> },
    { id: 'dividend_amount', label: 'Dividend Per Member', render: (row) => <span className="font-extrabold text-[#10B981] text-sm">{formatCurrency(row.dividend_amount)}</span> },
    { id: 'auction_date', label: 'Auction Date', render: (row) => (
      <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
        <CalendarMonth fontSize="inherit" />
        {row.auction_date}
      </div>
    ) },
    { id: 'status', label: 'Status', render: (row) => (
      <span className="bg-emerald-500/10 text-emerald-500 font-bold px-2 py-1 rounded-full text-xs">{row.status}</span>
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
          startIcon={<Gavel />}
          onClick={() => setOpenModal(true)}
          className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
        >
          Record Bidding Auction
        </Button>
      </div>

      <div className="space-y-4">
        <CustomGrid
          columns={columns}
          data={auctions}
          keyField="id"
          showCheckboxes={true}
          initialRowsPerPage={13}
          emptyMessage="No auctions recorded yet."
        />
      </div>

      {/* Record Modal */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} PaperProps={{ className: 'rounded-3xl p-4 w-full max-w-md' }}>
        <form onSubmit={handleRecordAuction}>
          <DialogTitle className="font-extrabold text-slate-850 dark:text-white">Record Auction Bid</DialogTitle>
          <DialogContent className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chit Group</label>
              <select
                value={form.chitGroupId}
                onChange={(e) => handleGroupChange(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              >
                <option value="" className="text-slate-400 dark:text-slate-500">Select Chit Group</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id} className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">
                    {g.id} - {g.name} ({formatCurrency(g.value)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Installment Number</label>
              <input
                type="number"
                required
                placeholder="Enter installment number"
                value={form.installmentNo}
                onChange={(e) => handleInstallmentChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Winning Bidder</label>
              <select
                value={form.winningBidderId}
                onChange={(e) => setForm({ ...form, winningBidderId: e.target.value })}
                required
                disabled={!form.chitGroupId}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm disabled:opacity-50"
              >
                <option value="" className="text-slate-400 dark:text-slate-500">
                  {!form.chitGroupId ? 'Please select a Chit Group first' : 'Select Winner'}
                </option>
                {filteredCustomers.map(c => (
                  <option key={c.id} value={c.id} className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">
                    {c.name} ({c.mobile})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Winning Bid Discount (INR)</label>
              <input
                type="number"
                required
                placeholder="Enter bid discount amount"
                value={form.bidAmount}
                onChange={(e) => handleBidChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Dividend per member:</span>
                <span className="font-bold text-[#10B981]">{formatCurrency(calculations.dividend)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Winner Payout Amount (Chit value - Bid):</span>
                <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(calculations.payout)}</span>
              </div>
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
              {submitLoading ? 'Recording...' : 'Record Bid'}
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
