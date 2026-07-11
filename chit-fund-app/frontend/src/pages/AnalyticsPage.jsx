import React, { useState, useEffect } from 'react';
import { Card, Grid, Typography, CircularProgress, Alert, Snackbar, Paper } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import axios from 'axios';
import { TrendingUp, Groups, HourglassEmpty } from '@mui/icons-material';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [collectionsData, setCollectionsData] = useState([]);
  const [methodData, setMethodData] = useState([]);
  const [duesData, setDuesData] = useState([]);
  const [stats, setStats] = useState({ totalCollections: 0, totalDues: 0, activeMembers: 0 });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const COLORS = ['#1E40AF', '#10B981', '#F59E0B', '#EF4444'];

  const fetchAnalyticsData = async () => {
    try {
      const [collectionsRes, customersRes, groupsRes] = await Promise.all([
        axios.get('/api/collections'),
        axios.get('/api/customers'),
        axios.get('/api/chits')
      ]);

      const collections = collectionsRes.data;
      const customers = customersRes.data;
      const groups = groupsRes.data;

      // 1. Process stats
      const totalCollections = collections.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
      const totalDues = customers.reduce((acc, curr) => acc + parseFloat(curr.pending_amount), 0);
      const activeMembers = groups.reduce((acc, curr) => acc + curr.active_members, 0);
      setStats({ totalCollections, totalDues, activeMembers });

      // 2. Process Monthly Collections Growth (Dynamic)
      // Group collections by month
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyTotals = {};
      collections.forEach(col => {
        const date = new Date(col.payment_date);
        const monthName = months[date.getMonth()];
        monthlyTotals[monthName] = (monthlyTotals[monthName] || 0) + parseFloat(col.amount);
      });

      const processedCollections = months.map(m => ({
        month: m,
        collections: monthlyTotals[m] || 0
      })).filter(item => item.collections > 0 || ['Jun', 'May', 'Apr'].includes(item.month)); // ensure we show at least active periods
      
      setCollectionsData(processedCollections);

      // 3. Process Payment Methods Share
      const methods = {};
      collections.forEach(col => {
        methods[col.payment_method] = (methods[col.payment_method] || 0) + parseFloat(col.amount);
      });
      const processedMethods = Object.keys(methods).map(name => ({
        name,
        value: methods[name]
      }));
      setMethodData(processedMethods);

      // 4. Process Customer Outstanding Dues Comparison
      let totalPaid = 0;
      let totalPending = 0;
      customers.forEach(c => {
        totalPaid += parseFloat(c.paid_amount);
        totalPending += parseFloat(c.pending_amount);
      });
      setDuesData([
        { name: 'Paid Capital', amount: totalPaid },
        { name: 'Outstanding Dues', amount: totalPending }
      ]);

    } catch (err) {
      console.error(err);
      showSnackbar('Error compiling real-time analytics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
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
      <div>
        <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
          Real-Time Analytics
        </Typography>
        <Typography variant="caption" className="text-slate-400 block mt-0.5">
          Review business health, outstanding asset values, and payment transaction splits.
        </Typography>
      </div>

      {/* KPI Cards Row */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] relative overflow-hidden border border-slate-100 dark:border-slate-800 hover-scale shadow-sm">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-8 -mt-8"></div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 rounded-2xl text-[#10B981]">
                <TrendingUp fontSize="medium" />
              </div>
              <div>
                <Typography variant="caption" className="text-slate-400 font-semibold uppercase tracking-wider block">
                  Aggregate Collections
                </Typography>
                <Typography variant="h5" className="font-extrabold text-emerald-600 dark:text-[#10B981] mt-1">
                  {formatCurrency(stats.totalCollections)}
                </Typography>
              </div>
            </div>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] relative overflow-hidden border border-slate-100 dark:border-slate-800 hover-scale shadow-sm">
            <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/10 rounded-full -mr-8 -mt-8"></div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-2xl text-red-500">
                <HourglassEmpty fontSize="medium" />
              </div>
              <div>
                <Typography variant="caption" className="text-slate-400 font-semibold uppercase tracking-wider block">
                  Total Pending Receivables
                </Typography>
                <Typography variant="h5" className="font-extrabold text-red-500 mt-1">
                  {formatCurrency(stats.totalDues)}
                </Typography>
              </div>
            </div>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] relative overflow-hidden border border-slate-100 dark:border-slate-800 hover-scale shadow-sm">
            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-8 -mt-8"></div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-2xl text-[#1E40AF]">
                <Groups fontSize="medium" />
              </div>
              <div>
                <Typography variant="caption" className="text-slate-400 font-semibold uppercase tracking-wider block">
                  Total Enrolled Members
                </Typography>
                <Typography variant="h5" className="font-extrabold text-[#1E40AF] dark:text-[#3B82F6] mt-1">
                  {stats.activeMembers} Users
                </Typography>
              </div>
            </div>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Grid */}
      <Grid container spacing={4}>
        {/* Collections Growth */}
        <Grid item xs={12} md={7}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-3xl h-[400px] flex flex-col justify-between">
            <Typography variant="subtitle2" className="font-extrabold text-slate-800 dark:text-white mb-4">
              Monthly Collections Trend
            </Typography>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collectionsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="collections" fill="#1E40AF" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Grid>

        {/* Payment Methods */}
        <Grid item xs={12} md={5}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-3xl h-[400px] flex flex-col justify-between">
            <Typography variant="subtitle2" className="font-extrabold text-slate-800 dark:text-white mb-4">
              Payment Methods Share
            </Typography>
            <div className="flex-1 flex justify-center items-center">
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={methodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {methodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Grid>

        {/* Dues comparison */}
        <Grid item xs={12}>
          <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-3xl h-[320px] flex flex-col justify-between">
            <Typography variant="subtitle2" className="font-extrabold text-slate-800 dark:text-white mb-4">
              Capital Distribution (Collected vs Outstanding Dues)
            </Typography>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={duesData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v/1000}k`} />
                  <YAxis dataKey="name" type="category" tickLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="amount" fill="#10B981" radius={[0, 8, 8, 0]}>
                    {duesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
