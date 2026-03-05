import { useState, useEffect } from "react";
import { Plus, Baby, Pencil, X } from "lucide-react";
import api from "../../services/api";
import Layout from "../../components/Layout";

interface Aluno {
  id: number;
  nome: string;
  turma: string;
  data_nascimento: string | null;
  ativo: boolean;
}

export default function Alunos() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nome: "", turma: "", data_nascimento: "", usuario_pai_id: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAlunos = async () => {
    const res = await api.get("/alunos");
    setAlunos(res.data);
  };

  useEffect(() => { fetchAlunos(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        nome: form.nome,
        turma: form.turma,
        data_nascimento: form.data_nascimento || null,
        usuario_pai_id: form.usuario_pai_id ? Number(form.usuario_pai_id) : null,
      };
      if (editingId) {
        await api.put(`/alunos/${editingId}`, payload);
      } else {
        await api.post("/alunos", payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ nome: "", turma: "", data_nascimento: "", usuario_pai_id: "" });
      fetchAlunos();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (a: Aluno) => {
    setEditingId(a.id);
    setForm({ nome: a.nome, turma: a.turma, data_nascimento: a.data_nascimento || "", usuario_pai_id: "" });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Desativar este aluno?")) return;
    await api.delete(`/alunos/${id}`);
    fetchAlunos();
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Baby size={22} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">Alunos</h1>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ nome: "", turma: "", data_nascimento: "", usuario_pai_id: "" }); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
          >
            <Plus size={16} /> Novo Aluno
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">{editingId ? "Editar Aluno" : "Novo Aluno"}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Turma *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.turma} onChange={(e) => setForm({ ...form, turma: e.target.value })} required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">ID do Usuário Pai (opcional)</label>
                <input
                  type="number"
                  placeholder="ID do usuário pai no sistema"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.usuario_pai_id} onChange={(e) => setForm({ ...form, usuario_pai_id: e.target.value })}
                />
              </div>
              {error && <p className="col-span-2 text-red-600 text-sm">{error}</p>}
              <div className="col-span-2 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {loading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        )}

        {alunos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            <Baby size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum aluno cadastrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(
              alunos.reduce((acc, a) => {
                if (!acc[a.turma]) acc[a.turma] = [];
                acc[a.turma].push(a);
                return acc;
              }, {} as Record<string, Aluno[]>)
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([turma, lista]) => (
                <div key={turma} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{turma}</span>
                    <span className="text-xs text-gray-400">{lista.length} aluno{lista.length !== 1 ? "s" : ""}</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {lista.map((a) => (
                        <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{a.nome}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {a.data_nascimento ? new Date(a.data_nascimento).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="px-4 py-3 flex gap-2 justify-end">
                            <button onClick={() => handleEdit(a)} className="text-blue-500 hover:text-blue-700"><Pencil size={15} /></button>
                            <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-600"><X size={15} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
