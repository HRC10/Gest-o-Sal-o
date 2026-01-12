import React, { useState, useEffect } from 'react';
import { Calendar, Users, DollarSign, Scissors, ChevronRight, X, Loader2, MessageCircle, Menu as MenuIcon, Plus, AlertCircle, Check, Trash2, Edit, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from './supabaseClient';

function App() {
  // ==========================================
  // 1. GERENCIAMENTO DE ESTADOS (STATES)
  // ==========================================
  
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [modalAberto, setModalAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [historicoFinanceiro, setHistoricoFinanceiro] = useState([]);
  const [filtroMes, setFiltroMes] = useState(`${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`);
  
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

  async function buscarFinanceiro() {
  const { data, error } = await supabase
    .from('financeiro')
    .select('*')
    .order('data_finalizacao', { ascending: false });
  if (!error) setHistoricoFinanceiro(data || []);
}
// FUNÇÃO DE SOMA PARA O CARD (Mês Corrente)
  const calcularRecebidoMesAtual = () => {
    const hoje = new Date();
    const mesRefAtual = `${(hoje.getMonth() + 1).toString().padStart(2, '0')}/${hoje.getFullYear()}`;
    
    const totalMes = historicoFinanceiro
      .filter(f => f.mes_referencia === mesRefAtual)
      .reduce((acc, curr) => acc + (Number(curr.valor_pago) || 0), 0);

    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMes);
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
    buscarFinanceiro();
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
    const hoje = new Date();
    const mesRef = `${(hoje.getMonth() + 1).toString().padStart(2, '0')}/${hoje.getFullYear()}`;

    const { data: existente } = await supabase
    .from('financeiro')
    .select('id')
    .eq('agendamento_id', item.id)
    .maybeSingle();

  if (existente) {
    mostrarAlerta('Atenção', 'Este atendimento já foi finalizado.');
    return;
  }


    // 1. Registrar no histórico financeiro
    await supabase.from('financeiro').insert([{
    agendamento_id: item.id,
    cliente_nome: item.cliente_nome,
    servico: item.servico,
    valor_servico: vT,
    valor_pago: vP,
    mes_referencia: mesRef
  }]);

    // 2. Lógica de débito (se houver)
    const debitoGerado = vT - vP;
    if (debitoGerado > 0) {
      const { data: cli } = await supabase.from('clientes').select('saldo_devedor').eq('nome', item.cliente_nome).maybeSingle();
      await supabase.from('clientes').upsert({ 
        nome: item.cliente_nome, 
        saldo_devedor: (cli?.saldo_devedor || 0) + debitoGerado 
      }, { onConflict: 'nome' });
    }

    // 3. Deletar da agenda
    await supabase.from('agendamentos').delete().eq('id', item.id);

    setPagamentoId(null);
    mostrarAlerta("Sucesso", "Atendimento finalizado e financeiro atualizado!");
    buscarAgendamentos();
    buscarClientes();
    buscarFinanceiro();
  } catch (e) {
    mostrarAlerta("Erro", "Falha ao processar pagamento.");
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

  // Lógica para os Cards do Financeiro
  const statsFinanceiras = () => {
    const hoje = new Date();
    const mesAtual = `${(hoje.getMonth() + 1).toString().padStart(2, '0')}/${hoje.getFullYear()}`;
    const dataMesPassado = new Date();
    dataMesPassado.setMonth(hoje.getMonth() - 1);
    const mesPassado = `${(dataMesPassado.getMonth() + 1).toString().padStart(2, '0')}/${dataMesPassado.getFullYear()}`;

    const registrosMes = historicoFinanceiro.filter(f => f.mes_referencia === (filtroMes || mesAtual));
    const registrosMesPassado = historicoFinanceiro.filter(f => f.mes_referencia === mesPassado);

    const recebidoMes = registrosMes.reduce((acc, curr) => acc + (Number(curr.valor_pago) || 0), 0);
    const aReceberMes = registrosMes.reduce((acc, curr) => acc + (Number(curr.valor_servico) - Number(curr.valor_pago)), 0);
    const faturamentoMesPassado = registrosMesPassado.reduce((acc, curr) => acc + (Number(curr.valor_pago) || 0), 0);

    let variacao = 0;
    if (faturamentoMesPassado > 0) {
      variacao = ((recebidoMes - faturamentoMesPassado) / faturamentoMesPassado) * 100;
    }
    return { recebidoMes, aReceberMes, variacao };
  };

  const stats = statsFinanceiras();

  // Função para quitar débito diretamente no financeiro
  async function quitarDebito(registro) {
    const valorPendente = registro.valor_servico - registro.valor_pago;
    try {
      await supabase.from('financeiro').update({ valor_pago: registro.valor_servico }).eq('id', registro.id);
      const { data: cli } = await supabase.from('clientes').select('saldo_devedor').eq('nome', registro.cliente_nome).maybeSingle();
      const novoSaldo = Math.max(0, (cli?.saldo_devedor || 0) - valorPendente);
      await supabase.from('clientes').update({ saldo_devedor: novoSaldo }).eq('nome', registro.cliente_nome);
      mostrarAlerta("Sucesso", "Débito quitado!");
      buscarFinanceiro(); buscarClientes();
    } catch (e) { mostrarAlerta("Erro", "Falha ao quitar."); }
  }

  return (
    <div className="min-h-screen bg-[#FDF6F3] flex font-sans text-[#5D4037] overflow-x-hidden">
      
      {/* MENU MOBILE */}
      <button onClick={() => setMenuAberto(!menuAberto)} className="fixed top-4 left-4 z-[60] p-3 bg-white rounded-xl shadow-lg md:hidden text-[#A67C52]">
        {menuAberto ? <X size={24} /> : <MenuIcon size={24} />}
      </button>

      {/* SIDEBAR */}
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
          <button onClick={() => { setAbaAtiva('financeiro'); setMenuAberto(false); }} className={`w-full flex items-center gap-4 p-4 rounded-xl transition ${abaAtiva === 'financeiro' ? 'bg-[#F9F1ED] text-[#A67C52] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
            <DollarSign size={20}/> Financeiro
          </button>
        </nav>
      </aside>

      <main className={`flex-1 transition-all duration-300 md:ml-72 p-4 md:p-12 max-w-full ${menuAberto ? 'blur-sm md:blur-none pointer-events-none md:pointer-events-auto' : ''}`}>
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 pt-12 md:pt-0">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif uppercase tracking-tight">Olá, Joanes!</h2>
            <p className="text-gray-500 mt-1">
              {abaAtiva === 'agenda' && 'Sua agenda atualizada em tempo real.'}
              {abaAtiva === 'clientes' && 'Gerencie sua base de clientes.'}
              {abaAtiva === 'financeiro' && 'Acompanhe seu histórico de ganhos.'}
            </p>
          </div>
          {abaAtiva === 'agenda' && (
            <button onClick={() => { limparCampos(); setModalAberto(true); }} className="w-full md:w-auto bg-[#A67C52] hover:bg-[#8B6543] text-white px-8 py-4 rounded-full font-bold shadow-lg transition-all active:scale-95">
              + Novo Agendamento
            </button>
          )}
        </header>

        {/* CARDS DE RESUMO DINÂMICOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          {abaAtiva !== 'financeiro' ? (
            <>
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
                <Calendar className="text-[#A67C52] mb-4" size={24}/>
                <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Agendamentos</h3>
                <p className="text-4xl font-serif mt-2">{dataSelecionada ? listaAgendamentos.filter(a => a.data === dataSelecionada).length : listaAgendamentos.length}</p>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
                <Users className="text-[#A67C52] mb-4" size={24}/>
                <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Total Clientes</h3>
                <p className="text-4xl font-serif mt-2">{listaClientes.length}</p>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
                <DollarSign className="text-[#A67C52] mb-4" size={24}/>
                <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Previsto Agenda</h3>
                <p className="text-3xl md:text-4xl font-serif mt-2">{calcularFaturamento()}</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
                <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest mb-2">Recebido (Mês)</h3>
                <p className="text-4xl font-serif text-green-600">R$ {stats.recebidoMes.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
                <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest mb-2">Pendente (Mês)</h3>
                <p className="text-4xl font-serif text-red-500">R$ {stats.aReceberMes.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
                <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest mb-2">Performance</h3>
                <div className="flex items-center gap-2">
                  <p className={`text-3xl font-serif ${stats.variacao >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                    {stats.variacao > 0 ? '+' : ''}{stats.variacao.toFixed(1)}%
                  </p>
                  {stats.variacao >= 0 ? <TrendingUp className="text-blue-600" /> : <TrendingDown className="text-amber-600" />}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl border border-[#EAD7CC] overflow-hidden">
          
          {/* ABA: AGENDA */}
          {abaAtiva === 'agenda' && (
            <>
              <div className="p-4 md:p-6 bg-white border-b border-[#EAD7CC] sticky top-0 z-20">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] md:text-xs uppercase tracking-widest font-black text-[#A67C52]">Navegação Rápida</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setOffsetDias(prev => Math.max(0, prev - 15))} className="p-2 rounded-xl border border-[#EAD7CC]"><ChevronRight size={18} className="rotate-180" /></button>
                    <button onClick={() => setOffsetDias(prev => prev + 15)} className="p-2 rounded-xl border border-[#EAD7CC]"><ChevronRight size={18} /></button>
                  </div>
                </div>
                <div className="flex flex-nowrap gap-3 overflow-x-auto pb-4 scrollbar-hide">
                  {[...Array(15)].map((_, i) => {
                    const d = new Date(); d.setDate(d.getDate() + i + offsetDias);
                    const iso = d.toISOString().split('T')[0];
                    const selecionado = dataSelecionada === iso;
                    return (
                      <button key={iso} onClick={() => setDataSelecionada(selecionado ? null : iso)} className={`flex flex-col items-center justify-center flex-shrink-0 w-[65px] h-[85px] rounded-[22px] border transition-all ${selecionado ? 'bg-[#A67C52] text-white shadow-md' : 'bg-[#FDF6F3] text-[#5D4037]'}`}>
                        <span className="text-[9px] uppercase font-bold mb-1">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0,3)}</span>
                        <span className="text-xl font-serif font-black">{d.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="divide-y divide-gray-50">
                {(dataSelecionada ? listaAgendamentos.filter(a => a.data === dataSelecionada) : listaAgendamentos).map((item) => (
                  <div key={item.id} className="p-4 md:p-6 hover:bg-[#FDF6F3] transition group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px] bg-[#F9F1ED] p-2 rounded-2xl">
                          <span className="block text-lg font-serif text-[#A67C52] font-bold">{item.hora.substring(0,5)}</span>
                          <span className="text-[9px] text-[#A67C52]/70 uppercase font-bold">{new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</span>
                        </div>
                        <div>
                          <p className="font-bold text-[#5D4037]">{item.cliente_nome}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest">{item.servico} • {item.telefone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button onClick={() => { setPagamentoId(item.id); setVTotal(item.valor_total || ''); setVPago(item.valor_pago || ''); }} className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all"><DollarSign size={18} /></button>
                        <button onClick={() => enviarWhatsApp(item)} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all"><MessageCircle size={18} /></button>
                        <button onClick={() => prepararEdicao(item)} className="p-2 bg-[#F9F1ED] text-[#A67C52] rounded-xl hover:bg-[#A67C52] hover:text-white transition-all"><Scissors size={18} /></button>
                        <button onClick={() => setConfirmacao({ aberto: true, item })} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><X size={18} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ABA: CLIENTES */}
          {abaAtiva === 'clientes' && (
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
                        <span className="bg-red-50 text-red-500 px-3 py-1 rounded-full text-xs font-bold">{cliente.desmarques_total || 0}</span>
                      </td>
                      <td className="p-6 text-center">
                        {cliente.saldo_devedor > 0 ? (
                          <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">R$ {cliente.saldo_devedor.toFixed(2)}</span>
                        ) : (
                          <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">Em dia</span>
                        )}
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setClienteEditando(cliente); setModalClienteAberto(true); }} className="p-2 text-blue-600"><Edit size={18}/></button>
                          <button onClick={() => excluirCliente(cliente.id)} className="p-2 text-red-500"><Trash2 size={18}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ABA: FINANCEIRO */}
          {abaAtiva === 'financeiro' && (
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif">Histórico de Recebimentos</h3>
                <div className="bg-[#F9F1ED] p-2 rounded-xl border border-[#EAD7CC]">
                  <input type="text" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-[#5D4037] w-20 text-center" placeholder="MM/AAAA" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[#A67C52] text-[10px] uppercase tracking-widest font-bold border-b border-[#F9F1ED]">
                    <tr>
                      <th className="pb-4">Data</th>
                      <th className="pb-4">Cliente</th>
                      <th className="pb-4 text-right">Total</th>
                      <th className="pb-4 text-right">Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {historicoFinanceiro.filter(f => !filtroMes || f.mes_referencia === filtroMes).map((reg) => (
                      <tr key={reg.id} className="text-sm">
                        <td className="py-4 text-gray-400">{new Date(reg.data_finalizacao).toLocaleDateString('pt-BR')}</td>
                        <td className="py-4 font-bold">{reg.cliente_nome}</td>
                        <td className="py-4 text-right text-gray-400">R$ {reg.valor_servico?.toFixed(2)}</td>
                        <td className="py-4 text-right font-bold text-green-600">R$ {reg.valor_pago?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAIS (EDIÇÃO, NOVO AGENDAMENTO, AVISOS, ETC) */}
      {/* ... [mantenha seus modais de Edição Cliente e Novo Agendamento aqui] ... */}

      {/* MODAL DE PAGAMENTO (ADICIONADO) */}
      {pagamentoId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-2xl font-serif mb-6 text-[#5D4037]">Finalizar Atendimento</h3>
            <div className="space-y-4">
              <input type="number" value={vTotal} onChange={(e) => setVTotal(e.target.value)} className="w-full bg-gray-50 border p-4 rounded-2xl outline-none" placeholder="Valor do Serviço" />
              <input type="number" value={vPago} onChange={(e) => setVPago(e.target.value)} className="w-full bg-gray-50 border p-4 rounded-2xl outline-none focus:border-green-500" placeholder="Quanto foi pago?" />
              <div className="flex gap-3 pt-4">
                <button onClick={() => setPagamentoId(null)} className="flex-1 py-4 font-bold text-gray-400">Voltar</button>
                <button onClick={() => salvarPagamento(listaAgendamentos.find(a => a.id === pagamentoId))} className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg">Finalizar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AVISOS */}
      {aviso.aberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl text-center">
            <h3 className="text-2xl font-serif mb-2">{aviso.titulo}</h3>
            <p className="text-gray-500 mb-8">{aviso.mensagem}</p>
            <button onClick={() => setAviso({ ...aviso, aberto: false })} className="w-full bg-[#A67C52] text-white py-4 rounded-xl font-bold">Entendi</button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO CANCELAMENTO */}
      {confirmacao.aberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl text-center">
            <h3 className="text-2xl font-serif mb-2 text-[#5D4037]">Cancelar Horário?</h3>
            <p className="text-gray-500 mb-8">Deseja remover o agendamento de <span className="font-bold">{confirmacao.item?.cliente_nome}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmacao({ aberto: false, item: null })} className="flex-1 bg-gray-100 py-4 rounded-xl font-bold text-gray-500">Voltar</button>
              <button onClick={executarCancelamento} className="flex-1 bg-red-500 text-white py-4 rounded-xl font-bold shadow-lg">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;