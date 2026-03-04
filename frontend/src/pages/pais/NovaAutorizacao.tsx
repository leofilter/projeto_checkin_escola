import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, ArrowLeft, CheckCircle } from "lucide-react";
import api from "../../services/api";
import Layout from "../../components/Layout";

interface Aluno { id: number; nome: string; turma: string; }
interface Responsavel { id: number; nome: string; parentesco: string; face_encoding: string | null; }

export default function NovaAutorizacao() {
  const navigate = useNavigate();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [form, setForm] = useState({ aluno_id: "", responsavel_id: "", data_autorizacao: "", hora_prevista: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ qrcode_image: string; token: string } | null>(null);

  useEffect(() => {
    api.get("/alunos").then((r) => setAlunos(r.data));
  }, []);

  useEffect(() => {
    if (form.aluno_id) {
      api.get(`/responsaveis?aluno_id=${form.aluno_id}`).then((r) => setResponsaveis(r.data));
    }
  }, [form.aluno_id]);

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/autorizacoes", {
        aluno_id: Number(form.aluno_id),
        responsavel_id: Number(form.responsavel_id),
        data_autorizacao: form.data_autorizacao,
        hora_prevista: form.hora_prevista || null,
      });
      setCreated({ qrcode_image: res.data.qrcode_image, token: res.data.qrcode_token });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao criar autorização");
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <Layout>
        <div className="max-w-sm mx-auto text-center mt-8">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-1">Autorização criada!</h2>
          <p className="text-sm text-gray-500 mb-6">Mostre o QR Code abaixo para o responsável apresentar na portaria.</p>
          {created.qrcode_image && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 inline-block mb-6">
              <img
                src={`data:image/png;base64,${created.qrcode_image}`}
                alt="QR Code"
                className="w-56 h-56"
              />
            </div>
          )}
          <p className="text-xs text-gray-400 mb-6">QR Code válido apenas para hoje até 23:59</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate("/pais/dashboard")} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <ArrowLeft size={14} /> Voltar
            </button>
            <button onClick={() => { setCreated(null); setForm({ aluno_id: "", responsavel_id: "", data_autorizacao: "", hora_prevista: "" }); }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Nova Autorização
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/pais/dashboard")} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <QrCode size={22} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">Nova Autorização</h1>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aluno *</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.aluno_id}
                onChange={(e) => setForm({ ...form, aluno_id: e.target.value, responsavel_id: "" })}
                required
              >
                <option value="">Selecione o aluno...</option>
                {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome} ({a.turma})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quem vai buscar *</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.responsavel_id}
                onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}
                required
                disabled={!form.aluno_id}
              >
                <option value="">Selecione o responsável...</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome} ({r.parentesco}){r.face_encoding ? " ✓ facial" : ""}
                  </option>
                ))}
              </select>
              {form.aluno_id && responsaveis.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Nenhum responsável cadastrado para este aluno.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                <input
                  type="date"
                  min={today}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.data_autorizacao}
                  onChange={(e) => setForm({ ...form, data_autorizacao: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horário previsto</label>
                <input
                  type="time"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.hora_prevista}
                  onChange={(e) => setForm({ ...form, hora_prevista: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"
            >
              <QrCode size={16} />
              {loading ? "Gerando QR Code..." : "Gerar QR Code"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
