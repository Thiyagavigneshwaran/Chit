import React, { useState, useEffect, useContext } from 'react';
import { Card, Grid, Typography, Chip, Button, IconButton, TextField, InputAdornment, List, ListItem, ListItemAvatar, ListItemText, Avatar, Divider, Switch, FormControlLabel, CircularProgress, Alert, Snackbar, Paper, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import {
  Search, NotificationsActive,
  ArrowForward, ContactPhone, MailOutline, Layers,
  CheckCircle, Warning, Help, Add, Download
} from '@mui/icons-material';
import axios from 'axios';
import defaultJsPDF, { jsPDF as namedJsPDF } from 'jspdf';
import { AuthContext } from '../App';

let ResolvedjsPDF = null;
if (defaultJsPDF) {
  if (typeof defaultJsPDF === 'function') {
    ResolvedjsPDF = defaultJsPDF;
  } else if (defaultJsPDF.jsPDF && typeof defaultJsPDF.jsPDF === 'function') {
    ResolvedjsPDF = defaultJsPDF.jsPDF;
  } else if (defaultJsPDF.default && typeof defaultJsPDF.default === 'function') {
    ResolvedjsPDF = defaultJsPDF.default;
  }
}
if (!ResolvedjsPDF && namedJsPDF) {
  ResolvedjsPDF = namedJsPDF;
}

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

export default function CustomersPage() {
  const { user, searchSelectedCustomerId, setSearchSelectedCustomerId } = useContext(AuthContext);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Simulated Notification states
  const [autoReminder, setAutoReminder] = useState(true);
  const [sendingReminder, setSendingReminder] = useState(null); // 'whatsapp' or 'sms' or null
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Registration Modal States
  const [chitGroups, setChitGroups] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', mobile: '', chitGroupId: '' });
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchChitGroups = async () => {
    try {
      const response = await axios.get('/api/chits');
      setChitGroups(response.data);
    } catch (err) {
      console.error('Error loading chit groups:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/customers');
      setCustomers(response.data);
      if (response.data.length > 0) {
        const targetId = searchSelectedCustomerId || response.data[0].id;
        handleSelectCustomer(targetId);
        if (searchSelectedCustomerId) {
          setSearchSelectedCustomerId(null); // Clear trigger
        }
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      showSnackbar('Error loading customer list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchChitGroups();
  }, []);

  // React to search selections while CustomersPage is already mounted
  useEffect(() => {
    if (searchSelectedCustomerId && customers.length > 0) {
      handleSelectCustomer(searchSelectedCustomerId);
      setSearchSelectedCustomerId(null);
    }
  }, [searchSelectedCustomerId, customers]);

  const handleRegisterCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.email || !newCustomer.mobile || !newCustomer.chitGroupId) {
      showSnackbar('Please complete all registration fields.', 'warning');
      return;
    }
    setSubmitLoading(true);
    try {
      const response = await axios.post('/api/customers', newCustomer);
      showSnackbar(response.data.message || 'Customer registered and enrolled successfully!', 'success');
      setOpenModal(false);
      setNewCustomer({ name: '', email: '', mobile: '', chitGroupId: '' });
      await fetchCustomers();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to register customer.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSelectCustomer = async (id) => {
    setProfileLoading(true);
    try {
      const response = await axios.get(`/api/customers/${id}`);
      setSelectedCustomer(id);
      setCustomerDetail(response.data);
      setAutoReminder(response.data.profile.auto_reminder === 1 || response.data.profile.auto_reminder === true);
    } catch (err) {
      showSnackbar('Failed to load customer profile details.', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleToggleAutoReminder = async (checked) => {
    if (!customerDetail) return;
    setAutoReminder(checked);
    try {
      await axios.patch(`/api/customers/${customerDetail.profile.id}/auto-reminder`, { autoReminder: checked });
      showSnackbar(`Auto email reminders ${checked ? 'enabled' : 'disabled'} for ${customerDetail.profile.name}.`, 'success');
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to update reminder settings.', 'error');
      setAutoReminder(!checked);
    }
  };

  const handleSendEmailReminder = async () => {
    if (!customerDetail) return;
    setSendingReminder('email');
    try {
      const res = await axios.post(`/api/customers/${customerDetail.profile.id}/send-reminder`);
      showSnackbar(res.data.message || 'Due reminder email sent successfully!', 'success');
    } catch (err) {
      console.error(err);
      showSnackbar(err.response?.data?.message || 'Failed to send due reminder email.', 'error');
    } finally {
      setSendingReminder(null);
    }
  };

  const handleDownloadStatement = () => {
    if (!customerDetail) return;

    try {
      const doc = new ResolvedjsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const customerName = customerDetail.profile.name;
      const clientId = customerDetail.profile.id;

      // Page tracking context
      const pageContext = { pageNo: 1 };
      const bottomMargin = 270;

      // Helper to check page overflow
      const checkPageOverflow = (y, heightNeeded) => {
        if (y + heightNeeded > bottomMargin) {
          doc.addPage();
          pageContext.pageNo += 1;

          // Next page mini-header
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184); // Slate 400
          const clientCode = customerDetail.profile.customer_code || `#${clientId}`;
          doc.text(`Customer Ledger Statement - ${customerName} (Customer ID: ${clientCode})`, 15, 12);
          doc.text(`Page ${pageContext.pageNo}`, 195, 12, { align: 'right' });

          doc.setDrawColor(226, 232, 240); // Slate 200
          doc.setLineWidth(0.2);
          doc.line(15, 15, 195, 15);
          return 22; // reset y
        }
        return y;
      };

      // Helper to format currency values as standard strings
      const formatPdfCurrency = (val) => {
        const num = parseFloat(val) || 0;
        return 'Rs. ' + new Intl.NumberFormat('en-IN', {
          maximumFractionDigits: 2
        }).format(num);
      };

      // Helper to format dates
      const formatPdfDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
          const d = new Date(dateStr);
          return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) {
          return dateStr;
        }
      };

      // Helper to draw tables dynamically
      const drawTable = (startY, title, headers, colWidths, rows) => {
        let y = startY;

        // Draw Table Title
        y = checkPageOverflow(y, 10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59); // Slate 800
        doc.text(title, 15, y);
        y += 5;

        // Draw Table Header
        const headerHeight = 7;
        y = checkPageOverflow(y, headerHeight);
        doc.setFillColor(30, 64, 175); // Primary Deep Blue (1E40AF)
        doc.rect(15, y, 180, headerHeight, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255); // White text

        const padding = 2;
        let currentX = 15;
        headers.forEach((header, idx) => {
          doc.text(header, currentX + padding, y + headerHeight - 2.5);
          currentX += colWidths[idx];
        });
        y += headerHeight;

        // Draw Rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105); // Slate 600

        if (!rows || rows.length === 0) {
          y = checkPageOverflow(y, 7);
          doc.text("No records found.", 17, y + 4);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(15, y + 7, 195, y + 7);
          y += 11;
          return y;
        }

        rows.forEach((row, rowIndex) => {
          const rowHeight = 6.5;
          y = checkPageOverflow(y, rowHeight);

          // Alternating row backgrounds
          if (rowIndex % 2 === 1) {
            doc.setFillColor(248, 250, 252); // Slate 50
            doc.rect(15, y, 180, rowHeight, 'F');
          }

          currentX = 15;
          row.forEach((cell, cellIdx) => {
            const cleanCell = String(cell !== undefined && cell !== null ? cell : '');
            // Detect numeric right-alignment
            const header = headers[cellIdx] || '';
            const align = (header.includes('Amount') || header.includes('Contribution') || header.includes('Discount') || header.includes('Dividend') || header.includes('Capital') || header.includes('Dues') || header.includes('Value')) ? 'right' : 'left';

            const textX = align === 'right' ? (currentX + colWidths[cellIdx] - padding) : (currentX + padding);
            doc.text(cleanCell, textX, y + rowHeight - 2.2, { align });
            currentX += colWidths[cellIdx];
          });

          // Row divider
          doc.setDrawColor(241, 245, 249); // Slate 100
          doc.setLineWidth(0.2);
          doc.line(15, y + rowHeight, 195, y + rowHeight);
          y += rowHeight;
        });

        y += 4; // spacing after table
        return y;
      };

      // --- PAGE 1: HEADER & PROFILE ---
      let y = 15;

      // Premium Brand Top Bar
      doc.setFillColor(30, 64, 175); // Deep Blue
      doc.rect(15, y, 180, 4, 'F');
      y += 10;

      // Header Text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 64, 175);
      doc.text("FINCORE CHIT FUNDS", 15, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const generatedOn = `Generated on: ${new Date().toLocaleString('en-IN')}`;
      doc.text(generatedOn, 195, y - 2, { align: 'right' });
      doc.text("Sri Vinayaga Chit Funds", 15, y + 4);
      y += 10;

      // Document Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text("CUSTOMER LEDGER STATEMENT", 15, y);

      // Divider line
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.5);
      doc.line(15, y + 2, 195, y + 2);
      y += 8;

      // Profile Summary Box
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.rect(15, y, 180, 36, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(15, y, 180, 36, 'S');

      // Left Column Profile Info
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text("Customer Profile Details", 18, y + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59); // Slate 800

      doc.setFont('helvetica', 'normal');
      doc.text("Customer ID:", 18, y + 12);
      doc.setFont('helvetica', 'bold');
      doc.text(customerDetail.profile.customer_code || `#${clientId}`, 45, y + 12);

      doc.setFont('helvetica', 'normal');
      doc.text("Full Name:", 18, y + 18);
      doc.setFont('helvetica', 'bold');
      doc.text(customerName, 45, y + 18);

      doc.setFont('helvetica', 'normal');
      doc.text("Mobile Contact:", 18, y + 24);
      doc.setFont('helvetica', 'bold');
      doc.text(`+91 ${customerDetail.profile.mobile}`, 45, y + 24);

      doc.setFont('helvetica', 'normal');
      doc.text("Email Directory:", 18, y + 30);
      doc.setFont('helvetica', 'bold');
      doc.text(customerDetail.profile.email, 45, y + 30);

      // Right Column Financial Info
      const rightX = 110;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text("Active Groups:", rightX, y + 12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`${customerDetail.profile.total_chits} Subscribed`, rightX + 38, y + 12);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text("Paid Capital:", rightX, y + 18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // Success Emerald Green
      doc.text(formatPdfCurrency(customerDetail.profile.paid_amount), rightX + 38, y + 18);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text("Outstanding Dues:", rightX, y + 24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(245, 158, 11); // Warning Orange
      doc.text(formatPdfCurrency(customerDetail.profile.pending_amount), rightX + 38, y + 24);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text("Ledger Status:", rightX, y + 30);
      doc.setFont('helvetica', 'bold');
      const status = customerDetail.profile.status;
      if (status === 'Paid') doc.setTextColor(16, 185, 129);
      else if (status === 'Pending') doc.setTextColor(245, 158, 11);
      else doc.setTextColor(239, 68, 68); // Red
      doc.text(status, rightX + 38, y + 30);

      y += 44;

      // --- SECTION 1: SUBSCRIBED CHITS ---
      const chitHeaders = ["Group ID", "Chit Scheme Name", "Contribution per Member", "Joined Date", "Chit Value"];
      const chitWidths = [25, 45, 40, 35, 35];
      const chitRows = (customerDetail.chits || []).map(chit => [
        chit.id,
        chit.name,
        formatPdfCurrency(getCurrentContribution(chit)),
        formatPdfDate(chit.joined_date),
        formatPdfCurrency(chit.value)
      ]);
      y = drawTable(y, "1. Subscribed Chit Groups", chitHeaders, chitWidths, chitRows);

      // --- SECTION 2: PAYMENT COLLECTIONS (Installments Paid) ---
      const collHeaders = ["Date", "Receipt No", "Chit Group", "Amount Paid", "Payment Method", "Collected By"];
      const collWidths = [30, 30, 25, 35, 30, 30];
      const collRows = (customerDetail.payments || []).map(p => [
        formatPdfDate(p.payment_date),
        p.receipt_no,
        p.chit_group_id,
        formatPdfCurrency(p.amount),
        p.payment_method,
        p.collected_by
      ]);
      y = drawTable(y, "2. Payments Made (Installments Paid)", collHeaders, collWidths, collRows);

      // --- SECTION 3: PAYOUTS RECEIVED ---
      const payoutHeaders = ["Date", "Transaction Ref", "Chit Group", "Amount Disbursed", "Payment Method", "Type"];
      const payoutWidths = [30, 35, 25, 35, 30, 25];
      const payoutRows = (customerDetail.payouts || []).map(p => [
        formatPdfDate(p.payment_date),
        p.transaction_ref,
        p.chit_group_id,
        formatPdfCurrency(p.amount),
        p.payment_method,
        p.type
      ]);
      y = drawTable(y, "3. Payouts Received (Winnings Disbursed)", payoutHeaders, payoutWidths, payoutRows);

      // --- SECTION 4: AUCTIONS IN SUBSCRIBED GROUPS ---
      const aucHeaders = ["Date", "Chit Group", "Instal. #", "Winning Bidder", "Bid Discount", "Dividend", "Did You Win?"];
      const aucWidths = [25, 30, 15, 35, 28, 25, 22];
      const aucRows = (customerDetail.auctions || []).map(a => [
        formatPdfDate(a.auction_date),
        (a.chit_group_name || a.chit_group_id),
        `#${a.installment_no}`,
        a.winning_bidder_name,
        formatPdfCurrency(a.bid_amount),
        formatPdfCurrency(a.dividend_amount),
        a.won
      ]);
      y = drawTable(y, "4. Group Auction Participation History", aucHeaders, aucWidths, aucRows);

      // Footer
      y = checkPageOverflow(y, 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("FinCore Multi-Tenant Financial Management Ledger Suite.", 15, y + 5);
      doc.text("This is a system generated report. No signature is required.", 15, y + 9);

      // Save PDF
      const sanitizedName = customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const statementFileId = customerDetail.profile.customer_code || clientId;
      doc.save(`statement_${sanitizedName}_${statementFileId}.pdf`);
      showSnackbar(`Statement PDF downloaded successfully for ${customerName}!`, 'success');
    } catch (err) {
      console.error("PDF generation failed:", err);
      showSnackbar("Statement download failed: " + err.message, "error");
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Filtered List
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm) ||
      (c.customer_code && c.customer_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'All' || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusChip = (status) => {
    switch (status) {
      case 'Paid':
        return <Chip label="Paid" icon={<CheckCircle />} className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 font-bold" size="small" variant="outlined" />;
      case 'Pending':
        return <Chip label="Pending" icon={<Warning />} className="bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30 font-bold" size="small" variant="outlined" />;
      case 'Overdue':
        return <Chip label="Overdue" icon={<Warning />} className="bg-red-500/15 text-red-500 border-red-500/30 font-bold" size="small" variant="outlined" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
            Paid
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
            Pending
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
            Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
            {status}
          </span>
        );
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
            Customers Ledger
          </Typography>
          <Typography variant="caption" className="text-slate-400 block mt-0.5">
            Manage customer directories, profiles, payment tracks, and push due alerts.
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenModal(true)}
          className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold py-2.5 px-4 rounded-xl text-xs"
        >
          Register New Customer
        </Button>
      </div>

      <Grid container spacing={3}>

        {/* Left Side: List of Customers */}
        <Grid item xs={12} md={5}>
          <Card className="p-5 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-3xl flex flex-col h-[75vh] shadow-sm">
            {/* Search Input */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search Name, Phone, Email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-semibold text-xs"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" fontSize="small" />
            </div>

            {/* Filter Toggle Buttons */}
            <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
              {['All', 'Paid', 'Pending', 'Overdue'].map(status => {
                const isActive = filterStatus === status;
                return (
                  <button
                    type="button"
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all duration-200 cursor-pointer ${isActive
                      ? 'bg-[#1E40AF] text-white shadow-sm shadow-[#1E40AF]/30'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {filteredCustomers.length === 0 ? (
                <div className="text-center text-slate-400 mt-12 text-sm">No customer match found.</div>
              ) : (
                <div className="space-y-2">
                  {filteredCustomers.map(c => {
                    const isSelected = selectedCustomer === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 flex justify-between items-center gap-3 ${isSelected
                          ? 'bg-gradient-to-r from-[#1E40AF]/10 to-[#10B981]/5 border-[#1E40AF]/30 dark:from-[#1E40AF]/15 dark:to-[#10B981]/5'
                          : 'bg-transparent border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="bg-gradient-to-tr from-[#1E40AF] to-[#10B981] font-bold text-xs text-white w-10 h-10 shadow-sm">
                            {c.name.split(' ').map(n => n[0]).join('')}
                          </Avatar>
                          <div>
                            <div className="font-extrabold text-xs text-slate-800 dark:text-slate-200">{c.name}</div>
                            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">{c.customer_code || 'No ID'} • {c.mobile}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(c.status)}
                          <ArrowForward className={`text-slate-400 transition-transform duration-200 ${isSelected ? 'translate-x-1' : ''}`} fontSize="small" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </Grid>

        {/* Right Side: Customer Detailed Profile */}
        <Grid item xs={12} md={7}>
          {profileLoading ? (
            <Card className="flex items-center justify-center h-[75vh] bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800">
              <CircularProgress size={50} className="text-[#1E40AF]" />
            </Card>
          ) : customerDetail ? (
            <div className="p-6 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 rounded-3xl h-[75vh] flex flex-col justify-between overflow-y-auto shadow-sm">

              {/* Profile Card Summary Header */}
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 bg-gradient-to-tr from-[#1E40AF] to-[#10B981] font-extrabold text-lg text-white">
                      {customerDetail.profile.name.split(' ').map(n => n[0]).join('')}
                    </Avatar>
                    <div>
                      <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
                        {customerDetail.profile.name}
                      </Typography>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusChip(customerDetail.profile.status)}
                        <span className="text-xs text-slate-400 font-semibold">Customer ID: {customerDetail.profile.customer_code || 'N/A'}</span>
                        <span className="text-xs text-slate-300 font-semibold">|</span>
                        <span className="text-xs text-slate-400 font-semibold">DB ID: #{customerDetail.profile.id}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={handleDownloadStatement}
                    className="border-[#1E40AF] text-[#1E40AF] hover:bg-[#1E40AF]/5 font-bold py-2 px-4 rounded-xl text-xs transition-colors w-full sm:w-auto"
                  >
                    Download Statement
                  </Button>
                </div>

                {/* Core Parameters Grid */}
                <Grid container spacing={3} className="py-6 border-b border-slate-100 dark:border-slate-800">
                  <Grid item xs={12} sm={6} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <ContactPhone className="text-[#1E40AF]" fontSize="small" />
                      <div>
                        <span className="text-xs text-slate-400 block font-semibold">Mobile Contact</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">+91 {customerDetail.profile.mobile}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <MailOutline className="text-[#1E40AF]" fontSize="small" />
                      <div>
                        <span className="text-xs text-slate-400 block font-semibold">Email Directory</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{customerDetail.profile.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Layers className="text-[#1E40AF]" fontSize="small" />
                      <div>
                        <span className="text-xs text-slate-400 block font-semibold">Total Subscribed Chits</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{customerDetail.profile.total_chits} Active Group(s)</span>
                      </div>
                    </div>
                  </Grid>

                  <Grid item xs={12} sm={6} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="text-[#10B981]" fontSize="small" />
                      <div>
                        <span className="text-xs text-slate-400 block font-semibold">Aggregate Paid Capital</span>
                        <span className="text-sm font-bold text-[#10B981]">{formatCurrency(customerDetail.profile.paid_amount)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Warning className="text-[#F59E0B]" fontSize="small" />
                      <div>
                        <span className="text-xs text-slate-400 block font-semibold">Pending Outstanding Dues</span>
                        <span className="text-sm font-bold text-[#F59E0B]">{formatCurrency(customerDetail.profile.pending_amount)}</span>
                      </div>
                    </div>
                  </Grid>
                </Grid>

                {/* Subscribed Plans Lists */}
                <div className="py-6 border-b border-slate-100 dark:border-slate-800">
                  <Typography variant="subtitle2" className="text-slate-500 font-bold uppercase tracking-wider mb-3">
                    Subscribed Groups Details
                  </Typography>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {customerDetail.chits.map((chit, index) => (
                      <div key={`${chit.id}-${index}`} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-[#1E40AF]">{chit.id}</span>
                          <span className="text-xs text-slate-400 font-medium">Joined: {chit.joined_date}</span>
                        </div>
                        <div className="font-bold text-sm text-slate-800 dark:text-white mt-1">{chit.name}</div>
                        <div className="flex justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          <span className="text-slate-400">Contribution per Member:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{formatCurrency(getCurrentContribution(chit))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Automated Actions Block */}
                <div className="py-6">
                  <Typography variant="subtitle2" className="text-slate-500 font-bold uppercase tracking-wider mb-4">
                    Reminders & Automation Control
                  </Typography>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoReminder}
                          onChange={(e) => handleToggleAutoReminder(e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <div>
                          <div className="text-sm font-bold text-slate-800 dark:text-white">Auto Email Reminder</div>
                          <div className="text-xs text-slate-400 font-medium">Auto-dispatch email notice when auctions/installments are cleared.</div>
                        </div>
                      }
                    />

                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleSendEmailReminder}
                        disabled={sendingReminder !== null}
                        className="flex items-center justify-center gap-1.5 border border-[#1E40AF]/30 text-[#1E40AF] hover:bg-[#1E40AF]/5 px-4 py-2.5 rounded-xl font-bold flex-1 sm:flex-initial text-xs transition-colors"
                      >
                        {sendingReminder === 'email' ? <CircularProgress size={14} className="text-[#1E40AF]" /> : <MailOutline fontSize="small" />}
                        Send Email Reminder
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center h-[75vh] bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800 p-8 text-center text-slate-400">
              <ContactPhone fontSize="large" className="mb-2" />
              Select a customer from the left list to review detailed ledger profiles.
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Registration Dialog */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} PaperProps={{ className: 'rounded-3xl p-4 w-full max-w-md' }}>
        <form onSubmit={handleRegisterCustomer}>
          <DialogTitle className="font-extrabold text-slate-850 dark:text-white">Register New Customer</DialogTitle>
          <DialogContent className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Full Name</label>
              <input
                type="text"
                required
                placeholder="Enter customer name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Email Address</label>
              <input
                type="email"
                required
                placeholder="Enter email address"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mobile Contact</label>
              <input
                type="text"
                required
                placeholder="Enter 10-digit number"
                value={newCustomer.mobile}
                onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assign Chit Plan</label>
              <select
                value={newCustomer.chitGroupId}
                onChange={(e) => setNewCustomer({ ...newCustomer, chitGroupId: e.target.value })}
                required
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              >
                <option value="" className="text-slate-400 dark:text-slate-500">Select Chit Plan</option>
                {chitGroups.map(g => (
                  <option key={g.id} value={g.id} className="text-slate-800 dark:text-white bg-white dark:bg-[#1E293B]">
                    {g.id} - {g.name}
                  </option>
                ))}
              </select>
            </div>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={() => setOpenModal(false)} className="text-slate-500 font-bold">Cancel</Button>
            <Button
              type="submit"
              disabled={submitLoading}
              variant="contained"
              className="bg-[#1E40AF] text-white font-bold px-5 rounded-xl"
            >
              {submitLoading ? 'Registering...' : 'Register'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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
