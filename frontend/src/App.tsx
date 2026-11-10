import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute, LoginRoute } from './auth/AuthRoutes'
import { AppLayout } from './components/Layout/AppLayout'
import { ModulePage, NotFoundPage } from './pages/InternalPages'
import { InicioPage } from './pages/Inicio/InicioPage'
import { navigation } from './navigation'
import { PermissionGuard } from './auth/PermissionGuard'
import './auth/session.css'

function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<LoginRoute />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<PermissionGuard permissao="inicio.visualizar"><InicioPage /></PermissionGuard>} />
        {navigation.filter(item => item.path !== '/').map(item =>
          <Route key={item.path} element={<PermissionGuard permissao={item.permissao} />}>
            <Route path={item.path} element={item.pagina ? <item.pagina /> : <ModulePage titulo={item.label} />} />
          </Route>,
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes></AuthProvider></BrowserRouter>
}

export default App
