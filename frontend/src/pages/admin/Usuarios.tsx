import { useState, useEffect } from "react";
import { Plus, Users, X, Trash2 } from "lucide-react";
import api from "../../services/api";
import Layout from "../../components/Layout";
import { useAuth } from "../../contexts/AuthContext";

interface Usuario {
  id: number; email: string; nome: string; role: string; ativo: boolean;
}

export default function Usuarios() {
  const { user: me } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", senha: "", nome: "", role: "porteiro" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const fetchUsuarios = async () => {
    const res = await api.get("/auth/usuarios");
    setUsuarios(res.data);
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/usuarios", form);
      setShowForm(false);
      setForm({ email: "", senha: "", nome: "", role: "porteiro" });
      fetchUsuarios();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao criar usuário");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (u: Usuario) => {
    setDeleteError("");
    if (!confirm(`Excluir o usuário "${u.nome}"?`)) return;
    try {
      await api.delete(`/auth/usuarios/${u.id}`);
      fetchUsuarios();
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || "Erro ao excluir usuário");
    }
  };

  const roleLabel = (r: string) => ({ admin: "Admin", porteiro: "Porteiro" }[r] || r);
  const roleColor = (r: string) => ({
    admin: "bg-purple-100 text-purple-700",
    porteiro: "bg-green-100 text-green-700",
  }[r] || "bg-gray-100 text-gray-700");

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users size={22} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">Usuários</h1>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg">
            <Plus size={16} /> Novo Usuário
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">Novo Usuário</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={6} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Perfil *</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="porteiro">Porteiro</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {error && <p className="col-span-2 text-red-600 text-sm">{error}</p>}
              <div className="col-span-2 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? "Criando..." : "Criar"}</button>
              </div>
            </form>
          </div>
        )}

        {deleteError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {deleteError}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Nome</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">E-mail</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Perfil</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(u.role)}`}>{roleLabel(u.role)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== me?.user_id && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-red-400 hover:text-red-600"
                        title="Excluir usuário"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
