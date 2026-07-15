import React, { useContext, useState, useEffect, useRef } from 'react';
import {
  AppBar, Toolbar, IconButton, Typography, Badge, Menu, MenuItem,
  InputBase, Box, Tooltip, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Popover, List, ListItem, ListItemText,
  ListItemAvatar, Avatar, Divider
} from '@mui/material';
import {
  Menu as MenuIcon, Search, Notifications, Mail, AccountCircle,
  DarkMode, LightMode, Settings, Shield, Autorenew, CheckCircle,
  Delete, MailOutline, Info, Warning, Close, Groups, Layers,
  ContactPhone, Add
} from '@mui/icons-material';
import axios from 'axios';
import { AuthContext } from '../App';

export default function Navbar({ darkMode, toggleDarkMode }) {
  const { 
    user, logout, setUser, token, activeTab, setActiveTab,
    mobileOpen, setMobileOpen,
    setSearchSelectedCustomerId, setSearchSelectedGroupId,
    notifications, fetchNotifications, submenuOpen,
    activeYear, changeYear
  } = useContext(AuthContext);

  const [profileAnchor, setProfileAnchor] = useState(null);
  const [roleAnchor, setRoleAnchor] = useState(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);
  const [messagesAnchor, setMessagesAnchor] = useState(null);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [customersSearchList, setCustomersSearchList] = useState([]);
  const [groupsSearchList, setGroupsSearchList] = useState([]);
  const searchRef = useRef(null);

  // Profile details modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Mock Messages State
  const [messages, setMessages] = useState([
    { id: 1, sender: 'System Scheduler', subject: 'Auction Automated Alert', body: 'The next auction for CH002 (Silver Plan) is scheduled for today at 3:00 PM.', time: '10 mins ago', read: false },
    { id: 2, sender: 'Vijay Sharma', subject: 'Customer payment collection', body: 'I have collected INR 2,000 from Priya Sharma. Receipt REC-2026-003 is uploaded.', time: '1 hour ago', read: false },
    { id: 3, sender: 'Reconciliation Bot', subject: 'Daily audit discrepancy', body: 'Discrepancy of INR 5,000 found in daily bank settlement. Please review logs.', time: '4 hours ago', read: false },
    { id: 4, sender: 'Support Team', subject: 'Server upgraded', body: 'The production tenant database clusters have been successfully upgraded to v15.4.', time: '1 day ago', read: true }
  ]);

  const roles = ['Super Admin', 'Manager', 'Collection Agent', 'Accountant'];

  // Fetch search lists on focus/mount
  const fetchSearchLists = async () => {
    try {
      const [custRes, groupRes] = await Promise.all([
        axios.get('/api/customers'),
        axios.get('/api/chits')
      ]);
      setCustomersSearchList(custRes.data || []);
      setGroupsSearchList(groupRes.data || []);
    } catch (err) {
      console.error('Failed to load search data:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSearchLists();
    }
  }, [token]);

  // Handle outside clicks to close search overlay
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleProfileMenuOpen = (e) => setProfileAnchor(e.currentTarget);
  const handleRoleMenuOpen = (e) => setRoleAnchor(e.currentTarget);
  const handleNotificationsOpen = (e) => {
    setNotificationsAnchor(e.currentTarget);
    fetchNotifications(); // Refresh on open
  };
  const handleMessagesOpen = (e) => setMessagesAnchor(e.currentTarget);

  const handleClose = () => {
    setProfileAnchor(null);
    setRoleAnchor(null);
    setNotificationsAnchor(null);
    setMessagesAnchor(null);
  };

  const handleSimulateRole = (role) => {
    setUser({ ...user, role });
    handleClose();
  };

  // Notification methods
  const handleMarkAsRead = async (id) => {
    try {
      await axios.put(`/api/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Error updating notification:', err);
    }
  };

  const handleClearNotification = async (id) => {
    try {
      await axios.delete(`/api/notifications/${id}`);
      fetchNotifications();
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    try {
      await Promise.all(unread.map(n => axios.put(`/api/notifications/${n.id}/read`)));
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notifications read:', err);
    }
  };

  // Message methods
  const handleMarkMessageRead = (id) => {
    setMessages(messages.map(m => m.id === id ? { ...m, read: true } : m));
  };

  const handleClearMessage = (id) => {
    setMessages(messages.filter(m => m.id !== id));
  };

  const handleMarkAllMessagesRead = () => {
    setMessages(messages.map(m => ({ ...m, read: true })));
  };

  // Navigation handlers from profile menu
  const handleSettingsNav = () => {
    setActiveTab('Settings');
    handleClose();
  };

  const handleProfileModalOpen = () => {
    setProfileModalOpen(true);
    handleClose();
  };

  // Search Results filtering
  const filteredCustomers = searchQuery
    ? customersSearchList.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mobile.includes(searchQuery) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5)
    : [];

  const filteredGroups = searchQuery
    ? groupsSearchList.filter(g =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.id.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5)
    : [];

  const showSearchResults = searchFocused && searchQuery && (filteredCustomers.length > 0 || filteredGroups.length > 0);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-[#10B981]" fontSize="small" />;
      case 'warning': return <Warning className="text-amber-500" fontSize="small" />;
      case 'danger':
      case 'alert': return <Warning className="text-red-500" fontSize="small" />;
      default: return <Info className="text-[#1E40AF] dark:text-[#3B82F6]" fontSize="small" />;
    }
  };

  const unreadNotifCount = notifications.filter(n => !n.is_read).length;
  const unreadMsgCount = messages.filter(m => !m.read).length;

  const hasSubmenu = ['Customers', 'Chit Groups', 'Chit Entry', 'Auctions', 'Payments', 'Notifications', 'Settings'].includes(activeTab);
  const currentDrawerWidth = (hasSubmenu && submenuOpen) ? 252 : 72;

  return (
    <AppBar 
      position="fixed" 
      elevation={0}
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer - 1, 
        width: { xs: '100%', sm: `calc(100% - ${currentDrawerWidth}px)` },
        ml: { sm: `${currentDrawerWidth}px` },
        left: { xs: 0, sm: 'auto' },
        bgcolor: 'background.default',
        boxShadow: 'none',
        borderBottom: 'none',
        backgroundImage: 'none',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <Toolbar className="flex justify-between items-center px-6">
        
        {/* Left Side: Active Page Title & Tenant Info */}
        <div className="flex items-center gap-3">
          <IconButton 
            edge="start" 
            color="inherit" 
            aria-label="menu" 
            sx={{ display: { sm: 'none' } }}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <MenuIcon />
          </IconButton>
          <div className="flex items-center gap-4">
            <Typography variant="h6" className="font-extrabold text-slate-800 dark:text-white tracking-wider text-base uppercase select-none">
              {activeTab === 'Chit Groups' ? 'CHIT POOLS' : activeTab === 'Chit Entry' ? 'CHIT ENTRY' : activeTab.toUpperCase()}
            </Typography>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.5 }}>
              <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full inline-block"></span>
              <Typography variant="caption" className="text-slate-400 font-bold tracking-wider uppercase text-[9px] select-none">
                {user.tenant_name || 'System Tenant'}
              </Typography>
            </Box>
          </div>
        </div>

        {/* Center: Empty (Search Box removed as requested) */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Right Side: Tools & Profile (styled exactly like the screenshot) */}
        <div className="flex items-center gap-3 select-none">
          
          {/* Financial/Current Year Selector */}
          <Tooltip title="Switch Financial Accounting Year">
            <select
              value={activeYear}
              onChange={(e) => changeYear(e.target.value)}
              className="px-3 py-1.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold rounded-full text-[10px] border border-emerald-500/20 shadow-sm outline-none cursor-pointer hover:bg-emerald-500/20 transition-all font-sans"
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(yr => (
                <option key={yr} value={yr} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-bold">
                  FY {yr}
                </option>
              ))}
            </select>
          </Tooltip>

          {/* Grouped Icon Actions Bar (MUI style pill container) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 px-1.5 py-1 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 gap-0.5 shadow-sm">
            {/* Quick Add Button */}
            <Tooltip title="Quick Register Customer/Group">
              <IconButton 
                size="small" 
                onClick={() => setActiveTab('Customers')}
                className="text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
              >
                <Add fontSize="small" style={{ fontSize: '1.1rem' }} />
              </IconButton>
            </Tooltip>



            {/* Notifications Bell */}
            <Tooltip title="Alerts Inbox">
              <IconButton 
                size="small" 
                onClick={handleNotificationsOpen}
                className="text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
              >
                <Badge 
                  badgeContent={unreadNotifCount} 
                  color="error"
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.65rem',
                      height: '16px',
                      minWidth: '16px',
                      padding: '0'
                    }
                  }}
                >
                  <Notifications fontSize="small" style={{ fontSize: '1.1rem' }} />
                </Badge>
              </IconButton>
            </Tooltip>
          </div>

          {/* Profile Circle Avatar with user's initial */}
          <Tooltip title="My Settings Profile">
            <button
              onClick={handleProfileMenuOpen}
              className="w-9 h-9 rounded-full bg-[#1E40AF] dark:bg-[#1E293B] hover:scale-105 active:scale-95 transition-transform flex items-center justify-center font-extrabold text-sm text-white select-none shadow-md shadow-[#1E40AF]/20 border border-white/10 cursor-pointer"
            >
              {user?.name?.charAt(0).toUpperCase() || 'VK'}
            </button>
          </Tooltip>
          
        </div>

        {/* Profile Menu */}
        <Menu
          anchorEl={profileAnchor}
          open={Boolean(profileAnchor)}
          onClose={handleClose}
          disableScrollLock={true}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            className: 'rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white',
          }}
        >
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
            <div className="font-bold">{user.name}</div>
            <div className="text-xs text-slate-400">{user.username}</div>
          </div>
          <MenuItem onClick={handleProfileModalOpen} className="text-sm"><AccountCircle fontSize="small" className="mr-2" /> My Profile</MenuItem>
          <MenuItem onClick={handleSettingsNav} className="text-sm"><Settings fontSize="small" className="mr-2" /> Settings</MenuItem>
          <MenuItem onClick={logout} className="text-sm text-red-500 font-semibold"><Autorenew fontSize="small" className="mr-2" /> Log Out</MenuItem>
        </Menu>

        {/* Role Simulator Menu */}
        <Menu
          anchorEl={roleAnchor}
          open={Boolean(roleAnchor)}
          onClose={handleClose}
          disableScrollLock={true}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            className: 'rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white',
          }}
        >
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
            <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Simulate Role View</div>
          </div>
          {roles.map((role) => (
            <MenuItem
              key={role}
              selected={user.role === role}
              onClick={() => handleSimulateRole(role)}
              className="text-sm"
            >
              {role}
            </MenuItem>
          ))}
        </Menu>

        {/* Notifications Popover */}
        <Popover
          open={Boolean(notificationsAnchor)}
          anchorEl={notificationsAnchor}
          onClose={handleClose}
          disableScrollLock={true}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            className: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 w-[380px] mt-2 overflow-hidden'
          }}
        >
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Notifications className="text-[#1E40AF] dark:text-[#3B82F6]" fontSize="small" />
              <span className="font-bold text-sm text-slate-800 dark:text-white">Alerts Inbox</span>
              {unreadNotifCount > 0 && (
                <span className="text-[10px] bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">
                  {unreadNotifCount} New
                </span>
              )}
            </div>
            {unreadNotifCount > 0 && (
              <Button
                size="small"
                onClick={handleMarkAllNotificationsRead}
                className="text-xs text-[#1E40AF] dark:text-[#3B82F6] hover:underline font-bold"
              >
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto p-1.5 space-y-1">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No system alerts at the moment.
              </div>
            ) : (
              notifications.slice(0, 8).map(notif => (
                <div
                  key={notif.id}
                  className={`p-2.5 rounded-xl border flex justify-between gap-2.5 transition-all ${notif.is_read
                      ? 'bg-transparent border-slate-100 dark:border-slate-800/20 opacity-70'
                      : 'bg-[#1E40AF]/5 border-[#1E40AF]/15 dark:bg-[#1E40AF]/10'
                    }`}
                >
                  <div className="flex gap-2.5 items-start">
                    <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-tight">
                        {notif.title}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal max-w-[220px]">
                        {notif.message}
                      </p>
                      <span className="text-[8px] text-slate-400 block mt-1 font-semibold">
                        {new Date(notif.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end gap-2">
                    {!notif.is_read && (
                      <IconButton size="small" onClick={() => handleMarkAsRead(notif.id)} className="text-[#1E40AF] dark:text-[#3B82F6]">
                        <CheckCircle fontSize="inherit" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => handleClearNotification(notif.id)} className="text-slate-400 hover:text-red-500">
                      <Delete fontSize="inherit" />
                    </IconButton>
                  </div>
                </div>
              ))
            )}
          </div>

          <Divider />
          <div className="p-2 bg-slate-50 dark:bg-slate-900 text-center">
            <Button
              fullWidth
              size="small"
              onClick={() => {
                setActiveTab('Notifications');
                handleClose();
              }}
              className="text-xs font-bold text-[#1E40AF] dark:text-[#3B82F6]"
            >
              View All Alerts
            </Button>
          </div>
        </Popover>

        {/* Messages Popover */}
        <Popover
          open={Boolean(messagesAnchor)}
          anchorEl={messagesAnchor}
          onClose={handleClose}
          disableScrollLock={true}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            className: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 w-[380px] mt-2 overflow-hidden'
          }}
        >
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Mail className="text-[#1E40AF] dark:text-[#3B82F6]" fontSize="small" />
              <span className="font-bold text-sm text-slate-800 dark:text-white">Messages Inbox</span>
              {unreadMsgCount > 0 && (
                <span className="text-[10px] bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">
                  {unreadMsgCount} New
                </span>
              )}
            </div>
            {unreadMsgCount > 0 && (
              <Button
                size="small"
                onClick={handleMarkAllMessagesRead}
                className="text-xs text-[#1E40AF] dark:text-[#3B82F6] hover:underline font-bold"
              >
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto p-1.5 space-y-1">
            {messages.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Your mailbox is empty.
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded-xl border flex justify-between gap-2.5 transition-all ${msg.read
                      ? 'bg-transparent border-slate-100 dark:border-slate-800/20 opacity-70'
                      : 'bg-[#1E40AF]/5 border-[#1E40AF]/15 dark:bg-[#1E40AF]/10'
                    }`}
                >
                  <div className="flex gap-2.5 items-start">
                    <Avatar className="w-8 h-8 bg-gradient-to-tr from-[#1E40AF] to-[#10B981] font-bold text-[10px] text-white mt-0.5">
                      {msg.sender.split(' ').map(n => n[0]).join('')}
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-tight">{msg.sender}</span>
                        {!msg.read && <span className="w-1.5 h-1.5 bg-[#1E40AF] rounded-full inline-block"></span>}
                      </div>
                      <div className="font-semibold text-[10px] text-slate-600 dark:text-slate-350 mt-0.5 leading-tight">{msg.subject}</div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal max-w-[220px]">
                        {msg.body}
                      </p>
                      <span className="text-[8px] text-slate-400 block mt-1 font-semibold">
                        {msg.time}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end gap-2">
                    {!msg.read && (
                      <IconButton size="small" onClick={() => handleMarkMessageRead(msg.id)} className="text-[#1E40AF] dark:text-[#3B82F6]">
                        <CheckCircle fontSize="inherit" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => handleClearMessage(msg.id)} className="text-slate-400 hover:text-red-500">
                      <Delete fontSize="inherit" />
                    </IconButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </Popover>

        {/* Profile Identity Modal */}
        <Dialog
          open={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          PaperProps={{
            className: 'rounded-3xl p-4 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl'
          }}
        >
          <DialogTitle className="flex justify-between items-center pb-2">
            <span className="font-extrabold text-lg text-slate-855 dark:text-white">Active User Profile</span>
            <IconButton size="small" onClick={() => setProfileModalOpen(false)} className="text-slate-400">
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent className="space-y-4 pt-2">
            <div className="flex flex-col items-center text-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 mb-3">
              <Avatar className="w-16 h-16 bg-gradient-to-tr from-[#1E40AF] to-[#10B981] font-extrabold text-xl text-white mb-2 shadow-sm">
                {user.name.split(' ').map(n => n[0]).join('')}
              </Avatar>
              <div className="font-extrabold text-base text-slate-855 dark:text-white leading-tight">{user.name}</div>
              <div className="text-xs text-slate-400 font-semibold mt-0.5">{user.username}</div>
              <Chip
                icon={<Shield className="text-[#10B981] h-3.5 w-3.5" />}
                label={user.role}
                size="small"
                className="mt-2.5 bg-[#10B981]/10 text-[#10B981] border-[#10B981]/25 border font-bold text-[10px]"
              />
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40">
                <span className="text-slate-400 font-semibold">Tenant Identifier</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{user.tenant_id}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40">
                <span className="text-slate-400 font-semibold">Allocated Company</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{user.tenant_name}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40">
                <span className="text-slate-400 font-semibold">Isolated Database Instance</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {user.tenant_id === 'tenant_1' ? 'chit_fund_tenant_1' : 'chit_fund_tenant_2'}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40">
                <span className="text-slate-400 font-semibold">Data Connection Encryption</span>
                <span className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/15 px-2.5 py-0.5 rounded-full">TLS/SSL Secured</span>
              </div>
            </div>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button
              fullWidth
              variant="contained"
              onClick={() => setProfileModalOpen(false)}
              className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-bold rounded-xl py-2"
            >
              Close Profile Details
            </Button>
          </DialogActions>
        </Dialog>

      </Toolbar>
    </AppBar>
  );
}
