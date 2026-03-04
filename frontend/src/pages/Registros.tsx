import { useState, useEffect } from "react";
import { ClipboardList, CheckCircle, XCircle } from "lucide-react";
import api from "../services/api";
import Layout from "../components/Layout";

interface Registro {
  id: number;
  timestamp: string;
  face_match: boolean;
  face_confidence: number | null;
  observacao: string | null;
  autorizacao: {
    data_autorizacao: string;
    aluno: { nome: string; turma: string };
    responsavel: { nome: string; parentesco: string };
  };
  porteiro: { nome: string };
}

export default function Registros() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [dataFiltro, setDataFiltro] = useState("");

  const fetchRegistros = async () => {
    const params = dataFiltro ? `?data=${dataFiltro}` : "";
    const res = await api.get(`/registros${params}`);
    setRegistros(res.data);
  };

  useEffect(() => { fetchRegistros(); }, [dataFiltro]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ClipboardList size={22} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">Registros de Entrega</h1>
          </div>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            value={dataFiltro}
            onChange={(e) => setDataFiltro(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {registros.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <ClipboardList size={40} className="mx-auto mb-2 opacity-30" />
              <p>Nenhum registro encontrado</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Data/Hora</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Aluno</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Responsável</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Facial</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Porteiro</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{r.autorizacao.aluno.nome}</div>
                      <div className="text-xs text-gray-400">{r.autorizacao.aluno.turma}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{r.autorizacao.responsavel.nome}</div>
                      <div className="text-xs text-gray-400">{r.autorizacao.responsavel.parentesco}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.face_match ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={14} />
                          <span className="text-xs">{r.face_confidence?.toFixed(1)}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-orange-500">
                          <XCircle size={14} />
                          <span className="text-xs">Manual</span>
                        </div>
                      )}
                      {r.observacao && (
                        <div className="text-xs text-gray-400 mt-0.5 max-w-[160px] truncate" title={r.observacao}>
                          {r.observacao}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{r.porteiro.nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
