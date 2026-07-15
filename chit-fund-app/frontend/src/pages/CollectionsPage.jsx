import React, { useState, useEffect, useContext } from 'react';
import { Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, IconButton, TextField, InputAdornment, Button, CircularProgress, Alert, Snackbar, Tooltip, Chip, Grid, Drawer } from '@mui/material';
import { Download, Search, ReceiptLong, CalendarMonth, FilterList, Close } from '@mui/icons-material';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { AuthContext } from '../App';
import CustomGrid from '../components/CustomGrid';

export default function CollectionsPage() {
  const { user } = useContext(AuthContext); 
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchCollections = async () => {
    try {
      const response = await axios.get('/api/collections');
      setCollections(response.data);
    } catch (err) {
      console.error('Error fetching collections:', err);
      showSnackbar('Error loading collections ledger.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  // Generate and download premium PDF receipt using jsPDF
  const downloadReceiptPDF = (col) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5' // A5 size is elegant for payment receipts
      });

      // Colors
      const primaryColor = '#1E40AF';
      const secondaryColor = '#0F172A';
      const successColor = '#10B981';

      // Design Header
      doc.setFillColor(15, 23, 42); // Dark Navy background header
      doc.rect(0, 0, 148, 30, 'F');

      // Title
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
      doc.setFillColor(248, 250, 252); // Light background card
      doc.roundedRect(10, 36, 128, 90, 4, 4, 'FD');

      doc.setTextColor(secondaryColor);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Receipt Details', 15, 45);
      
      // Draw details list
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
        
        // Draw dotted divider lines
        doc.setDrawColor(226, 232, 240);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(15, y + 2, 133, y + 2);
        
        y += 8;
      });

      // Amount banner
      doc.setFillColor(30, 64, 175); // Royal Blue banner
      doc.rect(10, 105, 128, 15, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('TOTAL AMOUNT PAID:', 15, 114);
      doc.text(formatCurrency(col.amount), 90, 114);

      // Sign-off Statement
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('This is a system generated e-receipt containing secure multi-tenant cryptographic signatures.', 10, 134);
      doc.text('Thank you for choosing FinCore Chit Fund services.', 10, 138);

      // Save PDF
      doc.save(`receipt-${col.receipt_no}.pdf`);
      showSnackbar(`Receipt PDF (${col.receipt_no}) downloaded successfully!`, 'success');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showSnackbar('Error generating Receipt PDF.', 'error');
    }
  };

  // Dynamic filter query
  const getFilteredCollections = () => {
    let filtered = [...collections];
    
    // 1. Search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => {
        const custName = c.customer_name ? c.customer_name.toLowerCase() : '';
        const recNo = c.receipt_no ? c.receipt_no.toLowerCase() : '';
        const grpId = c.chit_group_id ? c.chit_group_id.toLowerCase() : '';
        return custName.includes(term) || recNo.includes(term) || grpId.includes(term);
      });
    }

    // 2. Payment Method filter
    if (methodFilter !== 'All') {
      filtered = filtered.filter(c => c.payment_method === methodFilter);
    }

    // 3. Date range filters
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      filtered = filtered.filter(c => new Date(c.payment_date) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23,59,59,999);
      filtered = filtered.filter(c => new Date(c.payment_date) <= end);
    }

    return filtered;
  };

  const filteredCollections = getFilteredCollections();

  const columns = [
    { id: 'receipt_no', label: 'Receipt ID', render: (row) => <span className="font-bold text-xs text-slate-600 dark:text-slate-400">{row.receipt_no}</span> },
    { id: 'customer_name', label: 'Customer Name', render: (row) => <span className="font-bold text-slate-800 dark:text-white text-sm">{row.customer_name}</span> },
    { id: 'chit_group_id', label: 'Chit Group', render: (row) => <span className="font-bold text-xs text-[#1E40AF]">{row.chit_group_id}</span> },
    { id: 'amount', label: 'Amount Paid', render: (row) => <span className="font-extrabold text-[#10B981] text-sm">{formatCurrency(row.amount)}</span> },
    { id: 'payment_method', label: 'Method', render: (row) => (
      <Chip 
        label={row.payment_method} 
        size="small" 
        className={`font-semibold text-[10px] ${
          row.payment_method === 'UPI' 
            ? 'bg-blue-500/10 text-blue-500' 
            : row.payment_method === 'Cash' 
            ? 'bg-emerald-500/10 text-emerald-500' 
            : 'bg-indigo-500/10 text-indigo-500'
        }`}
      />
    ) },
    { id: 'payment_date', label: 'Date', render: (row) => (
      <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
        <CalendarMonth fontSize="inherit" />
        {row.payment_date}
      </div>
    ) },
    { id: 'collected_by', label: 'Collected By', render: (row) => <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{row.collected_by}</span> },
    { id: 'actions', label: 'Receipt', render: (row) => (
      <div className="text-center">
        <Tooltip title="Download PDF Receipt" placement="top">
          <IconButton 
            onClick={() => downloadReceiptPDF(row)}
            className="text-[#1E40AF] hover:bg-[#1E40AF]/10 rounded-full"
            size="small"
          >
            <Download fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
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

      {/* Audit Log Container */}
      <div className="space-y-4">
        
        {/* Search row */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <div className="relative max-w-sm w-full">
            <input
              type="text"
              placeholder="Search Receipt, Customer, Group..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-semibold text-xs"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" fontSize="small" />
          </div>
          
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            onClick={() => setFilterDrawerOpen(true)}
            className={`border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold py-2 px-4 text-xs h-[38px] cursor-pointer transition-colors relative ${
              (methodFilter !== 'All' || startDate || endDate) ? 'border-[#1E40AF] text-[#1E40AF] dark:text-[#3B82F6] bg-[#1E40AF]/5' : ''
            }`}
          >
            Filters {(methodFilter !== 'All' || startDate || endDate) && '•'}
          </Button>
        </div>

        {/* Right-side Sliding Filter Drawer */}
        <Drawer
          anchor="right"
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          PaperProps={{
            className: 'w-full sm:w-[360px] p-6 bg-white dark:bg-[#0F172A] border-l border-slate-100 dark:border-slate-800 flex flex-col justify-between'
          }}
          sx={{ zIndex: 1400 }}
        >
          <div>
            {/* Drawer Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <Typography variant="subtitle2" className="font-extrabold text-slate-850 dark:text-white uppercase tracking-wider text-xs">
                Filters
              </Typography>
              <div className="flex items-center gap-2">
                {(methodFilter !== 'All' || startDate || endDate) && (
                  <Button 
                    size="small" 
                    onClick={() => {
                      setMethodFilter('All');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-[10px] text-slate-400 font-bold hover:text-slate-600 dark:hover:text-slate-200 normal-case min-w-0 p-0"
                  >
                    Clear All
                  </Button>
                )}
                <IconButton 
                  onClick={() => setFilterDrawerOpen(false)} 
                  size="small" 
                  className="bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-500 rounded-xl"
                >
                  <Close fontSize="small" />
                </IconButton>
              </div>
            </div>

            {/* Filter Options Form */}
            <div className="space-y-6">
              {/* Payment Method */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Payment Method</span>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent font-semibold text-xs h-[38px]"
                >
                  <option value="All">All Methods</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              {/* From Date */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">From Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent font-semibold text-xs h-[38px]"
                />
              </div>

              {/* To Date */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">To Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent font-semibold text-xs h-[38px]"
                />
              </div>
            </div>
          </div>

          {/* Drawer Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
            <Button
              fullWidth
              variant="contained"
              onClick={() => setFilterDrawerOpen(false)}
              className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white py-2.5 rounded-xl font-bold text-xs shadow-md normal-case"
            >
              Apply Filters
            </Button>
          </div>
        </Drawer>

        <CustomGrid
          columns={columns}
          data={filteredCollections}
          keyField="id"
          showCheckboxes={true}
          initialRowsPerPage={13}
          emptyMessage="No matching collections records found."
        />
      </div>

      {/* Snackbar alerts */}
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
