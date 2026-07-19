import React, { useState } from 'react';
import { Card, TextField, Button, Typography, Alert, CircularProgress, Chip } from '@mui/material';
import axios from 'axios';
import { Shield, ArrowForward } from '@mui/icons-material';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/auth/login', { username, password });
      const { token, user } = response.data;
      onLoginSuccess(token, user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials or verify MySQL server is running.');
    } finally {
      setLoading(false);
    }
  };

  const autofillUser = (user, pass) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-[#0F172A] via-[#1E40AF] to-[#0F172A] p-6 relative overflow-hidden">
      
      {/* Background glowing bubbles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#10B981] opacity-20 rounded-full blur-3xl pulse-glow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#1E40AF] opacity-25 rounded-full blur-3xl pulse-glow"></div>

      <div className="w-full max-w-4xl grid md:grid-cols-12 gap-8 z-10 items-center">
        {/* Left Side Branding */}
        <div className="md:col-span-6 text-white space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 flex items-center justify-center">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="VK Logo" className="w-full h-full object-contain" />
            </div>
            <Typography variant="h4" component="h1" className="font-extrabold tracking-tight">
              FINCORE
            </Typography>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Multi-Tenant <span className="text-[#10B981] glow-text-blue">Chit Fund</span> Management
            </h2>
            <p className="text-slate-300 text-lg">
              A premium, secure solution to scale your financial collections, monitor portfolios, and run seamless bidding auctions across multiple branches.
            </p>
          </div>
        </div>

        {/* Right Side Login Box */}
        <div className="md:col-span-6">
          <Card className="glass-panel text-slate-800 dark:text-white p-8 rounded-3xl shadow-2xl border-white/20 w-full relative">
            <div>
              <div className="flex justify-between items-center mb-8">
                <Typography variant="h5" className="font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                  <Shield className="text-[#1E40AF]" /> Sign In
                </Typography>
                <span className="text-xs font-bold px-3 py-1 bg-[#1E40AF]/10 text-[#1E40AF] dark:text-[#3B82F6] dark:bg-[#3B82F6]/10 rounded-full">
                  v2.1 Premium
                </span>
              </div>

              {error && (
                <Alert severity="error" className="mb-6 rounded-xl">
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="username" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all"
                  />
                </div>

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading}
                  endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
                  className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white py-3.5 rounded-2xl font-bold transition-all mt-4"
                  size="large"
                >
                  {loading ? 'Authenticating...' : 'Secure Access'}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
