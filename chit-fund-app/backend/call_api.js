// Node 22 has native global fetch support
const run = async () => {
  try {
    console.log('Logging in to get JWT token...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Logged in successfully. Token obtained.');

    console.log('Calling notify-enrollment API endpoint...');
    const res = await fetch('http://localhost:5000/api/chits/CH001/notify-enrollment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    console.log('API Response:', data);
  } catch (err) {
    console.error('API Call Failed:', err.message);
  }
};

run();
