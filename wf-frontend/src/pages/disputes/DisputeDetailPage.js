import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDisputeDetails, updateDisputeStatus } from '../../api/disputeAPI';
import Spinner from '../../components/common/Spinner';
import { formatDate, formatDateTime, extractError } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

const DisputeDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToast } = useNotification();
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    getDisputeDetails(id)
      .then(({ data }) => setDispute(data.data))
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const handleClose = async () => {
    if (!window.confirm('Close this dispute?')) return;
    setUpdating(true);
    try {
      await updateDisputeStatus(id, { status: 'closed', resolution_notes: 'Closed by user' });
      setDispute((d) => ({ ...d, status: 'closed' }));
      addToast('Dispute closed', 'success');
    } catch (e) { addToast(extractError(e), 'error'); }
    finally { setUpdating(false); }
  };

  if (loading) return <Spinner />;
  if (error)   return <div style={{ color:'#ef4444', padding:20 }}>{error}</div>;
  if (!dispute) return null;

  const STATUS_COLOR = { open:'#3b82f6', under_review:'#f59e0b', resolved:'#10b981', closed:'#6b7280' };
  const color = STATUS_COLOR[dispute.status] || '#6b7280';

  return (
    <div style={{ maxWidth:700, margin:'0 auto' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:28, boxShadow:'0 2px 12px rgba(0,0,0,.08)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:22, fontWeight:700, margin:'0 0 4px' }}>Dispute #{dispute.id}</h2>
            <p style={{ color:'#6b7280', margin:0, fontSize:14 }}>For: <strong>{dispute.job_title || `Job #${dispute.job_id}`}</strong></p>
          </div>
          <span style={{ padding:'6px 14px', borderRadius:20, background: color+'20', color, fontWeight:600, fontSize:13, border:`1px solid ${color}` }}>
            {dispute.status?.replace('_', ' ')}
          </span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
          <div style={{ background:'#f9fafb', borderRadius:8, padding:14 }}>
            <div style={{ fontSize:12, color:'#9ca3af', marginBottom:2 }}>Raised By</div>
            <div style={{ fontWeight:500 }}>{dispute.raised_by_name || `User #${dispute.raised_by}`}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>{dispute.raised_by_email}</div>
          </div>
          <div style={{ background:'#f9fafb', borderRadius:8, padding:14 }}>
            <div style={{ fontSize:12, color:'#9ca3af', marginBottom:2 }}>Against</div>
            <div style={{ fontWeight:500 }}>{dispute.against_user_name || `User #${dispute.against_user}`}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>{dispute.against_user_email}</div>
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, color:'#9ca3af', marginBottom:4 }}>Reason</div>
          <p style={{ margin:0, fontWeight:500 }}>{dispute.reason}</p>
        </div>

        {dispute.description && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, color:'#9ca3af', marginBottom:4 }}>Description</div>
            <p style={{ margin:0, fontSize:14, color:'#374151', lineHeight:1.6 }}>{dispute.description}</p>
          </div>
        )}

        {dispute.evidence_urls?.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, color:'#9ca3af', marginBottom:8 }}>Evidence Photos</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {dispute.evidence_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`Evidence ${i+1}`} style={{ width:80, height:80, borderRadius:8, objectFit:'cover' }} />
                </a>
              ))}
            </div>
          </div>
        )}

        {dispute.resolution_notes && (
          <div style={{ background:'#f0fdf4', borderRadius:8, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:13, color:'#059669', fontWeight:500, marginBottom:4 }}>Resolution Notes</div>
            <p style={{ margin:0, fontSize:14, color:'#374151' }}>{dispute.resolution_notes}</p>
          </div>
        )}

        <div style={{ fontSize:12, color:'#9ca3af', display:'flex', gap:16, flexWrap:'wrap' }}>
          <span>Created: {formatDateTime(dispute.created_at)}</span>
          {dispute.resolved_at && <span>Resolved: {formatDateTime(dispute.resolved_at)}</span>}
        </div>

        {/* Actions */}
        {(dispute.raised_by === user?.id || dispute.against_user === user?.id) && dispute.status === 'open' && (
          <button onClick={handleClose} disabled={updating}
            style={{ marginTop:20, padding:'10px 20px', background:'#f3f4f6', color:'#374151', border:'none', borderRadius:8, cursor:'pointer', fontWeight:500 }}>
            {updating ? 'Closing…' : 'Close Dispute'}
          </button>
        )}
      </div>
    </div>
  );
};

export default DisputeDetailPage;
