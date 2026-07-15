import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { getAppTheme } from './theme';
import LoginPage from './pages/LoginPage';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';

import ChitGroupsPage from './pages/ChitGroupsPage';
import ChitEntryPage from './pages/ChitEntryPage';
import AuctionsPage from './pages/AuctionsPage';
import PaymentsPage from './pages/PaymentsPage';
import ReportsPage from './pages/ReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import FinancePage from './pages/FinancePage';
import axios from 'axios';

// Configure Axios Defaults
axios.defaults.baseURL = window.location.protocol === 'file:' ? 'http://localhost:5000' : '';

export const AuthContext = createContext(null);

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [activeYear, setActiveYear] = useState(localStorage.getItem('activeYear') || '2026');
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchSelectedCustomerId, setSearchSelectedCustomerId] = useState(null);

  const changeYear = (year) => {
    setActiveYear(year);
    localStorage.setItem('activeYear', year);
    axios.defaults.headers.common['X-Year'] = year;
    window.location.reload();
  };

  useEffect(() => {
    if (activeYear) {
      axios.defaults.headers.common['X-Year'] = activeYear;
    } else {
      delete axios.defaults.headers.common['X-Year'];
    }
  }, [activeYear]);
  const [searchSelectedGroupId, setSearchSelectedGroupId] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const response = await axios.get('/api/notifications');
      setNotifications(response.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };


  const getTabFromPath = () => {
    const path = window.location.hash.replace('#/', '').replace('#', '').toLowerCase();
    if (path === 'customers') return 'Customers';

    if (path === 'chit-groups' || path === 'chitgroups') return 'Chit Groups';
    if (path === 'chit-entry' || path === 'chitentry') return 'Chit Entry';
    if (path === 'auctions') return 'Auctions';
    if (path === 'payments') return 'Payments';
    if (path === 'finance') return 'Finance';
    if (path === 'reports') return 'Reports';
    if (path === 'analytics') return 'Analytics';
    if (path === 'notifications') return 'Notifications';
    if (path === 'settings') return 'Settings';
    return 'Dashboard';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath());
  const [submenuOpen, setSubmenuOpen] = useState(false);

  // Auto-open submenu when a tab with subitems is active
  useEffect(() => {
    const hasSub = ['Customers', 'Chit Groups', 'Chit Entry', 'Auctions', 'Payments', 'Notifications', 'Settings'].includes(activeTab);
    if (hasSub) {
      setSubmenuOpen(true);
    } else {
      setSubmenuOpen(false);
    }
  }, [activeTab]);

  // Sync URL hash with activeTab
  useEffect(() => {
    let pathName = activeTab.toLowerCase();
    if (activeTab === 'Chit Groups') {
      pathName = 'chit-groups';
    } else if (activeTab === 'Chit Entry') {
      pathName = 'chit-entry';
    }
    const targetHash = '#/' + pathName;
    if (window.location.hash !== targetHash) {
      window.history.pushState(null, '', targetHash);
    }
  }, [activeTab]);

  // Sync activeTab when user navigates using back/forward browser buttons
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Initialize Axios Auth Headers on token change
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
      fetchNotifications();
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
      setNotifications([]);
    }
  }, [token]);

  // Load profile if token exists
  useEffect(() => {
    if (token && !user) {
      axios.get('/api/auth/me')
        .then(response => {
          setUser(response.data);
        })
        .catch(() => {
          logout();
        });
    }
  }, [token, user]);

  const login = (jwtToken, userData) => {
    setToken(jwtToken);
    setUser(userData);
  };

  const logout = () => {
    setToken('');
    setUser(null);
    setActiveTab('Dashboard');
  };

  const toggleDarkMode = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    localStorage.setItem('theme', nextMode ? 'dark' : 'light');
    if (nextMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Sync initial theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const muiTheme = getAppTheme(darkMode ? 'dark' : 'light');

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return <DashboardPage />;
      case 'Customers':
        return <CustomersPage />;

      case 'Chit Groups':
        return <ChitGroupsPage />;
      case 'Chit Entry':
        return <ChitEntryPage />;
      case 'Auctions':
        return <AuctionsPage />;
      case 'Payments':
        return <PaymentsPage />;
      case 'Finance':
        return <FinancePage />;
      case 'Reports':
        return <ReportsPage />;
      case 'Analytics':
        return <AnalyticsPage />;
      case 'Notifications':
        return <NotificationsPage />;
      case 'Settings':
        return <SettingsPage />;
      default:
        return (
          <div className="p-8 text-center text-slate-500">
            <h2 className="text-2xl font-semibold mb-2">{activeTab} Section</h2>
            <p>This module is simulated for demonstration purposes.</p>
          </div>
        );
    }
  };

  if (!token || !user) {
    return (
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <LoginPage onLoginSuccess={login} />
      </ThemeProvider>
    );
  }

  const hasSubmenu = ['Customers', 'Chit Groups', 'Chit Entry', 'Auctions', 'Payments', 'Notifications', 'Settings'].includes(activeTab);

  return (
    <AuthContext.Provider value={{ 
      user, token, login, logout, activeTab, setActiveTab, setUser,
      mobileOpen, setMobileOpen, 
      searchSelectedCustomerId, setSearchSelectedCustomerId,
      searchSelectedGroupId, setSearchSelectedGroupId,
      notifications, fetchNotifications,
      submenuOpen, setSubmenuOpen,
      activeYear, changeYear
    }}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {/* Top AppBar */}
        <Navbar darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden', width: '100%' }}>
          {/* Drawer Sidebar */}
          <Sidebar />

          {/* Main App Content Area */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 3,
              mt: 8,
              width: { sm: `calc(100% - ${(hasSubmenu && submenuOpen) ? 252 : 72}px)` },
              transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              overflowX: 'hidden',
            }}
          >
            <div className="fade-in">
              {renderContent()}
            </div>
          </Box>
        </Box>
      </ThemeProvider>
    </AuthContext.Provider>
  );
}
