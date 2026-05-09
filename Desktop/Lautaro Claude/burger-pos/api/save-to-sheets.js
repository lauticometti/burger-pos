import express from 'express'
import { google } from 'googleapis'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import dotenv from 'dotenv'

// Load .env file
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') })

const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(cors())
app.use(express.json())

const SHEET_ID = process.env.VITE_GOOGLE_SHEETS_ID || ''
const SERVICE_KEY_PATH = process.env.GOOGLE_SERVICE_KEY || path.join(__dirname, '../service-account-key.json')

async function getSheets() {
  const keyFile = JSON.parse(fs.readFileSync(SERVICE_KEY_PATH, 'utf8'))

  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  return google.sheets({ version: 'v4', auth })
}

app.post('/api/save-to-sheets', async (req, res) => {
  try {
    const { orderNumber, customerName, items, total } = req.body

    if (!SHEET_ID) {
      return res.status(400).json({ error: 'VITE_GOOGLE_SHEETS_ID not configured' })
    }

    const sheets = await getSheets()
    const timestamp = new Date()
    const fecha = timestamp.toLocaleDateString('es-AR')
    const hora = timestamp.toLocaleTimeString('es-AR')
    const itemsStr = items.map(item => `${item.name} x${item.qty}`).join('; ')

    const values = [
      [fecha, hora, orderNumber, customerName, itemsStr, total],
    ]

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Pedidos!A:F',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    })

    res.json({ success: true, message: 'Pedido guardado en Google Sheets' })
  } catch (error) {
    console.error('Error guardando en Sheets:', error)
    res.status(500).json({ error: error.message })
  }
})

app.listen(3000, () => {
  console.log('API servidor en http://localhost:3000')
})
