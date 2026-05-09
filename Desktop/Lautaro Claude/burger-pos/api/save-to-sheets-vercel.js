import { google } from 'googleapis'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { orderNumber, customerName, items, total } = req.body

    const SHEET_ID = process.env.VITE_GOOGLE_SHEETS_ID
    if (!SHEET_ID) {
      return res.status(400).json({ error: 'VITE_GOOGLE_SHEETS_ID not configured' })
    }

    // Parse service account from env var (it's stored as JSON string)
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}')

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const timestamp = new Date()
    const fecha = timestamp.toLocaleDateString('es-AR')
    const hora = timestamp.toLocaleTimeString('es-AR')
    const itemsStr = items.map(item => `${item.name} x${item.qty}`).join('; ')

    const values = [[fecha, hora, orderNumber, customerName, itemsStr, total]]

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Pedidos!A:F',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    })

    res.status(200).json({ success: true, message: 'Pedido guardado en Google Sheets' })
  } catch (error) {
    console.error('Error guardando en Sheets:', error)
    res.status(500).json({ error: error.message })
  }
}
