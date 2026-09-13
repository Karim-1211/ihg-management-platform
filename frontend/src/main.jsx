import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AssistantProvider } from './context/AssistantContext'
import { StaffAssistantProvider } from './context/StaffAssistantContext'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AssistantProvider>
          <StaffAssistantProvider>
            <App />
          </StaffAssistantProvider>
        </AssistantProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)