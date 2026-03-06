import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Shield, Users, Baby, ClipboardList, LogOut } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const adminLinks = [
  { to: "/admin/alunos", label: "Alunos", icon: Baby },
  { to: "/admin/responsaveis", label: "Responsáveis", icon: Users },
  { to: "/admin/usuarios", label: "Usuários", icon: Users },
  { to: "/portaria", label: "Portaria", icon: Shield },
  { to: "/registros", label: "Registros", icon: ClipboardList },
];

const porteiroLinks = [
  { to: "/portaria", label: "Portaria", icon: Shield },
  { to: "/registros", label: "Registros", icon: ClipboardList },
];

const colaboradorLinks = [
  { to: "/admin/alunos", label: "Alunos", icon: Baby },
  { to: "/admin/responsaveis", label: "Responsáveis", icon: Users },
  { to: "/portaria", label: "Portaria", icon: Shield },
  { to: "/registros", label: "Registros", icon: ClipboardList },
];

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const links = user?.role === "admin" ? adminLinks : user?.role === "colaborador" ? colaboradorLinks : porteiroLinks;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-blue-600" />
            <span className="font-semibold text-gray-800 text-sm">Portaria Escolar</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{user?.nome}</p>
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded capitalize">
            {user?.role === "colaborador" ? "Colaborador" : user?.role}
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                location.pathname === to
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 w-full px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
