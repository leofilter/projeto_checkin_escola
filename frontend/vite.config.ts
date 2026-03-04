import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    port: 5173,
    proxy: {
      '/chegada/qrcode-escola': 'http://localhost:8000',
      '/chegada/buscar-por-cpf': 'http://localhost:8000',
      '/chegada/verificar-face': 'http://localhost:8000',
      '/chegada/confirmar': 'http://localhost:8000',
      '/chegada/registros-hoje': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/alunos': 'http://localhost:8000',
      '/responsaveis': 'http://localhost:8000',
      '/autorizacoes': 'http://localhost:8000',
      '/checkin': 'http://localhost:8000',
      '/registros': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
