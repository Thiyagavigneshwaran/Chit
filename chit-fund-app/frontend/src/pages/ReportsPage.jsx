import React, { useState, useEffect,useContext } from 'react';
import { 
  Card, Typography, Grid, Button, CircularProgress, 
  Alert, Snackbar, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip
} from '@mui/material';
import { 
  FileDownload, Description, Assessment, ReceiptLong, 
  MonetizationOn, Search, Print, GridOn, CalendarMonth, FilterList, Download
} from '@mui/icons-material';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import CustomGrid from '../components/CustomGrid';
import { AuthContext } from '../App';

export default function ReportsPage() {
  const { user } = useContext(AuthContext);
  // Navigation & Config States
  const [selectedReport, setSelectedReport] = useState('customers'); // 'customers', 'collections', 'disbursements', 'finance'
  const [financeSubReport, setFinanceSubReport] = useState('active'); // 'active', 'log', 'closed'
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // for customers
  const [methodFilter, setMethodFilter] = useState('All'); // for collections, disbursements, finance repayments
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // System States
  const [exporting, setExporting] = useState(null); // 'pdf', 'csv', 'print' or null
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Fetch report data based on selection
  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (selectedReport === 'customers') {
        const res = await axios.get('/api/customers');
        setData(res.data);
      } else if (selectedReport === 'collections') {
        const res = await axios.get('/api/collections');
        setData(res.data);
      } else if (selectedReport === 'disbursements') {
        const res = await axios.get('/api/payments');
        setData(res.data);
      } else if (selectedReport === 'finance') {
        // Loans endpoint returns all loans with dynamic accrued interest, balances, and repayments list
        const res = await axios.get('/api/finance/loans');
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
      showSnackbar('Error loading report details from server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
    // Reset filters on report switch
    setSearchTerm('');
    setStatusFilter('All');
    setMethodFilter('All');
    setStartDate('');
    setEndDate('');
  }, [selectedReport, financeSubReport]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

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
      doc.text((user?.tenant_name || 'System Tenant').toUpperCase(), 15, 20);

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
        { label: 'Payment Date:', val: formatDate(col.payment_date) || col.payment_date },
        { label: 'Customer Name:', val: col.customer_name },
        { label: 'Chit Group ID:', val: col.chit_group_id },
        { label: 'Payment Method:', val: col.payment_method },
        { label: 'Collected By:', val: col.collected_by || 'System' }
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

  // Compute filtered dataset
  const getFilteredData = () => {
    let filtered = [];
    
    if (selectedReport === 'finance' && financeSubReport === 'log') {
      // Flatten all repayments first
      data.forEach(loan => {
        if (loan.repayments) {
          loan.repayments.forEach(rep => {
            filtered.push({
              ...rep,
              customer_name: loan.customer_name,
              loan_id: loan.id
            });
          });
        }
      });
      // Sort repayments by date descending
      filtered.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
    } else {
      filtered = [...data];
    }

    // 1. Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (selectedReport === 'customers') {
        filtered = filtered.filter(c => 
          c.name.toLowerCase().includes(term) || 
          c.mobile.includes(term) || 
          c.email.toLowerCase().includes(term)
        );
      } else if (selectedReport === 'collections') {
        filtered = filtered.filter(c => 
          c.customer_name.toLowerCase().includes(term) || 
          c.receipt_no.toLowerCase().includes(term) || 
          c.chit_group_id.toLowerCase().includes(term)
        );
      } else if (selectedReport === 'disbursements') {
        filtered = filtered.filter(p => 
          p.customer_name.toLowerCase().includes(term) || 
          p.transaction_ref.toLowerCase().includes(term) || 
          p.chit_group_id.toLowerCase().includes(term)
        );
      } else if (selectedReport === 'finance') {
        if (financeSubReport === 'active' || financeSubReport === 'closed') {
          filtered = filtered.filter(l => 
            l.customer_name.toLowerCase().includes(term) || 
            l.notes?.toLowerCase().includes(term)
          );
        } else {
          // already flattened repayments list
          filtered = filtered.filter(r => 
            r.customer_name.toLowerCase().includes(term) || 
            r.notes?.toLowerCase().includes(term) ||
            String(r.loan_id).includes(term)
          );
        }
      }
    }

    // 2. Finance Sub-Report status isolation
    if (selectedReport === 'finance') {
      if (financeSubReport === 'active') {
        filtered = filtered.filter(l => l.status === 'Active');
      } else if (financeSubReport === 'closed') {
        filtered = filtered.filter(l => l.status === 'Closed');
      }
    }

    // 3. Dropdown status/method filters
    if (selectedReport === 'customers' && statusFilter !== 'All') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    if (selectedReport === 'collections' && methodFilter !== 'All') {
      filtered = filtered.filter(c => c.payment_method === methodFilter);
    }
    if (selectedReport === 'disbursements' && methodFilter !== 'All') {
      filtered = filtered.filter(p => p.payment_method === methodFilter);
    }
    if (selectedReport === 'finance' && financeSubReport === 'log' && methodFilter !== 'All') {
      filtered = filtered.filter(r => r.payment_method === methodFilter);
    }

    // 4. Date range filters
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      if (selectedReport === 'collections') {
        filtered = filtered.filter(c => new Date(c.payment_date) >= start);
      } else if (selectedReport === 'disbursements') {
        filtered = filtered.filter(p => new Date(p.payment_date) >= start);
      } else if (selectedReport === 'finance') {
        if (financeSubReport === 'active') {
          filtered = filtered.filter(l => new Date(l.loan_date) >= start);
        } else if (financeSubReport === 'closed') {
          filtered = filtered.filter(l => new Date(l.closed_date || l.loan_date) >= start);
        } else {
          filtered = filtered.filter(r => new Date(r.payment_date) >= start);
        }
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23,59,59,999);
      if (selectedReport === 'collections') {
        filtered = filtered.filter(c => new Date(c.payment_date) <= end);
      } else if (selectedReport === 'disbursements') {
        filtered = filtered.filter(p => new Date(p.payment_date) <= end);
      } else if (selectedReport === 'finance') {
        if (financeSubReport === 'active') {
          filtered = filtered.filter(l => new Date(l.loan_date) <= end);
        } else if (financeSubReport === 'closed') {
          filtered = filtered.filter(l => new Date(l.closed_date || l.loan_date) <= end);
        } else {
          filtered = filtered.filter(r => new Date(r.payment_date) <= end);
        }
      }
    }

    return filtered;
  };

  // Compile PDF document using jsPDF
  const generatePDFReport = (action = 'download') => {
    setExporting(action);
    try {
      const filtered = getFilteredData();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      let title = '';
      if (selectedReport === 'customers') title = 'Customers Directory Report';
      else if (selectedReport === 'collections') title = 'Collections Ledger Statement';
      else if (selectedReport === 'disbursements') title = 'Disbursements Payouts Statement';
      else if (selectedReport === 'finance') {
        if (financeSubReport === 'active') title = 'Active Interest Lending Report';
        else if (financeSubReport === 'closed') title = 'Closed Lending Entries Ledger';
        else title = 'Lending Interest Repayments Statement';
      }

      // Title Card
      doc.setFillColor(15, 23, 42); // Navy
      doc.rect(0, 0, 210, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('FINCORE CHIT FUNDS', 15, 12);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('SECURE ACCOUNTING SYSTEM AUDIT LEDGER', 15, 20);

      doc.setTextColor(16, 185, 129); // Emerald
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(title.toUpperCase(), 120, 15);

      // Report metadata
      doc.setTextColor(71, 85, 105); // Slate 600
      doc.setFontSize(8);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Generated Date: ${new Date().toLocaleString('en-IN')}`, 15, 38);
      doc.text(`Total Records Found: ${filtered.length}`, 15, 43);
      doc.line(15, 47, 195, 47);

      let y = 55;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59); // Slate 800

      // Write table headers based on report type
      if (selectedReport === 'customers') {
        doc.text('ID', 15, y);
        doc.text('Customer Name', 25, y);
        doc.text('Mobile Number', 85, y);
        doc.text('Paid Capital', 125, y);
        doc.text('Pending Dues', 155, y);
        doc.text('Status', 180, y);
        doc.line(15, y + 2, 195, y + 2);
        doc.setFont('Helvetica', 'normal');
        y += 8;
        filtered.forEach(c => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(String(c.id), 15, y);
          doc.text(c.name, 25, y);
          doc.text(c.mobile, 85, y);
          doc.text(formatCurrency(c.paid_amount), 125, y);
          doc.text(formatCurrency(c.pending_amount), 155, y);
          doc.text(c.status, 180, y);
          y += 7;
        });
      } else if (selectedReport === 'collections') {
        doc.text('Receipt No', 15, y);
        doc.text('Customer Name', 45, y);
        doc.text('Chit Group ID', 105, y);
        doc.text('Amount Paid', 135, y);
        doc.text('Method', 165, y);
        doc.text('Date', 182, y);
        doc.line(15, y + 2, 195, y + 2);
        doc.setFont('Helvetica', 'normal');
        y += 8;
        filtered.forEach(col => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(col.receipt_no, 15, y);
          doc.text(col.customer_name, 45, y);
          doc.text(col.chit_group_id, 105, y);
          doc.text(formatCurrency(col.amount), 135, y);
          doc.text(col.payment_method, 165, y);
          doc.text(col.payment_date, 182, y);
          y += 7;
        });
      } else if (selectedReport === 'disbursements') {
        doc.text('TXN Reference', 15, y);
        doc.text('Customer Name', 55, y);
        doc.text('Chit Group ID', 115, y);
        doc.text('Amount Settled', 145, y);
        doc.text('Date Paid', 175, y);
        doc.line(15, y + 2, 195, y + 2);
        doc.setFont('Helvetica', 'normal');
        y += 8;
        filtered.forEach(p => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(p.transaction_ref, 15, y);
          doc.text(p.customer_name, 55, y);
          doc.text(p.chit_group_id, 115, y);
          doc.text(formatCurrency(p.amount), 145, y);
          doc.text(p.payment_date, 175, y);
          y += 7;
        });
      } else if (selectedReport === 'finance') {
        if (financeSubReport === 'active') {
          doc.text('ID', 15, y);
          doc.text('Borrower Customer', 23, y);
          doc.text('Principal', 75, y);
          doc.text('Interest Terms', 105, y);
          doc.text('Elapsed', 135, y);
          doc.text('Pending Int', 153, y);
          doc.text('Rem Principal', 175, y);
          doc.line(15, y + 2, 195, y + 2);
          doc.setFont('Helvetica', 'normal');
          y += 8;
          filtered.forEach(l => {
            if (y > 280) { doc.addPage(); y = 20; }
            doc.text(String(l.id), 15, y);
            doc.text(l.customer_name, 23, y);
            doc.text(formatCurrency(l.principal_amount), 75, y);
            doc.text(`${l.interest_rate}% ${l.interest_type}`, 105, y);
            doc.text(`${l.elapsedDays}d`, 135, y);
            doc.text(formatCurrency(l.pendingInterest), 153, y);
            doc.text(formatCurrency(l.remainingPrincipal), 175, y);
            y += 7;
          });
        } else if (financeSubReport === 'closed') {
          doc.text('ID', 15, y);
          doc.text('Borrower Customer', 25, y);
          doc.text('Principal', 80, y);
          doc.text('Interest Terms', 110, y);
          doc.text('Interest Paid', 140, y);
          doc.text('Closed Date', 170, y);
          doc.line(15, y + 2, 195, y + 2);
          doc.setFont('Helvetica', 'normal');
          y += 8;
          filtered.forEach(l => {
            if (y > 280) { doc.addPage(); y = 20; }
            doc.text(String(l.id), 15, y);
            doc.text(l.customer_name, 25, y);
            doc.text(formatCurrency(l.principal_amount), 80, y);
            doc.text(`${l.interest_rate}% ${l.interest_type}`, 110, y);
            doc.text(formatCurrency(l.interestPaid), 140, y);
            doc.text(formatDate(l.closed_date), 170, y);
            y += 7;
          });
        } else {
          doc.text('Date', 15, y);
          doc.text('Borrower Customer', 40, y);
          doc.text('Loan ID', 95, y);
          doc.text('Interest Paid', 115, y);
          doc.text('Principal Paid', 145, y);
          doc.text('Total Repaid', 172, y);
          doc.line(15, y + 2, 195, y + 2);
          doc.setFont('Helvetica', 'normal');
          y += 8;
          filtered.forEach(r => {
            if (y > 280) { doc.addPage(); y = 20; }
            doc.text(formatDate(r.payment_date), 15, y);
            doc.text(r.customer_name, 40, y);
            doc.text(`Loan #${r.loan_id}`, 95, y);
            doc.text(formatCurrency(r.interest_paid), 115, y);
            doc.text(formatCurrency(r.principal_paid), 145, y);
            doc.text(formatCurrency(r.total_paid), 172, y);
            y += 7;
          });
        }
      }

      // Footer Cryptography signature block
      y = Math.min(270, y + 10);
      doc.setDrawColor(226, 232, 240);
      doc.line(15, y, 195, y);
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('FinCore System generated report statement containing multi-tenant cryptographic signatures.', 15, y + 4);

      if (action === 'print') {
        doc.autoPrint();
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');
        showSnackbar('Report opened in print window.', 'success');
      } else {
        const filename = `${title.toLowerCase().replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        showSnackbar(`PDF Report downloaded: ${filename}`, 'success');
      }
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to compile PDF document.', 'error');
    } finally {
      setExporting(null);
    }
  };

  // Compile and download CSV sheet
  const handleExportCSV = () => {
    setExporting('csv');
    try {
      const filtered = getFilteredData();
      let headers = [];
      let rows = [];
      let filename = '';

      if (selectedReport === 'customers') {
        headers = ['ID', 'Customer Name', 'Email', 'Mobile', 'Total Chits', 'Paid Amount', 'Pending Amount', 'Status'];
        rows = filtered.map(c => [c.id, c.name, c.email, c.mobile, c.total_chits, c.paid_amount, c.pending_amount, c.status]);
        filename = 'customers_ledger_report.csv';
      } else if (selectedReport === 'collections') {
        headers = ['Receipt No', 'Customer Name', 'Group ID', 'Amount', 'Payment Method', 'Payment Date', 'Collected By'];
        rows = filtered.map(c => [c.receipt_no, c.customer_name, c.chit_group_id, c.amount, c.payment_method, c.payment_date, c.collected_by]);
        filename = 'collections_audit_log.csv';
      } else if (selectedReport === 'disbursements') {
        headers = ['TXN Ref', 'Customer Name', 'Group ID', 'Amount', 'Payment Method', 'Payment Date', 'Payout Type'];
        rows = filtered.map(p => [p.transaction_ref, p.customer_name, p.chit_group_id, p.amount, p.payment_method, p.payment_date, p.type]);
        filename = 'disbursements_payout_log.csv';
      } else if (selectedReport === 'finance') {
        if (financeSubReport === 'active') {
          headers = ['ID', 'Borrower', 'Principal', 'Interest Rate', 'Interest Period', 'Lending Date', 'Days Elapsed', 'Accrued Interest', 'Paid Interest', 'Pending Interest', 'Remaining Principal'];
          rows = filtered.map(l => [l.id, l.customer_name, l.principal_amount, l.interest_rate, l.interest_type, l.loan_date, l.elapsedDays, l.accruedInterest, l.interestPaid, l.pendingInterest, l.remainingPrincipal]);
          filename = 'active_lending_ledger.csv';
        } else if (financeSubReport === 'closed') {
          headers = ['ID', 'Borrower', 'Principal', 'Interest Rate', 'Interest Period', 'Lending Date', 'Days Elapsed', 'Interest Paid', 'Closed Date'];
          rows = filtered.map(l => [l.id, l.customer_name, l.principal_amount, l.interest_rate, l.interest_type, l.loan_date, l.elapsedDays, l.interestPaid, l.closed_date]);
          filename = 'closed_lending_ledger.csv';
        } else {
          headers = ['ID', 'Date', 'Borrower', 'Loan ID', 'Interest Paid', 'Principal Paid', 'Total Paid', 'Payment Method', 'Transaction Ref', 'Notes'];
          rows = filtered.map(r => [r.id, r.payment_date, r.customer_name, r.loan_id, r.interest_paid, r.principal_paid, r.total_paid, r.payment_method, r.transaction_ref || '', r.notes || '']);
          filename = 'lending_repayments_ledger.csv';
        }
      }

      // Convert rows to CSV content
      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" // UTF-8 BOM
        + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSnackbar(`CSV Statement exported: ${filename}`, 'success');
    } catch (err) {
      console.error(err);
      showSnackbar('Error exporting CSV sheet.', 'error');
    } finally {
      setExporting(null);
    }
  };

  const filteredData = getFilteredData();

  const getReportColumns = () => {
    if (selectedReport === 'customers') {
      return [
        { id: 'id', label: 'ID', render: (row) => <span className="font-bold text-xs text-slate-500">#{row.id}</span> },
        { id: 'name', label: 'Customer Name', render: (row) => <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{row.name}</span> },
        { id: 'mobile', label: 'Mobile Contact', render: (row) => <span className="text-xs text-slate-500 font-semibold">{row.mobile}</span> },
        { id: 'paid_amount', label: 'Paid Capital', render: (row) => <span className="text-sm font-extrabold text-[#10B981]">{formatCurrency(row.paid_amount)}</span> },
        { id: 'pending_amount', label: 'Pending Dues', render: (row) => <span className="text-sm font-extrabold text-[#F59E0B]">{formatCurrency(row.pending_amount)}</span> },
        { id: 'status', label: 'Status', render: (row) => (
          <Chip 
            label={row.status} 
            size="small" 
            className={`font-semibold text-[10px] ${
              row.status === 'Paid' 
                ? 'bg-emerald-500/10 text-emerald-500' 
                : row.status === 'Pending' 
                ? 'bg-amber-500/10 text-amber-500' 
                : 'bg-red-500/10 text-red-500'
            }`}
          />
        ) }
      ];
    }

    if (selectedReport === 'collections') {
      return [
        { id: 'receipt_no', label: 'Receipt No', render: (row) => <span className="text-xs text-slate-500 font-bold">{row.receipt_no}</span> },
        { id: 'customer_name', label: 'Customer Name', render: (row) => <span className="font-bold text-slate-850 dark:text-white text-sm">{row.customer_name}</span> },
        { id: 'chit_group_id', label: 'Group ID', render: (row) => <span className="text-xs font-extrabold text-[#1E40AF]">{row.chit_group_id}</span> },
        { id: 'amount', label: 'Amount Paid', render: (row) => <span className="text-sm font-extrabold text-[#10B981]">{formatCurrency(row.amount)}</span> },
        { id: 'payment_method', label: 'Method', render: (row) => <span className="text-xs font-semibold">{row.payment_method}</span> },
        { id: 'payment_date', label: 'Payment Date', render: (row) => <span className="text-xs text-slate-500 font-medium">{formatDate(row.payment_date)}</span> },
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
    }

    if (selectedReport === 'disbursements') {
      return [
        { id: 'transaction_ref', label: 'TXN Ref', render: (row) => <span className="text-xs text-slate-500 font-bold">{row.transaction_ref}</span> },
        { id: 'customer_name', label: 'Customer Name', render: (row) => <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{row.customer_name}</span> },
        { id: 'chit_group_id', label: 'Group ID', render: (row) => <span className="text-xs font-extrabold text-slate-500">{row.chit_group_id}</span> },
        { id: 'amount', label: 'Amount Disbursed', render: (row) => <span className="text-sm font-extrabold text-[#1E40AF]">{formatCurrency(row.amount)}</span> },
        { id: 'payment_date', label: 'Date Paid', render: (row) => <span className="text-xs text-slate-500 font-medium">{formatDate(row.payment_date)}</span> },
        { id: 'type', label: 'Type', render: (row) => <span className="text-xs font-semibold">{row.type}</span> }
      ];
    }

    if (selectedReport === 'finance') {
      if (financeSubReport === 'active') {
        return [
          { id: 'id', label: 'ID', render: (row) => <span className="text-xs text-slate-500 font-bold">#{row.id}</span> },
          { id: 'customer_name', label: 'Borrower', render: (row) => <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{row.customer_name}</span> },
          { id: 'principal_amount', label: 'Principal', render: (row) => <span className="text-sm font-extrabold">{formatCurrency(row.principal_amount)}</span> },
          { id: 'interest_rate', label: 'Interest Rate', render: (row) => <span className="text-xs font-bold text-[#1E40AF]">{row.interest_rate}% {row.interest_type}</span> },
          { id: 'loan_date', label: 'Lending Date', render: (row) => <span className="text-xs text-slate-500 font-medium">{formatDate(row.loan_date)}</span> },
          { id: 'elapsedDays', label: 'Elapsed', render: (row) => <span className="text-xs font-semibold text-indigo-500">{row.elapsedDays} Days</span> },
          { id: 'pendingInterest', label: 'Pending Interest', render: (row) => <span className="text-sm font-extrabold text-[#F59E0B]">{formatCurrency(row.pendingInterest)}</span> },
          { id: 'remainingPrincipal', label: 'Remaining Principal', render: (row) => <span className="text-sm font-extrabold">{formatCurrency(row.remainingPrincipal)}</span> }
        ];
      }
      if (financeSubReport === 'closed') {
        return [
          { id: 'id', label: 'ID', render: (row) => <span className="text-xs text-slate-500 font-bold">#{row.id}</span> },
          { id: 'customer_name', label: 'Borrower', render: (row) => <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{row.customer_name}</span> },
          { id: 'principal_amount', label: 'Original Principal', render: (row) => <span className="text-sm font-extrabold">{formatCurrency(row.principal_amount)}</span> },
          { id: 'interest_rate', label: 'Interest Rate', render: (row) => <span className="text-xs font-semibold text-[#1E40AF]">{row.interest_rate}% {row.interest_type}</span> },
          { id: 'loan_date', label: 'Lending Date', render: (row) => <span className="text-xs text-slate-500 font-medium">{formatDate(row.loan_date)}</span> },
          { id: 'elapsedDays', label: 'Elapsed Days', render: (row) => <span className="text-xs font-semibold text-slate-500">{row.elapsedDays} Days</span> },
          { id: 'interestPaid', label: 'Interest Paid', render: (row) => <span className="text-sm font-extrabold text-[#10B981]">{formatCurrency(row.interestPaid)}</span> },
          { id: 'closed_date', label: 'Closed Date', render: (row) => <span className="text-xs text-slate-500 font-semibold">{formatDate(row.closed_date)}</span> }
        ];
      }
      if (financeSubReport === 'log') {
        return [
          { id: 'payment_date', label: 'Payment Date', render: (row) => <span className="text-xs text-slate-500 font-medium">{formatDate(row.payment_date)}</span> },
          { id: 'customer_name', label: 'Borrower', render: (row) => <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{row.customer_name}</span> },
          { id: 'loan_id', label: 'Loan ID', render: (row) => <span className="text-xs font-bold text-indigo-500">Loan #{row.loan_id}</span> },
          { id: 'interest_paid', label: 'Interest Paid', render: (row) => <span className="text-sm font-extrabold text-[#10B981]">{formatCurrency(row.interest_paid)}</span> },
          { id: 'principal_paid', label: 'Principal Paid', render: (row) => <span className="text-sm font-extrabold text-[#1E40AF]">{formatCurrency(row.principal_paid)}</span> },
          { id: 'total_paid', label: 'Total Paid', render: (row) => <span className="text-sm font-extrabold text-[#10B981]">{formatCurrency(row.total_paid)}</span> },
          { id: 'payment_method', label: 'Payment Method', render: (row) => (
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
          { id: 'notes', label: 'Notes', render: (row) => <span className="text-xs text-slate-500 italic max-w-xs truncate">{row.notes || '-'}</span> }
        ];
      }
    }
    return [];
  };

  const columns = getReportColumns();

  const isFinanceLog = selectedReport === 'finance' && financeSubReport === 'log';
  const searchWidth = isFinanceLog ? 2 : 3;
  const statusWidth = 3;
  const methodWidth = isFinanceLog ? 2 : 3;
  const financeTypeWidth = isFinanceLog ? 2 : 3;
  const dateWidth = isFinanceLog ? 2 : 2;
  const actionsWidth = isFinanceLog ? 2 : (selectedReport === 'customers' ? 6 : 2);

  return (
    <div className="space-y-6">

      {/* Grid: 4 Report Selecting Cards */}
      <Grid container spacing={3}>
        {[
          { id: 'customers', label: 'Customers Directory', desc: 'List of all customer directories, status, paid capital, and outstanding dues.', color: 'from-blue-500/10 to-blue-500/5', icon: <Description className="text-[#1E40AF]" />, border: 'border-blue-500/20' },
          { id: 'collections', label: 'Collections Ledger', desc: 'Audit trail of customer installment payments, methods, and receipt logs.', color: 'from-emerald-500/10 to-emerald-500/5', icon: <ReceiptLong className="text-[#10B981]" />, border: 'border-emerald-500/20' },
          { id: 'disbursements', label: 'Disbursements Payouts', desc: 'Registry of payouts, prize payouts, and dividend settlements distributed.', color: 'from-amber-500/10 to-amber-500/5', icon: <Assessment className="text-amber-500" />, border: 'border-amber-500/20' },
          { id: 'finance', label: 'Finance & Lending', desc: 'Details of active micro-loans (vatti), repayments ledger, and closed records.', color: 'from-purple-500/10 to-purple-500/5', icon: <MonetizationOn className="text-purple-500" />, border: 'border-purple-500/20' }
        ].map(card => {
          const isSelected = selectedReport === card.id;
          return (
            <Grid item xs={12} sm={6} md={3} key={card.id}>
              <div
                onClick={() => setSelectedReport(card.id)}
                className={`p-5 rounded-3xl cursor-pointer bg-gradient-to-tr ${card.color} border transition-[border-color,box-shadow,background-color] duration-200 h-[190px] flex flex-col justify-between hover:shadow-md ${
                  isSelected 
                    ? 'border-[#1E40AF] ring-2 ring-[#1E40AF]/20 shadow-sm' 
                    : `${card.border} border-slate-100 hover:border-slate-300 dark:hover:border-slate-700`
                }`}
              >
                <div>
                  <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
                    {card.icon}
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-white mt-3">{card.label}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    {card.desc}
                  </p>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-[#1E40AF] dark:text-[#3B82F6]">
                  <span>{isSelected ? 'ACTIVE VIEW' : 'SELECT REPORT'}</span>
                </div>
              </div>
            </Grid>
          );
        })}
      </Grid>

      {/* Reports Preview Container */}
      <div className="space-y-6">
        
        <Typography variant="subtitle1" className="font-extrabold text-slate-800 dark:text-white mb-6 uppercase tracking-wider text-xs border-b pb-3 border-slate-100 dark:border-slate-800">
          Report Preview: {
            selectedReport === 'customers' ? 'Customers Directory' :
            selectedReport === 'collections' ? 'Collections Ledger' :
            selectedReport === 'disbursements' ? 'Disbursements Register' : 'Finance & Lending Ledger'
          }
        </Typography>

        {/* Filters Grid */}
        <Grid container spacing={2} className="mb-6 items-center">
          
          {/* 1. Keyword search input */}
          <Grid item xs={12} sm={6} md={searchWidth}>
            <div className="space-y-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Search Parameter</span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Borrower, Customer, Ref..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-semibold text-xs"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fontSize="small" />
              </div>
            </div>
          </Grid>

          {/* 2. Specific Report-based dropdowns */}
          {selectedReport === 'customers' && (
            <Grid item xs={12} sm={6} md={statusWidth}>
              <div className="space-y-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Filter By Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent font-medium text-xs h-[36px]"
                >
                  <option value="All">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
            </Grid>
          )}

          {(selectedReport === 'collections' || selectedReport === 'disbursements' || (selectedReport === 'finance' && financeSubReport === 'log')) && (
            <Grid item xs={12} sm={6} md={methodWidth}>
              <div className="space-y-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Method</span>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent font-medium text-xs h-[36px]"
                >
                  <option value="All">All Methods</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
            </Grid>
          )}

          {selectedReport === 'finance' && (
            <Grid item xs={12} sm={6} md={financeTypeWidth}>
              <div className="space-y-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Finance Report Type</span>
                <select
                  value={financeSubReport}
                  onChange={(e) => setFinanceSubReport(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent font-medium text-xs h-[36px]"
                >
                  <option value="active">Active Lending Entries</option>
                  <option value="log">Interest Repayments Log</option>
                  <option value="closed">Closed Entries Ledger</option>
                </select>
              </div>
            </Grid>
          )}

          {/* 3. Date Filters (From/To) */}
          {selectedReport !== 'customers' && (
            <>
              <Grid item xs={6} sm={3} md={dateWidth}>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-semibold">From Date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent font-medium text-xs h-[36px]"
                  />
                </div>
              </Grid>
              <Grid item xs={6} sm={3} md={dateWidth}>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-semibold">To Date</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent font-medium text-xs h-[36px]"
                  />
                </div>
              </Grid>
            </>
          )}

          {/* 4. Actions: Download PDF, Print, CSV Export */}
          <Grid item xs={12} md={actionsWidth} className="flex gap-2 justify-end self-end mt-4 md:mt-0 ml-auto">
            <button
              onClick={() => generatePDFReport('download')}
              disabled={exporting !== null || loading}
              className="flex items-center justify-center gap-1.5 border border-[#1E40AF]/20 hover:border-[#1E40AF] text-[#1E40AF] dark:text-[#3B82F6] px-3.5 py-2 rounded-xl font-bold text-xs transition-colors bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-[36px]"
              title="Download PDF Ledger"
            >
              {exporting === 'download' ? <CircularProgress size={12} /> : <FileDownload fontSize="inherit" />}
              PDF
            </button>
            <button
              onClick={() => generatePDFReport('print')}
              disabled={exporting !== null || loading}
              className="flex items-center justify-center gap-1.5 border border-indigo-500/20 hover:border-indigo-500 text-indigo-500 px-3.5 py-2 rounded-xl font-bold text-xs transition-colors bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-[36px]"
              title="Print Document"
            >
              {exporting === 'print' ? <CircularProgress size={12} /> : <Print fontSize="inherit" />}
              Print
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting !== null || loading}
              className="flex items-center justify-center gap-1.5 border border-emerald-500/20 hover:border-emerald-500 text-emerald-500 px-3.5 py-2 rounded-xl font-bold text-xs transition-colors bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-[36px]"
              title="Export CSV Sheet"
            >
              {exporting === 'csv' ? <CircularProgress size={12} /> : <GridOn fontSize="inherit" />}
              CSV
            </button>
          </Grid>

        </Grid>

        {/* Loading / Preview Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[500px] py-16 gap-3">
            <CircularProgress size={40} className="text-[#1E40AF]" />
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Compiling Preview Data...</span>
          </div>
        ) : (
          <CustomGrid
            columns={columns}
            data={filteredData}
            keyField="id"
            showCheckboxes={true}
            initialRowsPerPage={13}
            emptyMessage="No matching records found."
          />
        )}
      </div>

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
