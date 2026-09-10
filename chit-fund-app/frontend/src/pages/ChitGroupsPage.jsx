import React, { useState, useEffect, useContext } from 'react';
import { Card, Grid, Typography, Chip, Button, IconButton, TextField, CircularProgress, Alert, Snackbar, Paper, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemAvatar, ListItemText, Avatar, Drawer, Switch, FormControlLabel, Autocomplete } from '@mui/material';
import { Add, Search, Groups, CalendarMonth, CurrencyExchange, Close, ArrowBack, CheckCircle } from '@mui/icons-material';
import axios from 'axios';
import { AuthContext } from '../App';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
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

const getBidTrendData = (group) => {
  if (!group || !group.installment_schedule) return [];
  try {
    const schedule = typeof group.installment_schedule === 'string'
      ? JSON.parse(group.installment_schedule)
      : group.installment_schedule;
    if (Array.isArray(schedule)) {
      return schedule.map((item, idx) => {
        const bidVal = item.bidAmount !== undefined ? parseFloat(item.bidAmount) : 0;
        return {
          month: `M${idx + 1}`,
          discount: bidVal
        };
      }).filter(item => item.discount > 0);
    }
  } catch (e) {
    console.error('Failed to parse bid trend data:', e);
  }
  return [];
};




export default function ChitGroupsPage() {
  const { searchSelectedGroupId, setSearchSelectedGroupId } = useContext(AuthContext);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState('list'); // 'list', 'create', 'edit', 'ledger'
  
  // Ledger View States
  const [ledgerGroup, setLedgerGroup] = useState(null);
  const [ledgerMembers, setLedgerMembers] = useState([]);
  const [ledgerAuctions, setLedgerAuctions] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    customerId: '',
    customerName: '',
    amount: '',
    paymentMethod: 'UPI',
    paymentDate: new Date().toISOString().split('T')[0]
  });
  const [guaranteeDialogOpen, setGuaranteeDialogOpen] = useState(false);
  const [guaranteeData, setGuaranteeData] = useState({
    customerId: '',
    customerName: '',
    guarantorName: '',
    guarantorMobile: ''
  });
  const [auctionDialogOpen, setAuctionDialogOpen] = useState(false);
  const [auctionData, setAuctionData] = useState({
    customerId: '',
    customerName: '',
    installmentNo: '',
    bidAmount: ''
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingGuarantee, setSavingGuarantee] = useState(false);
  const [savingAuction, setSavingAuction] = useState(false);
  
  // Create Modal Scheme Mode States
  const [createSchemeMode, setCreateSchemeMode] = useState('default'); // 'default' or 'custom'
  
  // Create Modal
  const [createStep, setCreateStep] = useState(1); // Step 1: Scheme Selector, Step 2: Details & Ledger
  const [newGroup, setNewGroup] = useState({ 
    id: '', 
    name: '', 
    value: '100000', 
    installments: '20', 
    monthlyContribution: '5000',
    firstDueDate: new Date().toISOString().split('T')[0]
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Enroll member states
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [openRegisterModal, setOpenRegisterModal] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: '', email: '', mobile: '' });
  const [registerLoading, setRegisterLoading] = useState(false);

  // Custom installment schedule states
  const [useCustomSchedule, setUseCustomSchedule] = useState(true); // Default to true since we have custom grid tables
  const [customSchedule, setCustomSchedule] = useState([]);

  // Saved templates states & helpers
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState([]);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('/api/chits/config/templates');
      setSavedTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleSelectCustomTemplate = (template) => {
    setCreateSchemeMode('custom');
    setUseCustomSchedule(true);
    
    const newStartDate = newGroup.firstDueDate || new Date().toISOString().split('T')[0];
    
    const updatedSchedule = template.installmentSchedule.map((row, idx) => {
      const d = new Date(newStartDate);
      d.setMonth(d.getMonth() + idx);
      return {
        ...row,
        dueDate: d.toISOString().split('T')[0]
      };
    });
    
    setNewGroup(prev => ({
      ...prev,
      value: template.value ? template.value.toString() : '',
      installments: template.installments ? template.installments.toString() : '',
      monthlyContribution: template.monthly_contribution ? template.monthly_contribution.toString() : (template.monthlyContribution ? template.monthlyContribution.toString() : '')
    }));
    
    setCustomSchedule(updatedSchedule);
    setCreateStep(2);
  };

  const handleSelectEditTemplate = (template) => {
    setEditSchemeMode('custom');
    setUseCustomEditSchedule(true);
    
    const newStartDate = editGroupData.firstDueDate || new Date().toISOString().split('T')[0];
    
    const updatedSchedule = template.installmentSchedule.map((row, idx) => {
      const d = new Date(newStartDate);
      d.setMonth(d.getMonth() + idx);
      return {
        ...row,
        dueDate: d.toISOString().split('T')[0]
      };
    });
    
    setEditGroupData(prev => ({
      ...prev,
      value: template.value ? template.value.toString() : '',
      installments: template.installments ? template.installments.toString() : '',
      monthlyContribution: template.monthly_contribution ? template.monthly_contribution.toString() : (template.monthlyContribution ? template.monthlyContribution.toString() : '')
    }));
    
    setCustomEditSchedule(updatedSchedule);
    setEditStep(2);
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      await axios.delete(`/api/chits/config/templates/${templateId}`);
      showSnackbar('Template deleted successfully.', 'info');
      fetchTemplates();
    } catch (err) {
      showSnackbar('Failed to delete template.', 'error');
    }
  };

  // Edit Modal States
  const [editStep, setEditStep] = useState(1); // Step 1: Scheme Selector, Step 2: Details & Ledger
  const [editSchemeMode, setEditSchemeMode] = useState('default'); // 'default' or 'custom'
  const [editGroupData, setEditGroupData] = useState({ 
    id: '', 
    name: '', 
    value: '', 
    installments: '', 
    monthlyContribution: '', 
    status: 'Active',
    firstDueDate: new Date().toISOString().split('T')[0]
  });
  const [useCustomEditSchedule, setUseCustomEditSchedule] = useState(true);
  const [customEditSchedule, setCustomEditSchedule] = useState([]);

  // Create Modal schedule generation
  useEffect(() => {
    if (createSchemeMode === 'custom') {
      if (useCustomSchedule) {
        const count = parseInt(newGroup.installments) || 0;
        const totalVal = parseFloat(newGroup.value) || 0;
        if (count > 0 && totalVal > 0) {
          // If customSchedule length doesn't match count, regenerate default uniform rows
          if (customSchedule.length !== count) {
            const defaultVal = Math.floor(totalVal / count);
            const remainder = totalVal - (defaultVal * count);
            const next = Array.from({ length: count }, (_, i) => {
              const amountVal = i === count - 1 ? defaultVal + remainder : defaultVal;
              const d = new Date(newGroup.firstDueDate || new Date());
              d.setMonth(d.getMonth() + i);
              return {
                month: i + 1,
                actualAmount: amountVal,
                payingAmount: amountVal,
                amount: amountVal,
                bidAmount: 0,
                repaymentAmount: 0,
                dueDate: d.toISOString().split('T')[0]
              };
            });
            setCustomSchedule(next);
          }
        } else {
          setCustomSchedule([]);
        }
      } else {
        setCustomSchedule([]);
      }
    }
  }, [createSchemeMode, newGroup.firstDueDate, useCustomSchedule, newGroup.installments, newGroup.value]);

  // Edit Modal schedule generation
  useEffect(() => {
    if (editSchemeMode === 'custom') {
      if (useCustomEditSchedule) {
        const count = parseInt(editGroupData.installments) || 0;
        const totalVal = parseFloat(editGroupData.value) || 0;
        if (count > 0 && totalVal > 0) {
          if (customEditSchedule.length !== count) {
            const defaultVal = Math.floor(totalVal / count);
            const remainder = totalVal - (defaultVal * count);
            const next = Array.from({ length: count }, (_, i) => {
              const amountVal = i === count - 1 ? defaultVal + remainder : defaultVal;
              const d = new Date(editGroupData.firstDueDate || new Date());
              d.setMonth(d.getMonth() + i);
              return {
                month: i + 1,
                actualAmount: amountVal,
                payingAmount: amountVal,
                amount: amountVal,
                bidAmount: 0,
                repaymentAmount: 0,
                dueDate: d.toISOString().split('T')[0]
              };
            });
            setCustomEditSchedule(next);
          }
        } else {
          setCustomEditSchedule([]);
        }
      } else {
        setCustomEditSchedule([]);
      }
    }
  }, [editSchemeMode, editGroupData.firstDueDate, useCustomEditSchedule, editGroupData.installments, editGroupData.value]);

  const customSum = customSchedule.reduce((sum, item) => sum + (parseFloat(item.payingAmount || item.amount) || 0), 0);
  const totalValueNum = parseFloat(newGroup.value) || 0;

  const customEditSum = customEditSchedule.reduce((sum, item) => sum + (parseFloat(item.payingAmount || item.amount) || 0), 0);
  const editTotalValueNum = parseFloat(editGroupData.value) || 0;

  const handleUpdateRow = (idx, field, value) => {
    const nextSchedule = [...customSchedule];
    nextSchedule[idx] = { ...nextSchedule[idx], [field]: value };
    if (field === 'payingAmount') {
      nextSchedule[idx].amount = value; // Keep compatibility
    }
    setCustomSchedule(nextSchedule);
  };

  const handleUpdateEditRow = (idx, field, value) => {
    const nextSchedule = [...customEditSchedule];
    nextSchedule[idx] = { ...nextSchedule[idx], [field]: value };
    if (field === 'payingAmount') {
      nextSchedule[idx].amount = value; // Keep compatibility
    }
    setCustomEditSchedule(nextSchedule);
  };

  const handleOpenLedgerView = async (group) => {
    setDrawerOpen(false);
    setLedgerLoading(true);
    setActiveView('ledger');
    try {
      const res = await axios.get(`/api/chits/${group.id}`);
      setLedgerGroup(res.data.group);
      setLedgerMembers(res.data.members || []);
      setLedgerAuctions(res.data.auctions || []);
    } catch (err) {
      showSnackbar('Failed to load ledger details.', 'error');
      setActiveView('list');
    } finally {
      setLedgerLoading(false);
    }
  };

  const refreshLedger = async (groupId) => {
    try {
      const res = await axios.get(`/api/chits/${groupId}`);
      setLedgerGroup(res.data.group);
      setLedgerMembers(res.data.members || []);
      setLedgerAuctions(res.data.auctions || []);
    } catch (err) {
      console.error('Failed to refresh ledger:', err);
    }
  };

  const isInstallmentPaid = (member, installmentIdx) => {
    let schedule = [];
    if (ledgerGroup && ledgerGroup.installment_schedule) {
      try {
        schedule = typeof ledgerGroup.installment_schedule === 'string'
          ? JSON.parse(ledgerGroup.installment_schedule)
          : ledgerGroup.installment_schedule;
      } catch (e) {
        console.error('Failed to parse schedule:', e);
      }
    }
    
    const count = ledgerGroup ? parseInt(ledgerGroup.installments) || 0 : 0;
    const monthly = ledgerGroup ? parseFloat(ledgerGroup.monthly_contribution) || 0 : 0;

    if (!Array.isArray(schedule) || schedule.length === 0) {
      const totalPaid = parseFloat(member.total_paid) || 0;
      const requiredAmount = monthly * (installmentIdx + 1);
      return totalPaid >= requiredAmount;
    }
    
    let requiredAmount = 0;
    for (let i = 0; i <= installmentIdx; i++) {
      const row = schedule[i];
      const amt = row ? (parseFloat(row.payingAmount || row.amount || row) || 0) : 0;
      requiredAmount += amt;
    }
    
    const totalPaid = parseFloat(member.total_paid) || 0;
    return totalPaid >= requiredAmount;
  };

  const getLedgerSchedule = () => {
    let schedule = [];
    if (ledgerGroup && ledgerGroup.installment_schedule) {
      try {
        schedule = typeof ledgerGroup.installment_schedule === 'string'
          ? JSON.parse(ledgerGroup.installment_schedule)
          : ledgerGroup.installment_schedule;
      } catch (e) {
        console.error('Failed to parse schedule:', e);
      }
    }
    const count = ledgerGroup ? parseInt(ledgerGroup.installments) || 0 : 0;
    const monthly = ledgerGroup ? parseFloat(ledgerGroup.monthly_contribution) || 0 : 0;
    
    if (!Array.isArray(schedule) || schedule.length !== count) {
      schedule = Array.from({ length: count }, (_, i) => {
        const d = new Date(ledgerGroup.firstDueDate || new Date());
        d.setMonth(d.getMonth() + i);
        return {
          month: i + 1,
          payingAmount: monthly,
          dueDate: d.toISOString().split('T')[0]
        };
      });
    }
    return schedule;
  };

  const handleCheckboxClick = (member, instIdx, isPaid, instAmount, instDueDate) => {
    if (isPaid) {
      showSnackbar(`${member.name} has already paid up to this installment. To modify payments, use the Collections page or manual payment history.`, 'info');
    } else {
      setPaymentData({
        customerId: member.id.toString(),
        customerName: member.name,
        amount: instAmount.toString(),
        paymentMethod: 'UPI',
        paymentDate: instDueDate || new Date().toISOString().split('T')[0]
      });
      setPaymentDialogOpen(true);
    }
  };

  const handleOpenManualPayment = (member) => {
    setPaymentData({
      customerId: member.id.toString(),
      customerName: member.name,
      amount: '',
      paymentMethod: 'UPI',
      paymentDate: new Date().toISOString().split('T')[0]
    });
    setPaymentDialogOpen(true);
  };

  const handleOpenGuaranteeDialog = (member) => {
    setGuaranteeData({
      customerId: member.id.toString(),
      customerName: member.name,
      guarantorName: member.guarantor_name || '',
      guarantorMobile: member.guarantor_mobile || ''
    });
    setGuaranteeDialogOpen(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!paymentData.customerId || !paymentData.amount || !paymentData.paymentMethod) {
      showSnackbar('Please fill in all fields.', 'warning');
      return;
    }
    setSavingPayment(true);
    try {
      const payload = {
        customerId: parseInt(paymentData.customerId),
        chitGroupId: ledgerGroup.id,
        amount: parseFloat(paymentData.amount),
        paymentMethod: paymentData.paymentMethod,
        paymentDate: paymentData.paymentDate
      };
      await axios.post('/api/collections', payload);
      showSnackbar('Payment entry recorded successfully!', 'success');
      setPaymentDialogOpen(false);
      await refreshLedger(ledgerGroup.id);
      fetchGroups();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to record payment.', 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSaveGuarantee = async (e) => {
    e.preventDefault();
    if (!guaranteeData.customerId || !guaranteeData.guarantorName || !guaranteeData.guarantorMobile) {
      showSnackbar('Please fill in all fields.', 'warning');
      return;
    }
    setSavingGuarantee(true);
    try {
      const payload = {
        customerId: parseInt(guaranteeData.customerId),
        guarantorName: guaranteeData.guarantorName,
        guarantorMobile: guaranteeData.guarantorMobile
      };
      await axios.post(`/api/chits/${ledgerGroup.id}/guarantee`, payload);
      showSnackbar('Guarantor details saved successfully!', 'success');
      setGuaranteeDialogOpen(false);
      await refreshLedger(ledgerGroup.id);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save guarantor details.', 'error');
    } finally {
      setSavingGuarantee(false);
    }
  };

  const handleOpenAuctionDialog = (member) => {
    const totalInstallments = ledgerGroup ? parseInt(ledgerGroup.installments) || 0 : 0;
    const wonMonths = ledgerAuctions.map(a => a.installment_no);
    let nextMonth = '';
    for (let i = 1; i <= totalInstallments; i++) {
      if (!wonMonths.includes(i)) {
        nextMonth = i.toString();
        break;
      }
    }

    setAuctionData({
      customerId: member.id.toString(),
      customerName: member.name,
      installmentNo: nextMonth,
      bidAmount: ''
    });
    setAuctionDialogOpen(true);
  };

  const handleSaveAuction = async (e) => {
    e.preventDefault();
    if (!auctionData.customerId || !auctionData.installmentNo || !auctionData.bidAmount) {
      showSnackbar('Please fill in all fields.', 'warning');
      return;
    }
    setSavingAuction(true);
    try {
      const payload = {
        chitGroupId: ledgerGroup.id,
        installmentNo: parseInt(auctionData.installmentNo),
        winningBidderId: parseInt(auctionData.customerId),
        bidAmount: parseFloat(auctionData.bidAmount)
      };
      await axios.post('/api/auctions', payload);
      showSnackbar(`Auction for Month ${auctionData.installmentNo} recorded successfully!`, 'success');
      setAuctionDialogOpen(false);
      await refreshLedger(ledgerGroup.id);
      fetchGroups();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to record auction details.', 'error');
    } finally {
      setSavingAuction(false);
    }
  };

  const handleCloseModal = () => {
    setActiveView('list');
    setNewGroup({ 
      id: '', 
      name: '', 
      value: '100000', 
      installments: '20', 
      monthlyContribution: '5000',
      firstDueDate: new Date().toISOString().split('T')[0]
    });
    setCreateSchemeMode('default');
    setUseCustomSchedule(true);
    setCustomSchedule([]);
    setCreateStep(1);
  };

  const handleCloseEditModal = () => {
    setActiveView('list');
    setEditGroupData({ 
      id: '', 
      name: '', 
      value: '', 
      installments: '', 
      monthlyContribution: '', 
      status: 'Active',
      firstDueDate: new Date().toISOString().split('T')[0]
    });
    setEditSchemeMode('custom');
    setUseCustomEditSchedule(true);
    setCustomEditSchedule([]);
    setEditStep(1);
  };

  const handleOpenEditModal = (group) => {
    let parsedSchedule = null;
    if (group.installment_schedule) {
      try {
        parsedSchedule = typeof group.installment_schedule === 'string'
          ? JSON.parse(group.installment_schedule)
          : group.installment_schedule;
      } catch (e) {
        console.error('Failed to parse schedule:', e);
      }
    }

    let detectedFirstDueDate = new Date().toISOString().split('T')[0];
    if (parsedSchedule && parsedSchedule.length > 0) {
      if (typeof parsedSchedule[0] === 'object' && parsedSchedule[0].dueDate) {
        detectedFirstDueDate = parsedSchedule[0].dueDate;
      }
    }

    setEditGroupData({
      id: group.id,
      name: group.name,
      value: group.value.toString(),
      installments: group.installments.toString(),
      monthlyContribution: group.monthly_contribution.toString(),
      status: group.status,
      firstDueDate: detectedFirstDueDate
    });

    setEditSchemeMode('custom');
    setUseCustomEditSchedule(!!(parsedSchedule && parsedSchedule.length > 0));

    if (parsedSchedule && parsedSchedule.length > 0) {
      const mapped = parsedSchedule.map((item, idx) => {
        const d = new Date(detectedFirstDueDate);
        d.setMonth(d.getMonth() + idx);
        
        const actVal = item.actualAmount !== undefined ? item.actualAmount : (item.amount || item);
        const payVal = item.payingAmount !== undefined ? item.payingAmount : (item.amount || item);
        const bidVal = item.bidAmount !== undefined ? item.bidAmount : 0;
        const repayVal = item.repaymentAmount !== undefined ? item.repaymentAmount : 0;

        return {
          month: idx + 1,
          actualAmount: parseFloat(actVal),
          payingAmount: parseFloat(payVal),
          amount: parseFloat(payVal),
          bidAmount: parseFloat(bidVal),
          repaymentAmount: parseFloat(repayVal),
          dueDate: item.dueDate || d.toISOString().split('T')[0]
        };
      });
      setCustomEditSchedule(mapped);
    } else {
      setCustomEditSchedule([]);
    }

    setEditStep(1);
    setDrawerOpen(false);
    setActiveView('edit');
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editGroupData.name || !editGroupData.value || !editGroupData.installments || !editGroupData.monthlyContribution) {
      showSnackbar('Please fill in all fields.', 'warning');
      return;
    }
    setSubmitLoading(true);

    const tenure = parseInt(editGroupData.installments) || 0;
    const value = parseFloat(editGroupData.value) || 0;
    const startD = editGroupData.firstDueDate || new Date().toISOString().split('T')[0];

    const generatedEditSchedule = [];
    if (tenure > 0) {
      const defaultVal = Math.floor(value / tenure);
      const remainder = value - (defaultVal * tenure);
      for (let i = 0; i < tenure; i++) {
        const d = new Date(startD);
        d.setMonth(d.getMonth() + i);
        generatedEditSchedule.push({
          month: i + 1,
          actualAmount: defaultVal,
          payingAmount: i === tenure - 1 ? defaultVal + remainder : defaultVal,
          amount: i === tenure - 1 ? defaultVal + remainder : defaultVal,
          bidAmount: 0,
          repaymentAmount: 0,
          dueDate: d.toISOString().split('T')[0]
        });
      }
    }

    try {
      const payload = {
        name: editGroupData.name,
        value: editGroupData.value,
        installments: editGroupData.installments,
        monthlyContribution: editGroupData.monthlyContribution,
        status: editGroupData.status,
        installmentSchedule: useCustomEditSchedule ? customEditSchedule : generatedEditSchedule
      };
      await axios.put(`/api/chits/${editGroupData.id}`, payload);
      showSnackbar('Chit Group updated successfully!', 'success');
      handleCloseEditModal();
      
      // Reload catalog list
      await fetchGroups();
      
      // Update selected group in drawer if open
      setSelectedGroup(prev => prev ? { ...prev, ...payload, monthly_contribution: payload.monthlyContribution, installment_schedule: payload.installmentSchedule } : null);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to update group.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/customers');
      setCustomers(response.data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get('/api/chits');
      setGroups(response.data);
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to load chit groups.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchCustomers();
    fetchTemplates();
  }, []);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleViewGroupDetails = async (group) => {
    setSelectedGroup(group);
    setDrawerOpen(true);
    setMembersLoading(true);
    try {
      const response = await axios.get(`/api/chits/${group.id}`);
      setMembers(response.data.members || []);
    } catch (err) {
      showSnackbar('Failed to fetch group members.', 'error');
    } finally {
      setMembersLoading(false);
    }
  };

  const handleEnrollMember = async () => {
    if (!selectedGroup || !selectedCustomerId) return;
    setEnrollLoading(true);
    try {
      const response = await axios.post(`/api/chits/${selectedGroup.id}/members`, {
        customerId: parseInt(selectedCustomerId)
      });
      showSnackbar(response.data.message || 'Member added successfully!', 'success');
      setSelectedCustomerId('');
      // Reload members list in overlay
      await handleViewGroupDetails(selectedGroup);
      // Refresh groups catalog to update members counts
      fetchGroups();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to add member.', 'error');
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleRegisterAndEnroll = async (e) => {
    e.preventDefault();
    if (!newCustomerData.name || !newCustomerData.mobile) {
      showSnackbar('Please fill in all registration fields.', 'warning');
      return;
    }
    setRegisterLoading(true);
    try {
      const response = await axios.post('/api/customers', {
        ...newCustomerData,
        chitGroupId: selectedGroup.id
      });
      showSnackbar(response.data.message || 'Customer registered and enrolled successfully!', 'success');
      setOpenRegisterModal(false);
      setNewCustomerData({ name: '', email: '', mobile: '' });
      
      // Refresh customer list & group details in sidebar
      await fetchCustomers();
      await handleViewGroupDetails(selectedGroup);
      await fetchGroups(); // update counts
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to register and enroll customer.', 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  // React to search selections
  useEffect(() => {
    if (groups.length > 0 && searchSelectedGroupId) {
      const matchedGroup = groups.find(g => g.id === searchSelectedGroupId);
      if (matchedGroup) {
        handleViewGroupDetails(matchedGroup);
        setSearchSelectedGroupId(null); // Clear trigger
      }
    }
  }, [groups, searchSelectedGroupId]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroup.id || !newGroup.name || !newGroup.value || !newGroup.installments || !newGroup.monthlyContribution) {
      showSnackbar('Please fill in all fields.', 'warning');
      return;
    }
    setSubmitLoading(true);

    const tenure = parseInt(newGroup.installments) || 0;
    const value = parseFloat(newGroup.value) || 0;
    const startD = newGroup.firstDueDate || new Date().toISOString().split('T')[0];

    const generatedSchedule = [];
    if (tenure > 0) {
      const defaultVal = Math.floor(value / tenure);
      const remainder = value - (defaultVal * tenure);
      for (let i = 0; i < tenure; i++) {
        const d = new Date(startD);
        d.setMonth(d.getMonth() + i);
        generatedSchedule.push({
          month: i + 1,
          actualAmount: defaultVal,
          payingAmount: i === tenure - 1 ? defaultVal + remainder : defaultVal,
          amount: i === tenure - 1 ? defaultVal + remainder : defaultVal,
          bidAmount: 0,
          repaymentAmount: 0,
          dueDate: d.toISOString().split('T')[0]
        });
      }
    }

    try {
      const scheduleToSave = useCustomSchedule ? customSchedule : generatedSchedule;
      const payload = {
        ...newGroup,
        installmentSchedule: scheduleToSave
      };
      await axios.post('/api/chits', payload);

      // Save custom template to database if selected
      if (saveAsTemplate) {
        try {
          await axios.post('/api/chits/config/templates', {
            name: newGroup.name, // Save template under group name
            value: newGroup.value,
            installments: newGroup.installments,
            monthlyContribution: newGroup.monthlyContribution,
            installmentSchedule: scheduleToSave
          });
          fetchTemplates();
        } catch (templateErr) {
          console.error('Failed to save template to database:', templateErr);
        }
      }

      showSnackbar('Chit Group created successfully!', 'success');
      setSaveAsTemplate(false); // Reset checkbox state
      handleCloseModal();
      fetchGroups();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to create group.', 'error');
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

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <CircularProgress size={60} className="text-[#1E40AF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeView === 'list' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
        <div>
          <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
            Chit Groups Catalog
          </Typography>
          <Typography variant="caption" className="text-slate-400 block mt-0.5">
            Configure financial pools, audit active enrollment, and register new groups.
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setCreateStep(1);
            setActiveView('create');
          }}
          className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold py-2.5 px-4 rounded-xl text-xs"
        >
          Create New Group
        </Button>
      </div>

      {/* Search Filter */}
      <Card className="p-4 bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-800">
        <TextField
          placeholder="Search by group ID or group name..."
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-slate-50 dark:bg-slate-800 rounded-xl max-w-md w-full"
          InputProps={{
            startAdornment: (
              <Search className="text-slate-400 mr-2" fontSize="small" />
            ),
            className: 'rounded-xl',
          }}
        />
      </Card>

      {/* Groups Grid */}
      <Grid container spacing={3}>
        {filteredGroups.length === 0 ? (
          <Grid item xs={12} className="text-center text-slate-400 py-12">
            No active chit groups match your search.
          </Grid>
        ) : (
          filteredGroups.map(g => (
            <Grid item xs={12} sm={6} md={4} key={g.id}>
              <Paper 
                elevation={0}
                className="p-5 rounded-3xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-[#1E293B] hover:shadow-lg transition-all duration-200 cursor-pointer"
                onClick={() => handleViewGroupDetails(g)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold text-[#1E40AF] tracking-wide bg-blue-500/10 px-2.5 py-1 rounded-full dark:text-[#3B82F6]">{g.id}</span>
                    <h3 className="font-extrabold text-lg text-slate-800 dark:text-white mt-2">{g.name}</h3>
                  </div>
                  <Chip 
                    label={g.status} 
                    size="small" 
                    className={g.status === 'Active' ? 'bg-[#10B981]/15 text-[#10B981] font-bold text-[10px]' : 'bg-slate-500/15 text-slate-500 font-bold text-[10px]'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Chit Value</span>
                    <span className="font-extrabold text-sm text-slate-700 dark:text-slate-200">{formatCurrency(g.value)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Contribution</span>
                    <span className="font-extrabold text-sm text-[#10B981]">{formatCurrency(getCurrentContribution(g))} / member</span>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-1">
                    <Groups fontSize="inherit" className="text-[#1E40AF]" />
                    <span>{g.active_members} / {g.installments} Members</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CalendarMonth fontSize="inherit" />
                    <span>{g.installments} Installments</span>
                  </div>
                </div>
              </Paper>
            </Grid>
          ))
        )}
      </Grid>

      {/* Inspect Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          className: 'w-full sm:w-[500px] p-6 bg-white dark:bg-[#0F172A] border-l border-slate-100 dark:border-slate-800'
        }}
        sx={{ zIndex: 1300 }}
      >
        {selectedGroup && (
          <div className="space-y-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
                <div>
                  <span className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-widest">{selectedGroup.id}</span>
                  <Typography variant="h6" className="font-extrabold text-white" style={{ color: '#ffffff' }}>{selectedGroup.name}</Typography>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    onClick={() => handleOpenLedgerView(selectedGroup)}
                    variant="contained"
                    size="small"
                    className="bg-[#10B981] hover:bg-[#059669] text-white font-bold px-3 py-1.5 rounded-xl text-[10px] h-[30px] shadow-sm shadow-emerald-500/20"
                    style={{ textTransform: 'none' }}
                  >
                    View Ledger
                  </Button>
                  <Button
                    onClick={() => handleOpenEditModal(selectedGroup)}
                    variant="outlined"
                    size="small"
                    className="border-[#3B82F6] text-[#3B82F6] hover:bg-[#3B82F6]/10 font-bold px-3 py-1.5 rounded-xl text-[10px] h-[30px]"
                    style={{ color: '#3B82F6', borderColor: '#3B82F6', textTransform: 'none' }}
                  >
                    Edit
                  </Button>
                  <IconButton onClick={() => setDrawerOpen(false)} size="small" className="text-slate-300 hover:text-white">
                    <Close style={{ color: '#CBD5E1' }} />
                  </IconButton>
                </div>
              </div>

              <div className="my-6 space-y-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Pool Value:</span>
                  <span className="font-bold text-slate-700 dark:text-white">{formatCurrency(selectedGroup.value)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Contribution per Member:</span>
                  <span className="font-bold text-[#10B981]">{formatCurrency(getCurrentContribution(selectedGroup))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Tenure:</span>
                  <span className="font-bold text-slate-700 dark:text-white">{selectedGroup.installments} Months</span>
                </div>
              </div>

              {/* Bid Discount Trend Chart */}
              {(() => {
                const chartData = getBidTrendData(selectedGroup);
                if (chartData.length > 0) {
                  return (
                    <div className="mb-6 space-y-2 p-4 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                      <Typography variant="subtitle2" className="text-slate-400 uppercase tracking-widest font-black text-[10px]">
                        Bidding Discount Trend
                      </Typography>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                            <XAxis dataKey="month" stroke="#94A3B8" fontSize={9} />
                            <YAxis stroke="#94A3B8" fontSize={9} tickFormatter={(val) => `₹${val}`} />
                            <ChartTooltip 
                              formatter={(val) => [formatCurrency(val), 'Bid Discount']}
                              contentStyle={{ borderRadius: 12, border: 'none', backgroundColor: '#0F172A', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontSize: '10px' }}
                            />
                            <Line type="monotone" dataKey="discount" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Installment Breakdown display */}
              {(() => {
                let parsedSchedule = null;
                if (selectedGroup.installment_schedule) {
                  try {
                    parsedSchedule = typeof selectedGroup.installment_schedule === 'string'
                      ? JSON.parse(selectedGroup.installment_schedule)
                      : selectedGroup.installment_schedule;
                  } catch (e) {
                    console.error('Failed to parse installment schedule:', e);
                  }
                }
                return parsedSchedule && parsedSchedule.length > 0 ? (
                  <div className="mb-6 space-y-2">
                    <Typography variant="subtitle2" className="text-slate-400 uppercase tracking-widest font-semibold text-xs">
                      Installment Schedule
                    </Typography>
                    <div className="overflow-x-auto bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 max-h-64 overflow-y-auto pr-1">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60">
                            <th className="p-2 font-bold text-slate-500 text-center">Month</th>
                            <th className="p-2 font-bold text-slate-500 text-right">Actual</th>
                            <th className="p-2 font-bold text-slate-500 text-right text-[#10B981]">Paying</th>
                            <th className="p-2 font-bold text-slate-500 text-right">Bid (Payout)</th>
                            <th className="p-2 font-bold text-slate-500 text-right">Repay/Div.</th>
                            <th className="p-2 font-bold text-slate-500 text-center">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedSchedule.map((item, idx) => {
                            const actVal = item.actualAmount !== undefined ? item.actualAmount : (item.amount || item);
                            const payVal = item.payingAmount !== undefined ? item.payingAmount : (item.amount || item);
                            const bidVal = item.bidAmount !== undefined ? item.bidAmount : 0;
                            const repayVal = item.repaymentAmount !== undefined ? item.repaymentAmount : 0;
                            const dateVal = item.dueDate || null;
                            return (
                              <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/40 last:border-0 hover:bg-slate-150/30 dark:hover:bg-slate-800/30">
                                <td className="p-2 font-bold text-slate-400 text-center">M{idx + 1}</td>
                                <td className="p-2 text-right font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(actVal)}</td>
                                <td className="p-2 text-right font-extrabold text-[#10B981]">{formatCurrency(payVal)}</td>
                                <td className="p-2 text-right font-medium text-slate-700 dark:text-slate-200">{formatCurrency(bidVal)}</td>
                                <td className="p-2 text-right font-medium text-amber-600 dark:text-amber-400">{formatCurrency(repayVal)}</td>
                                <td className="p-2 text-center text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                  {dateVal ? new Date(dateVal).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 space-y-2">
                    <Typography variant="subtitle2" className="text-slate-400 uppercase tracking-widest font-semibold text-xs">
                      Installment Schedule (Uniform)
                    </Typography>
                    <div className="text-xs p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/20 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800/60">
                      This group uses uniform payments of <span className="font-bold text-[#10B981]">{formatCurrency(selectedGroup.monthly_contribution)}</span> per member for all {selectedGroup.installments} months.
                    </div>
                  </div>
                );
              })()}

              {/* Enroll Member Section */}
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3">
                <Typography variant="subtitle2" className="text-slate-400 uppercase tracking-widest font-semibold text-xs">
                  Enroll Member
                </Typography>
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Autocomplete
                      value={customers.find(c => c.id === parseInt(selectedCustomerId)) || null}
                      onChange={(event, newValue) => {
                        setSelectedCustomerId(newValue ? newValue.id.toString() : '');
                      }}
                      options={customers}
                      getOptionLabel={(option) => `${option.name} (${option.customer_code || 'No ID'}) (+91 ${option.mobile})`}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select Customer"
                          variant="outlined"
                          size="small"
                          InputProps={{
                            ...params.InputProps,
                            className: 'text-white dark:text-white text-xs',
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#000000ff',
                              fontSize: '0.75rem',
                              '& fieldset': {
                                borderColor: '#334155',
                                borderRadius: '12px',
                              },
                              '&:hover fieldset': {
                                borderColor: '#475569',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#3B82F6',
                              },
                            },
                            '& .MuiAutocomplete-popupIndicator': {
                              color: '#94A3B8',
                            },
                            '& .MuiAutocomplete-clearIndicator': {
                              color: '#94A3B8',
                            },
                          }}
                        />
                      )}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleEnrollMember}
                      disabled={enrollLoading || !selectedCustomerId}
                      variant="contained"
                      className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50 shrink-0"
                    >
                      {enrollLoading ? 'Adding...' : 'Add'}
                    </Button>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-slate-400 font-semibold">Not registered yet?</span>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setOpenRegisterModal(true)}
                      className="text-xs text-[#1E40AF] dark:text-[#3B82F6] font-bold p-0 min-w-0 hover:underline normal-case"
                    >
                      + Register New Customer
                    </Button>
                  </div>
                </div>
              </div>

              <Typography variant="subtitle2" className="text-slate-400 uppercase tracking-widest font-semibold text-xs mb-3">Enrolled Members</Typography>
              {membersLoading ? (
                <div className="flex justify-center p-8">
                  <CircularProgress size={30} />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center text-slate-500 py-8 text-sm">No customers currently enrolled.</div>
              ) : (
                <List className="space-y-2 p-0">
                  {members.map(m => (
                    <Paper key={m.id} className="p-3 border border-slate-100 dark:border-slate-800/40 bg-transparent rounded-xl flex items-center gap-3">
                      <Avatar className="w-8 h-8 bg-gradient-to-tr from-[#1E40AF] to-[#10B981] text-xs font-bold text-white">
                        {m.name.split(' ').map(n => n[0]).join('')}
                      </Avatar>
                      <ListItemText
                        primary={<span className="font-bold text-sm text-slate-850 dark:text-slate-200">{m.name}</span>}
                        secondary={<span className="text-xs text-slate-400">{m.mobile}</span>}
                      />
                    </Paper>
                  ))}
                </List>
              )}

              {/* Finalize & Send Summary Email Button */}
              {members.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={notifyLoading}
                    onClick={async () => {
                      setNotifyLoading(true);
                      try {
                        const res = await axios.post(`/api/chits/${selectedGroup.id}/notify-enrollment`);
                        showSnackbar(
                          `✅ ${res.data.message}${
                            res.data.crossEnrollmentCount > 0
                              ? ` ⚠️ ${res.data.crossEnrollmentCount} member(s) are in multiple groups — check your inbox!`
                              : ''
                          }`,
                          'success'
                        );
                      } catch (err) {
                        showSnackbar(err.response?.data?.message || 'Failed to send emails.', 'error');
                      } finally {
                        setNotifyLoading(false);
                      }
                    }}
                    sx={{
                      background: 'linear-gradient(135deg, #059669, #10B981)',
                      '&:hover': { background: 'linear-gradient(135deg, #047857, #059669)' },
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      py: 1.5,
                      textTransform: 'none',
                      boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                    }}
                  >
                    {notifyLoading ? '📧 Sending Emails...' : `📧 Finalize & Send Summary (${members.length} Members)`}
                  </Button>
                  <p className="text-[10px] text-slate-400 text-center mt-2">
                    Sends 1 summary to admin inbox + welcome email to each member
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
        </div>
      )}

      {/* Creation Page View */}
      {activeView === 'create' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Premium Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
                Create New Chit Group
              </Typography>
              <Typography variant="caption" className="text-slate-400 block mt-0.5">
                Set up the financial pool value, monthly contribution, and custom installment schedule.
              </Typography>
            </div>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={handleCloseModal}
              className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all normal-case"
            >
              Back to Catalog
            </Button>
          </div>

          <Card 
            className={`rounded-3xl p-8 border border-slate-150 dark:border-slate-800 bg-white dark:bg-[#1E293B] shadow-sm mx-auto transition-all duration-350 w-full ${
              createStep === 1 ? 'max-w-2xl' : 'max-w-6xl'
            }`}
          >
            <form onSubmit={handleCreateGroup}>
              <div className="flex justify-between items-center pb-3 mb-6 border-b border-slate-100 dark:border-slate-850">
                <h3 className="font-extrabold text-lg text-slate-855 dark:text-white">
                  {createStep === 1 ? 'Select Scheme Type (Step 1 of 2)' : 'Configure Group Details & Ledger (Step 2 of 2)'}
                </h3>
                <span className="text-xs font-bold text-[#1E40AF]">Step {createStep} of 2</span>
              </div>
              <div className="pt-2">
            {createStep === 1 ? (
              // Step 1: Scheme Selection
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Scheme Configuration Mode</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-205 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCreateSchemeMode('default')}
                      className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                        createSchemeMode === 'default'
                          ? 'bg-[#1E40AF] text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-250'
                      }`}
                    >
                      Select Scheme Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateSchemeMode('custom')}
                      className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                        createSchemeMode === 'custom'
                          ? 'bg-[#1E40AF] text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-250'
                      }`}
                    >
                      Configure from Scratch
                    </button>
                  </div>
                </div>

                {createSchemeMode === 'default' ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Available Templates (Database)</label>
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {savedTemplates.length > 0 ? (
                        savedTemplates.map((template) => {
                          const isSystem = ['50K Scheme', '100K Scheme', '200K Scheme', '500K Scheme'].includes(template.name);
                          return (
                            <Chip
                              key={template.id}
                              label={`${template.name} (${formatCurrency(template.value)} - ${template.installments} Months)`}
                              onClick={() => handleSelectCustomTemplate(template)}
                              onDelete={isSystem ? undefined : () => handleDeleteTemplate(template.id)}
                              className="font-bold cursor-pointer rounded-xl transition-all duration-200 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750"
                            />
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-400">Loading database templates...</span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-450 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/30 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      ℹ️ Selecting a database scheme template automatically populates the custom installments schedule and advances to Step 2.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chit Value (INR)</label>
                        <input
                          type="number"
                          required
                          placeholder="Enter chit value"
                          value={newGroup.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            const inst = newGroup.installments;
                            const monthly = val && inst ? (parseFloat(val) / parseFloat(inst)).toFixed(0) : '';
                            setNewGroup({ ...newGroup, value: val, monthlyContribution: monthly });
                          }}
                          className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tenure (Months)</label>
                        <input
                          type="number"
                          required
                          placeholder="Enter installments"
                          value={newGroup.installments}
                          onChange={(e) => {
                            const inst = e.target.value;
                            const val = newGroup.value;
                            const monthly = val && inst ? (parseFloat(val) / parseFloat(inst)).toFixed(0) : '';
                            setNewGroup({ ...newGroup, installments: inst, monthlyContribution: monthly });
                          }}
                          className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Step 2: Remaining Fields and ledger table grid
              <Grid container spacing={4}>
                {/* Left Column: Group Details */}
                <Grid item xs={12} md={4.5} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Group Code (e.g. CH004)</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter group code"
                      value={newGroup.id}
                      onChange={(e) => setNewGroup({ ...newGroup, id: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Group Name (e.g. Premium Plan)</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter group name"
                      value={newGroup.name}
                      onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">First Installment Due Date</label>
                    <input
                      type="date"
                      required
                      value={newGroup.firstDueDate}
                      onChange={(e) => setNewGroup({ ...newGroup, firstDueDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                    />
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Configuration Summary</div>
                    <div className="text-sm font-extrabold text-slate-800 dark:text-white">
                      {createSchemeMode === 'default' ? 'Default Template' : 'Custom Scheme'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <div>Chit Pool Value: <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(totalValueNum)}</span></div>
                      <div>Tenure / Months: <span className="font-bold text-slate-800 dark:text-white">{newGroup.installments} Months</span></div>
                    </div>
                    <Button 
                      size="small" 
                      variant="text" 
                      onClick={() => setCreateStep(1)} 
                      className="text-xs text-[#1E40AF] font-bold p-0 min-w-0 mt-1 cursor-pointer hover:underline normal-case"
                    >
                      ← Change Scheme
                    </Button>
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 mt-2">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={saveAsTemplate}
                            onChange={(e) => setSaveAsTemplate(e.target.checked)}
                            color="primary"
                            size="small"
                          />
                        }
                        label={
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-350">
                            💾 Save as reusable template
                          </span>
                        }
                      />
                    </div>
                  </div>
                </Grid>

                {/* Right Column: Interactive Schedule Grid */}
                <Grid item xs={12} md={7.5}>
                  {useCustomSchedule && customSchedule.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Installment Ledger Builder</span>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Paying Sum: {formatCurrency(customSum)} / {formatCurrency(totalValueNum)}
                        </span>
                      </div>

                      <div className="overflow-x-auto bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 max-h-96 overflow-y-auto pr-1">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60">
                              <th className="p-2 font-bold text-slate-500 text-center">Month</th>
                              <th className="p-2 font-bold text-slate-500">Actual Amount</th>
                              <th className="p-2 font-bold text-slate-500 text-[#10B981]">Paying Amount</th>
                              <th className="p-2 font-bold text-slate-500">Bid (Payout)</th>
                              <th className="p-2 font-bold text-slate-500">Repay/Dividend</th>
                              <th className="p-2 font-bold text-slate-500 text-center">Due Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customSchedule.map((item, idx) => (
                              <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/40 last:border-0 hover:bg-slate-150/30 dark:hover:bg-slate-800/30">
                                <td className="p-2 font-bold text-slate-400 text-center">M{idx + 1}</td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    required
                                    value={item.actualAmount || 0}
                                    onChange={(e) => handleUpdateRow(idx, 'actualAmount', parseFloat(e.target.value) || 0)}
                                    className="w-20 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-xs font-semibold text-right"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    required
                                    value={item.payingAmount || 0}
                                    onChange={(e) => handleUpdateRow(idx, 'payingAmount', parseFloat(e.target.value) || 0)}
                                    className="w-20 p-1 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-650 rounded-lg text-[#10B981] text-xs font-extrabold text-right"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    required
                                    value={item.bidAmount || 0}
                                    onChange={(e) => handleUpdateRow(idx, 'bidAmount', parseFloat(e.target.value) || 0)}
                                    className="w-24 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-xs font-semibold text-right"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    required
                                    value={item.repaymentAmount || 0}
                                    onChange={(e) => handleUpdateRow(idx, 'repaymentAmount', parseFloat(e.target.value) || 0)}
                                    className="w-20 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-xs font-semibold text-right"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="date"
                                    required
                                    value={item.dueDate || ''}
                                    onChange={(e) => handleUpdateRow(idx, 'dueDate', e.target.value)}
                                    className="w-28 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-[10px] font-semibold text-center"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-2 text-xs">
                        {customSum === totalValueNum ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 dark:bg-emerald-500/5 p-2 rounded-xl">
                            <span>✓ Paying amount matches total Chit Value of {formatCurrency(totalValueNum)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-455 font-bold bg-amber-500/10 dark:bg-amber-500/5 p-2 rounded-xl">
                            <span>⚠️ Note: Paying amount sum ({formatCurrency(customSum)}) differs from total pool value ({formatCurrency(totalValueNum)})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-400">
                      <CalendarMonth className="mb-2" />
                      <span>Ledger schedule table could not be generated. Please go back to Step 1 and verify input values.</span>
                    </div>
                  )}
                </Grid>
              </Grid>
            )}
          </div>
          <div className="px-6 pb-4 border-t border-slate-150 dark:border-slate-800/80 pt-4 mt-4 flex justify-end gap-3">
            {createStep === 1 ? (
              <>
                <Button onClick={handleCloseModal} className="text-slate-500 font-bold">Cancel</Button>
                <Button
                  type="button"
                  onClick={() => setCreateStep(2)}
                  disabled={
                    createSchemeMode === 'default' ||
                    !newGroup.value || !newGroup.installments || parseInt(newGroup.installments) <= 0 || parseFloat(newGroup.value) <= 0
                  }
                  className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold px-6 py-2 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  Configure Group Details →
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setCreateStep(1)} className="text-slate-500 font-bold">← Back</Button>
                <Button
                  type="submit"
                  disabled={submitLoading}
                  className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold px-6 py-2 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {submitLoading ? 'Creating...' : 'Register Pool'}
                </Button>
              </>
            )}
          </div>
        </form>
      </Card>
    </div>
  )}

  {/* Edit Page View */}
  {activeView === 'edit' && (
    <div className="space-y-6 animate-fadeIn">
      {/* Premium Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
            Edit Chit Group ({editGroupData.id})
          </Typography>
          <Typography variant="caption" className="text-slate-400 block mt-0.5">
            Modify the chit scheme configuration, details, and installment schedule.
          </Typography>
        </div>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={handleCloseEditModal}
          className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all normal-case"
        >
          Back to Catalog
        </Button>
      </div>

      <Card 
        className={`rounded-3xl p-8 border border-slate-150 dark:border-slate-800 bg-white dark:bg-[#1E293B] shadow-sm mx-auto transition-all duration-350 w-full ${
          editStep === 1 ? 'max-w-2xl' : 'max-w-6xl'
        }`}
      >
        <form onSubmit={handleUpdateGroup}>
          <div className="flex justify-between items-center pb-3 mb-6 border-b border-slate-100 dark:border-slate-855">
            <h3 className="font-extrabold text-lg text-slate-855 dark:text-white">
              {editStep === 1 ? `Edit Scheme Configuration (Step 1 of 2)` : `Configure Details & Ledger (Step 2 of 2)`}
            </h3>
            <span className="text-xs font-bold text-[#1E40AF]">Step {editStep} of 2</span>
          </div>
          <div className="pt-2">
            {editStep === 1 ? (
              // Step 1: Scheme Selection
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Scheme Configuration Mode</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-205 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditSchemeMode('default')}
                      className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                        editSchemeMode === 'default'
                          ? 'bg-[#1E40AF] text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-250'
                      }`}
                    >
                      Select Scheme Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditSchemeMode('custom')}
                      className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                        editSchemeMode === 'custom'
                          ? 'bg-[#1E40AF] text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-250'
                      }`}
                    >
                      Configure from Scratch
                    </button>
                  </div>
                </div>

                {editSchemeMode === 'default' ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Available Templates (Database)</label>
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {savedTemplates.length > 0 ? (
                        savedTemplates.map((template) => {
                          const isSystem = ['50K Scheme', '100K Scheme', '200K Scheme', '500K Scheme'].includes(template.name);
                          return (
                            <Chip
                              key={template.id}
                              label={`${template.name} (${formatCurrency(template.value)} - ${template.installments} Months)`}
                              onClick={() => handleSelectEditTemplate(template)}
                              onDelete={isSystem ? undefined : () => handleDeleteTemplate(template.id)}
                              className="font-bold cursor-pointer rounded-xl transition-all duration-200 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750"
                            />
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-400">Loading database templates...</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-450 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/30 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      ℹ️ Selecting a database scheme template automatically populates the custom installments schedule and advances to Step 2.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chit Value (INR)</label>
                        <input
                          type="number"
                          required
                          placeholder="Enter chit value"
                          value={editGroupData.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            const inst = editGroupData.installments;
                            const monthly = val && inst ? (parseFloat(val) / parseFloat(inst)).toFixed(0) : '';
                            setEditGroupData({ ...editGroupData, value: val, monthlyContribution: monthly });
                          }}
                          className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tenure (Months)</label>
                        <input
                          type="number"
                          required
                          placeholder="Enter installments"
                          value={editGroupData.installments}
                          onChange={(e) => {
                            const inst = e.target.value;
                            const val = editGroupData.value;
                            const monthly = val && inst ? (parseFloat(val) / parseFloat(inst)).toFixed(0) : '';
                            setEditGroupData({ ...editGroupData, installments: inst, monthlyContribution: monthly });
                          }}
                          className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Step 2: Details & Schedule Table Grid
              <Grid container spacing={4}>
                {/* Left Column: Group Details */}
                <Grid item xs={12} md={4.5} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Group Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter group name"
                      value={editGroupData.name}
                      onChange={(e) => setEditGroupData({ ...editGroupData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</label>
                    <select
                      value={editGroupData.status}
                      onChange={(e) => setEditGroupData({ ...editGroupData, status: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-855 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-semibold text-sm"
                    >
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">First Installment Due Date</label>
                    <input
                      type="date"
                      required
                      value={editGroupData.firstDueDate}
                      onChange={(e) => setEditGroupData({ ...editGroupData, firstDueDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
                    />
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Configuration Summary</div>
                    <div className="text-sm font-extrabold text-slate-850 dark:text-white">
                      {editSchemeMode === 'default' ? 'Default Template' : 'Custom Scheme'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <div>Chit Pool Value: <span className="font-bold text-slate-850 dark:text-white">{formatCurrency(editTotalValueNum)}</span></div>
                      <div>Tenure / Months: <span className="font-bold text-slate-850 dark:text-white">{editGroupData.installments} Months</span></div>
                    </div>
                    <Button 
                      size="small" 
                      variant="text" 
                      onClick={() => setEditStep(1)} 
                      className="text-xs text-[#1E40AF] font-bold p-0 min-w-0 mt-1 cursor-pointer hover:underline normal-case"
                    >
                      ← Change Scheme
                    </Button>
                  </div>
                </Grid>

                {/* Right Column: Interactive Schedule Grid */}
                <Grid item xs={12} md={7.5}>
                  {useCustomEditSchedule && customEditSchedule.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Installment Ledger Builder</span>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Paying Sum: {formatCurrency(customEditSum)} / {formatCurrency(editTotalValueNum)}
                        </span>
                      </div>

                      <div className="overflow-x-auto bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 max-h-96 overflow-y-auto pr-1">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60">
                              <th className="p-2 font-bold text-slate-500 text-center">Month</th>
                              <th className="p-2 font-bold text-slate-500">Actual Amount</th>
                              <th className="p-2 font-bold text-slate-500 text-[#10B981]">Paying Amount</th>
                              <th className="p-2 font-bold text-slate-500">Bid (Payout)</th>
                              <th className="p-2 font-bold text-slate-500">Repay/Dividend</th>
                              <th className="p-2 font-bold text-slate-500 text-center">Due Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customEditSchedule.map((item, idx) => (
                              <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/40 last:border-0 hover:bg-slate-150/30 dark:hover:bg-slate-800/30">
                                <td className="p-2 font-bold text-slate-400 text-center">M{idx + 1}</td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    required
                                    value={item.actualAmount || 0}
                                    onChange={(e) => handleUpdateEditRow(idx, 'actualAmount', parseFloat(e.target.value) || 0)}
                                    className="w-20 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-xs font-semibold text-right"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    required
                                    value={item.payingAmount || 0}
                                    onChange={(e) => handleUpdateEditRow(idx, 'payingAmount', parseFloat(e.target.value) || 0)}
                                    className="w-20 p-1 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-650 rounded-lg text-[#10B981] text-xs font-extrabold text-right"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    required
                                    value={item.bidAmount || 0}
                                    onChange={(e) => handleUpdateEditRow(idx, 'bidAmount', parseFloat(e.target.value) || 0)}
                                    className="w-24 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-xs font-semibold text-right"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    required
                                    value={item.repaymentAmount || 0}
                                    onChange={(e) => handleUpdateEditRow(idx, 'repaymentAmount', parseFloat(e.target.value) || 0)}
                                    className="w-20 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-xs font-semibold text-right"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="date"
                                    required
                                    value={item.dueDate || ''}
                                    onChange={(e) => handleUpdateEditRow(idx, 'dueDate', e.target.value)}
                                    className="w-28 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-[10px] font-semibold text-center"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-2 text-xs">
                        {customEditSum === editTotalValueNum ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 dark:bg-emerald-500/5 p-2 rounded-xl">
                            <span>✓ Paying amount matches total Chit Value of {formatCurrency(editTotalValueNum)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-450 font-bold bg-amber-500/10 dark:bg-amber-500/5 p-2 rounded-xl">
                            <span>⚠️ Note: Paying amount sum ({formatCurrency(customEditSum)}) differs from total pool value ({formatCurrency(editTotalValueNum)})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-400">
                      <CalendarMonth className="mb-2" />
                      <span>Ledger schedule table could not be generated. Please go back to Step 1 and verify input values.</span>
                    </div>
                  )}
                </Grid>
              </Grid>
            )}
          </div>
          <div className="px-6 pb-4 border-t border-slate-150 dark:border-slate-800/80 pt-4 mt-4 flex justify-end gap-3">
            {editStep === 1 ? (
              <>
                <Button onClick={handleCloseEditModal} className="text-slate-500 font-bold">Cancel</Button>
                <Button
                  type="button"
                  onClick={() => setEditStep(2)}
                  disabled={
                    editSchemeMode === 'default' ||
                    !editGroupData.value || !editGroupData.installments || parseInt(editGroupData.installments) <= 0 || parseFloat(editGroupData.value) <= 0
                  }
                  className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold px-6 py-2 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  Configure Group Details →
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setEditStep(1)} className="text-slate-500 font-bold">← Back</Button>
                <Button
                  type="submit"
                  disabled={submitLoading}
                  className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold px-6 py-2 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {submitLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
          </div>
        </form>
      </Card>
    </div>
  )}

  {/* Ledger Page View */}
  {activeView === 'ledger' && (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <Typography variant="h5" className="font-extrabold text-slate-800 dark:text-white">
            Chit Group Ledger: {ledgerGroup?.name}
          </Typography>
          <Typography variant="caption" className="text-slate-400 block mt-0.5">
            Group Code: <span className="font-bold text-[#1E40AF]">{ledgerGroup?.id}</span> • Total Value: <span className="font-bold">{formatCurrency(ledgerGroup?.value)}</span> • Installments: <span className="font-bold">{ledgerGroup?.installments} Months</span>
          </Typography>
        </div>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => setActiveView('list')}
          className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all normal-case"
        >
          Back to Catalog
        </Button>
      </div>

      {ledgerLoading ? (
        <div className="flex justify-center items-center py-24">
          <CircularProgress size={50} className="text-[#1E40AF]" />
        </div>
      ) : (() => {
        const columns = [
          {
            id: 'customer_code',
            label: 'Cust Code',
            width: 100,
            render: (row) => (
              <span className="font-bold text-xs text-slate-600 dark:text-slate-400">
                {row.customer_code || `CUST-${String(row.id).padStart(4, '0')}`}
              </span>
            )
          },
          {
            id: 'name',
            label: 'Cust Name',
            width: 160,
            render: (row) => (
              <span className="font-extrabold text-slate-800 dark:text-white text-sm truncate max-w-[150px]">
                {row.name}
              </span>
            )
          },
          ...getLedgerSchedule().map((inst, idx) => {
            const instAmount = inst.payingAmount || inst.amount;
            const instDueDate = inst.dueDate;
            const dateLabel = instDueDate ? new Date(instDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '—';
            return {
              id: `inst_${idx}`,
              label: `M${idx + 1} (${formatCurrency(instAmount)}) ${dateLabel}`,
              width: 130,
              render: (row) => {
                const isPaid = isInstallmentPaid(row, idx);
                return (
                  <div className="flex justify-center w-full">
                    <button
                      type="button"
                      onClick={() => handleCheckboxClick(row, idx, isPaid, instAmount, instDueDate)}
                      className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex cursor-pointer focus:outline-none"
                    >
                      {isPaid ? (
                        <CheckCircle className="text-[#10B981]" fontSize="small" />
                      ) : (
                        <span className="w-5 h-5 rounded-full border-2 border-slate-350 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 flex items-center justify-center text-[10px] text-slate-400 font-bold hover:text-blue-500">
                          +
                        </span>
                      )}
                    </button>
                  </div>
                );
              }
            };
          }),
          {
            id: 'chit_taken',
            label: 'Chit Taken (Auction)',
            width: 200,
            render: (row) => {
              const wonAuction = ledgerAuctions.find(a => a.winning_bidder_id === row.id);
              if (wonAuction) {
                return (
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-[#C2410C] text-xs">
                      Month {wonAuction.installment_no}
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold">
                      Discount Bid: {formatCurrency(wonAuction.bid_amount)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium">
                      {wonAuction.auction_date ? new Date(wonAuction.auction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                    </div>
                  </div>
                );
              } else {
                return (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleOpenAuctionDialog(row)}
                    className="border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-500 hover:bg-amber-500/10 font-bold py-1 px-2 text-[10px] rounded-lg normal-case"
                    style={{ minWidth: '100px' }}
                  >
                    + Log Auction
                  </Button>
                );
              }
            }
          },
          {
            id: 'guarantor_name',
            label: 'Guarantor Details',
            width: 180,
            render: (row) => row.guarantor_name ? (
              <div className="space-y-0.5">
                <div className="font-bold text-xs truncate max-w-[160px]">{row.guarantor_name}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{row.guarantor_mobile}</div>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 italic">No guarantor registered</span>
            )
          },
          {
            id: 'actions',
            label: 'Quick Actions',
            width: 190,
            render: (row) => (
              <div className="flex gap-2 justify-center items-center w-full font-bold">
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleOpenManualPayment(row)}
                  className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold py-1 px-2.5 rounded-lg text-[10px] shadow-sm"
                  style={{ textTransform: 'none', minWidth: '60px' }}
                >
                  + Pay
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleOpenGuaranteeDialog(row)}
                  className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold py-1 px-2.5 rounded-lg text-[10px]"
                  style={{ textTransform: 'none', minWidth: '85px' }}
                >
                  🛡️ Guarantee
                </Button>
              </div>
            )
          }
        ];

        return (
          <CustomGrid
            columns={columns}
            data={ledgerMembers}
            keyField="id"
            showCheckboxes={false}
            initialRowsPerPage={10}
            height={600}
            rowHeight={65}
            emptyMessage="No members enrolled in this chit group. Edit the group to add customers."
          />
        );
      })()}
    </div>
  )}

      {/* Inline Registration Dialog */}
      <Dialog open={openRegisterModal} onClose={() => setOpenRegisterModal(false)} PaperProps={{ className: 'rounded-3xl p-4 w-full max-w-md bg-white dark:bg-[#1E293B]' }}>
        <form onSubmit={handleRegisterAndEnroll}>
          <DialogTitle className="font-extrabold text-slate-800 dark:text-white pb-1">Register & Enroll Customer</DialogTitle>
          <Typography variant="caption" className="text-slate-450 px-6 block pb-4">
            Register a new customer and enroll them directly in '{selectedGroup?.name || 'this group'}'.
          </Typography>
          <DialogContent className="space-y-4 pt-0">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Full Name</label>
              <input
                type="text"
                required
                placeholder="Enter customer name"
                value={newCustomerData.name}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Email Address (Optional)</label>
              <input
                type="email"
                placeholder="Enter email address"
                value={newCustomerData.email}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mobile Contact</label>
              <input
                type="text"
                required
                placeholder="Enter 10-digit number"
                value={newCustomerData.mobile}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, mobile: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={() => setOpenRegisterModal(false)} className="text-slate-500 font-bold">Cancel</Button>
            <Button
              type="submit"
              disabled={registerLoading}
              variant="contained"
              className="bg-[#1E40AF] text-white font-bold px-5 rounded-xl normal-case"
            >
              {registerLoading ? 'Registering...' : 'Register & Enroll'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Interactive Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} PaperProps={{ className: 'rounded-3xl p-4 w-full max-w-md bg-white dark:bg-[#1E293B]' }}>
        <form onSubmit={handleSavePayment}>
          <DialogTitle className="font-extrabold text-slate-800 dark:text-white pb-1">Record Payment Entry</DialogTitle>
          <Typography variant="caption" className="text-slate-450 px-6 block pb-4">
            Record a new installment contribution collection for **{paymentData.customerName}**.
          </Typography>
          <DialogContent className="space-y-4 pt-0">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Amount (INR)</label>
              <input
                type="number"
                required
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Method</label>
              <select
                value={paymentData.paymentMethod}
                onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Date</label>
              <input
                type="date"
                required
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={() => setPaymentDialogOpen(false)} className="text-slate-500 font-bold">Cancel</Button>
            <Button
              type="submit"
              disabled={savingPayment}
              variant="contained"
              className="bg-[#1E40AF] text-white font-bold px-5 rounded-xl normal-case"
            >
              {savingPayment ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Guarantee Dialog */}
      <Dialog open={guaranteeDialogOpen} onClose={() => setGuaranteeDialogOpen(false)} PaperProps={{ className: 'rounded-3xl p-4 w-full max-w-md bg-white dark:bg-[#1E293B]' }}>
        <form onSubmit={handleSaveGuarantee}>
          <DialogTitle className="font-extrabold text-slate-800 dark:text-white pb-1">Register Guarantor</DialogTitle>
          <Typography variant="caption" className="text-slate-450 px-6 block pb-4">
            Add or update the guarantor details for **{guaranteeData.customerName}**.
          </Typography>
          <DialogContent className="space-y-4 pt-0">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Guarantor Name</label>
              <input
                type="text"
                required
                placeholder="Enter guarantor's full name"
                value={guaranteeData.guarantorName}
                onChange={(e) => setGuaranteeData({ ...guaranteeData, guarantorName: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Guarantor Mobile</label>
              <input
                type="text"
                required
                placeholder="Enter guarantor's mobile number"
                value={guaranteeData.guarantorMobile}
                onChange={(e) => setGuaranteeData({ ...guaranteeData, guarantorMobile: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={() => setGuaranteeDialogOpen(false)} className="text-slate-500 font-bold">Cancel</Button>
            <Button
              type="submit"
              disabled={savingGuarantee}
              variant="contained"
              className="bg-[#1E40AF] text-white font-bold px-5 rounded-xl normal-case"
            >
              {savingGuarantee ? 'Saving...' : 'Save Guarantor'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Log Auction Dialog */}
      <Dialog open={auctionDialogOpen} onClose={() => setAuctionDialogOpen(false)} PaperProps={{ className: 'rounded-3xl p-4 w-full max-w-md bg-white dark:bg-[#1E293B]' }}>
        <form onSubmit={handleSaveAuction}>
          <DialogTitle className="font-extrabold text-slate-800 dark:text-white pb-1">Log Auction Winner (Chit Taken)</DialogTitle>
          <Typography variant="caption" className="text-slate-450 px-6 block pb-4">
            Record auction winning details for **{auctionData.customerName}** in group '{ledgerGroup?.name}'.
          </Typography>
          <DialogContent className="space-y-4 pt-0">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Installment Month</label>
              <select
                required
                value={auctionData.installmentNo}
                onChange={(e) => setAuctionData({ ...auctionData, installmentNo: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              >
                <option value="" disabled>Select Month</option>
                {Array.from({ length: ledgerGroup ? parseInt(ledgerGroup.installments) || 0 : 0 }, (_, i) => {
                  const m = i + 1;
                  const alreadyWon = ledgerAuctions.some(a => a.installment_no === m);
                  return (
                    <option key={m} value={m} disabled={alreadyWon}>
                      Month {m} {alreadyWon ? '(Already Recorded)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bid Discount Amount (₹)</label>
              <input
                type="number"
                required
                placeholder="Enter discount amount"
                value={auctionData.bidAmount}
                onChange={(e) => setAuctionData({ ...auctionData, bidAmount: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all font-medium text-sm"
              />
            </div>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={() => setAuctionDialogOpen(false)} className="text-slate-500 font-bold">Cancel</Button>
            <Button
              type="submit"
              disabled={savingAuction}
              variant="contained"
              className="bg-[#1E40AF] text-white font-bold px-5 rounded-xl normal-case"
            >
              {savingAuction ? 'Saving...' : 'Record Auction'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Toast Alert */}
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
