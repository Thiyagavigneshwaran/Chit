import React, { useState, useEffect, useContext } from 'react';
import { 
  Card, Grid, Typography, Button, IconButton, CircularProgress, 
  Alert, Snackbar, Tooltip, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, 
  DialogContent, DialogActions, FormControlLabel, Checkbox
} from '@mui/material';
import { 
  Search, CalendarMonth, Download, Close, Add, FilterList, 
  Print, AccountCircle, ReceiptLong, Wallet, HelpOutline
} from '@mui/icons-material';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { AuthContext } from '../App';
import CustomGrid from '../components/CustomGrid';

const getInstallmentAmountForMonth = (group, monthNo) => {
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
    const matchedMonth = schedule.find(item => item && item.month === monthNo);
    if (matchedMonth) {
      return parseFloat(matchedMonth.amount !== undefined ? matchedMonth.amount : (matchedMonth.payingAmount || matchedMonth.actualAmount || group.monthly_contribution));
    }
  }
  return parseFloat(group.monthly_contribution) || 0;
};

export default function ChitEntryPage() {
  const { user } = useContext(AuthContext);
  
  // Data lists
  const [customers, setCustomers] = useState([]);
  const [chitGroups, setChitGroups] = useState([]);
  const [collections, setCollections] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');

  // Dialog State
  const [openAddModal, setOpenAddModal] = useState(false);
  
  // Form states (inside modal)
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerDetail, setCustomerDetail] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Payment Breakdown Inputs
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [chequeAmount, setChequeAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [refNo, setRefNo] = useState('');
  const [printOn, setPrintOn] = useState(false);
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = async () => {
    try {
      const [customersRes, chitsRes, collectionsRes] = await Promise.all([
        axios.get('/api/customers'),
        axios.get('/api/chits'),
        axios.get('/api/collections')
      ]);
      setCustomers(customersRes.data);
      setChitGroups(chitsRes.data);
      setCollections(collectionsRes.data || []);
    } catch (err) {
      console.error('Error fetching data for Chit Entry page:', err);
      showSnackbar('Error loading page data.', 'error');
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

  // Group change loads members of that group
  const handleGroupChangeInModal = async (groupId) => {
    setSelectedGroupId(groupId);
    setSelectedCustomerId('');
    setCustomerDetail(null);
    setGroupMembers([]);
    resetPaymentBreakdown();
    
    if (!groupId) return;

    setGroupMembersLoading(true);
    try {
      const response = await axios.get(`/api/chits/${groupId}`);
      setGroupMembers(response.data.members || []);
    } catch (err) {
      console.error('Failed to load group members:', err);
      showSnackbar('Error loading group members.', 'error');
    } finally {
      setGroupMembersLoading(false);
    }
  };

  // Customer change inside Profile Info loads customer detail details
  const handleCustomerChangeInModal = async (customerId) => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      setCustomerDetail(null);
      resetPaymentBreakdown();
      return;
    }
    setCustomerDetailLoading(true);
    try {
      const response = await axios.get(`/api/customers/${customerId}`);
      const data = response.data;
      setCustomerDetail(data);

      // Calculate next installment amount and auto fill the online input
      const groupPayments = (data.payments || []).filter(p => p.chit_group_id === selectedGroupId);
      const paidCount = groupPayments.length;
      const nextNo = paidCount + 1;
      
      const group = chitGroups.find(g => g.id === selectedGroupId);
      if (group) {
        const nextAmount = getInstallmentAmountForMonth(group, nextNo);
        setOnlineAmount(nextAmount.toString());
      }
    } catch (err) {
      console.error('Failed to load customer details:', err);
      showSnackbar('Error loading customer profile.', 'error');
    } finally {
      setCustomerDetailLoading(false);
    }
  };

  const resetPaymentBreakdown = () => {
    setCashAmount('');
    setCardAmount('');
    setChequeAmount('');
    setOnlineAmount('');
    setRefNo('');
  };

  // Profile data extraction helpers
  const customerProfile = customerDetail ? customerDetail.profile : null;
  const customerPaymentsList = customerDetail ? customerDetail.payments : [];

  // Installment count metrics
  const groupPayments = customerPaymentsList.filter(p => p.chit_group_id === selectedGroupId);
  const paidCount = groupPayments.length;
  
  const selectedGroup = chitGroups.find(g => g.id === selectedGroupId);
  const totalInstallments = selectedGroup ? selectedGroup.installments : 0;
  const pendingCount = Math.max(0, totalInstallments - paidCount);
  const nextInstallmentNo = paidCount + 1;
  const nextInstallmentAmount = selectedGroup ? getInstallmentAmountForMonth(selectedGroup, nextInstallmentNo) : 0;

  // Calculate dynamic totals for calculator
  const netAmount = 
    parseFloat(cashAmount || 0) + 
    parseFloat(cardAmount || 0) + 
    parseFloat(chequeAmount || 0) + 
    parseFloat(onlineAmount || 0);

  const targetMonthlyContribution = selectedGroup ? parseFloat(selectedGroup.monthly_contribution) : 0;
  // If customer is selected, remaining balance calculates against the next exact scheduled due. Otherwise, defaults to monthly standard.
  const targetDueAmount = selectedCustomerId ? nextInstallmentAmount : targetMonthlyContribution;
  const remainingBalance = targetDueAmount - netAmount;

  // Render billing list dynamically
  const billingItems = [];
  if (parseFloat(cashAmount) > 0) {
    billingItems.push({ method: 'Cash', account: 'Cash Vault', amount: parseFloat(cashAmount), reference: '-' });
  }
  if (parseFloat(cardAmount) > 0) {
    billingItems.push({ method: 'Card', account: 'Merchant A/C', amount: parseFloat(cardAmount), reference: refNo || '-' });
  }
  if (parseFloat(chequeAmount) > 0) {
    billingItems.push({ method: 'Cheque', account: 'Clearing Vault', amount: parseFloat(chequeAmount), reference: refNo || '-' });
  }
  if (parseFloat(onlineAmount) > 0) {
    billingItems.push({ method: 'Online / UPI', account: 'UPI Gateway', amount: parseFloat(onlineAmount), reference: refNo || '-' });
  }

  // Handle Save Submission
  const handleSaveEntry = async (e) => {
    if (e) e.preventDefault();

    if (!selectedGroupId || !selectedCustomerId || netAmount <= 0) {
      showSnackbar('Please select Chit Group, Borrower customer, and enter payment amount.', 'warning');
      return;
    }

    if (user.role === 'Accountant') {
      showSnackbar('Access Denied: Your accountant role does not authorize posting collections.', 'error');
      return;
    }

    // Select primary payment method based on values entered
    let primaryMethod = 'UPI';
    if (parseFloat(cashAmount) > 0 && parseFloat(cashAmount) >= Math.max(parseFloat(cardAmount || 0), parseFloat(chequeAmount || 0), parseFloat(onlineAmount || 0))) {
      primaryMethod = 'Cash';
    } else if (parseFloat(chequeAmount) > 0 && parseFloat(chequeAmount) >= Math.max(parseFloat(cashAmount || 0), parseFloat(cardAmount || 0), parseFloat(onlineAmount || 0))) {
      primaryMethod = 'Cheque';
    } else if (parseFloat(cardAmount) > 0 && parseFloat(cardAmount) >= Math.max(parseFloat(cashAmount || 0), parseFloat(chequeAmount || 0), parseFloat(onlineAmount || 0))) {
      primaryMethod = 'Card';
    } else {
      primaryMethod = 'UPI';
    }

    setSubmitting(true);
    try {
      const response = await axios.post('/api/collections', {
        customerId: selectedCustomerId,
        chitGroupId: selectedGroupId,
        amount: netAmount,
        paymentMethod: primaryMethod,
        paymentDate
      });
      showSnackbar('Chit Entry registered successfully!', 'success');
      
      // Auto download if printOn is active
      if (printOn) {
        downloadReceiptPDF({
          receipt_no: response.data.collection.receiptNo,
          customer_name: response.data.collection.customerName,
          chit_group_id: selectedGroupId,
          amount: netAmount,
          payment_method: primaryMethod,
          payment_date: paymentDate,
          collected_by: response.data.collection.collectedBy
        });
      }

      // Reset
      setOpenAddModal(false);
      setSelectedGroupId('');
      setSelectedCustomerId('');
      setCustomerDetail(null);
      setGroupMembers([]);
      resetPaymentBreakdown();
      
      // Reload main collections list
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Error processing chit entry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Generate and download receipt PDF using jsPDF
  const downloadReceiptPDF = (col) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      });

      const primaryColor = '#1E40AF';
      const secondaryColor = '#0F172A';
      const successColor = '#10B981';

      // Header block
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 148, 30, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('FINCORE CHIT FUNDS', 15, 12);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(user.tenant_name.toUpperCase(), 15, 20);

      doc.setTextColor(successColor);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('OFFICIAL PAYMENT RECEIPT', 95, 15);

      // Receipt Parameters Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(10, 36, 128, 90, 4, 4, 'FD');

      doc.setTextColor(secondaryColor);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Receipt Details', 15, 45);
      
      const details = [
        { label: 'Receipt No:', val: col.receipt_no },
        { label: 'Payment Date:', val: col.payment_date },
        { label: 'Customer Name:', val: col.customer_name },
        { label: 'Chit Group ID:', val: col.chit_group_id },
        { label: 'Payment Method:', val: col.payment_method },
        { label: 'Collected By:', val: col.collected_by }
      ];

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      let y = 54;
      details.forEach(item => {
        doc.setFont('Helvetica', 'bold');
        doc.text(item.label, 15, y);
        doc.setFont('Helvetica', 'normal');
        doc.text(String(item.val), 55, y);
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(15, y + 2, 133, y + 2);
        
        y += 8;
      });

      // Amount banner
      doc.setFillColor(30, 64, 175);
      doc.rect(10, 105, 128, 15, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('TOTAL AMOUNT PAID:', 15, 114);
      // jsPDF does not support the Rupee symbol or Intl.NumberFormat special chars, so use plain ASCII
      const pdfAmount = 'INR ' + Number(col.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
      doc.text(pdfAmount, 90, 114);

      // Footer disclaimer
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('This is a system generated e-receipt containing secure multi-tenant cryptographic signatures.', 10, 134);
      doc.text('Thank you for choosing FinCore Chit Fund services.', 10, 138);

      doc.save(`receipt-${col.receipt_no}.pdf`);
      showSnackbar(`Receipt PDF (${col.receipt_no}) downloaded successfully!`, 'success');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showSnackbar('Error generating Receipt PDF.', 'error');
    }
  };

  // Main table columns
  const columns = [
    { id: 'receipt_no', label: 'Receipt ID', render: (row) => <span className="font-bold text-xs text-slate-500">#{row.receipt_no}</span> },
    { id: 'customer_name', label: 'Customer Name', render: (row) => <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{row.customer_name}</span> },
    { id: 'chit_group_id', label: 'Chit Group', render: (row) => <span className="text-xs font-bold text-blue-500 uppercase">{row.chit_group_id}</span> },
    { id: 'amount', label: 'Amount Paid', render: (row) => <span className="text-sm font-extrabold text-[#10B981]">{formatCurrency(row.amount)}</span> },
    { id: 'payment_method', label: 'Payment Method', render: (row) => (
      <Chip 
        label={row.payment_method} 
        size="small" 
        className={`font-semibold text-[10px] ${
          row.payment_method === 'UPI' || row.payment_method === 'Online'
            ? 'bg-blue-500/10 text-blue-500' 
            : row.payment_method === 'Cash' 
            ? 'bg-emerald-500/10 text-emerald-500' 
            : 'bg-indigo-500/10 text-indigo-500'
        }`}
      />
    ) },
    { id: 'payment_date', label: 'Payment Date', render: (row) => <span className="text-xs text-slate-500 font-semibold">{row.payment_date}</span> },
    { id: 'collected_by', label: 'Collected By', render: (row) => <span className="text-xs text-slate-400 font-bold">{row.collected_by}</span> },
    { id: 'actions', label: 'Receipt', render: (row) => (
      <Tooltip title="Download PDF Receipt" placement="top">
        <IconButton 
          onClick={() => downloadReceiptPDF(row)}
          className="text-[#1E40AF] hover:bg-[#1E40AF]/10 rounded-full"
          size="small"
        >
          <Download fontSize="small" />
        </IconButton>
      </Tooltip>
    ) }
  ];

  // Filtered collections based on search and date ranges
  const filteredCollections = collections.filter(col => {
    const matchesSearch = (
      col.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      col.chit_group_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      col.receipt_no?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (!matchesSearch) return false;

    if (timeFilter === 'all') return true;
    if (!col.payment_date) return false;

    const date = new Date(col.payment_date);
    if (isNaN(date.getTime())) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today - itemDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (timeFilter === 'today') {
      return diffDays === 0;
    }
    if (timeFilter === '7days') {
      return diffDays >= 0 && diffDays <= 7;
    }
    if (timeFilter === '30days') {
      return diffDays >= 0 && diffDays <= 30;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top filter pills and ADD button row */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        
        {/* Pills (Mimicking reference screenshot) */}
        <div className="flex gap-2 items-center flex-wrap overflow-x-auto pb-1 scrollbar-none">
          <Chip 
            label="Chitentry Details" 
            size="small" 
            onClick={() => setTimeFilter('all')}
            className={`font-bold text-xs cursor-pointer transition-all ${
              timeFilter === 'all'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
          />
          <Chip 
            label="Today - Entries" 
            size="small" 
            onClick={() => setTimeFilter('today')}
            className={`font-bold text-xs cursor-pointer transition-all ${
              timeFilter === 'today'
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                : 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900/50 hover:bg-teal-100'
            }`}
          />
          <Chip 
            label="Last 7 Days - Entries" 
            size="small" 
            onClick={() => setTimeFilter('7days')}
            className={`font-bold text-xs cursor-pointer transition-all ${
              timeFilter === '7days'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-100'
            }`}
          />
          <Chip 
            label="Last 30 Days - Entries" 
            size="small" 
            onClick={() => setTimeFilter('30days')}
            className={`font-bold text-xs cursor-pointer transition-all ${
              timeFilter === '30days'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-100'
            }`}
          />
        </div>

        {/* Action Controls */}
        <div className="flex gap-2 justify-end items-center">
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Search collections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-semibold text-xs h-[36px]"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fontSize="small" />
          </div>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpenAddModal(true)}
            className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer h-[36px]"
          >
            ADD
          </Button>
        </div>

      </div>

      {/* Main Grid View of Collections */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <CircularProgress size={50} className="text-[#1E40AF]" />
        </div>
      ) : (
        <div className="space-y-4">
          <CustomGrid
            columns={columns}
            data={filteredCollections}
            keyField="id"
            showCheckboxes={true}
            initialRowsPerPage={13}
            emptyMessage="No collections entries found."
          />
        </div>
      )}

      {/* Chit Entry Dialog (Matching Mockup 2 Layout) */}
      <Dialog 
        open={openAddModal} 
        onClose={() => setOpenAddModal(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ 
          className: 'rounded-3xl p-4 bg-slate-50 dark:bg-[#0f172a]',
          style: { minHeight: '85vh' }
        }}
      >
        {/* Custom Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-slate-200 dark:border-slate-800 pb-4 mb-4 gap-4">
          <div className="flex items-center gap-4">
            <Typography variant="h6" className="font-extrabold text-slate-800 dark:text-white tracking-widest uppercase text-sm">
              CHITENTRY
            </Typography>
            
            {/* Center: Chit Group Select in header */}
            <div className="w-[280px]">
              <select
                value={selectedGroupId}
                onChange={(e) => handleGroupChangeInModal(e.target.value)}
                required
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-bold text-xs h-[36px]"
              >
                <option value="" className="text-slate-450 dark:text-slate-500">SELECT CHIT GROUP</option>
                {chitGroups.map(g => (
                  <option key={g.id} value={g.id} className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">
                    {g.id} - {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end">
            {/* Print On checkbox */}
            <FormControlLabel
              control={
                <Checkbox 
                  checked={printOn} 
                  onChange={(e) => setPrintOn(e.target.checked)} 
                  color="primary" 
                  size="small"
                />
              }
              label={
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase">
                  <Print fontSize="inherit" />
                  Print On
                </span>
              }
            />

            <Button
              variant="contained"
              onClick={handleSaveEntry}
              disabled={submitting || user.role === 'Accountant'}
              className="bg-[#10B981] hover:bg-[#059669] text-white font-bold px-6 py-2 rounded-xl text-xs h-[36px] cursor-pointer"
            >
              {submitting ? 'SAVING...' : 'SAVE'}
            </Button>

            <IconButton 
              onClick={() => setOpenAddModal(false)} 
              size="small" 
              className="text-red-500 border border-red-200 hover:bg-red-50 rounded-xl p-1.5"
            >
              <Close fontSize="small" />
            </IconButton>
          </div>
        </div>

        {/* Dialog Content Grid */}
        <DialogContent className="p-0 overflow-y-auto">
          <Grid container spacing={3}>
            
            {/* LEFT PANEL: Profile Information & Billing List */}
            <Grid item xs={12} md={8} className="space-y-4">
              
              {/* Profile Information Card */}
              <Card className="p-5 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-none">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-850 pb-2">
                  <AccountCircle className="text-blue-500" size="small" />
                  <Typography variant="caption" className="font-extrabold uppercase text-xs tracking-wider text-slate-800 dark:text-white">
                    PROFILE INFORMATION
                  </Typography>
                </div>

                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {/* Initials Avatar */}
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-2xl border border-blue-200/50">
                    {customerProfile ? customerProfile.name.split(' ').map(n => n[0]).join('') : 'U'}
                  </div>

                  {/* Profile info fields */}
                  <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    
                    {/* Member select field */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Select Group Member *</label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => handleCustomerChangeInModal(e.target.value)}
                        required
                        disabled={!selectedGroupId || groupMembersLoading}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold disabled:opacity-65"
                      >
                        {groupMembersLoading ? (
                          <option value="">Loading members...</option>
                        ) : !selectedGroupId ? (
                          <option value="">Select Chit Group first</option>
                        ) : (
                          <>
                            <option value="">Choose Member</option>
                            {groupMembers.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} (+91 {m.mobile})
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Mobile:</span>
                      <span className="font-extrabold text-slate-700 dark:text-slate-200">
                        {customerProfile ? customerProfile.mobile : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Email:</span>
                      <span className="font-semibold text-slate-650 dark:text-slate-350 truncate block">
                        {customerProfile ? customerProfile.email : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Scheme Name:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {selectedGroup ? selectedGroup.name : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Monthly Installment:</span>
                      <span className="font-extrabold text-blue-600 dark:text-blue-400">
                        {selectedGroup ? formatCurrency(selectedGroup.monthly_contribution) : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Total Installments:</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        {selectedGroup ? `${selectedGroup.installments} Months` : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Total Chit Value:</span>
                      <span className="font-extrabold text-emerald-500">
                        {selectedGroup ? formatCurrency(selectedGroup.value) : '-'}
                      </span>
                    </div>

                    {/* DYNAMIC PAYMENT PARAMETERS */}
                    {selectedCustomerId && (
                      <>
                        <div className="bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <span className="block text-[10px] text-[#1E40AF] font-extrabold uppercase">Installments Paid:</span>
                          <span className="font-black text-sm text-[#1E40AF]">
                            {paidCount} / {totalInstallments} Months
                          </span>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <span className="block text-[10px] text-amber-600 font-extrabold uppercase">Installments Pending:</span>
                          <span className="font-black text-sm text-amber-600">
                            {pendingCount} Months
                          </span>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-800">
                          <span className="block text-[10px] text-[#10B981] font-extrabold uppercase">Now Paying Installment:</span>
                          <span className="font-black text-sm text-[#10B981]">
                            Month #{nextInstallmentNo}
                          </span>
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800 col-span-2">
                          <span className="block text-[10px] text-emerald-600 font-extrabold uppercase">Scheduled Installment Due:</span>
                          <span className="font-black text-sm text-emerald-600">
                            {formatCurrency(nextInstallmentAmount)}
                          </span>
                        </div>
                      </>
                    )}

                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Reference No:</span>
                      <span className="font-semibold text-slate-500 font-mono">
                        {selectedGroup ? selectedGroup.id : '-'}
                      </span>
                    </div>

                  </div>
                </div>
              </Card>

              {/* Chit Entry List card */}
              <Card className="p-5 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-none">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-850 pb-2">
                  <ReceiptLong className="text-purple-500" size="small" />
                  <Typography variant="caption" className="font-extrabold uppercase text-xs tracking-wider text-slate-850 dark:text-white">
                    CHIT ENTRY BILLING LIST
                  </Typography>
                </div>

                <TableContainer component={Paper} className="shadow-none border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-transparent">
                  <Table size="small">
                    <TableHead className="bg-slate-50 dark:bg-slate-900/60">
                      <TableRow>
                        <TableCell className="font-bold text-[10px] text-slate-500 py-2">S.NO</TableCell>
                        <TableCell className="font-bold text-[10px] text-slate-500 py-2">PAYMENT TYPE</TableCell>
                        <TableCell className="font-bold text-[10px] text-slate-500 py-2">PAYMENT ACCOUNT</TableCell>
                        <TableCell className="font-bold text-[10px] text-slate-500 py-2 text-right">AMOUNT</TableCell>
                        <TableCell className="font-bold text-[10px] text-slate-500 py-2">REFERENCE</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {billingItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-400 py-12 text-xs italic">
                            No payment amount entered yet. Type amounts in the Payment Panel on the right.
                          </TableCell>
                        </TableRow>
                      ) : (
                        billingItems.map((item, idx) => (
                          <TableRow key={item.method} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <TableCell className="text-slate-500 text-xs py-2">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-slate-700 dark:text-slate-200 text-xs py-2 uppercase">{item.method}</TableCell>
                            <TableCell className="text-slate-500 text-xs py-2">{item.account}</TableCell>
                            <TableCell className="font-bold text-emerald-500 text-xs py-2 text-right">{formatCurrency(item.amount)}</TableCell>
                            <TableCell className="text-slate-500 text-xs py-2 font-mono">{item.reference}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>

            </Grid>

            {/* RIGHT PANEL: Mode of Payment Inputs, Save & Calculator */}
            <Grid item xs={12} md={4}>
              <Card className="p-5 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-none space-y-5 h-full flex flex-col justify-between">
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2">
                    <Wallet className="text-emerald-500" size="small" />
                    <Typography variant="caption" className="font-extrabold uppercase text-xs tracking-wider text-slate-850 dark:text-white">
                      PAYMENT DESK
                    </Typography>
                  </div>

                  {/* Cash input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Cash Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    />
                  </div>

                  {/* Card input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Card Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={cardAmount}
                      onChange={(e) => setCardAmount(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    />
                  </div>

                  {/* Cheque input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Cheque Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={chequeAmount}
                      onChange={(e) => setChequeAmount(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    />
                  </div>

                  {/* Online input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Online / UPI Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={onlineAmount}
                      onChange={(e) => setOnlineAmount(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    />
                  </div>

                  {/* Reference No input for card/cheque/online */}
                  {(parseFloat(cardAmount) > 0 || parseFloat(chequeAmount) > 0 || parseFloat(onlineAmount) > 0) && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-indigo-500 uppercase">Transaction / Check Ref No</label>
                      <input
                        type="text"
                        placeholder="Enter transaction ref / check no"
                        value={refNo}
                        onChange={(e) => setRefNo(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {/* Payment Date input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Payment Date</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-850 space-y-4">
                  {/* Dynamic Net Amount */}
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Net Amount</span>
                    <span className="font-extrabold text-slate-800 dark:text-white text-base">
                      {formatCurrency(netAmount)}
                    </span>
                  </div>

                  {/* Dynamic Remaining Balance */}
                  {selectedGroupId && (
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Remaining Balance</span>
                      <span className={`font-black text-xl ${remainingBalance <= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {formatCurrency(remainingBalance)}
                      </span>
                    </div>
                  )}

                  {/* Save button */}
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleSaveEntry}
                    disabled={submitting || user.role === 'Accountant' || netAmount <= 0}
                    className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                  >
                    {submitting ? 'RECORDING...' : 'SAVE ENTRY'}
                  </Button>
                </div>

              </Card>
            </Grid>

          </Grid>
        </DialogContent>
      </Dialog>

      {/* Snackbar Alert */}
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
