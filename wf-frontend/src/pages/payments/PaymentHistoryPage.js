import React, { useState, useEffect } from 'react';
import { getPaymentHistory } from '../../api/paymentAPI';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import { formatDate, formatCurrency, extractError } from '../../utils/helpers';

const STATUS_COLOR = { captured:'#10b981', failed:'#ef4444', refunded:'#f59e0b', pending:'#6b7280' };

const PaymentHistoryPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filterStatus, setFStatus] = useState('');
  const { page, limit, meta, updateMeta, setPage } = usePagination(1, 10);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await getPaymentHistory({ page, limit, ...(filterStatus ? { status: filterStatus } : {}) });
        setPayments(data.data?.payments || data.data || []);
        updateMeta(data.data?.pagination);
      } catch (e) {
        setError(extractError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [page, filterStatus]);

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:20 }}>💰 Payment History</h2>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {['', 'captured', 'failed', 'refunded'].map((s) => (
          <button key={s} onClick={() => { setFStatus(s); setPage(1); }}
            style={{ padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:13,
              background: filterStatus===s ? '#6366f1' : '#f3f4f6',
              color: filterStatus===s ? '#fff' : '#374151', fontWeight: filterStatus===s ? 600 : 400 }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <div style={{ color:'#ef4444', marginBottom:12 }}>{error}</div>}
      {loading ? <Spinner /> : (
        <>
          {payments.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, background:'#fff', borderRadius:12, color:'#9ca3af', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ fontSize:48 }}>💳</div>
              <p>No payments found.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {payments.map((p) => (
                <div key={p.id} style={{ background:'#fff', borderRadius:12, padding:'16px 20px', boxShadow:'0 2px 8px rgba(0,0,0,.06)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, borderLeft:`4px solid ${STATUS_COLOR[p.status]||'#6b7280'}` }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:15 }}>{p.job_title || `Job #${p.job_id}`}</div>
                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
                      {formatDate(p.created_at)} · {p.transaction_id || p.razorpay_payment_id || '—'}
                    </div>
                    {p.platform_fee && (
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                        Platform: {formatCurrency(p.platform_fee)} · Worker payout: {formatCurrency(p.worker_payout)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:20, fontWeight:700, color:'#1f2937' }}>{formatCurrency(p.amount)}</div>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:500, background:(STATUS_COLOR[p.status]||'#6b7280')+'20', color: STATUS_COLOR[p.status]||'#6b7280' }}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default PaymentHistoryPage;
