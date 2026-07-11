import React, { useContext, useRef, useEffect } from 'react';
import { Drawer, Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { 
  Dashboard, People, Layers, AccountBalanceWallet, Gavel, 
  Payment, Assessment, BarChart, Notifications, Settings,
  AssignmentTurnedIn, MonetizationOn
} from '@mui/icons-material';
import { AuthContext } from '../App';

export default function Sidebar() {
  const { user, activeTab, setActiveTab, mobileOpen, setMobileOpen, submenuOpen, setSubmenuOpen } = useContext(AuthContext);

  // Groupings & active item resolutions
  const hasSubmenu = ['Customers', 'Chit Groups', 'Chit Entry', 'Auctions', 'Payments', 'Notifications', 'Settings'].includes(activeTab);
  const currentDrawerWidth = (hasSubmenu && submenuOpen) ? 252 : 72;

  const mainMenuItems = [
    { id: 'dashboard', text: 'Dashboard', icon: <Dashboard />, tab: 'Dashboard' },
    { 
      id: 'chit', 
      text: 'Chit Operations', 
      icon: <Layers />, 
      subItems: [
        { text: 'Customers', icon: <People /> },
        { text: 'Chit Groups', icon: <Layers /> },
        { text: 'Chit Entry', icon: <AssignmentTurnedIn /> },
        { text: 'Auctions', icon: <Gavel /> },
        { text: 'Payments', icon: <Payment /> },
      ],
      defaultTab: 'Customers'
    },
    { id: 'finance', text: 'Finance', icon: <MonetizationOn />, tab: 'Finance' },
    { id: 'reports', text: 'Reports', icon: <Assessment />, tab: 'Reports' },
    { id: 'analytics', text: 'Analytics', icon: <BarChart />, tab: 'Analytics' },
    { 
      id: 'settings', 
      text: 'Settings', 
      icon: <Settings />, 
      subItems: [
        { text: 'Notifications', icon: <Notifications /> },
        { text: 'Settings', icon: <Settings /> },
      ],
      defaultTab: 'Notifications'
    }
  ];

  // Detect which main menu item is currently active
  const getActiveMainItemId = () => {
    if (activeTab === 'Dashboard') return 'dashboard';
    if (['Customers', 'Chit Groups', 'Chit Entry', 'Auctions', 'Payments'].includes(activeTab)) return 'chit';
    if (activeTab === 'Finance') return 'finance';
    if (activeTab === 'Reports') return 'reports';
    if (activeTab === 'Analytics') return 'analytics';
    if (['Notifications', 'Settings'].includes(activeTab)) return 'settings';
    return 'dashboard';
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      // If clicked inside the sidebar drawer, ignore the click outside logic
      if (event.target.closest('.sidebar-container')) {
        return;
      }
      setSubmenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setSubmenuOpen]);

  const activeMainItemId = getActiveMainItemId();
  const activeMainItemObj = mainMenuItems.find(item => item.id === activeMainItemId);

  const handleMainItemClick = (item) => {
    if (item.tab) {
      setActiveTab(item.tab);
      setMobileOpen(false);
      setSubmenuOpen(false);
    } else if (item.subItems && item.subItems.length > 0) {
      const subTabsList = item.subItems.map(si => si.text);
      if (!subTabsList.includes(activeTab)) {
        setActiveTab(item.defaultTab);
        setSubmenuOpen(true);
      } else {
        setSubmenuOpen(!submenuOpen);
      }
    }
  };

  const drawerContent = (
    <Box className="sidebar-container" sx={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>
      
      {/* PANE 1: Main narrow sidebar (72px) */}
      <Box 
        className="bg-slate-900 dark:bg-slate-950 flex flex-col items-center py-6 select-none"
        sx={{ width: '72px', minWidth: '72px', height: '100%', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* App Mini Logo */}
        <div 
          className="w-12 h-12 flex items-center justify-center rounded-2xl mb-8 cursor-pointer hover:scale-105 transition-transform overflow-hidden bg-white/5 hover:bg-white/10" 
          onClick={() => setActiveTab('Dashboard')}
        >
          <img src="/logo.png" alt="VK Logo" className="w-10 h-10 object-contain" />
        </div>

        {/* Icons Navigation List */}
        <div className="flex flex-col items-center gap-4 flex-grow w-full px-2">
          {mainMenuItems.map((item) => {
            const isMainSelected = activeMainItemId === item.id;
            return (
              <Tooltip key={item.id} title={item.text} placement="right" arrow>
                <button
                  onClick={() => handleMainItemClick(item)}
                  className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 relative group cursor-pointer ${
                    isMainSelected 
                      ? 'bg-white/10 text-white scale-105' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {/* Left indicator bar on hover/active */}
                  <div className={`absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full transition-all duration-300 ${
                    isMainSelected ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50 group-hover:opacity-50 group-hover:scale-y-75'
                  }`} />
                  
                  <div className="text-xl">
                    {item.icon}
                  </div>
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Footer profile icon */}
        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
          {user?.name?.split(' ').map(n => n[0]).join('') || 'A'}
        </div>
      </Box>

      {/* PANE 2: Submenu panel (180px) - displays dynamically */}
      {hasSubmenu && submenuOpen && activeMainItemObj?.subItems && (
        <Box 
          className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex flex-col py-6 h-full border-r border-slate-100 dark:border-slate-800"
          sx={{ width: '180px', minWidth: '180px' }}
        >
          {/* Header Title */}
          <div className="px-4 mb-4">
            <Typography variant="overline" className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
              {activeMainItemId === 'chit' ? 'Chit Operations' : 'System & Settings'}
            </Typography>
          </div>

          {/* Submenu List */}
          <List className="px-2 space-y-1 flex-grow">
            {activeMainItemObj.subItems.map((subItem) => {
              const isSubSelected = activeTab === subItem.text;
              return (
                <ListItem key={subItem.text} disablePadding>
                  <ListItemButton
                    selected={isSubSelected}
                    onClick={() => {
                      setActiveTab(subItem.text);
                      setMobileOpen(false);
                    }}
                    className={`rounded-xl transition-all duration-200 px-3 py-2 ${
                      isSubSelected 
                        ? 'bg-[#1E40AF]/10 text-[#1E40AF] dark:text-[#3B82F6]' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-850 dark:hover:text-slate-200'
                    }`}
                    sx={{
                      color: isSubSelected ? '#1E40AF' : 'inherit',
                      '& .MuiListItemIcon-root': {
                        color: isSubSelected ? '#1E40AF' : 'inherit',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(30, 64, 175, 0.1)',
                        color: '#1E40AF',
                        '&:hover': {
                          backgroundColor: 'rgba(30, 64, 175, 0.15)',
                        },
                        '& .MuiListItemIcon-root': {
                          color: '#1E40AF',
                        }
                      }
                    }}
                  >
                    <ListItemIcon 
                      className={`min-w-0 mr-3 transition-colors ${
                        isSubSelected 
                          ? 'text-[#1E40AF] dark:text-[#3B82F6]' 
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                      sx={{ 
                        '& svg': { fontSize: '1.1rem' },
                        color: isSubSelected ? '#1E40AF' : 'inherit'
                      }}
                    >
                      {subItem.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={subItem.text} 
                      primaryTypographyProps={{
                        fontSize: '0.8rem',
                        fontWeight: isSubSelected ? 700 : 500,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}

    </Box>
  );

  return (
    <>
      {/* Mobile Drawer (Temporary) */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          [`& .MuiDrawer-paper`]: { 
            width: currentDrawerWidth, 
            boxSizing: 'border-box',
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
            borderRight: 'none'
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer (Permanent) */}
      <Drawer
        variant="permanent"
        sx={{
          width: currentDrawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { 
            width: currentDrawerWidth, 
            boxSizing: 'border-box',
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
            borderRight: 'none'
          },
          display: { xs: 'none', sm: 'block' }
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
}
