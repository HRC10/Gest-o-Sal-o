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
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [aviso, setAviso] = useState({ aberto: false, titulo: '', mensagem: '' });
  const [confirmacao, setConfirmacao] = useState({ aberto: false, item: null });
  const [listaClientes, setListaClientes] = useState([]);
  const [listaAgendamentos, setListaAgendamentos] = useState([]);
  const [offsetDias, setOffsetDias] = useState(0); 
  const [dataSelecionada, setDataSelecionada] = useState(null);
  const [idEditando, setIdEditando] = useState(null);

  // Campos do formulário
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [servico, setServico] = useState('Volume Russo');
  const [valorTotal, setValorTotal] = useState(''); 
  const [valorPago, setValorPago] = useState('');

  // Estados do Modal de Pagamento (Cifrão)
  const [pagamentoId, setPagamentoId] = useState(null); 
  const [vTotal, setVTotal] = useState(''); 
  const [vPago, setVPago] = useState('');

  // ==========================================
  // 2. BUSCA DE DADOS (SUPABASE)
  // ==========================================
  const mostrarAlerta = (titulo, mensagem) => setAviso({ aberto: true, titulo, mensagem });

  async function buscarTudo() {
    setCarregando(true);
    await Promise.all([buscarAgendamentos(), buscarClientes(), buscarFinanceiro()]);
    setCarregando(false);
  }

  async function buscarFinanceiro() {
    const { data, error } = await supabase.from('financeiro').select('*').order('data_finalizacao', { ascending: false });
    if (!error) setHistoricoFinanceiro(data || []);
  }

  async function buscarAgendamentos() {
    const { data, error } = await supabase.from('agendamentos').select('*').order('data', { ascending: true }).order('hora', { ascending: true });
    if (!error) setListaAgendamentos(data || []);
  }

  async function buscarClientes() {
    const { data, error } = await supabase.from('clientes').select('*').order('nome', { ascending: true });
    if (!error) setListaClientes(data || []);
  }

  useEffect(() => { buscarTudo(); }, []);

  // ==========================================
  // 3. LÓGICA DE NEGÓCIO E CALCULOS
  // ==========================================
  const statsFinanceiras = () => {
    const hoje = new Date();
    const mesAtual = `${(hoje.getMonth() + 1).toString().padStart(2, '0')}/${hoje.getFullYear()}`;
    const registrosMes = historicoFinanceiro.filter(f => f.mes_referencia === mesAtual);
    const recebidoMes = registrosMes.reduce((acc, curr) => acc + (Number(curr.valor_pago) || 0), 0);
    const aReceberMes = registrosMes.reduce((acc, curr) => acc + Math.max(0, Number(curr.valor_servico) - Number(curr.valor_pago)), 0);
    
    // Variacao (Simulada ou baseada no mes anterior)
    return { recebidoMes, aReceberMes, variacao: 12.5 }; 
  };

  const stats = statsFinanceiras();

  const calcularFaturamentoPrevisto = () => {
    const totalAgenda = listaAgendamentos.reduce((acc, curr) => acc + (Number(curr.valor_pago) || 0), 0);
    const totalFinanceiro = stats.recebidoMes;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAgenda + totalFinanceiro);
  };

  // ==========================================
  // 4. FUNÇÕES DE AÇÃO
  // ==========================================
  async function handleSalvar(e) {
    e.preventDefault();
    try {
      const dados = { 
        cliente_nome: nomeCliente, telefone, data, hora, servico, 
        valor_total: Number(valorTotal) || 0, valor_pago: Number(valorPago) || 0 
      };

      if (idEditando) {
        await supabase.from('agendamentos').update(dados).eq('id', idEditando);
      } else {
        await supabase.from('agendamentos').insert([dados]);
      }

      await supabase.from('clientes').upsert({ nome: nomeCliente, telefone }, { onConflict: 'nome' });
      setModalAberto(false);
      limparCampos();
      await buscarTudo();
      mostrarAlerta("Sucesso", "Agendamento salvo!");
    } catch (err) { mostrarAlerta("Erro", err.message); }
  }

  async function salvarPagamento(item) {
    try {
      const vT = Number(vTotal) || 0;
      const vP = Number(vPago) || 0;
      const mesRef = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`;

      await supabase.from('financeiro').insert([{
        agendamento_id: item.id, cliente_nome: item.cliente_nome,
        servico: item.servico, valor_servico: vT, valor_pago: vP,
        mes_referencia: mesRef, data_finalizacao: new Date().toISOString()
      }]);

      if (vT > vP) {
        const { data: cli } = await supabase.from('clientes').select('saldo_devedor').eq('nome', item.cliente_nome).maybeSingle();
        await supabase.from('clientes').upsert({ nome: item.cliente_nome, saldo_devedor: (cli?.saldo_devedor || 0) + (vT - vP) }, { onConflict: 'nome' });
      }

      await supabase.from('agendamentos').delete().eq('id', item.id);
      setPagamentoId(null);
      await buscarTudo();
    } catch (e) { mostrarAlerta("Erro", "Erro ao pagar"); }
  }

  async function executarCancelamento() {
    const item = confirmacao.item;
    await supabase.from('agendamentos').delete().eq('id', item.id);
    const { data: cli } = await supabase.from('clientes').select('desmarques_total').eq('nome', item.cliente_nome).maybeSingle();
    await supabase.from('clientes').upsert({ nome: item.cliente_nome, desmarques_total: (cli?.desmarques_total || 0) + 1 }, { onConflict: 'nome' });
    setConfirmacao({ aberto: false, item: null });
    await buscarTudo();
  }

  const limparCampos = () => { setNomeCliente(''); setTelefone(''); setData(''); setHora(''); setValorTotal(''); setValorPago(''); setIdEditando(null); };

  const prepararEdicao = (item) => {
    setIdEditando(item.id); setNomeCliente(item.cliente_nome); setTelefone(item.telefone);
    setData(item.data); setHora(item.hora); setServico(item.servico);
    setValorTotal(item.valor_total || ''); setValorPago(item.valor_pago || '');
    setModalAberto(true);
  };

  const enviarWhatsApp = (item) => {
    const msg = encodeURIComponent(`Olá ${item.cliente_nome}, confirmo seu horário de ${item.servico} dia ${item.data} às ${item.hora}?`);
    window.open(`https://wa.me/55${item.telefone.replace(/\D/g,'')}?text=${msg}`, '_blank');
  };

  // ==========================================
  // 5. INTERFACE (RENDER)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#FDF6F3] flex font-sans text-[#5D4037] overflow-x-hidden">
      
      {/* BOTÃO MENU MOBILE */}
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

        {/* CARDS DE RESUMO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
            <Calendar className="text-[#A67C52] mb-4" size={24}/>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Agendamentos</h3>
            <p className="text-4xl font-serif mt-2">
              {dataSelecionada ? listaAgendamentos.filter(a => a.data === dataSelecionada).length : listaAgendamentos.length}
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
            <p className="text-3xl md:text-4xl font-serif mt-2">{calcularFaturamentoPrevisto()}</p>
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO */}
        <div className="bg-white rounded-[2rem] shadow-xl border border-[#EAD7CC] overflow-hidden">
          
          {/* ABA: AGENDA */}
          {abaAtiva === 'agenda' && (
            <>
              {/* CARROSSEL DE DATAS */}
              <div className="p-4 md:p-6 bg-white border-b border-[#EAD7CC] sticky top-0 z-20">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] md:text-xs uppercase tracking-widest font-black text-[#A67C52]">Navegação Rápida</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setOffsetDias(prev => Math.max(0, prev - 15))} className="p-2 rounded-xl border border-[#EAD7CC] hover:bg-gray-50"><ChevronRight size={18} className="rotate-180" /></button>
                    <button onClick={() => setOffsetDias(prev => prev + 15)} className="p-2 rounded-xl border border-[#EAD7CC] hover:bg-gray-50"><ChevronRight size={18} /></button>
                  </div>
                </div>
                <div className="flex flex-nowrap gap-3 overflow-x-auto pb-4 scrollbar-hide touch-pan-x">
                  {[...Array(15)].map((_, i) => {
                    const d = new Date(); d.setDate(d.getDate() + i + offsetDias);
                    const iso = d.toISOString().split('T')[0];
                    const selecionado = dataSelecionada === iso;
                    const temAgendamento = listaAgendamentos.some(a => a.data === iso);
                    return (
                      <button key={iso} onClick={() => setDataSelecionada(selecionado ? null : iso)} className={`flex flex-col items-center justify-center flex-shrink-0 w-[65px] h-[85px] rounded-[22px] transition-all border ${selecionado ? 'bg-[#A67C52] border-[#A67C52] text-white shadow-md scale-105' : 'bg-[#FDF6F3] border-[#EAD7CC] text-[#5D4037] hover:border-[#A67C52]'}`}>
                        <span className="text-[9px] uppercase font-bold opacity-60 mb-1">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0,3)}</span>
                        <span className="text-xl font-serif font-black">{d.getDate()}</span>
                        <div className={`w-1.5 h-1.5 rounded-full mt-2 ${temAgendamento ? (selecionado ? 'bg-white' : 'bg-[#A67C52]') : 'bg-transparent'}`}></div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* LISTA DA AGENDA */}
              <div className="divide-y divide-gray-50">
                {(dataSelecionada ? listaAgendamentos.filter(a => a.data === dataSelecionada) : listaAgendamentos).map((item) => (
                  <div key={item.id} className="p-4 md:p-6 hover:bg-[#FDF6F3] transition group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px] bg-[#F9F1ED] p-2 rounded-2xl">
                          <span className="block text-xl font-serif text-[#A67C52] font-bold">{item.hora.substring(0,5)}</span>
                          <span className="text-[9px] text-[#A67C52]/70 uppercase font-bold">{new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</span>
                        </div>
                        <div>
                          <p className="font-bold text-lg text-[#5D4037]">{item.cliente_nome}</p>
                          <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest">{item.servico} • {item.telefone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button onClick={() => { setPagamentoId(item.id); setVTotal(item.valor_total || ''); setVPago(item.valor_pago || ''); }} className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all"><DollarSign size={18} /></button>
                        <button onClick={() => enviarWhatsApp(item)} className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all"><MessageCircle size={18} /></button>
                        <button onClick={() => prepararEdicao(item)} className="p-3 bg-[#F9F1ED] text-[#A67C52] rounded-xl hover:bg-[#A67C52] hover:text-white transition-all"><Scissors size={18} /></button>
                        <button onClick={() => setConfirmacao({ aberto: true, item })} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><X size={18} /></button>
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
                          <span className="flex items-center justify-center gap-1 bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase mx-auto w-fit">
                            <AlertCircle size={12}/> R$ {cliente.saldo_devedor.toFixed(2)}
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase mx-auto w-fit">Em dia</span>
                        )}
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => enviarWhatsApp(cliente)} className="p-2 text-green-600"><MessageCircle size={18}/></button>
                          <button onClick={() => { setClienteEditando(cliente); setModalClienteAberto(true); }} className="p-2 text-blue-600"><Edit size={18}/></button>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white border border-[#EAD7CC] p-6 rounded-[2rem]">
                  <h4 className="text-gray-400 text-[10px] font-black uppercase mb-2">Recebido (Mês)</h4>
                  <p className="text-3xl font-serif text-green-600">R$ {stats.recebidoMes.toFixed(2)}</p>
                </div>
                <div className="bg-white border border-[#EAD7CC] p-6 rounded-[2rem]">
                  <h4 className="text-gray-400 text-[10px] font-black uppercase mb-2">Pendente (Mês)</h4>
                  <p className="text-3xl font-serif text-red-500">R$ {stats.aReceberMes.toFixed(2)}</p>
                </div>
                <div className="bg-white border border-[#EAD7CC] p-6 rounded-[2rem]">
                  <h4 className="text-gray-400 text-[10px] font-black uppercase mb-2">Performance</h4>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-serif text-blue-600">+{stats.variacao}%</p>
                    <TrendingUp className="text-blue-600" />
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-serif mb-6">Histórico de Recebimentos</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[#A67C52] text-[10px] uppercase tracking-widest font-bold border-b border-[#F9F1ED]">
                    <tr><th className="pb-4">Data</th><th className="pb-4">Cliente</th><th className="pb-4 text-right">Pago</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {historicoFinanceiro.map(reg => (
                      <tr key={reg.id} className="text-sm">
                        <td className="py-4 text-gray-400">{new Date(reg.data_finalizacao).toLocaleDateString('pt-BR')}</td>
                        <td className="py-4 font-bold">{reg.cliente_nome}</td>
                        <td className="py-4 text-right font-bold text-green-600">R$ {reg.valor_pago.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL AGENDAMENTO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl relative">
            <button onClick={() => setModalAberto(false)} className="absolute top-6 right-6 text-gray-400"><X size={28}/></button>
            <h3 className="text-2xl font-serif mb-8">{idEditando ? 'Editar Horário' : 'Novo Agendamento'}</h3>
            <form onSubmit={handleSalvar} className="space-y-4">
              <input type="text" placeholder="Nome da Cliente" required value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
              <input type="tel" placeholder="WhatsApp" value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" required value={data} onChange={e => setData(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
                <input type="time" required value={hora} onChange={e => setHora(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Valor Total" value={valorTotal} onChange={e => setValorTotal(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
                <input type="number" placeholder="Valor Pago" value={valorPago} onChange={e => setValorPago(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none" />
              </div>
              <select value={servico} onChange={e => setServico(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-2xl p-4 outline-none">
                <option>Volume Russo</option><option>Volume Híbrido</option><option>Design de Sobrancelha</option><option>Limpeza de Pele</option>
              </select>
              <button type="submit" className="w-full bg-[#5D4037] text-white py-5 rounded-2xl font-bold text-lg shadow-lg">Confirmar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGAMENTO (CIFRÃO) */}
      {pagamentoId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-2xl font-serif mb-6">Finalizar Atendimento</h3>
            <div className="space-y-4">
              <label className="text-xs font-bold text-gray-400 block ml-1">Valor Total do Serviço</label>
              <input type="number" value={vTotal} onChange={e => setVTotal(e.target.value)} className="w-full bg-gray-50 border p-4 rounded-2xl outline-none" />
              <label className="text-xs font-bold text-gray-400 block ml-1">Valor Recebido</label>
              <input type="number" value={vPago} onChange={e => setVPago(e.target.value)} className="w-full bg-gray-50 border p-4 rounded-2xl outline-none focus:border-green-500" />
              <div className="flex gap-3 pt-4">
                <button onClick={() => setPagamentoId(null)} className="flex-1 py-4 font-bold text-gray-400">Voltar</button>
                <button onClick={() => salvarPagamento(listaAgendamentos.find(a => a.id === pagamentoId))} className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg">Pagar e Finalizar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO CANCELAMENTO */}
      {confirmacao.aberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl text-center">
            <h3 className="text-2xl font-serif mb-2">Cancelar Horário?</h3>
            <p className="text-gray-500 mb-8">Deseja remover o agendamento de <span className="font-bold">{confirmacao.item?.cliente_nome}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmacao({ aberto: false, item: null })} className="flex-1 bg-gray-100 py-4 rounded-xl font-bold">Voltar</button>
              <button onClick={executarCancelamento} className="flex-1 bg-red-500 text-white py-4 rounded-xl font-bold">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* AVISOS GERAIS */}
      {aviso.aberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-xs p-8 text-center shadow-2xl">
            <h3 className="text-xl font-bold mb-2">{aviso.titulo}</h3>
            <p className="text-gray-500 mb-6">{aviso.mensagem}</p>
            <button onClick={() => setAviso({ ...aviso, aberto: false })} className="w-full bg-[#A67C52] text-white py-4 rounded-xl font-bold">Entendi</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;