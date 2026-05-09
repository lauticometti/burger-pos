import React, { useState } from 'react'

const STATUS_OPTIONS = [
  { value: 'nuevo', label: 'Nuevo', color: '#888' },
  { value: 'en_cocina', label: 'En cocina', color: '#f59e0b' },
  { value: 'listo', label: 'Listo', color: '#3b82f6' },
  { value: 'entregado', label: 'Entregado', color: '#22c55e' },
  { value: 'cancelado', label: 'Cancelado', color: '#ef4444' },
]

const PAYMENT_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transfer.',
  mercado_pago: 'MP',
  otro: 'Otro',
}

function PaymentStatusToggle({ status, docId, onUpdate }) {
  const isPending = status !== 'pagado'
  return (
    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
      <button
        onClick={(e) => { e.stopPropagation(); if (isPending) return; onUpdate(docId, 'pendiente'); }}
        style={{
          padding: '0 10px',
          height: '32px',
          fontSize: '11px',
          fontWeight: 'bold',
          border: 'none',
          cursor: isPending ? 'default' : 'pointer',
          background: isPending ? '#f59e0b' : 'rgba(255,255,255,0.05)',
          color: isPending ? '#000' : 'rgba(255,255,255,0.35)',
          transition: 'background 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        Pendiente
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); if (!isPending) return; onUpdate(docId, 'pagado'); }}
        style={{
          padding: '0 10px',
          height: '32px',
          fontSize: '11px',
          fontWeight: 'bold',
          border: 'none',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          cursor: !isPending ? 'default' : 'pointer',
          background: !isPending ? '#22c55e' : 'rgba(255,255,255,0.05)',
          color: !isPending ? '#000' : 'rgba(255,255,255,0.35)',
          transition: 'background 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        Pagado
      </button>
    </div>
  )
}

function isSameDay(firestoreTimestamp) {
  if (!firestoreTimestamp) return false;
  const d = firestoreTimestamp.toDate ? firestoreTimestamp.toDate() : new Date(firestoreTimestamp);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function StatusBadge({ status }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 'bold',
      color: opt.color,
      border: `1px solid ${opt.color}`,
      whiteSpace: 'nowrap',
    }}>
      {opt.label}
    </span>
  );
}

function ActionRow({ order, updateOrderStatus, printTicket, printTickets }) {
  const [updating, setUpdating] = useState(false);

  const handleStatus = async (status) => {
    setUpdating(true);
    try {
      await updateOrderStatus(order.id, status);
    } finally {
      setUpdating(false);
    }
  };

  const btnStyle = (color = 'var(--panel)') => ({
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 'bold',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: color,
    color: color === 'var(--panel)' ? 'var(--text)' : '#000',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <tr style={{ background: 'rgba(255,198,42,0.04)' }}>
      <td colSpan={7} style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: '4px' }}>Estado:</span>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStatus(opt.value)}
              disabled={updating || order.status === opt.value}
              style={{
                ...btnStyle(),
                border: order.status === opt.value ? `1px solid ${opt.color}` : '1px solid rgba(255,255,255,0.1)',
                color: order.status === opt.value ? opt.color : 'var(--muted)',
                opacity: updating ? 0.5 : 1,
              }}
            >
              {opt.label}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button onClick={() => printTicket(order, 'cliente')} style={btnStyle()}>
              Cliente
            </button>
            <button onClick={() => printTicket(order, 'cocina')} style={btnStyle()}>
              Cocina
            </button>
            <button onClick={() => printTicket(order, 'caja')} style={btnStyle()}>
              Caja
            </button>
            <button onClick={() => printTickets(order)} style={{ ...btnStyle('var(--y)'), color: '#000' }}>
              3 comandas
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function OrderHistory({ orders, loading, updateOrderStatus, updatePaymentStatus, printTicket, printTickets }) {
  const [expandedId, setExpandedId] = useState(null);

  const todayOrders = orders
    .filter(o => isSameDay(o.createdAt))
    .sort((a, b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return ta - tb;
    });

  const total = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div style={{
      background: 'var(--panel)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow)',
      padding: '24px',
      marginTop: '32px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text)', margin: 0 }}>
          Pedidos del día
        </h2>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{todayOrders.length} pedidos</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--y)' }}>
            ${total.toLocaleString()}
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>Cargando...</p>
      ) : todayOrders.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>Sin pedidos hoy</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line)' }}>
                {['#', 'Hora', 'Cliente', 'Total', 'Pago', 'Estado pago', 'Estado'].map(col => (
                  <th key={col} style={{
                    padding: '10px 8px', fontWeight: 'bold', color: 'var(--muted)',
                    textAlign: col === 'Total' ? 'right' : 'left', fontSize: '11px',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todayOrders.map(order => {
                const isExpanded = expandedId === order.id;
                const hora = order.createdAt?.toDate
                  ? order.createdAt.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                  : '-';
                return (
                  <React.Fragment key={order.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid var(--line)',
                        cursor: 'pointer',
                        background: isExpanded ? 'rgba(255,198,42,0.06)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 8px', fontWeight: '600', color: 'var(--y)' }}>
                        #{String(order.orderNumber || 0).padStart(3, '0')}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--muted)' }}>{hora}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--text)', fontWeight: '500' }}>
                        {order.customerName}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: 'var(--text)' }}>
                        ${(order.total || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--muted)' }}>
                        {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || '-'}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <PaymentStatusToggle
                          status={order.paymentStatus}
                          docId={order.id}
                          onUpdate={updatePaymentStatus}
                        />
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <StatusBadge status={order.status || 'nuevo'} />
                      </td>
                    </tr>
                    {isExpanded && (
                      <ActionRow
                        order={order}
                        updateOrderStatus={updateOrderStatus}
                        printTicket={printTicket}
                        printTickets={printTickets}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
