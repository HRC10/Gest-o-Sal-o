import React, { useState, useEffect } from 'react';
import { Calendar, Users, DollarSign, Scissors, ChevronRight, X, Loader2, MessageCircle, Menu as MenuIcon } from 'lucide-react';
import { supabase } from './supabaseClient';

function App() {
  // --- ESTADOS ---
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState({ aberto: false, titulo: '', mensagem: '' });
  const [confirmacao, setConfirmacao] = useState({ aberto: false, item: null });
  const [idEditando, setIdEditando] = useState(null);
  const [listaClientes, setListaClientes] = useState([]);
  const [menuAberto, setMenuAberto] = useState(false); // Estado do menu mobile

  // Estados para a Lista e Agendamentos
  const [listaAgendamentos, setListaAgendamentos] = useState([]);

  // Estados para o Formulário do Modal
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [servico, setServico] = useState('Volume Russo');

  // --- FUNÇÕES AUXILIARES ---
  const mostrarAlerta = (titulo, mensagem) => {
    setAviso({ aberto: true, titulo, mensagem });
  };

  // --- BUSCAR DADOS (READ) ---
  async function buscarAgendamentos() {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data', { ascending: true })
        .order('hora', { ascending: true });

      if (error) throw error;
      setListaAgendamentos(data || []);
    } catch (error) {
      mostrarAlerta("Erro", "Erro ao carregar agenda: " + error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function buscarClientes() {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setListaClientes(data || []);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error.message);
    }
  }

  useEffect(() => {
    buscarAgendamentos();
    buscarClientes();
  }, []);

  useEffect(() => {
    if (abaAtiva === 'clientes') {
      buscarClientes();
    }
  }, [abaAtiva]);

  // --- SALVAR DADOS (CREATE / UPDATE) ---
  async function handleSalvar(e) {
    e.preventDefault();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataSelecionada = new Date(data + 'T00:00:00');

    if (dataSelecionada < hoje) {
      mostrarAlerta("Data Inválida", "Ops! Não é possível realizar um agendamento em uma data que já passou.");
      return;
    }

    if (!nomeCliente || !data || !hora) {
      mostrarAlerta("Campos Vazios", "Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    try {
      const { data: existente, error: erroBusca } = await supabase
        .from('agendamentos')
        .select('id, cliente_nome')
        .eq('data', data)
        .eq('hora', hora)
        .maybeSingle();

      if (erroBusca) throw erroBusca;

      if (existente && existente.id !== idEditando) {
        mostrarAlerta("Horário Ocupado", `Atenção: Este horário já está ocupado por ${existente.cliente_nome}.`);
        return;
      }

      let erroOperacao;
      if (idEditando) {
        const { error } = await supabase
          .from('agendamentos')
          .update({ cliente_nome: nomeCliente, telefone, data, hora, servico })
          .eq('id', idEditando);
        erroOperacao = error;
      } else {
        const { error } = await supabase
          .from('agendamentos')
          .insert([{ cliente_nome: nomeCliente, telefone, data, hora, servico }]);
        erroOperacao = error;
      }

      if (erroOperacao) throw erroOperacao;

      await supabase.from('clientes').upsert(
        { nome: nomeCliente, telefone: telefone },
        { onConflict: 'nome' }
      );

      mostrarAlerta(idEditando ? "Atualizado" : "Sucesso", "Dados salvos com sucesso!");
      
      setNomeCliente('');
      setTelefone('');
      setData('');
      setHora('');
      setIdEditando(null);
      setModalAberto(false);

      buscarAgendamentos();
      buscarClientes();

    } catch (error) {
      mostrarAlerta("Erro", "Erro ao processar: " + error.message);
    }
  }

  // --- LÓGICA DE CANCELAMENTO ---
  function solicitarCancelamento(item) {
    setConfirmacao({ aberto: true, item: item });
  }

  async function executarCancelamento() {
    const agendamento = confirmacao.item;
    if (!agendamento) return;

    try {
      const { error: erroDelete } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', agendamento.id);

      if (erroDelete) throw erroDelete;

      const { data: cliente } = await supabase
        .from('clientes')
        .select('desmarques_total')
        .eq('nome', agendamento.cliente_nome)
        .maybeSingle();

      const novoTotal = (cliente?.desmarques_total || 0) + 1;

      await supabase
        .from('clientes')
        .upsert({ nome: agendamento.cliente_nome, desmarques_total: novoTotal }, { onConflict: 'nome' });

      setConfirmacao({ aberto: false, item: null });
      mostrarAlerta("Cancelado", "O horário foi removido.");
      buscarAgendamentos(); 
    } catch (error) {
      mostrarAlerta("Erro", "Não foi possível cancelar: " + error.message);
    }
  }

  const enviarWhatsApp = (item) => {
    const msg = encodeURIComponent(`Olá ${item.cliente_nome}, confirmo seu horário de ${item.servico} no dia ${new Date(item.data).toLocaleDateString('pt-BR')} às ${item.hora.substring(0,5)}?`);
    window.open(`https://wa.me/55${item.telefone.replace(/\D/g,'')}?text=${msg}`, '_blank');
  };

  function prepararEdicao(item) {
    setIdEditando(item.id);
    setNomeCliente(item.cliente_nome);
    setTelefone(item.telefone);
    setData(item.data);
    setHora(item.hora);
    setServico(item.servico);
    setModalAberto(true);
  }

  return (
    <div className="min-h-screen bg-[#FDF6F3] flex font-sans text-[#5D4037]">
      
      {/* BOTÃO MOBILE */}
      <button 
        onClick={() => setMenuAberto(!menuAberto)}
        className="fixed top-4 left-4 z-[60] p-3 bg-white rounded-xl shadow-lg md:hidden text-[#A67C52]"
      >
        {menuAberto ? <X size={24} /> : <MenuIcon size={24} />}
      </button>

      {/* SIDEBAR RESPONSIVA */}
      <aside className={`
        w-72 bg-white shadow-2xl border-r border-[#EAD7CC] flex flex-col fixed h-full z-50 transition-transform duration-300 ease-in-out
        ${menuAberto ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0
      `}>
        <div className="p-8">
          <h1 className="text-2xl font-serif font-bold text-[#A67C52] leading-tight">Joanes <br/> Netto</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mt-2 font-semibold">Painel de Gestão</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => { setAbaAtiva('agenda'); setMenuAberto(false); }} 
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition ${abaAtiva === 'agenda' ? 'bg-[#F9F1ED] text-[#A67C52] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Calendar size={20}/> Agenda
          </button>
          <button 
            onClick={() => { setAbaAtiva('clientes'); setMenuAberto(false); }} 
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition ${abaAtiva === 'clientes' ? 'bg-[#F9F1ED] text-[#A67C52] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Users size={20}/> Clientes
          </button>
          <button className="w-full flex items-center gap-4 p-4 rounded-xl text-gray-500 hover:bg-gray-50 transition"><Scissors size={20}/> Serviços</button>
          <button className="w-full flex items-center gap-4 p-4 rounded-xl text-gray-500 hover:bg-gray-50 transition"><DollarSign size={20}/> Financeiro</button>
        </nav>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className={`flex-1 transition-all duration-300 md:ml-72 p-6 md:p-12 ${menuAberto ? 'blur-sm md:blur-none pointer-events-none md:pointer-events-auto' : ''}`}>
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 pt-12 md:pt-0">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif uppercase tracking-tight">Olá, Joanes Netto!</h2>
            <p className="text-gray-500 mt-1">
              {abaAtiva === 'agenda' ? 'Sua agenda atualizada em tempo real.' : 'Gerencie sua base de clientes.'}
            </p>
          </div>
          
          {abaAtiva === 'agenda' && (
            <button 
              onClick={() => { setIdEditando(null); setModalAberto(true); }}
              className="w-full md:w-auto bg-[#A67C52] hover:bg-[#8B6543] text-white px-8 py-4 rounded-full font-bold shadow-lg transition-all active:scale-95"
            >
              + Novo Agendamento
            </button>
          )}
        </header>

        {/* CARDS DE RESUMO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
            <Calendar className="text-[#A67C52] mb-4" size={24}/>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Agendamentos</h3>
            <p className="text-4xl font-serif mt-2">{listaAgendamentos.length}</p>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
            <Users className="text-[#A67C52] mb-4" size={24}/>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Total Clientes</h3>
            <p className="text-4xl font-serif mt-2">{listaClientes.length}</p>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
            <DollarSign className="text-[#A67C52] mb-4" size={24}/>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Faturamento</h3>
            <p className="text-4xl font-serif mt-2">R$ 0,00</p>
          </div>
        </div>

        {/* CONTEÚDO DINÂMICO */}
        <div className="bg-white rounded-[2rem] shadow-xl border border-[#EAD7CC] overflow-hidden">
          {abaAtiva === 'agenda' ? (
            <>
              <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                <h3 className="text-2xl font-serif">Próximos Horários</h3>
                {carregando && <Loader2 className="animate-spin text-[#A67C52]" size={20} />}
              </div>
              <div className="divide-y divide-gray-50">
                {listaAgendamentos.length > 0 ? (
                  listaAgendamentos.map((item) => (
                    <div key={item.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-[#FDF6F3] gap-4 transition group">
                      <div className="flex items-center gap-6">
                        <div className="text-center min-w-[60px] bg-[#F9F1ED] p-3 rounded-2xl">
                          <span className="block text-xl font-serif text-[#A67C52] font-bold">{item.hora.substring(0,5)}</span>
                          <span className="text-[10px] text-[#A67C52]/70 uppercase font-bold">{new Date(item.data).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</span>
                        </div>
                        <div>
                          <p className="font-bold text-lg text-[#5D4037]">{item.cliente_nome}</p>
                          <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">{item.servico} • {item.telefone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button onClick={() => enviarWhatsApp(item)} className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all">
                          <MessageCircle size={20} />
                        </button>
                        <button onClick={() => prepararEdicao(item)} className="p-3 bg-[#F9F1ED] text-[#A67C52] rounded-xl hover:bg-[#A67C52] hover:text-white transition-all">
                          <Scissors size={20} />
                        </button>
                        <button onClick={() => solicitarCancelamento(item)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center text-gray-400 italic">Nenhum agendamento encontrado.</div>
                )}
              </div>
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#F9F1ED] text-[#A67C52] text-xs uppercase font-bold tracking-widest">
                  <tr>
                    <th className="p-6">Nome</th>
                    <th className="p-6">WhatsApp</th>
                    <th className="p-6 text-center">Histórico</th>
                    <th className="p-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {listaClientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-[#FDF6F3] transition">
                      <td className="p-6 font-bold">{cliente.nome}</td>
                      <td className="p-6 text-gray-500">{cliente.telefone}</td>
                      <td className="p-6 text-center">
                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${cliente.desmarques_total >= 3 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          {cliente.desmarques_total || 0} desmarques
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <button onClick={() => enviarWhatsApp({ cliente_nome: cliente.nome, telefone: cliente.telefone, servico: 'atendimento' })} className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all">
                          <MessageCircle size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* MODAL RESPONSIVO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] p-0 md:p-4">
          <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] w-full max-w-lg p-8 md:p-10 shadow-2xl relative h-[90vh] md:h-auto overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <button onClick={() => setModalAberto(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 p-2">
              <X size={28}/>
            </button>
            <h3 className="text-2xl md:text-3xl font-serif mb-8 text-[#5D4037]">
              {idEditando ? 'Editar Horário' : 'Novo Agendamento'}
            </h3>
            <form onSubmit={handleSalvar} className="space-y-5 pb-10">
              <div>
                <label className="block text-xs uppercase tracking-widest text-[#A67C52] font-bold mb-2">Nome da Cliente</label>
                <input 
                  type="text" 
                  list="clientes-list"
                  required 
                  value={nomeCliente} 
                  onChange={(e) => {
                    setNomeCliente(e.target.value);
                    const clienteExistente = listaClientes.find(c => c.nome === e.target.value);
                    if (clienteExistente) setTelefone(clienteExistente.telefone);
                  }}
                  className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#A67C52]/20" 
                  placeholder="Nome completo..." 
                />
                <datalist id="clientes-list">
                  {listaClientes.map(c => <option key={c.id} value={c.nome} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-[#A67C52] font-bold mb-2">WhatsApp</label>
                <input type="tel" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-[#A67C52] font-bold mb-2">Data</label>
                  <input type="date" required value={data} onChange={(e) => setData(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-[#A67C52] font-bold mb-2">Hora</label>
                  <input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-[#A67C52] font-bold mb-2">Serviço</label>
                <select value={servico} onChange={(e) => setServico(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none">
                  <option>Volume Russo</option>
                  <option>Volume Híbrido</option>
                  <option>Design de Sobrancelha</option>
                  <option>Limpeza de Pele</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-[#5D4037] text-white py-5 rounded-2xl font-bold text-lg hover:bg-[#3E2B25] transition-all shadow-lg mt-4 active:scale-95">
                {idEditando ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR AGENDAMENTO'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE AVISO */}
      {aviso.aberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl text-center border border-[#EAD7CC]">
            <h3 className="text-2xl font-serif mb-2 text-[#5D4037]">{aviso.titulo}</h3>
            <p className="text-gray-500 mb-8">{aviso.mensagem}</p>
            <button onClick={() => setAviso({ ...aviso, aberto: false })} className="w-full bg-[#A67C52] text-white py-4 rounded-xl font-bold">
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO */}
      {confirmacao.aberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl text-center border border-[#EAD7CC]">
            <h3 className="text-2xl font-serif mb-2 text-[#5D4037]">Cancelar Horário?</h3>
            <p className="text-gray-500 mb-8">Deseja remover o agendamento de <span className="font-bold">{confirmacao.item?.cliente_nome}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmacao({ aberto: false, item: null })} className="flex-1 bg-gray-100 py-4 rounded-xl font-bold">Voltar</button>
              <button onClick={executarCancelamento} className="flex-1 bg-red-500 text-white py-4 rounded-xl font-bold">Confirmar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;