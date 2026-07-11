import React, { useState, useEffect, useContext } from 'react';
import { Card, Grid, Typography, Button, TextField, Select, MenuItem, InputLabel, FormControl, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Snackbar, Alert, CircularProgress } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  TrendingUp, PeopleAlt, Payment, HourglassEmpty, 
  ChevronRight, LocalPhone, Email, ReceiptLong 
} from '@mui/icons-material';
import axios from 'axios';
import { AuthContext } from '../App';
import CustomGrid from '../components/CustomGrid';

const getCurrentContribution = (group, dateStr = new Date().toISOString().split('T')[0]) => {
  if (!group) return 0;
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
  if (Array.isArray(schedule) && schedule.length > 0) {
    const [selYear, selMonth] = dateStr.split('-');
    const matchedItem = schedule.find(item => {
      const dateVal = (item && typeof item === 'object') ? item.dueDate : null;
      if (dateVal) {
        const [y, m] = dateVal.split('-');
        return y === selYear && m === selMonth;
      }
      return false;
    });
    if (matchedItem) {
      return (matchedItem.amount !== undefined) ? parseFloat(matchedItem.amount) : parseFloat(matchedItem);
    }
  }
  return parseFloat(group.monthly_contribution) || 0;
};

export default function DashboardPage() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [chitGroups, setChitGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchDashboardData = async () => {
    try {
      const [statsRes, customersRes, chitsRes] = await Promise.all([
        axios.get('/api/dashboard/stats'),
        axios.get('/api/customers'),
        axios.get('/api/chits')
      ]);
      setStats(statsRes.data);
      setCustomers(customersRes.data);
      setChitGroups(chitsRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      showSnackbar('Error loading dashboard statistics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedGroupId || !installmentAmount || !paymentMethod) {
      showSnackbar('Please complete all form fields.', 'warning');
      return;
    }

    // Role-Based Access Control Verification
    if (user.role === 'Accountant') {
      showSnackbar('Access Denied: Accountants are not authorized to post payments.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/api/collections', {
        customerId: selectedCustomerId,
        chitGroupId: selectedGroupId,
        amount: installmentAmount,
        paymentMethod
      });
      showSnackbar('Payment Collection recorded successfully!', 'success');
      
      // Reset form
      setSelectedCustomerId('');
      setSelectedGroupId('');
      setInstallmentAmount('');
      
      // Reload stats and charts
      fetchDashboardData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Error processing collection entry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <CircularProgress size={60} className="text-[#1E40AF]" />
      </div>
    );
  }

  // Format currency in Indian Numbering System
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const columns = [
    { id: 'id', label: 'Group Code', render: (row) => <span className="font-semibold text-xs text-[#1E40AF]">{row.id}</span> },
    { id: 'name', label: 'Plan Name', render: (row) => <span className="font-bold text-slate-800 dark:text-white text-sm">{row.name}</span> },
    { id: 'value', label: 'Group Value', render: (row) => <span className="font-bold text-slate-800 dark:text-white text-sm">{formatCurrency(row.value)}</span> },
    { id: 'active_members', label: 'Members', render: (row) => <span className="text-sm font-semibold text-slate-500">{row.active_members} Members</span> },
    { id: 'contribution', label: 'Per Member', render: (row) => <span className="font-bold text-[#10B981] text-sm">{formatCurrency(getCurrentContribution(row))}/member</span> }
  ];

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-[#1E40AF] to-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="z-10">
          <Typography variant="h4" className="font-extrabold mb-1">
            Welcome back, {user.name}!
          </Typography>
          <Typography variant="body2" className="text-slate-300">
            Here's the financial summary for <span className="font-bold text-[#10B981]">{user.tenant_name}</span>. Access Role: {user.role}.
          </Typography>
        </div>
        <div className="z-10 bg-white/10 px-4 py-2 rounded-2xl border border-white/20 backdrop-blur-md">
          <Typography variant="caption" className="text-slate-300 uppercase tracking-widest block font-bold">
            Database Scope
          </Typography>
          <Typography variant="body2" className="font-extrabold text-[#10B981]">
            Active MySQL Instance
          </Typography>
        </div>
      </div>

      {/* 4 Dashboard Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] relative overflow-hidden border border-slate-100 dark:border-slate-800 hover-scale">
            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-8 -mt-8"></div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-2xl text-[#1E40AF]">
                <TrendingUp fontSize="medium" />
              </div>
              <div>
                <Typography variant="caption" className="text-slate-500 font-semibold uppercase tracking-wider block">
                  Total Portfolio Value
                </Typography>
                <Typography variant="h5" className="font-bold text-slate-800 dark:text-white mt-1">
                  {formatCurrency(stats.cards.totalChits)}
                </Typography>
              </div>
            </div>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] relative overflow-hidden border border-slate-100 dark:border-slate-800 hover-scale">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-8 -mt-8"></div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 rounded-2xl text-[#10B981]">
                <PeopleAlt fontSize="medium" />
              </div>
              <div>
                <Typography variant="caption" className="text-slate-500 font-semibold uppercase tracking-wider block">
                  Active Members
                </Typography>
                <Typography variant="h5" className="font-bold text-slate-800 dark:text-white mt-1">
                  {stats.cards.activeMembers}
                </Typography>
              </div>
            </div>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] relative overflow-hidden border border-slate-100 dark:border-slate-800 hover-scale">
            <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 rounded-full -mr-8 -mt-8"></div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-950/50 rounded-2xl text-[#6366F1]">
                <Payment fontSize="medium" />
              </div>
              <div>
                <Typography variant="caption" className="text-slate-500 font-semibold uppercase tracking-wider block">
                  Monthly Collection
                </Typography>
                <Typography variant="h5" className="font-bold text-slate-800 dark:text-white mt-1">
                  {formatCurrency(stats.cards.monthlyCollection)}
                </Typography>
              </div>
            </div>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] relative overflow-hidden border border-slate-100 dark:border-slate-800 hover-scale">
            <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-full -mr-8 -mt-8"></div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/50 rounded-2xl text-[#F59E0B]">
                <HourglassEmpty fontSize="medium" />
              </div>
              <div>
                <Typography variant="caption" className="text-slate-500 font-semibold uppercase tracking-wider block">
                  Pending Dues
                </Typography>
                <Typography variant="h5" className="font-bold text-slate-800 dark:text-white mt-1">
                  {formatCurrency(stats.cards.pendingDues)}
                </Typography>
              </div>
            </div>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3}>
        {/* Line Chart */}
        <Grid item xs={12} md={8}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800">
            <Typography variant="h6" className="font-bold mb-4 text-slate-800 dark:text-white">
              Collection Analytics (Line Chart)
            </Typography>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.collectionAnalytics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(val) => `₹${val/1000}k`} />
                  <ChartTooltip 
                    formatter={(val) => [formatCurrency(val), 'Collected']}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#1E40AF" strokeWidth={3} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Grid>

        {/* Pie Chart */}
        <Grid item xs={12} md={4}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <Typography variant="h6" className="font-bold mb-4 text-slate-800 dark:text-white">
                Payment Status Breakdown
              </Typography>
              <div className="h-60 flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.paymentStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.paymentStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip formatter={(val) => [`${val}%`, 'Ratio']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Labels */}
            <div className="flex justify-around mt-4">
              {stats.paymentStatus.map((item) => (
                <div key={item.name} className="text-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }}></span>
                    <span className="text-xs font-semibold text-slate-500">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800 dark:text-white">{item.value}%</span>
                </div>
              ))}
            </div>
          </Card>
        </Grid>
      </Grid>

      {/* Chit Groups & Form */}
      <Grid container spacing={3}>
        {/* Table */}
        <Grid item xs={12} md={7}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800">
            <Typography variant="h6" className="font-bold mb-4 text-slate-800 dark:text-white">
              Chit Groups Portfolio
            </Typography>
            <CustomGrid 
              columns={columns} 
              data={chitGroups} 
              keyField="id" 
              showCheckboxes={true}
              initialRowsPerPage={13}
            />
          </Card>
        </Grid>

        {/* Collection Entry Form */}
        <Grid item xs={12} md={5}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-full">
            <div>
              <Typography variant="h6" className="font-bold mb-1 text-slate-800 dark:text-white">
                Collection Entry Form
              </Typography>
              <Typography variant="caption" className="text-slate-400 block mb-6">
                Post installment payments directly to client records.
              </Typography>

              {user.role === 'Accountant' && (
                <Alert severity="warning" className="mb-4 rounded-xl text-xs font-semibold">
                  Simulated Role is 'Accountant'. Submission is disabled due to RBAC filters.
                </Alert>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Customer Name</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                  >
                    <option value="" className="text-slate-400 dark:text-slate-500">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">
                        {c.name} ({c.mobile})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Group Selection</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedGroupId(val);
                      const group = chitGroups.find(g => g.id === val);
                      if (group) setInstallmentAmount(getCurrentContribution(group));
                    }}
                    required
                    className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                  >
                    <option value="" className="text-slate-400 dark:text-slate-500">Select Chit Group</option>
                    {chitGroups.map((g) => (
                      <option key={g.id} value={g.id} className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">
                        {g.id} - {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Installment Amount (INR)</label>
                  <input
                    type="number"
                    required
                    placeholder="Enter installment amount"
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={submitting || user.role === 'Accountant'}
                  className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white py-3 rounded-2xl font-bold transition-all mt-4 text-sm"
                >
                  {submitting ? 'Recording...' : 'Submit Entry'}
                </Button>
              </form>
            </div>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar notification */}
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
