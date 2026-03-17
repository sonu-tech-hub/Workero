/* Toast notification */
import React from 'react';
import { useNotification } from '../../context/NotificationContext';

const typeStyle = {
  success: { background: '#10b981', color: '#fff' },
  error:   { background: '#ef4444', color: '#fff' },
  warning: { background: '#f59e0b', color: '#fff' },
  info:    { background: '#3b82f6', color: '#fff' },
};

const Toast = () => {
  const { toasts, removeToast } = useNotification();
  if (!toasts.length) return null;

  return (
    <div style={{ position:'fixed', top:16, right:16, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => removeToast(t.id)}
          style={{
            ...typeStyle[t.type] || typeStyle.info,
            padding:'12px 20px',
            borderRadius:8,
            boxShadow:'0 4px 12px rgba(0,0,0,.2)',
            cursor:'pointer',
            maxWidth:360,
            fontSize:14,
            fontWeight:500,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
};

export default Toast;
