/**
 * Painel do porteiro.
 * Monitora em tempo real as chegadas registradas pelos responsáveis via celular.
 */
import { useState, useEffect } from "react";
import { Shield, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import api from "../../services/api";
import Layout from "../../components/Layout";

interface Chegada {
  id: number;
  hora: string;
  timestamp: string;
  responsavel: { nome: string; parentesco: string };
  aluno: { nome: string; turma: string };
  face_match: boolean;
  face_confidence: number | null;
}

export default function Portaria() {
  const [chegadas, setChegadas] = useState<Chegada[]>([]);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date());

  const fetchChegadas = async () => {
    try {
      const res = await api.get("/chegada/registros-hoje");
      setChegadas(res.data);
      setUltimaAtualizacao(new Date());
    } catch {
      // silencioso — não interrompe o polling
    }
  };

  useEffect(() => {
    fetchChegadas().finally(() => setLoading(false));
    // Atualiza a lista de chegadas a cada 15 segundos
    const chegadasInterval = setInterval(fetchChegadas, 15000);
    return () => clearInterval(chegadasInterval);
  }, []);

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield size={22} className="text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Portaria</h1>
              <p className="text-xs text-gray-400 capitalize">{hoje}</p>
            </div>
          </div>
          <button
            onClick={fetchChegadas}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-600">
            {chegadas.length === 0 ? "Nenhuma chegada hoje" : `${chegadas.length} chegada${chegadas.length > 1 ? "s" : ""} hoje`}
          </p>
          <p className="text-xs text-gray-400">
            Atualizado às {ultimaAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : chegadas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
            <Shield size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Aguardando chegadas</p>
            <p className="text-sm mt-1">
              Os responsáveis acessam o sistema pelo celular para registrar a chegada.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chegadas.map((c) => (
              <div
                key={c.id}
                className={`bg-white rounded-xl border-2 p-4 ${c.face_match ? "border-green-200" : "border-orange-200"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-full mt-0.5 ${c.face_match ? "bg-green-100" : "bg-orange-100"}`}>
                      {c.face_match ? (
                        <CheckCircle size={18} className="text-green-600" />
                      ) : (
                        <AlertTriangle size={18} className="text-orange-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{c.aluno.nome}</p>
                      <p className="text-sm text-gray-500">
                        <span className="text-gray-700">{c.responsavel.nome}</span>
                        <span className="text-gray-400"> · {c.responsavel.parentesco}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{c.aluno.turma}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-700 text-lg">{c.hora}</p>
                    {c.face_match ? (
                      <p className="text-xs text-green-600">
                        {c.face_confidence?.toFixed(0)}% facial ✓
                      </p>
                    ) : (
                      <p className="text-xs text-orange-500">Manual</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          Atualiza automaticamente a cada 15 segundos
        </p>
      </div>
    </Layout>
  );
}
