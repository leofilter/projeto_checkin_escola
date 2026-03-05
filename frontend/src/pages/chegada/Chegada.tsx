/**
 * Página pública de check-in de chegada.
 * O responsável escaneia o QR fixo da escola, informa o CPF,
 * seleciona um ou mais filhos, tira uma selfie e confirma.
 * Funciona no celular sem login.
 */
import { useState, useRef } from "react";
import { Camera, CheckCircle, XCircle, AlertTriangle, RefreshCw, User, ChevronRight } from "lucide-react";
import api from "../../services/api";

type State =
  | "cpf"
  | "loading_cpf"
  | "selecionar_filho"
  | "selfie"
  | "processing"
  | "face_result"
  | "confirmando"
  | "sucesso"
  | "erro";

interface Filho {
  id: number;
  nome: string;
  turma: string;
  responsavel_id: number;
}

interface ResponsavelInfo {
  responsavel_id: number;
  nome: string;
  parentesco: string;
  tem_facial: boolean;
  filhos: Filho[];
}

interface FaceResult {
  match: boolean;
  confidence: number | null;
  reason: string | null;
}

export default function Chegada() {
  const [state, setState] = useState<State>("cpf");
  const [cpf, setCpf] = useState("");
  const [responsavelInfo, setResponsavelInfo] = useState<ResponsavelInfo | null>(null);
  const [filhosSelecionados, setFilhosSelecionados] = useState<Filho[]>([]);
  const [faceResult, setFaceResult] = useState<FaceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [filhosConfirmados, setFilhosConfirmados] = useState<Filho[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const buscarPorCpf = async () => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) return;

    setState("loading_cpf");
    try {
      const res = await api.get(`/chegada/buscar-por-cpf/${cpf}`);
      setResponsavelInfo(res.data);
      setFilhosSelecionados([]);
      setState("selecionar_filho");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "CPF não encontrado no sistema.");
      setState("erro");
    }
  };

  const toggleFilho = (filho: Filho) => {
    setFilhosSelecionados((prev) =>
      prev.some((f) => f.id === filho.id)
        ? prev.filter((f) => f.id !== filho.id)
        : [...prev, filho]
    );
  };

  const iniciarSelfie = async () => {
    setState("selfie");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setErrorMsg("Não foi possível acessar a câmera do celular.");
      setState("erro");
    }
  };

  const capturarSelfie = async () => {
    if (!videoRef.current || !responsavelInfo) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);

    stopCamera();
    setState("processing");

    const blob = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", 0.85)
    );

    const formData = new FormData();
    formData.append("responsavel_id", String(responsavelInfo.responsavel_id));
    formData.append("selfie", blob, "selfie.jpg");

    try {
      const res = await api.post("/chegada/verificar-face", formData);
      setFaceResult(res.data);
      setState("face_result");
    } catch (err: any) {
      setErrorMsg("Erro ao processar reconhecimento facial.");
      setState("erro");
    }
  };

  const confirmarChegada = async () => {
    if (!responsavelInfo || filhosSelecionados.length === 0) return;

    setState("confirmando");
    try {
      await Promise.all(
        filhosSelecionados.map((filho) =>
          api.post("/chegada/confirmar", {
            responsavel_id: filho.responsavel_id,
            aluno_id: filho.id,
            face_match: true,
            face_confidence: faceResult?.confidence ?? null,
            observacao: null,
          })
        )
      );
      setFilhosConfirmados(filhosSelecionados);
      setState("sucesso");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Erro ao registrar chegada.");
      setState("erro");
    }
  };

  const reiniciar = () => {
    stopCamera();
    setState("cpf");
    setCpf("");
    setResponsavelInfo(null);
    setFilhosSelecionados([]);
    setFaceResult(null);
    setErrorMsg("");
    setFilhosConfirmados([]);
  };

  // Agrupa filhos por turma
  const filhosPorTurma = responsavelInfo
    ? responsavelInfo.filhos.reduce((acc, filho) => {
        if (!acc[filho.turma]) acc[filho.turma] = [];
        acc[filho.turma].push(filho);
        return acc;
      }, {} as Record<string, Filho[]>)
    : {};
  const turmas = Object.keys(filhosPorTurma).sort();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 pt-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-3">
            <User size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Check-in de Chegada</h1>
          <p className="text-sm text-gray-500 mt-1">Portaria Escolar</p>
        </div>

        {/* ETAPA 1 — CPF */}
        {state === "cpf" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-700 mb-1">Informe seu CPF</h2>
            <p className="text-sm text-gray-400 mb-4">Para identificarmos quem você é</p>
            <input
              type="tel"
              inputMode="numeric"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-mono text-center focus:outline-none focus:border-blue-500"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && buscarPorCpf()}
              maxLength={14}
            />
            <button
              onClick={buscarPorCpf}
              disabled={cpf.replace(/\D/g, "").length !== 11}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              Continuar <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* LOADING CPF */}
        {state === "loading_cpf" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Buscando seu cadastro...</p>
          </div>
        )}

        {/* ETAPA 2 — SELECIONAR FILHOS (checkboxes por turma) */}
        {state === "selecionar_filho" && responsavelInfo && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="mb-4">
              <p className="text-sm text-gray-500">Bem-vindo(a),</p>
              <p className="text-lg font-bold text-gray-800">{responsavelInfo.nome}</p>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-3">
              Quem você vai buscar hoje?{" "}
              <span className="text-gray-400 font-normal">(selecione um ou mais)</span>
            </p>

            <div className="space-y-4">
              {turmas.map((turma) => (
                <div key={turma}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Turma {turma}
                  </p>
                  <div className="space-y-2">
                    {filhosPorTurma[turma].map((filho) => {
                      const selecionado = filhosSelecionados.some((f) => f.id === filho.id);
                      return (
                        <label
                          key={filho.id}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                            selecionado
                              ? "bg-blue-50 border-blue-400"
                              : "bg-gray-50 border-gray-200 hover:border-blue-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selecionado}
                            onChange={() => toggleFilho(filho)}
                            className="w-4 h-4 accent-blue-600"
                          />
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">{filho.nome}</p>
                          </div>
                          {selecionado && <CheckCircle size={18} className="text-blue-500" />}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={iniciarSelfie}
              disabled={filhosSelecionados.length === 0}
              className="mt-5 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              Continuar ({filhosSelecionados.length} selecionado{filhosSelecionados.length !== 1 ? "s" : ""})
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ETAPA 3 — SELFIE */}
        {state === "selfie" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm text-gray-600 text-center mb-3 font-medium">
              Posicione seu rosto na câmera
            </p>
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="border-4 border-white opacity-50 rounded-full"
                  style={{ width: "65%", height: "80%" }}
                />
              </div>
            </div>
            <button
              onClick={capturarSelfie}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              <Camera size={20} /> Tirar Selfie
            </button>
            <button onClick={() => setState("selecionar_filho")} className="mt-2 w-full text-sm text-gray-400 py-2">
              Voltar
            </button>
          </div>
        )}

        {/* PROCESSING */}
        {state === "processing" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">Verificando reconhecimento facial...</p>
            <p className="text-gray-400 text-sm mt-1">Aguarde alguns segundos</p>
          </div>
        )}

        {/* RESULTADO FACIAL */}
        {state === "face_result" && faceResult && filhosSelecionados.length > 0 && (
          <div className={`bg-white rounded-2xl shadow-sm border-2 p-5 ${faceResult.match ? "border-green-300" : "border-red-300"}`}>
            {faceResult.match ? (
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-100 p-2.5 rounded-full">
                  <CheckCircle size={28} className="text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-green-700">Identidade confirmada!</p>
                  <p className="text-sm text-green-600">Similaridade: {faceResult.confidence?.toFixed(1)}%</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-2.5 rounded-full">
                  <AlertTriangle size={28} className="text-red-500" />
                </div>
                <div>
                  <p className="font-bold text-red-700">Identidade não confirmada</p>
                  <p className="text-sm text-red-600">{faceResult.reason || "Tente novamente com melhor iluminação"}</p>
                </div>
              </div>
            )}

            {/* Lista de filhos selecionados */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">Buscando</p>
              <div className="space-y-1">
                {filhosSelecionados.map((f) => (
                  <p key={f.id} className="font-semibold text-gray-800">
                    {f.nome} <span className="text-xs font-normal text-gray-400">Turma {f.turma}</span>
                  </p>
                ))}
              </div>
            </div>

            {faceResult.match ? (
              <button
                onClick={confirmarChegada}
                className="w-full py-3 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700"
              >
                ✓ Confirmar Chegada
              </button>
            ) : (
              <p className="text-xs text-center text-gray-500 mb-3">
                O check-in só é permitido com reconhecimento facial aprovado.
              </p>
            )}

            <button
              onClick={iniciarSelfie}
              className="mt-2 w-full border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm flex items-center justify-center gap-1"
            >
              <RefreshCw size={14} /> Tentar selfie novamente
            </button>
          </div>
        )}

        {/* CONFIRMANDO */}
        {state === "confirmando" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">Registrando sua chegada...</p>
          </div>
        )}

        {/* SUCESSO */}
        {state === "sucesso" && responsavelInfo && (
          <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-6 text-center">
            <div className="bg-green-100 p-4 rounded-full inline-block mb-4">
              <CheckCircle size={48} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-700 mb-2">Check-in Registrado!</h2>
            <p className="text-gray-600 text-sm mb-3">
              Você está autorizado(a) a retirar{filhosConfirmados.length > 1 ? "" : ""}:
            </p>
            <div className="space-y-1 mb-4">
              {filhosConfirmados.map((f) => (
                <p key={f.id} className="text-xl font-bold text-gray-800">
                  {f.nome}
                </p>
              ))}
            </div>
            <p className="text-gray-400 text-sm mb-6">
              {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-6 text-sm text-blue-700">
              O porteiro foi notificado. Aguarde a liberação.
            </div>
            <button
              onClick={reiniciar}
              className="w-full border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm"
            >
              Novo check-in
            </button>
          </div>
        )}

        {/* ERRO */}
        {state === "erro" && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 text-center">
            <XCircle size={40} className="text-red-500 mx-auto mb-3" />
            <h2 className="font-semibold text-red-700 mb-2">Erro</h2>
            <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
            <p className="text-xs text-gray-400 mb-4">
              Se o problema persistir, comunique o porteiro.
            </p>
            <button
              onClick={reiniciar}
              className="w-full bg-gray-800 text-white py-3 rounded-xl text-sm font-medium"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
