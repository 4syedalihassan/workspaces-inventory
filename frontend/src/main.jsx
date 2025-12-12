import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { theme } from './theme'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ConfigProvider theme={theme}>
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </StrictMode>,
)
