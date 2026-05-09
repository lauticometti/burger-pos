// Este archivo debe actualizarse cada vez que cambie el flujo operativo del POS.
// Comanda para Claude: "genera instrucciones para el sistema POS"

export function PosInstructions({ onBack }) {
  const section = (title, children) => (
    <div style={{
      background: 'var(--panel)',
      borderRadius: 'var(--radius)',
      padding: '20px',
      marginBottom: '16px',
    }}>
      <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--y)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </h2>
      {children}
    </div>
  )

  const step = (num, text) => (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--y)', fontWeight: 'bold', fontSize: '14px', minWidth: '20px' }}>{num}.</span>
      <span style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.5 }}>{text}</span>
    </div>
  )

  const rule = (text) => (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--r)', fontWeight: 'bold', fontSize: '14px', minWidth: '16px' }}>—</span>
      <span style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.5 }}>{text}</span>
    </div>
  )

  const check = (text) => (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--y)', fontWeight: 'bold', fontSize: '14px', minWidth: '16px' }}>[ ]</span>
      <span style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.5 }}>{text}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              color: 'var(--text)',
              fontWeight: 'bold',
              padding: '10px 18px',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Volver
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)', margin: 0 }}>
            Instrucciones de uso del POS
          </h1>
        </div>

        {/* 1. Cómo tomar un pedido */}
        {section('1. Cómo tomar un pedido con cliente enfrente', <>
          {step(1, 'Saludar y pedir el nombre del cliente.')}
          {step(2, 'Preguntar si es Local, Retiro o Delivery.')}
          {step(3, 'Elegir el tamaño de cada burger desde los botones: Simple, Doble, Triple, Cuádruple, Quíntuple o Séxtuple. Cada toque agrega una burger de ese tamaño.')}
          {step(4, 'Si hay burgers del mismo tamaño, usar [-] y [+] en el carrito para ajustar la cantidad.')}
          {step(5, 'Preguntar si alguna burger va sin cheddar. Tocar "Quitar cheddar" en la burger correspondiente.')}
          {step(6, 'Cargar papas fritas si el cliente pide.')}
          {step(7, 'Cargar bebidas.')}
          {step(8, 'Cargar dips.')}
          {step(9, 'Repetir el pedido completo de arriba a abajo antes de confirmar (ver sección 2).')}
          {step(10, 'Tocar "Confirmar Pedido", completar el formulario y guardar.')}
          <div style={{ background: 'rgba(255,198,42,0.08)', border: '1px solid rgba(255,198,42,0.25)', borderRadius: '10px', padding: '12px', marginTop: '8px' }}>
            <p style={{ fontSize: '13px', color: 'var(--y)', fontWeight: '700', margin: '0 0 4px' }}>REGLA DE ORO:</p>
            <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
              Primero elegí el tamaño correcto de burger desde los botones: Simple, Doble, Triple, Cuádruple, Quíntuple o Séxtuple. En el carrito solo corregís cantidad o cheddar.
            </p>
          </div>
        </>)}

        {/* 2. Regla de repetición */}
        {section('2. Regla obligatoria de repetición', <>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '12px', lineHeight: 1.5 }}>
            Antes de cobrar o imprimir, repetir el pedido al cliente en este orden:
          </p>
          <div style={{ background: 'rgba(255,198,42,0.06)', border: '1px solid rgba(255,198,42,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 6px', fontWeight: '600' }}>ORDEN DE REPETICION:</p>
            <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0, lineHeight: 1.8 }}>
              Burgers → Papas → Bebidas → Dips → Tipo de pedido → Medio de pago → Total
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px' }}>
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 6px', fontWeight: '600' }}>EJEMPLO:</p>
            <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0, lineHeight: 1.8, fontStyle: 'italic' }}>
              "Te repito: 2 Smash Burger Simple, una sin cheddar; 1 Papas Fritas; 1 Coca 600; 1 Dip Salsa Secreta. Es para local, pagas en efectivo. Total $XX.XXX."
            </p>
          </div>
        </>)}

        {/* 3. Cómo corregir errores */}
        {section('3. Cómo corregir errores', <>
          {rule('Cambiar cantidad: usar los botones [-] y [+] en la fila "Cantidad" del item en el carrito.')}
          {rule('Cambiar tamaño de burger: eliminar la línea con × y tocar el botón correcto (Simple, Doble, Triple...) en el POS. No se puede cambiar el tamaño desde el carrito.')}
          {rule('Quitar o agregar cheddar: tocar "Quitar cheddar" o "Agregar cheddar" en la burger. El estado se muestra en la línea de info debajo del nombre.')}
          {rule('Eliminar un item: tocar el botón × rojo a la derecha del nombre del producto.')}
          {rule('Vaciar todo el carrito: tocar "Vaciar carrito" (arriba del carrito, texto pequeño). Pide confirmación antes de limpiar.')}
          {rule('Ver pedido completo: tocar "Ver pedido completo" para revisar el carrito expandido. Desde ahí también se puede confirmar o volver.')}
          {rule('Volver desde confirmación: tocar "Atras" en la pantalla de confirmación para seguir editando el carrito.')}
        </>)}

        {/* 4. Cómo usar Miti miti */}
        {section('4. Cómo usar Miti miti', <>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '12px', lineHeight: 1.5 }}>
            Usar cuando el cliente paga con dos medios distintos (por ejemplo, parte en transferencia y parte en efectivo).
          </p>
          {step(1, 'Seleccionar "Miti miti" como medio de pago.')}
          {step(2, 'Aparecen 3 campos: Transferencia, Efectivo, Queda debiendo.')}
          {step(3, 'Completar 2 de los 3 campos. El tercero se calcula automáticamente.')}
          {step(4, 'Verificar que la suma coincida con el total del pedido. Si no coincide, aparece una advertencia en amarillo.')}
          {step(5, 'El desglose queda guardado en el pedido y se imprime en el ticket.')}
          <div style={{ background: 'rgba(255,198,42,0.06)', border: '1px solid rgba(255,198,42,0.2)', borderRadius: '10px', padding: '14px', marginTop: '8px' }}>
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 4px', fontWeight: '600' }}>EJEMPLO:</p>
            <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0, lineHeight: 1.8 }}>
              Total: $40.000<br />
              Transferencia: $25.000 → Efectivo: $15.000 → Queda debiendo: $0<br />
              O: Transferencia: $20.000, Queda debiendo: $5.000 → Efectivo: $15.000
            </p>
          </div>
        </>)}

        {/* 5. Checklist antes de imprimir */}
        {section('5. Checklist antes de imprimir', <>
          {check('Nombre del cliente cargado.')}
          {check('Tipo de pedido correcto (Local / Retiro / Delivery).')}
          {check('Medio de pago correcto.')}
          {check('Estado de pago correcto (Pagado / Pendiente).')}
          {check('Pedido repetido al cliente y confirmado.')}
          {check('Total confirmado por el cliente.')}
          {check('Observaciones cargadas si el cliente pidió algo especial.')}
          {check('Si es Miti miti: suma coincide con el total.')}
        </>)}

        {/* 6. Errores que no se permiten */}
        {section('6. Errores que no se permiten', <>
          {rule('No imprimir sin haber repetido el pedido al cliente.')}
          {rule('No confirmar si el cliente no escuchó el total.')}
          {rule('No usar "Canje" como pago común. Canje es solo para situaciones especiales autorizadas.')}
          {rule('No dejar un pedido sin nombre del cliente.')}
          {rule('No tocar "Vaciar carrito" salvo que el pedido realmente se cancele. La acción pide confirmación pero es irreversible.')}
          {rule('No cerrar el navegador ni usar los botones laterales del mouse mientras hay un pedido en curso. Si hay carrito activo, el sistema pide confirmación antes de salir.')}
        </>)}

      </div>
    </div>
  )
}
