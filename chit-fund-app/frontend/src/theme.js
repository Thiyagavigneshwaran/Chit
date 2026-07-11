import { createTheme } from '@mui/material/styles';

export const getAppTheme = (mode) => {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#1E40AF', // Royal Blue
        light: '#3B82F6',
        dark: '#1D4ED8',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#0F172A', // Dark Navy
        light: '#1E293B',
        dark: '#020617',
        contrastText: '#ffffff',
      },
      success: {
        main: '#10B981',
        light: '#34D399',
        dark: '#059669',
      },
      warning: {
        main: '#F59E0B',
        light: '#FBBF24',
        dark: '#D97706',
      },
      background: {
        default: mode === 'light' ? '#F8FAFC' : '#0B0F19',
        paper: mode === 'light' ? '#ffffff' : '#1E293B',
      },
      text: {
        primary: mode === 'light' ? '#0F172A' : '#F8FAFC',
        secondary: mode === 'light' ? '#475569' : '#94A3B8',
      },
    },
    typography: {
      fontFamily: '"Outfit", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: mode === 'light' 
              ? '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)' 
              : '0 4px 6px -1px rgb(0 0 0 / 0.2), 0 2px 4px -2px rgb(0 0 0 / 0.2)',
            borderRadius: 16,
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'light' ? '#ffffff' : '#1E293B',
            color: mode === 'light' ? '#0F172A' : '#F8FAFC',
            boxShadow: 'none',
            borderBottom: `1px solid ${mode === 'light' ? '#E2E8F0' : '#334155'}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: mode === 'light' ? '#0F172A' : '#070A13',
            color: '#F8FAFC',
            borderRight: 'none',
          },
        },
      },
    },
  });
};
