import { useState, useEffect, useRef } from "react";
import { Plus, Users, Camera, CheckCircle, AlertCircle, X, Pencil, Trash2 } from "lucide-react";
import api from "../../services/api";
import Layout from "../../components/Layout";

interface Aluno { id: number; nome: string; turma: string; }
interface Responsavel {
  id: number; nome: string; cpf: string; telefone: string | null;
  parentesco: string; aluno_id: number; face_encoding: string | null; foto_path: string | null;
}
interface Grupo {
  cpf: string;
  nome: string;
  telefone: string | null;
  parentesco: string;
  tem_facial: boolean;
  principal_id: number;
  vinculos: Responsavel[];
}

const parentescos = ["Pai", "Mãe", "Avô", "Avó", "Tio(a)", "Responsável legal", "Babá", "Motorista", "Outro"];

export default function Responsaveis() {
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);

  // ── formulário novo responsável ──
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", cpf: "", telefone: "", parentesco: "", aluno_id: "" });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // ── modal edição ──
  const [editGrupo, setEditGrupo] = useState<Grupo | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", telefone: "", parentesco: "" });
const [editAlunosParaAdicionar, setEditAlunosParaAdicionar] = useState<number[]>([]);
  const [editRemoving, setEditRemoving] = useState<number[]>([]);
  const [editSearchAlunos, setEditSearchAlunos] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // ── cadastro facial ──
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [enrollStatus, setEnrollStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [enrollMsg, setEnrollMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    const [r, a] = await Promise.all([api.get("/responsaveis"), api.get("/alunos")]);
    setResponsaveis(r.data);
    setAlunos(a.data);
  };

  useEffect(() => { fetchAll(); }, []);

  // Agrupa responsáveis por CPF
  const grupos: Grupo[] = Object.values(
    responsaveis.reduce((acc, r) => {
      if (!acc[r.cpf]) {
        acc[r.cpf] = {
          cpf: r.cpf, nome: r.nome, telefone: r.telefone,
          parentesco: r.parentesco, tem_facial: false,
          principal_id: r.id, vinculos: [],
        };
      }
      acc[r.cpf].vinculos.push(r);
      if (r.face_encoding) acc[r.cpf].tem_facial = true;
      return acc;
    }, {} as Record<string, Grupo>)
  );

  // ── Novo responsável ──
  const handleCpfBlur = () => {
    if (!form.cpf) return;
    const cpfLimpo = form.cpf.replace(/\D/g, "");
    const existente = responsaveis.find((r) => r.cpf.replace(/\D/g, "") === cpfLimpo);
    if (existente) {
      setForm((f) => ({ ...f, nome: existente.nome, telefone: existente.telefone || "", parentesco: existente.parentesco }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      await api.post("/responsaveis", { ...form, aluno_id: Number(form.aluno_id) });
      setShowForm(false);
      setForm({ nome: "", cpf: "", telefone: "", parentesco: "", aluno_id: "" });
      fetchAll();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Erro ao salvar");
    } finally {
      setFormLoading(false);
    }
  };

  // ── Edição ──
  const openEdit = (grupo: Grupo) => {
    setEditGrupo(grupo);
    setEditForm({ nome: grupo.nome, telefone: grupo.telefone || "", parentesco: grupo.parentesco });
setEditAlunosParaAdicionar([]);
    setEditRemoving([]);
    setEditSearchAlunos("");
    setEditError("");
  };

  const toggleRemover = (id: number) => {
    setEditRemoving((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAdicionarAluno = (alunoId: number) => {
    setEditAlunosParaAdicionar((prev) =>
      prev.includes(alunoId) ? prev.filter((x) => x !== alunoId) : [...prev, alunoId]
    );
  };

  const saveEdit = async () => {
    if (!editGrupo) return;
    const mantidos = editGrupo.vinculos.filter((v) => !editRemoving.includes(v.id));
    if (mantidos.length === 0 && editAlunosParaAdicionar.length === 0) {
      setEditError("O responsável deve ter ao menos um aluno vinculado.");
      return;
    }
    setEditLoading(true);
    setEditError("");
    try {
      // Atualiza campos compartilhados (propagado pelo backend para todos do CPF)
      await api.put(`/responsaveis/${editGrupo.principal_id}`, editForm);

      // Remove vínculos marcados
      await Promise.all(editRemoving.map((id) => api.delete(`/responsaveis/${id}`)));

      // Adiciona novos vínculos para todos os alunos selecionados
      await Promise.all(
        editAlunosParaAdicionar.map((alunoId) =>
          api.post("/responsaveis", {
            nome: editForm.nome,
            cpf: editGrupo.cpf,
            telefone: editForm.telefone,
            parentesco: editForm.parentesco,
            aluno_id: alunoId,
          })
        )
      );

      setEditGrupo(null);
      fetchAll();
    } catch (err: any) {
      setEditError(err.response?.data?.detail || "Erro ao salvar");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Cadastro facial ──
  const handleEnrollFace = async (file: File) => {
    if (!enrollingId) return;
    setEnrollStatus("loading");
    const formData = new FormData();
    formData.append("photo", file);
    try {
      await api.post(`/responsaveis/${enrollingId}/face-enroll`, formData);
      setEnrollStatus("ok");
      setEnrollMsg("Reconhecimento facial cadastrado com sucesso!");
      fetchAll();
    } catch (err: any) {
      setEnrollStatus("error");
      setEnrollMsg(err.response?.data?.detail?.message || err.response?.data?.detail || "Erro ao cadastrar facial");
    }
  };

  // Alunos disponíveis para adicionar (não vinculados ao grupo em edição)
  const alunosDisponiveis = editGrupo
    ? alunos.filter((a) => !editGrupo.vinculos.some((v) => v.aluno_id === a.id && !editRemoving.includes(v.id)))
    : alunos;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users size={22} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">Responsáveis</h1>
          </div>
          <button
            onClick={() => { setShowForm(true); setForm({ nome: "", cpf: "", telefone: "", parentesco: "", aluno_id: "" }); setFormError(""); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
          >
            <Plus size={16} /> Novo Responsável
          </button>
        </div>

        {/* Formulário novo responsável */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">Novo Responsável</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} onBlur={handleCpfBlur} placeholder="000.000.000-00" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parentesco *</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.parentesco} onChange={(e) => setForm({ ...form, parentesco: e.target.value })} required>
                  <option value="">Selecione...</option>
                  {parentescos.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aluno *</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.aluno_id} onChange={(e) => setForm({ ...form, aluno_id: e.target.value })} required>
                  <option value="">Selecione...</option>
                  {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome} ({a.turma})</option>)}
                </select>
              </div>
              {formError && <p className="col-span-2 text-red-600 text-sm">{formError}</p>}
              <div className="col-span-2 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {formLoading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal de edição */}
        {editGrupo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Editar Responsável</h3>
                <button onClick={() => setEditGrupo(null)}><X size={18} /></button>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={editForm.telefone} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parentesco *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={editForm.parentesco} onChange={(e) => setEditForm({ ...editForm, parentesco: e.target.value })} required>
                    <option value="">Selecione...</option>
                    {parentescos.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Alunos vinculados */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Alunos vinculados</p>
                <div className="space-y-2">
                  {editGrupo.vinculos.map((v) => {
                    const aluno = alunos.find((a) => a.id === v.aluno_id);
                    const removendo = editRemoving.includes(v.id);
                    return (
                      <div key={v.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${removendo ? "border-red-200 bg-red-50 line-through text-gray-400" : "border-gray-200 bg-gray-50"}`}>
                        <span className="text-sm">{aluno?.nome} <span className="text-xs text-gray-400">({aluno?.turma})</span></span>
                        <button
                          onClick={() => toggleRemover(v.id)}
                          title={removendo ? "Desfazer remoção" : "Remover vínculo"}
                          className={`ml-2 ${removendo ? "text-gray-400 hover:text-gray-600" : "text-red-400 hover:text-red-600"}`}
                        >
                          {removendo ? <Plus size={14} /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Adicionar alunos - seleção visual */}
              {alunosDisponiveis.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Adicionar alunos</label>
                  <input
                    type="text"
                    placeholder="Pesquisar por nome..."
                    value={editSearchAlunos}
                    onChange={(e) => setEditSearchAlunos(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                  />
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {alunosDisponiveis
                      .filter((a) =>
                        a.nome.toLowerCase().includes(editSearchAlunos.toLowerCase())
                      )
                      .map((a) => {
                        const selecionado = editAlunosParaAdicionar.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            onClick={() => toggleAdicionarAluno(a.id)}
                            className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all ${
                              selecionado
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 bg-white hover:border-blue-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selecionado}
                              readOnly
                              className="w-4 h-4"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-800">{a.nome}</div>
                              <div className="text-xs text-gray-500">{a.turma}</div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {editError && <p className="text-red-600 text-sm mb-3">{editError}</p>}

              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditGrupo(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button onClick={saveEdit} disabled={editLoading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {editLoading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de cadastro facial */}
        {enrollingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Cadastrar Reconhecimento Facial</h3>
                <button onClick={() => { setEnrollingId(null); setEnrollStatus("idle"); }}><X size={18} /></button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Envie uma foto clara do rosto do responsável. O rosto deve estar centralizado e bem iluminado.
              </p>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleEnrollFace(e.target.files[0]); }} />
              {enrollStatus === "idle" && (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-6 text-center text-gray-500 hover:text-blue-600 transition-colors">
                  <Camera size={32} className="mx-auto mb-2" />
                  <p className="text-sm">Clique para selecionar foto</p>
                </button>
              )}
              {enrollStatus === "loading" && (
                <div className="text-center py-6 text-blue-600">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                  <p className="text-sm">Processando reconhecimento facial...</p>
                </div>
              )}
              {enrollStatus === "ok" && (
                <div className="text-center py-4">
                  <CheckCircle size={40} className="text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-green-700">{enrollMsg}</p>
                  <button onClick={() => { setEnrollingId(null); setEnrollStatus("idle"); }} className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Fechar</button>
                </div>
              )}
              {enrollStatus === "error" && (
                <div className="text-center py-4">
                  <AlertCircle size={40} className="text-red-500 mx-auto mb-2" />
                  <p className="text-sm text-red-700">{enrollMsg}</p>
                  <button onClick={() => setEnrollStatus("idle")} className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-lg">Tentar novamente</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabela agrupada por pessoa */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {grupos.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Users size={40} className="mx-auto mb-2 opacity-30" />
              <p>Nenhum responsável cadastrado</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Nome</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">CPF</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Parentesco</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Alunos</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Facial</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((grupo) => (
                  <tr key={grupo.cpf} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{grupo.nome}</div>
                      {grupo.telefone && <div className="text-xs text-gray-400">{grupo.telefone}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{grupo.cpf}</td>
                    <td className="px-4 py-3 text-gray-600">{grupo.parentesco}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {grupo.vinculos.map((v) => {
                          const aluno = alunos.find((a) => a.id === v.aluno_id);
                          return aluno ? (
                            <span key={v.id} className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                              {aluno.nome} <span className="opacity-60">({aluno.turma})</span>
                            </span>
                          ) : null;
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {grupo.tem_facial ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={14} /> Cadastrado</span>
                      ) : (
                        <span className="text-xs text-gray-400">Não cadastrado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 flex gap-2 justify-end">
                      <button onClick={() => { setEnrollingId(grupo.principal_id); setEnrollStatus("idle"); }} title="Cadastrar facial" className="text-purple-500 hover:text-purple-700">
                        <Camera size={15} />
                      </button>
                      <button onClick={() => openEdit(grupo)} className="text-blue-500 hover:text-blue-700">
                        <Pencil size={15} />
                      </button>
                    </td>
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
