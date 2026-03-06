import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Alunos from "./pages/admin/Alunos";
import Responsaveis from "./pages/admin/Responsaveis";
import Usuarios from "./pages/admin/Usuarios";
import Portaria from "./pages/portaria/Portaria";
import Registros from "./pages/Registros";
import Chegada from "./pages/chegada/Chegada";

function PrivateRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function DefaultRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin/alunos" replace />;
  return <Navigate to="/portaria" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Pública — responsável escaneia QR Code com o celular */}
      <Route path="/chegada" element={<Chegada />} />

      <Route path="/login" element={<Login />} />
      <Route path="/" element={<DefaultRedirect />} />

      {/* Admin */}
      <Route path="/admin/alunos" element={<PrivateRoute roles={["admin"]}><Alunos /></PrivateRoute>} />
      <Route path="/admin/responsaveis" element={<PrivateRoute roles={["admin"]}><Responsaveis /></PrivateRoute>} />
      <Route path="/admin/usuarios" element={<PrivateRoute roles={["admin"]}><Usuarios /></PrivateRoute>} />

      {/* Portaria — painel de monitoramento de chegadas */}
      <Route path="/portaria" element={<PrivateRoute roles={["porteiro", "admin"]}><Portaria /></PrivateRoute>} />

      {/* Registros */}
      <Route path="/registros" element={<PrivateRoute roles={["admin", "porteiro"]}><Registros /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
