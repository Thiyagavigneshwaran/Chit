import React, { useState, useEffect, useContext } from 'react';
import { 
  Card, Grid, Typography, Button, IconButton, Dialog, 
  DialogTitle, DialogContent, DialogActions, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Paper, 
  CircularProgress, Alert, Snackbar, Chip
} from '@mui/material';
import { 
  Search, Add, MonetizationOn, History, CalendarMonth, 
  CheckCircle, Warning, AccountCircle, ReceiptLong, Close, Payment, Edit
} from '@mui/icons-material';
import axios from 'axios';
import { AuthContext } from '../App';
import CustomGrid from '../components/CustomGrid';

export default function FinancePage() {
  const { user } = useContext(AuthContext);
  
  // Data states
  const [loans, setLoans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('active'); // 'active', 'log', 'closed'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [openLendingModal, setOpenLendingModal] = useState(false);
  const [openRepaymentModal, setOpenRepaymentModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  
  // Form states - Lending
  const [newLending, setNewLending] = useState({
    customerId: '',
    principalAmount: '',
    interestRate: '3.00',
    interestType: 'Monthly',
    loanDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [editLending, setEditLending] = useState({
    id: '',
    customerId: '',
    principalAmount: '',
    interestRate: '',
    interestType: '',
    loanDate: '',
    notes: ''
  });
  
  // Form states - Repayment
  const [newRepayment, setNewRepayment] = useState({
    interestPaid: '',
    principalPaid: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'UPI',
    transactionRef: '',
    notes: '',
    closeLoan: false
  });
  
  // System states
  const [submitLoading, setSubmitLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };
  
  // Fetch customers and loans
  const fetchData = async () => {
    try {
      const [loansRes, customersRes] = await Promise.all([
        axios.get('/api/finance/loans'),
        axios.get('/api/customers')
      ]);
      setLoans(loansRes.data);
      setCustomers(customersRes.data);
    } catch (err) {
      console.error('Error fetching finance data:', err);
      showSnackbar('Failed to load finance ledger records.', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  
  // Submit new lending entry
  const handleCreateLending = async (e) => {
    e.preventDefault();
    if (!newLending.customerId || !newLending.principalAmount || !newLending.interestRate || !newLending.loanDate) {
      showSnackbar('Please fill in all required fields.', 'warning');
      return;
    }
    setSubmitLoading(true);
    try {
      const response = await axios.post('/api/finance/loans', newLending);
      showSnackbar(response.data.message || 'Lending entry created!', 'success');
      setOpenLendingModal(false);
      setNewLending({
        customerId: '',
        principalAmount: '',
        interestRate: '3.00',
        interestType: 'Monthly',
        loanDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
      await fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar(err.response?.data?.message || 'Failed to log lending entry.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOpenEdit = (loan) => {
    setEditLending({
      id: loan.id,
      customerId: loan.customer_id,
      principalAmount: parseFloat(loan.principal_amount).toFixed(2),
      interestRate: parseFloat(loan.interest_rate).toFixed(2),
      interestType: loan.interest_type,
      loanDate: loan.loan_date.split('T')[0],
      notes: loan.notes || ''
    });
    setOpenEditModal(true);
  };

  const handleUpdateLending = async (e) => {
    e.preventDefault();
    if (!editLending.customerId || !editLending.principalAmount || !editLending.interestRate || !editLending.loanDate) {
      showSnackbar('Please fill in all required fields.', 'warning');
      return;
    }
    setSubmitLoading(true);
    try {
      const response = await axios.put(`/api/finance/loans/${editLending.id}`, editLending);
      showSnackbar(response.data.message || 'Lending entry updated!', 'success');
      setOpenEditModal(false);
      await fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar(err.response?.data?.message || 'Failed to update lending entry.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };
  
  // Submit repayment
  const handleCreateRepayment = async (e) => {
    e.preventDefault();
    if (!selectedLoan) return;
    
    const interestVal = parseFloat(newRepayment.interestPaid) || 0;
    const principalVal = parseFloat(newRepayment.principalPaid) || 0;
    
    if (interestVal <= 0 && principalVal <= 0) {
      showSnackbar('Repayment amount must be greater than zero.', 'warning');
      return;
    }
    
    setSubmitLoading(true);
    try {
      const response = await axios.post(`/api/finance/loans/${selectedLoan.id}/repayments`, {
        interestPaid: interestVal,
        principalPaid: principalVal,
        paymentDate: newRepayment.paymentDate,
        paymentMethod: newRepayment.paymentMethod,
        transactionRef: newRepayment.transactionRef,
        notes: newRepayment.notes
      });
      
      showSnackbar(response.data.message || 'Repayment recorded!', 'success');
      setOpenRepaymentModal(false);
      setSelectedLoan(null);
      setNewRepayment({
        interestPaid: '',
        principalPaid: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'UPI',
        transactionRef: '',
        notes: '',
        closeLoan: false
      });
      await fetchData();
    } catch (err) {
      console.error(err);
      showSnackbar(err.response?.data?.message || 'Failed to record repayment.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };
  
  // Open repayment modal and initialize values
  const handleOpenRepayment = (loan, isCloseAction = false) => {
    setSelectedLoan(loan);
    const pendingInt = Math.max(0, parseFloat(loan.pendingInterest || 0));
    const remainingPrinc = Math.max(0, parseFloat(loan.remainingPrincipal || 0));
    
    if (isCloseAction) {
      setNewRepayment({
        interestPaid: pendingInt.toFixed(2),
        principalPaid: remainingPrinc.toFixed(2),
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'UPI',
        transactionRef: '',
        notes: 'Full repayment and loan closure.',
        closeLoan: true
      });
    } else {
      setNewRepayment({
        interestPaid: pendingInt.toFixed(2),
        principalPaid: '0.00',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'UPI',
        transactionRef: '',
        notes: '',
        closeLoan: false
      });
    }
    setOpenRepaymentModal(true);
  };
  
  // Filter lists based on search
  const filteredLoans = loans.filter(l => {
    const matchesSearch = l.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          l.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (activeSubTab === 'active') return l.status === 'Active';
    if (activeSubTab === 'closed') return l.status === 'Closed';
    return true; // for transaction logs we handle list separately
  });
  
  // Gather all repayments flat list for the logs sub-tab
  const getAllRepayments = () => {
    const all = [];
    loans.forEach(loan => {
      if (loan.repayments) {
        loan.repayments.forEach(rep => {
          all.push({
            ...rep,
            customer_name: loan.customer_name,
            interest_rate: loan.interest_rate,
            interest_type: loan.interest_type,
            loan_id: loan.id
          });
        });
      }
    });
    // Sort repayments by date descending
    return all.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
              .filter(r => r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || r.notes?.toLowerCase().includes(searchTerm.toLowerCase()));
  };
  
  const totalMoneyLent = loans
    .filter(l => l.status === 'Active')
    .reduce((sum, l) => sum + parseFloat(l.remainingPrincipal || 0), 0);
    
  const totalInterestCollected = loans
    .reduce((sum, l) => sum + parseFloat(l.interestPaid || 0), 0);
    
  const expectedMonthlyYield = loans
    .filter(l => l.status === 'Active')
    .reduce((sum, l) => {
      const princ = parseFloat(l.remainingPrincipal || 0);
      const rate = parseFloat(l.interest_rate || 0) / 100;
      if (l.interest_type === 'Monthly') {
        return sum + (princ * rate);
      } else if (l.interest_type === 'Weekly') {
        return sum + (princ * rate * 4.28); // average weeks in a month
      } else if (l.interest_type === 'Daily') {
        return sum + (princ * rate * 30); // 30 days in a month
      }
      return sum;
    }, 0);
    
  const activeLoansCount = loans.filter(l => l.status === 'Active').length;
  const closedLoansCount = loans.filter(l => l.status === 'Closed').length;
    
  const closedColumns = [
    { id: 'customer_name', label: 'Customer', render: (row) => <span className="font-bold text-slate-800 dark:text-white text-sm">{row.customer_name}</span> },
    { id: 'principal_amount', label: 'Original Principal', render: (row) => <span className="font-semibold text-sm">{formatCurrency(row.principal_amount)}</span> },
    { id: 'interest_rate', label: 'Interest Rate', render: (row) => <span className="text-xs font-semibold text-[#1E40AF]">{row.interest_rate}% {row.interest_type}</span> },
    { id: 'loan_date', label: 'Lending Date', render: (row) => <span className="text-xs text-slate-500 font-semibold">{formatDate(row.loan_date)}</span> },
    { id: 'elapsedDays', label: 'Days Elapsed', render: (row) => <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{row.elapsedDays} Days</span> },
    { id: 'interestPaid', label: 'Interest Paid', render: (row) => <span className="font-extrabold text-[#10B981] text-sm">{formatCurrency(row.interestPaid)}</span> },
    { id: 'closed_date', label: 'Closed Date', render: (row) => <span className="text-xs text-slate-500 font-semibold">{formatDate(row.closed_date || row.repayments?.[0]?.payment_date)}</span> },
    { id: 'status', label: 'Status', render: (row) => (
      <Chip 
        label="Fully Settled" 
        icon={<CheckCircle className="text-emerald-500" fontSize="inherit" />}
        size="small"
        className="bg-[#10B981]/15 text-[#10B981] font-bold border-[#10B981]/30"
      />
    ) }
  ];

  const logColumns = [
    { id: 'payment_date', label: 'Payment Date', render: (row) => (
      <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
        <CalendarMonth fontSize="inherit" />
        {formatDate(row.payment_date)}
      </div>
    ) },
    { id: 'customer_name', label: 'Customer Name', render: (row) => <span className="font-bold text-slate-800 dark:text-white text-sm">{row.customer_name}</span> },
    { id: 'loan_id', label: 'Loan ID', render: (row) => <span className="text-xs font-bold text-indigo-500">Loan #{row.loan_id}</span> },
    { id: 'interest_paid', label: 'Interest Paid', render: (row) => <span className="font-semibold text-sm text-[#10B981]">{formatCurrency(row.interest_paid)}</span> },
    { id: 'principal_paid', label: 'Principal Paid', render: (row) => <span className="font-semibold text-sm text-[#1E40AF]">{formatCurrency(row.principal_paid)}</span> },
    { id: 'total_paid', label: 'Total Paid', render: (row) => <span className="font-extrabold text-sm text-[#10B981]">{formatCurrency(row.total_paid)}</span> },
    { id: 'payment_method', label: 'Payment Method', render: (row) => (
      <div className="flex flex-col items-start gap-1">
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
        {row.transaction_ref && (
          <span className="text-[10px] text-slate-400 font-bold block">
            Ref: {row.transaction_ref}
          </span>
        )}
      </div>
    ) },
    { id: 'notes', label: 'Notes', render: (row) => <span className="text-xs text-slate-500 italic max-w-xs truncate">{row.notes || '-'}</span> }
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
          onClick={() => setOpenLendingModal(true)}
          className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md transition-all cursor-pointer"
        >
          New Lending Entry
        </Button>
      </div>

      {/* KPI Cards Row */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="p-5 bg-gradient-to-tr from-[#1E40AF]/10 to-[#1D4ED8]/5 border border-blue-500/20 rounded-3xl shadow-sm">
            <Typography variant="caption" className="text-slate-400 font-bold block mb-1">
              ACTIVE PRINCIPAL LENT
            </Typography>
            <div className="flex items-center gap-2">
              <MonetizationOn className="text-[#1E40AF]" />
              <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
                {formatCurrency(totalMoneyLent)}
              </Typography>
            </div>
            <Typography variant="caption" className="text-slate-400 block mt-2 font-medium">
              Across {activeLoansCount} active loans
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="p-5 bg-gradient-to-tr from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-3xl shadow-sm">
            <Typography variant="caption" className="text-slate-400 font-bold block mb-1">
              ESTIMATED MONTHLY YIELD
            </Typography>
            <div className="flex items-center gap-2">
              <MonetizationOn className="text-[#10B981]" />
              <Typography variant="h5" className="font-extrabold text-[#10B981]">
                {formatCurrency(expectedMonthlyYield)}
              </Typography>
            </div>
            <Typography variant="caption" className="text-slate-400 block mt-2 font-medium">
              Accruing from active rates
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="p-5 bg-gradient-to-tr from-indigo-500/10 to-violet-500/5 border border-indigo-500/20 rounded-3xl shadow-sm">
            <Typography variant="caption" className="text-slate-400 font-bold block mb-1">
              INTEREST COLLECTED
            </Typography>
            <div className="flex items-center gap-2">
              <Payment className="text-indigo-500" />
              <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
                {formatCurrency(totalInterestCollected)}
              </Typography>
            </div>
            <Typography variant="caption" className="text-slate-400 block mt-2 font-medium">
              Cumulative interest earnings
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="p-5 bg-gradient-to-tr from-slate-500/10 to-slate-400/5 border border-slate-500/20 rounded-3xl shadow-sm">
            <Typography variant="caption" className="text-slate-400 font-bold block mb-1">
              CLOSED LENDING ENTRIES
            </Typography>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-slate-500" />
              <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
                {closedLoansCount}
              </Typography>
            </div>
            <Typography variant="caption" className="text-slate-400 block mt-2 font-medium">
              Fully settled loan profiles
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Control and Lists Section */}
      <div className="space-y-4">
        
        {/* Navigation & Search row */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'active', label: 'Active Lending' },
              { id: 'log', label: 'Repayments Log' },
              { id: 'closed', label: 'Closed Entries' }
            ].map(tab => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#1E40AF] text-white shadow-sm shadow-[#1E40AF]/30'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative max-w-sm w-full md:w-[260px] self-end md:self-auto">
            <input
              type="text"
              placeholder="Search Customer or Notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-semibold text-xs"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" fontSize="small" />
          </div>
        </div>

        {/* Dynamic List Content */}
        {activeSubTab === 'active' && (
          <Grid container spacing={3}>
            {filteredLoans.length === 0 ? (
              <Grid item xs={12}>
                <div className="text-center text-slate-400 py-12 text-sm font-semibold">
                  No active lending entries found.
                </div>
              </Grid>
            ) : (
              filteredLoans.map(loan => (
                <Grid item xs={12} md={6} lg={4} key={loan.id}>
                  <div className="p-5 bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between h-full space-y-4 hover:border-[#1E40AF]/30 transition-all duration-300">
                    
                    {/* Customer Info Header */}
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1E40AF] to-[#10B981] flex items-center justify-center font-bold text-xs text-white">
                            {loan.customer_name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{loan.customer_name}</div>
                            <div className="text-[10px] text-slate-400 font-semibold">{loan.mobile}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Chip 
                            label={`${loan.interest_rate}% ${loan.interest_type}`}
                            size="small"
                            className="font-bold text-[9px] bg-blue-500/10 text-blue-500"
                          />
                          <IconButton 
                            size="small" 
                            onClick={() => handleOpenEdit(loan)} 
                            className="text-slate-400 hover:text-[#1E40AF] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full p-1"
                            title="Edit Lending Details"
                          >
                            <Edit fontSize="small" style={{ fontSize: '0.9rem' }} />
                          </IconButton>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                        <span className="text-slate-400">Lending Date:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{formatDate(loan.loan_date)}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs mt-2">
                        <span className="text-slate-400">Elapsed Duration:</span>
                        <span className="font-extrabold text-indigo-500">{loan.elapsedDays} Days</span>
                      </div>
                    </div>

                    {/* Monetary Parameters Grid */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3.5 grid grid-cols-2 gap-3 text-center border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Remaining Principal</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                          {formatCurrency(loan.remainingPrincipal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#F59E0B] font-bold block">Pending Interest</span>
                        <span className="font-extrabold text-[#F59E0B] text-sm">
                          {formatCurrency(loan.pendingInterest)}
                        </span>
                      </div>
                    </div>

                    {/* Cumulative details */}
                    <div className="space-y-1 text-xs px-1 text-slate-400 font-medium">
                      <div className="flex justify-between">
                        <span>Original Principal:</span>
                        <span>{formatCurrency(loan.principal_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Accrued Interest:</span>
                        <span>{formatCurrency(loan.accruedInterest)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Paid Interest so far:</span>
                        <span className="text-emerald-500">{formatCurrency(loan.interestPaid)}</span>
                      </div>
                    </div>

                    {loan.notes && (
                      <div className="text-[10px] italic text-slate-400 border-l-2 border-slate-300 dark:border-slate-700 pl-2 leading-relaxed">
                        Notes: {loan.notes}
                      </div>
                    )}

                    {/* CTA Buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleOpenRepayment(loan, false)}
                        className="flex-1 bg-slate-500 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Pay Interest
                      </button>
                      <button
                        onClick={() => handleOpenRepayment(loan, true)}
                        className="flex-1 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Repay & Close
                      </button>
                    </div>

                  </div>
                </Grid>
              ))
            )}
          </Grid>
        )}

        {activeSubTab === 'closed' && (
          <CustomGrid
            columns={closedColumns}
            data={filteredLoans}
            keyField="id"
            showCheckboxes={true}
            initialRowsPerPage={13}
            emptyMessage="No closed lending records found."
          />
        )}

        {activeSubTab === 'log' && (
          <CustomGrid
            columns={logColumns}
            data={getAllRepayments()}
            keyField="id"
            showCheckboxes={true}
            initialRowsPerPage={13}
            emptyMessage="No interest repayments recorded yet."
          />
        )}
      </div>

      {/* Dialog: Create Lending Entry */}
      <Dialog 
        open={openLendingModal} 
        onClose={() => setOpenLendingModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: 'rounded-3xl p-4' }}
      >
        <form onSubmit={handleCreateLending}>
          <DialogTitle className="font-extrabold text-slate-850 dark:text-white flex justify-between items-center pb-2">
            <span>New Lending Entry</span>
            <IconButton onClick={() => setOpenLendingModal(false)} size="small" className="text-slate-400 hover:text-slate-600">
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent className="space-y-4 pt-2">
            
            {/* Select Customer */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Borrower Customer *</label>
              <select
                value={newLending.customerId}
                onChange={(e) => setNewLending({ ...newLending, customerId: e.target.value })}
                required
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              >
                <option value="" className="text-slate-400 dark:text-slate-500">Select Borrower</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-850 dark:text-white bg-white dark:bg-[#1E293B]">
                    {c.name} (+91 {c.mobile})
                  </option>
                ))}
              </select>
            </div>

            {/* Principal Amount */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Principal Amount (₹) *</label>
              <input
                type="number"
                required
                placeholder="Enter amount"
                value={newLending.principalAmount}
                onChange={(e) => setNewLending({ ...newLending, principalAmount: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            {/* Interest Rate & Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Interest Rate (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 3.00"
                  value={newLending.interestRate}
                  onChange={(e) => setNewLending({ ...newLending, interestRate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Period *</label>
                <select
                  value={newLending.interestType}
                  onChange={(e) => setNewLending({ ...newLending, interestType: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                >
                  <option value="Daily" className="text-slate-850 dark:text-white bg-white dark:bg-[#1E293B]">Daily</option>
                  <option value="Weekly" className="text-slate-850 dark:text-white bg-white dark:bg-[#1E293B]">Weekly</option>
                  <option value="Monthly" className="text-slate-850 dark:text-white bg-white dark:bg-[#1E293B]">Monthly</option>
                </select>
              </div>
            </div>

            {/* Loan Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Lending Date *</label>
              <input
                type="date"
                required
                value={newLending.loanDate}
                onChange={(e) => setNewLending({ ...newLending, loanDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Notes / Security Details</label>
              <textarea
                rows={2}
                placeholder="e.g. Promissory note, security etc."
                value={newLending.notes}
                onChange={(e) => setNewLending({ ...newLending, notes: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>
            
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button 
              onClick={() => setOpenLendingModal(false)}
              className="text-slate-500 font-bold"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              variant="contained"
              disabled={submitLoading}
              className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold rounded-xl px-5 py-2 text-xs"
            >
              {submitLoading ? <CircularProgress size={16} className="text-white" /> : 'Log Entry'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog: Record Repayment */}
      <Dialog 
        open={openRepaymentModal} 
        onClose={() => setOpenRepaymentModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: 'rounded-3xl p-4' }}
      >
        {selectedLoan && (
          <form onSubmit={handleCreateRepayment}>
            <DialogTitle className="font-extrabold text-slate-855 dark:text-white flex justify-between items-center pb-2">
              <span>{newRepayment.closeLoan ? 'Repay & Close Loan' : 'Record Interest Payment'}</span>
              <IconButton onClick={() => setOpenRepaymentModal(false)} size="small" className="text-slate-400 hover:text-slate-600">
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent className="space-y-4 pt-2">
              
              {/* Dynamic calculations card */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loan Status Info</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block">Borrower:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{selectedLoan.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Interest Terms:</span>
                    <span className="font-bold text-indigo-500">{selectedLoan.interest_rate}% {selectedLoan.interest_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Outstanding Principal:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(selectedLoan.remainingPrincipal)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[#F59E0B]">Pending Interest:</span>
                    <span className="font-bold text-[#F59E0B]">{formatCurrency(selectedLoan.pendingInterest)}</span>
                  </div>
                </div>
              </div>

              {/* Interest Repayment */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Interest Payment Amount (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={newRepayment.interestPaid}
                  onChange={(e) => setNewRepayment({ ...newRepayment, interestPaid: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                />
              </div>

              {/* Principal Repayment */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Principal Payment Amount (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  disabled={!newRepayment.closeLoan}
                  value={newRepayment.principalPaid}
                  onChange={(e) => setNewRepayment({ ...newRepayment, principalPaid: e.target.value })}
                  className={`w-full px-4 py-2.5 border rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm ${
                    !newRepayment.closeLoan 
                      ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-550' 
                      : 'bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/80 text-slate-800'
                  }`}
                />
              </div>

              {/* Total Payment Amount */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Payment Amount (₹)</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={((parseFloat(newRepayment.interestPaid) || 0) + (parseFloat(newRepayment.principalPaid) || 0)).toFixed(2)}
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 font-extrabold text-sm"
                />
              </div>

              {/* Repayment Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={newRepayment.paymentDate}
                  onChange={(e) => setNewRepayment({ ...newRepayment, paymentDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Method *</label>
                <select
                  value={newRepayment.paymentMethod}
                  onChange={(e) => setNewRepayment({ ...newRepayment, paymentMethod: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                >
                  <option value="UPI" className="text-slate-850 dark:text-white bg-white dark:bg-[#1E293B]">UPI</option>
                  <option value="Cash" className="text-slate-850 dark:text-white bg-white dark:bg-[#1E293B]">Cash</option>
                  <option value="Bank Transfer" className="text-slate-850 dark:text-white bg-white dark:bg-[#1E293B]">Bank Transfer</option>
                </select>
              </div>

              {/* UPI Transaction Ref */}
              {newRepayment.paymentMethod === 'UPI' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">UPI Transaction Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter UPI transaction ID"
                    value={newRepayment.transactionRef}
                    onChange={(e) => setNewRepayment({ ...newRepayment, transactionRef: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Notes</label>
                <textarea
                  rows={2}
                  value={newRepayment.notes}
                  onChange={(e) => setNewRepayment({ ...newRepayment, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                />
              </div>

            </DialogContent>
            <DialogActions className="px-6 pb-4">
              <Button 
                onClick={() => setOpenRepaymentModal(false)}
                className="text-slate-500 font-bold"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                variant="contained"
                disabled={submitLoading}
                className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold rounded-xl px-5 py-2 text-xs"
              >
                {submitLoading ? <CircularProgress size={16} className="text-white" /> : 'Log Payment'}
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* Dialog: Edit Lending Entry */}
      <Dialog 
        open={openEditModal} 
        onClose={() => setOpenEditModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: 'rounded-3xl p-4' }}
      >
        <form onSubmit={handleUpdateLending}>
          <DialogTitle className="font-extrabold text-slate-850 dark:text-white flex justify-between items-center pb-2">
            <span>Edit Lending Entry</span>
            <IconButton onClick={() => setOpenEditModal(false)} size="small" className="text-slate-400 hover:text-slate-600">
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent className="space-y-4 pt-2">
            
            {/* Select Customer */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Borrower Customer *</label>
              <select
                value={editLending.customerId}
                onChange={(e) => setEditLending({ ...editLending, customerId: e.target.value })}
                required
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              >
                <option value="" className="text-slate-400 dark:text-slate-500">Select Borrower</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-855 dark:text-white bg-white dark:bg-[#1E293B]">
                    {c.name} (+91 {c.mobile})
                  </option>
                ))}
              </select>
            </div>

            {/* Principal Amount */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Principal Amount (₹) *</label>
              <input
                type="number"
                required
                placeholder="Enter amount"
                value={editLending.principalAmount}
                onChange={(e) => setEditLending({ ...editLending, principalAmount: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            {/* Interest Rate & Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Interest Rate (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 3.00"
                  value={editLending.interestRate}
                  onChange={(e) => setEditLending({ ...editLending, interestRate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Period *</label>
                <select
                  value={editLending.interestType}
                  onChange={(e) => setEditLending({ ...editLending, interestType: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                >
                  <option value="Daily" className="text-slate-855 dark:text-white bg-white dark:bg-[#1E293B]">Daily</option>
                  <option value="Weekly" className="text-slate-855 dark:text-white bg-white dark:bg-[#1E293B]">Weekly</option>
                  <option value="Monthly" className="text-slate-855 dark:text-white bg-white dark:bg-[#1E293B]">Monthly</option>
                </select>
              </div>
            </div>

            {/* Loan Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Lending Date *</label>
              <input
                type="date"
                required
                value={editLending.loanDate}
                onChange={(e) => setEditLending({ ...editLending, loanDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Notes / Security Details</label>
              <textarea
                rows={2}
                placeholder="e.g. Promissory note, security etc."
                value={editLending.notes}
                onChange={(e) => setEditLending({ ...editLending, notes: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>
            
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button 
              onClick={() => setOpenEditModal(false)}
              className="text-slate-500 font-bold"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              variant="contained"
              disabled={submitLoading}
              className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold rounded-xl px-5 py-2 text-xs"
            >
              {submitLoading ? <CircularProgress size={16} className="text-white" /> : 'Save Changes'}
            </Button>
          </DialogActions>
        </form>
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
