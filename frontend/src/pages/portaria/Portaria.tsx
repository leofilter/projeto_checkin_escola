/**
 * Painel do porteiro.
 * Exibe o QR Code fixo da escola e monitora em tempo real
 * as chegadas registradas pelos responsáveis via celular.
 */
import { useState, useEffect } from "react";
import { Shield, CheckCircle, AlertTriangle, RefreshCw, QrCode, Monitor } from "lucide-react";
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

interface QRData {
  qr_image: string;
  url: string;
  instrucao: string;
}

export default function Portaria() {
  const [chegadas, setChegadas] = useState<Chegada[]>([]);
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [tab, setTab] = useState<"monitor" | "qrcode">("monitor");
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

  const fetchQR = async () => {
    try {
      const res = await api.get("/chegada/qrcode-escola");
      setQrData(res.data);
    } catch {}
  };

  useEffect(() => {
    Promise.all([fetchChegadas(), fetchQR()]).finally(() => setLoading(false));
    // Atualiza a lista de chegadas a cada 15 segundos
    const chegadasInterval = setInterval(fetchChegadas, 15000);
    // Renova o QR Code a cada 6 horas (token expira com a janela de 6h)
    const qrInterval = setInterval(fetchQR, 6 * 60 * 60 * 1000);
    return () => {
      clearInterval(chegadasInterval);
      clearInterval(qrInterval);
    };
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

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab("monitor")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "monitor" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Monitor size={15} />
            Monitor de Chegadas
            {chegadas.length > 0 && (
              <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {chegadas.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("qrcode")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "qrcode" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <QrCode size={15} /> QR Code da Escola
          </button>
        </div>

        {/* MONITOR DE CHEGADAS */}
        {tab === "monitor" && (
          <div>
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
                  Os responsáveis devem escanear o QR Code da escola com o celular.
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
        )}

        {/* QR CODE FIXO DA ESCOLA */}
        {tab === "qrcode" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <h2 className="font-semibold text-gray-800 mb-1">QR Code da Portaria</h2>
            <p className="text-sm text-gray-500 mb-5">
              Imprima ou exiba em uma tela na entrada da escola.
              Os responsáveis escaneiam com o celular para fazer o check-in.
            </p>

            {qrData ? (
              <>
                <div className="inline-block p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm mb-4">
                  <img
                    src={`data:image/png;base64,${qrData.qr_image}`}
                    alt="QR Code da Escola"
                    className="w-56 h-56"
                  />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">{qrData.instrucao}</p>
                <p className="text-xs text-gray-400 font-mono break-all mb-2">{qrData.url}</p>
                <p className="text-xs text-amber-600 mb-4">Atualiza automaticamente a cada 6 horas</p>
                <a
                  href={`data:image/png;base64,${qrData.qr_image}`}
                  download="qrcode-portaria.png"
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2.5 rounded-xl font-medium"
                >
                  Baixar QR Code (PNG)
                </a>
              </>
            ) : (
              <div className="py-8 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                <p className="text-sm">Gerando QR Code...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
