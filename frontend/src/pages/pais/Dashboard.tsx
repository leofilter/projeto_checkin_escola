import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock, CheckCircle, XCircle, Plus } from "lucide-react";
import api from "../../services/api";
import Layout from "../../components/Layout";
import { useAuth } from "../../contexts/AuthContext";

interface Autorizacao {
  id: number;
  data_autorizacao: string;
  hora_prevista: string | null;
  usado: boolean;
  cancelado: boolean;
  aluno: { nome: string; turma: string };
  responsavel: { nome: string; parentesco: string };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [autorizacoes, setAutorizacoes] = useState<Autorizacao[]>([]);

  const fetchAutorizacoes = async () => {
    const res = await api.get("/autorizacoes");
    setAutorizacoes(res.data);
  };

  useEffect(() => { fetchAutorizacoes(); }, []);

  const cancelar = async (id: number) => {
    if (!confirm("Cancelar esta autorização?")) return;
    await api.post(`/autorizacoes/${id}/cancelar`);
    fetchAutorizacoes();
  };

  const today = new Date().toISOString().split("T")[0];

  const statusIcon = (a: Autorizacao) => {
    if (a.cancelado) return <XCircle size={16} className="text-red-400" />;
    if (a.usado) return <CheckCircle size={16} className="text-green-500" />;
    if (a.data_autorizacao < today) return <Clock size={16} className="text-gray-400" />;
    return <Clock size={16} className="text-blue-500" />;
  };

  const statusLabel = (a: Autorizacao) => {
    if (a.cancelado) return "Cancelada";
    if (a.usado) return "Utilizada";
    if (a.data_autorizacao < today) return "Expirada";
    if (a.data_autorizacao === today) return "Hoje";
    return "Agendada";
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Olá, {user?.nome}!</h1>
            <p className="text-sm text-gray-500">Gerencie as autorizações de retirada</p>
          </div>
          <Link
            to="/pais/nova-autorizacao"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
          >
            <Plus size={16} /> Nova Autorização
          </Link>
        </div>

        {autorizacoes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
            <Clock size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma autorização criada</p>
            <p className="text-sm mt-1">Crie uma autorização de retirada para o responsável</p>
            <Link to="/pais/nova-autorizacao" className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
              <Plus size={14} /> Criar autorização
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {autorizacoes.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {statusIcon(a)}
                      <span className="text-sm font-medium text-gray-800">{a.aluno.nome}</span>
                      <span className="text-xs text-gray-400">({a.aluno.turma})</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        a.usado ? "bg-green-100 text-green-700" :
                        a.cancelado ? "bg-red-100 text-red-700" :
                        a.data_autorizacao === today ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{statusLabel(a)}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{a.responsavel.nome}</span>
                      <span className="text-gray-400"> · {a.responsavel.parentesco}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.data_autorizacao).toLocaleDateString("pt-BR")}
                      {a.hora_prevista && ` às ${a.hora_prevista.substring(0, 5)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!a.usado && !a.cancelado && (
                      <button
                        onClick={() => cancelar(a.id)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg"
                        title="Cancelar"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </Layout>
  );
}
