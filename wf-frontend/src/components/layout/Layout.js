import React from 'react';
import Navbar from './Navbar';
import Toast from '../common/Toast';

const Layout = ({ children }) => (
  <div style={{ minHeight:'100vh', background:'#f9fafb', fontFamily:"'Inter',system-ui,sans-serif" }}>
    <Navbar />
    <main style={{ maxWidth:1200, margin:'0 auto', padding:'24px 16px' }}>
      {children}
    </main>
    <Toast />
  </div>
);

export default Layout;
