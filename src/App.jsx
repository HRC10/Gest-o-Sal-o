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
    <div className="min-h-screen flex">
      <Sidebar
        abaAtiva={abaAtiva}
        setAbaAtiva={setAbaAtiva}
        menuAberto={menuAberto}
        setMenuAberto={setMenuAberto}
      />

      <main className="flex-1 md:ml-72 p-6">
        <Header
          abaAtiva={abaAtiva}
          onNovoAgendamento={() => { limparCampos(); setModalAberto(true); }}
        />

        {abaAtiva === 'agenda' && <AgendaView {...propsAgenda} />}
        {abaAtiva === 'clientes' && <ClientesTable {...propsClientes} />}
        {abaAtiva === 'financeiro' && <FinanceiroTable {...propsFinanceiro} />}

        {pagamentoId && (
          <ModalPagamento
            vTotal={vTotal}
            vPago={vPago}
            setVTotal={setVTotal}
            setVPago={setVPago}
            onCancelar={() => setPagamentoId(null)}
            onSalvar={() => salvarPagamento(listaAgendamentos.find(a => a.id === pagamentoId))}
          />
        )}
      </main>
    </div>
  );
}
export default App;