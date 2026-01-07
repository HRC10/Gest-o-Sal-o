import React, { useState, useEffect } from 'react';
// Adicionado 'Trash2' e 'Edit' aos imports
import { Calendar, Users, DollarSign, Scissors, ChevronRight, X, Loader2, MessageCircle, Menu as MenuIcon, Plus, AlertCircle, Check, Trash2, Edit } from 'lucide-react';
import { supabase } from './supabaseClient';

function App() {
  // ==========================================
  // 1. GERENCIAMENTO DE ESTADOS (STATES)
  // ==========================================
  
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [modalAberto, setModalAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  
  // Estado para Modal de Edição de Cliente
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);

  const [aviso, setAviso] = useState({ aberto: false, titulo: '', mensagem: '' });
  const [confirmacao, setConfirmacao] = useState({ aberto: false, item: null });
  
  const [listaClientes, setListaClientes] = useState([]);
  const [listaAgendamentos, setListaAgendamentos] = useState([]);
  
  const [offsetDias, setOffsetDias] = useState(0); 
  const [dataSelecionada, setDataSelecionada] = useState(null);

  const [idEditando, setIdEditando] = useState(null);
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [servico, setServico] = useState('Volume Russo');
  const [valorTotal, setValorTotal] = useState(''); 
  const [valorPago, setValorPago] = useState('');   

  const [pagamentoId, setPagamentoId] = useState(null); 
  const [vTotal, setVTotal] = useState(''); 
  const [vPago, setVPago] = useState('');   

  // ==========================================
  // 2. FUNÇÕES AUXILIARES E DE BUSCA
  // ==========================================

  const mostrarAlerta = (titulo, mensagem) => {
    setAviso({ aberto: true, titulo, mensagem });
  };

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

  // ==========================================
  // 4. FUNÇÕES DE AÇÃO (SALVAR, EDITAR, EXCLUIR)
  // ==========================================

  async function handleSalvar(e) {
    e.preventDefault();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataValida = new Date(data + 'T00:00:00');

    if (dataValida < hoje && !idEditando) {
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

      const dadosAgendamento = { 
        cliente_nome: nomeCliente, 
        telefone, 
        data, 
        hora, 
        servico,
        valor_total: Number(valorTotal) || 0,
        valor_pago: Number(valorPago) || 0
      };

      if (idEditando) {
        await supabase.from('agendamentos').update(dadosAgendamento).eq('id', idEditando);
      } else {
        await supabase.from('agendamentos').insert([dadosAgendamento]);
      }

      await supabase.from('clientes').upsert(
        { nome: nomeCliente, telefone: telefone },
        { onConflict: 'nome' }
      );

      mostrarAlerta(idEditando ? "Atualizado" : "Sucesso", "Dados salvos com sucesso!");
      limparCampos();
      setModalAberto(false);
      buscarAgendamentos();
      buscarClientes();

    } catch (error) {
      mostrarAlerta("Erro", "Erro ao processar: " + error.message);
    }
  }

  const limparCampos = () => {
    setNomeCliente('');
    setTelefone('');
    setData('');
    setHora('');
    setValorTotal('');
    setValorPago('');
    setIdEditando(null);
  };

  async function executarCancelamento() {
    const agendamento = confirmacao.item;
    if (!agendamento) return;
    try {
      await supabase.from('agendamentos').delete().eq('id', agendamento.id);

      const { data: cliente } = await supabase.from('clientes').select('desmarques_total').eq('nome', agendamento.cliente_nome).maybeSingle();
      const novoTotal = (cliente?.desmarques_total || 0) + 1;

      await supabase.from('clientes').upsert({ nome: agendamento.cliente_nome, desmarques_total: novoTotal }, { onConflict: 'nome' });

      setConfirmacao({ aberto: false, item: null });
      mostrarAlerta("Cancelado", "O horário foi removido.");
      buscarAgendamentos(); 
      buscarClientes();
    } catch (error) {
      mostrarAlerta("Erro", "Não foi possível cancelar: " + error.message);
    }
  }

  // NOVA FUNÇÃO: SALVAR PAGAMENTO E DELETAR DA AGENDA
  async function salvarPagamento(item) {
    try {
      const vT = Number(vTotal) || 0;
      const vP = Number(vPago) || 0;
      const debitoGerado = vT - vP;

      if (debitoGerado > 0) {
        const { data: cli } = await supabase.from('clientes').select('saldo_devedor').eq('nome', item.cliente_nome).maybeSingle();
        const novoSaldo = (cli?.saldo_devedor || 0) + debitoGerado;
        await supabase.from('clientes').upsert({ nome: item.cliente_nome, saldo_devedor: novoSaldo }, { onConflict: 'nome' });
      }

      const { error } = await supabase.from('agendamentos').delete().eq('id', item.id);
      if (error) throw error;

      setPagamentoId(null);
      mostrarAlerta("Finalizado", "Pagamento registrado e agendamento removido.");
      buscarAgendamentos();
      buscarClientes();
    } catch (e) {
      mostrarAlerta("Erro", "Não foi possível finalizar.");
    }
  }

  // NOVA FUNÇÃO: EXCLUIR CLIENTE
  async function excluirCliente(id) {
    if (!confirm("Deseja excluir este cliente permanentemente?")) return;
    await supabase.from('clientes').delete().eq('id', id);
    buscarClientes();
  }

  // NOVA FUNÇÃO: SALVAR EDIÇÃO CLIENTE
  async function handleSalvarEdicaoCliente(e) {
    e.preventDefault();
    await supabase.from('clientes').update({
      nome: clienteEditando.nome,
      telefone: clienteEditando.telefone,
      saldo_devedor: Number(clienteEditando.saldo_devedor) || 0,
      desmarques_total: Number(clienteEditando.desmarques_total) || 0
    }).eq('id', clienteEditando.id);
    setModalClienteAberto(false);
    buscarClientes();
  }

  const enviarWhatsApp = (item) => {
    const vTotalItem = item.valor_total || item.valor_total_cliente || 0; 
    const vPagoItem = item.valor_pago || 0;
    const valorPendente = (Number(vTotalItem) || 0) - (Number(vPagoItem) || 0);
    let msg = "";

    if (valorPendente > 0 && item.servico !== 'atendimento') {
      msg = encodeURIComponent(`Olá ${item.cliente_nome}! Tudo bem? 😊\n\nPassando para informar que consta um valor em aberto de R$ ${valorPendente.toFixed(2).replace('.',',')} referente ao serviço de ${item.servico}.`);
    } else if (item.data && item.hora) {
      msg = encodeURIComponent(`Olá ${item.cliente_nome}, confirmo seu horário de ${item.servico} no dia ${new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR')} às ${item.hora.substring(0,5)}?`);
    } else {
      msg = encodeURIComponent(`Olá ${item.cliente_nome}, tudo bem?`);
    }
    window.open(`https://wa.me/55${item.telefone.replace(/\D/g,'')}?text=${msg}`, '_blank');
  };

  function prepararEdicao(item) {
    setIdEditando(item.id);
    setNomeCliente(item.cliente_nome);
    setTelefone(item.telefone);
    setData(item.data);
    setHora(item.hora);
    setServico(item.servico);
    setValorTotal(item.valor_total || '');
    setValorPago(item.valor_pago || '');
    setModalAberto(true);
  }

  const calcularFaturamento = () => {
    const total = listaAgendamentos.reduce((acc, curr) => acc + (Number(curr.valor_pago) || 0), 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
  };

  return (
    <div className="min-h-screen bg-[#FDF6F3] flex font-sans text-[#5D4037] overflow-x-hidden">
      
      <button onClick={() => setMenuAberto(!menuAberto)} className="fixed top-4 left-4 z-[60] p-3 bg-white rounded-xl shadow-lg md:hidden text-[#A67C52]">
        {menuAberto ? <X size={24} /> : <MenuIcon size={24} />}
      </button>

      <aside className={`w-72 bg-white shadow-2xl border-r border-[#EAD7CC] flex flex-col fixed h-full z-50 transition-transform duration-300 md:translate-x-0 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8">
          <h1 className="text-2xl font-serif font-bold text-[#A67C52] leading-tight">Joanes <br/> Netto</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mt-2 font-semibold">Painel de Gestão</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => { setAbaAtiva('agenda'); setMenuAberto(false); }} className={`w-full flex items-center gap-4 p-4 rounded-xl transition ${abaAtiva === 'agenda' ? 'bg-[#F9F1ED] text-[#A67C52] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Calendar size={20}/> Agenda
          </button>
          <button onClick={() => { setAbaAtiva('clientes'); setMenuAberto(false); }} className={`w-full flex items-center gap-4 p-4 rounded-xl transition ${abaAtiva === 'clientes' ? 'bg-[#F9F1ED] text-[#A67C52] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Users size={20}/> Clientes
          </button>
          <button className="w-full flex items-center gap-4 p-4 rounded-xl text-gray-500 hover:bg-gray-50 transition"><Scissors size={20}/> Serviços</button>
          <button className="w-full flex items-center gap-4 p-4 rounded-xl text-gray-500 hover:bg-gray-50 transition"><DollarSign size={20}/> Financeiro</button>
        </nav>
      </aside>

      <main className={`flex-1 transition-all duration-300 md:ml-72 p-4 md:p-12 max-w-full ${menuAberto ? 'blur-sm md:blur-none pointer-events-none md:pointer-events-auto' : ''}`}>
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 pt-12 md:pt-0">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif uppercase tracking-tight">Olá, Joanes!</h2>
            <p className="text-gray-500 mt-1">{abaAtiva === 'agenda' ? 'Sua agenda atualizada em tempo real.' : 'Gerencie sua base de clientes.'}</p>
          </div>
          {abaAtiva === 'agenda' && (
            <button onClick={() => { limparCampos(); setModalAberto(true); }} className="w-full md:w-auto bg-[#A67C52] hover:bg-[#8B6543] text-white px-8 py-4 rounded-full font-bold shadow-lg transition-all active:scale-95">
              + Novo Agendamento
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
            <Calendar className="text-[#A67C52] mb-4" size={24}/>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Agendamentos</h3>
            <p className="text-4xl font-serif mt-2">
              {dataSelecionada 
                ? listaAgendamentos.filter(a => a.data === dataSelecionada).length 
                : listaAgendamentos.length}
            </p>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
            <Users className="text-[#A67C52] mb-4" size={24}/>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Total Clientes</h3>
            <p className="text-4xl font-serif mt-2">{listaClientes.length}</p>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
            <DollarSign className="text-[#A67C52] mb-4" size={24}/>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Faturamento Total</h3>
            <p className="text-3xl md:text-4xl font-serif mt-2">{calcularFaturamento()}</p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl border border-[#EAD7CC] overflow-hidden">
          {abaAtiva === 'agenda' ? (
            <>
              <div className="p-4 md:p-6 bg-white border-b border-[#EAD7CC] sticky top-0 z-20">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[10px] md:text-xs uppercase tracking-widest font-black text-[#A67C52]">Navegação Rápida</h3>
                    {dataSelecionada && (
                      <button onClick={() => setDataSelecionada(null)} className="text-[10px] bg-[#A67C52] text-white px-3 py-1 rounded-full font-bold uppercase hover:bg-[#8B6543] transition-colors">Ver Todos</button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={offsetDias === 0} onClick={() => setOffsetDias(prev => Math.max(0, prev - 15))} className={`p-2 rounded-xl border transition-all ${offsetDias === 0 ? 'text-gray-200 border-gray-100' : 'text-[#A67C52] border-[#EAD7CC] hover:bg-[#F9F1ED]'}`}><ChevronRight size={18} className="rotate-180" /></button>
                    <button type="button" onClick={() => setOffsetDias(prev => prev + 15)} className="p-2 rounded-xl border text-[#A67C52] border-[#EAD7CC] hover:bg-[#F9F1ED] transition-all"><ChevronRight size={18} /></button>
                  </div>
                </div>

                <div className="flex flex-nowrap gap-3 overflow-x-auto pb-4 scrollbar-hide touch-pan-x">
                  {[...Array(15)].map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() + i + offsetDias);
                    const iso = d.toISOString().split('T')[0];
                    const selecionado = dataSelecionada === iso;
                    const temAgendamento = listaAgendamentos.some(a => a.data === iso);

                    return (
                      <button
                        key={iso}
                        onClick={() => setDataSelecionada(selecionado ? null : iso)}
                        className={`flex flex-col items-center justify-center flex-shrink-0 w-[65px] h-[85px] md:w-[75px] md:h-[95px] rounded-[22px] md:rounded-[30px] transition-all border ${
                          selecionado ? 'bg-[#A67C52] border-[#A67C52] text-white shadow-md scale-105' : 'bg-[#FDF6F3] border-[#EAD7CC] text-[#5D4037] hover:border-[#A67C52]'
                        }`}
                      >
                        <span className="text-[9px] md:text-[10px] uppercase font-bold opacity-60 mb-1">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0,3)}</span>
                        <span className="text-xl md:text-2xl font-serif font-black">{d.getDate()}</span>
                        <div className={`w-1.5 h-1.5 rounded-full mt-2 ${temAgendamento ? (selecionado ? 'bg-white' : 'bg-[#A67C52]') : 'bg-transparent'}`}></div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl md:text-2xl font-serif">
                  {dataSelecionada ? `Agenda: ${new Date(dataSelecionada + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: 'long'})}` : 'Próximos Horários'}
                </h3>
                {dataSelecionada && (
                  <button onClick={() => { limparCampos(); setData(dataSelecionada); setModalAberto(true); }} className="flex items-center gap-2 bg-[#F9F1ED] text-[#A67C52] px-4 py-2 rounded-xl text-xs font-bold border border-[#EAD7CC] hover:bg-[#A67C52] hover:text-white transition-all">
                    <Plus size={16} /> Novo neste dia
                  </button>
                )}
                {carregando && <Loader2 className="animate-spin text-[#A67C52]" size={20} />}
              </div>

              <div className="divide-y divide-gray-50">
                {(dataSelecionada ? listaAgendamentos.filter(a => a.data === dataSelecionada) : listaAgendamentos).map((item) => (
                    <div key={item.id} className="p-4 md:p-6 hover:bg-[#FDF6F3] transition group">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 md:gap-6">
                          <div className="text-center min-w-[55px] md:min-w-[60px] bg-[#F9F1ED] p-2 md:p-3 rounded-2xl">
                            <span className="block text-lg md:text-xl font-serif text-[#A67C52] font-bold">{item.hora.substring(0,5)}</span>
                            <span className="text-[9px] text-[#A67C52]/70 uppercase font-bold">{new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</span>
                          </div>
                          <div>
                            <p className="font-bold text-base md:text-lg text-[#5D4037]">{item.cliente_nome}</p>
                            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest font-medium">
                              {item.servico} • {item.telefone} 
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto">
                          <button 
                            onClick={() => { setPagamentoId(item.id); setVTotal(item.valor_total || ''); setVPago(item.valor_pago || ''); }} 
                            className="p-2 md:p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all"
                          >
                            <DollarSign size={18} />
                          </button>

                          <button onClick={() => enviarWhatsApp(item)} className="p-2 md:p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all">
                            <MessageCircle size={18} />
                          </button>
                          
                          <button onClick={() => prepararEdicao(item)} className="p-2 md:p-3 bg-[#F9F1ED] text-[#A67C52] rounded-xl hover:bg-[#A67C52] hover:text-white transition-all">
                            <Scissors size={18} />
                          </button>

                          <button onClick={() => setConfirmacao({ aberto: true, item })} className="p-2 md:p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                            <X size={18} />
                          </button>
                        </div>
                      </div>

                      {pagamentoId === item.id && (
                        <div className="mt-4 p-4 bg-[#F9F1ED] border border-[#EAD7CC] rounded-2xl flex flex-wrap gap-4 items-end animate-in slide-in-from-top-2">
                          <div className="flex-1 min-w-[120px]">
                            <label className="text-[10px] font-black uppercase text-[#A67C52] block mb-1">Valor do Serviço (R$)</label>
                            <input type="number" value={vTotal} onChange={e => setVTotal(e.target.value)} className="w-full p-2 rounded-lg bg-white border border-[#EAD7CC] outline-none" placeholder="0.00" />
                          </div>
                          <div className="flex-1 min-w-[120px]">
                            <label className="text-[10px] font-black uppercase text-[#A67C52] block mb-1">Valor Recebido (R$)</label>
                            <input type="number" value={vPago} onChange={e => setVPago(e.target.value)} className="w-full p-2 rounded-lg bg-white border border-[#EAD7CC] outline-none" placeholder="0.00" />
                          </div>
                          <button onClick={() => salvarPagamento(item)} className="bg-[#A67C52] text-white p-2.5 rounded-xl hover:bg-[#8B6543]">
                            <Check size={20}/>
                          </button>
                          <button onClick={() => setPagamentoId(null)} className="bg-white text-gray-400 p-2.5 rounded-xl border border-[#EAD7CC]">
                            <X size={20}/>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-[#F9F1ED] text-[#A67C52] text-xs uppercase font-bold tracking-widest">
                  <tr>
                    <th className="p-6">Nome</th>
                    <th className="p-6 text-center">Desmarques</th>
                    <th className="p-6 text-center">Situação Financeira</th>
                    <th className="p-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {listaClientes.map((cliente) => (
                      <tr key={cliente.id} className="hover:bg-[#FDF6F3] transition">
                        <td className="p-6">
                          <p className="font-bold">{cliente.nome}</p>
                          <p className="text-xs text-gray-400">{cliente.telefone}</p>
                        </td>
                        <td className="p-6 text-center">
                          <span className="bg-red-50 text-red-500 px-3 py-1 rounded-full text-xs font-bold">
                            {cliente.desmarques_total || 0}
                          </span>
                        </td>
                        <td className="p-6 text-center">
                          {cliente.saldo_devedor > 0 ? (
                            <span className="flex items-center justify-center gap-1 bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase mx-auto w-fit">
                              <AlertCircle size={12}/> R$ {cliente.saldo_devedor.toFixed(2)}
                            </span>
                          ) : (
                            <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase mx-auto w-fit">Em dia</span>
                          )}
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => enviarWhatsApp(cliente)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><MessageCircle size={18}/></button>
                            <button onClick={() => { setClienteEditando(cliente); setModalClienteAberto(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={18}/></button>
                            <button onClick={() => excluirCliente(cliente.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* NOVO MODAL: EDIÇÃO DE CLIENTE */}
      {modalClienteAberto && clienteEditando && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative">
            <button onClick={() => setModalClienteAberto(false)} className="absolute top-6 right-6 text-gray-400"><X size={24}/></button>
            <h3 className="text-2xl font-serif mb-6 text-[#5D4037]">Editar Cliente</h3>
            <form onSubmit={handleSalvarEdicaoCliente} className="space-y-4">
              <input type="text" value={clienteEditando.nome} onChange={e => setClienteEditando({...clienteEditando, nome: e.target.value})} className="w-full bg-gray-50 border p-4 rounded-2xl outline-none" placeholder="Nome" />
              <input type="tel" value={clienteEditando.telefone} onChange={e => setClienteEditando({...clienteEditando, telefone: e.target.value})} className="w-full bg-gray-50 border p-4 rounded-2xl outline-none" placeholder="WhatsApp" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 ml-1">Saldo Devedor</label>
                  <input type="number" value={clienteEditando.saldo_devedor} onChange={e => setClienteEditando({...clienteEditando, saldo_devedor: e.target.value})} className="w-full bg-gray-50 border p-4 rounded-2xl outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 ml-1">Desmarques</label>
                  <input type="number" value={clienteEditando.desmarques_total} onChange={e => setClienteEditando({...clienteEditando, desmarques_total: e.target.value})} className="w-full bg-gray-50 border p-4 rounded-2xl outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#A67C52] text-white py-4 rounded-2xl font-bold shadow-lg mt-2">Salvar Alterações</button>
            </form>
          </div>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] p-0 md:p-4">
          <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] w-full max-w-lg p-6 md:p-10 shadow-2xl relative h-[95vh] md:h-auto overflow-y-auto">
            <button onClick={() => setModalAberto(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 p-2"><X size={28}/></button>
            <h3 className="text-2xl md:text-3xl font-serif mb-8 text-[#5D4037]">{idEditando ? 'Editar Horário' : 'Novo Agendamento'}</h3>
            <form onSubmit={handleSalvar} className="space-y-4 md:space-y-5 pb-10">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#A67C52] font-bold mb-2">Nome da Cliente</label>
                <input type="text" list="clientes-list" required value={nomeCliente} onChange={(e) => {
                    setNomeCliente(e.target.value);
                    const clienteExistente = listaClientes.find(c => c.nome === e.target.value);
                    if (clienteExistente) setTelefone(clienteExistente.telefone);
                  }} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#A67C52]/20" placeholder="Nome completo..." />
                <datalist id="clientes-list">{listaClientes.map(c => <option key={c.id} value={c.nome} />)}</datalist>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#A67C52] font-bold mb-2">WhatsApp</label>
                <input type="tel" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-[#A67C52] font-bold mb-2">Data</label>
                  <input type="date" required value={data} onChange={(e) => setData(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-[#A67C52] font-bold mb-2">Hora</label>
                  <input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#A67C52] font-bold mb-2">Serviço</label>
                <select value={servico} onChange={(e) => setServico(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none">
                  <option>Volume Russo</option>
                  <option>Volume Híbrido</option>
                  <option>Design de Sobrancelha</option>
                  <option>Limpeza de Pele</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-[#5D4037] text-white py-4 md:py-5 rounded-2xl font-bold text-lg hover:bg-[#3E2B25] shadow-lg mt-4 active:scale-95 transition-all uppercase tracking-widest">
                {idEditando ? 'Salvar Alterações' : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {aviso.aberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl text-center border border-[#EAD7CC]">
            <h3 className="text-2xl font-serif mb-2 text-[#5D4037]">{aviso.titulo}</h3>
            <p className="text-gray-500 mb-8">{aviso.mensagem}</p>
            <button onClick={() => setAviso({ ...aviso, aberto: false })} className="w-full bg-[#A67C52] text-white py-4 rounded-xl font-bold">Entendi</button>
          </div>
        </div>
      )}

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