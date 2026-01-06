import React, { useState, useEffect } from 'react';
import { Calendar, Users, DollarSign, Scissors, ChevronRight, X, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

function App() {
  // --- ESTADOS ---
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState({ aberto: false, titulo: '', mensagem: '' });
  const [confirmacao, setConfirmacao] = useState({ aberto: false, item: null });
  const [idEditando, setIdEditando] = useState(null);

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
  useEffect(() => {
    buscarAgendamentos();
  }, []);
  // --- SALVAR DADOS (CREATE) ---
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
      // Verificação de Disponibilidade
      const { data: existente, error: erroBusca } = await supabase
        .from('agendamentos')
        .select('id, cliente_nome')
        .eq('data', data)
        .eq('hora', hora)
        .maybeSingle();

      if (erroBusca) throw erroBusca;

      if (existente) {
        mostrarAlerta("Horário Ocupado", `Atenção: Este horário já está ocupado por ${existente.cliente_nome}.`);
        return;
      }

      // Inserção no Banco
      // Se tiver idEditando, faz UPDATE. Se não, faz INSERT.
    if (idEditando) {
      const { error } = await supabase
        .from('agendamentos')
        .update({ 
          cliente_nome: nomeCliente, 
          telefone, 
          data, 
          hora, 
          servico 
        })
        .eq('id', idEditando);

      if (error) throw error;
      mostrarAlerta("Atualizado", "O agendamento foi alterado com sucesso!");
    } else {
      const { error } = await supabase
        .from('agendamentos')
        .insert([{ cliente_nome: nomeCliente, telefone, data, hora, servico }]);

      if (error) throw error;
      mostrarAlerta("Sucesso", "Agendamento realizado com sucesso!");
    }

    // Limpa tudo
    setIdEditando(null);
    setNomeCliente('');

      mostrarAlerta("Sucesso", "Agendamento realizado com sucesso!");
      
      setNomeCliente('');
      setTelefone('');
      setData('');
      setHora('');
      setModalAberto(false);
      buscarAgendamentos();
      
    } catch (error) {
      mostrarAlerta("Erro", "Erro ao processar agendamento: " + error.message);
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
      // 1. Deletar Agendamento
      const { error: erroDelete } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', agendamento.id);

      if (erroDelete) throw erroDelete;

      // 2. Incrementar contador de faltas na tabela de clientes
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
      mostrarAlerta("Cancelado", "O horário foi removido e o histórico da cliente atualizado.");
      buscarAgendamentos(); 

    } catch (error) {
      mostrarAlerta("Erro", "Não foi possível cancelar: " + error.message);
    }
  }

  // --- FUNÇÃO WHATSAPP ---
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
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-white shadow-2xl border-r border-[#EAD7CC] flex flex-col fixed h-full z-10">
        <div className="p-8">
          <h1 className="text-2xl font-serif font-bold text-[#A67C52] leading-tight">GABRIELI <br/> BEAUTY</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mt-2 font-semibold">Painel de Gestão</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => setAbaAtiva('agenda')} className={`w-full flex items-center gap-4 p-4 rounded-xl transition ${abaAtiva === 'agenda' ? 'bg-[#F9F1ED] text-[#A67C52] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Calendar size={20}/> Agenda
          </button>
          <button onClick={() => setAbaAtiva('clientes')} className={`w-full flex items-center gap-4 p-4 rounded-xl transition ${abaAtiva === 'clientes' ? 'bg-[#F9F1ED] text-[#A67C52] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Users size={20}/> Clientes
          </button>
          <button className="w-full flex items-center gap-4 p-4 rounded-xl text-gray-500 hover:bg-gray-50 transition"><Scissors size={20}/> Serviços</button>
          <button className="w-full flex items-center gap-4 p-4 rounded-xl text-gray-500 hover:bg-gray-50 transition"><DollarSign size={20}/> Financeiro</button>
        </nav>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 ml-72 p-12">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-4xl font-serif">Olá, Gabrieli!</h2>
            <p className="text-gray-500 mt-1">Sua agenda atualizada em tempo real.</p>
          </div>
          <button 
            onClick={() => setModalAberto(true)}
            className="bg-[#A67C52] hover:bg-[#8B6543] text-white px-8 py-4 rounded-full font-bold shadow-lg transition-all transform hover:scale-105"
          >
            + Novo Agendamento
          </button>
        </header>

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
            <Calendar className="text-[#A67C52] mb-4" size={24}/>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Agendamentos Totais</h3>
            <p className="text-4xl font-serif mt-2">{listaAgendamentos.length}</p>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-[#EAD7CC] shadow-sm">
            <DollarSign className="text-[#A67C52] mb-4" size={24}/>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-widest">Faturamento Estimado</h3>
            <p className="text-4xl font-serif mt-2">R$ 0,00</p>
          </div>
        </div>

        {/* LISTA DE AGENDAMENTOS */}
        {/* LISTA DE AGENDAMENTOS COM CORES VIVAS */}
<div className="divide-y divide-gray-100">
  {listaAgendamentos.map((item) => (
    <div key={item.id} className="p-6 flex items-center justify-between hover:bg-[#FDF6F3] transition group">
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
      
      <div className="flex items-center gap-2">
        {/* BOTÃO WHATSAPP - VERDE VIVO */}
        <button 
          onClick={() => enviarWhatsApp(item)}
          className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm"
          title="Confirmar via WhatsApp"
        >
          <MessageCircle size={20} fill="currentColor" fillOpacity={0.1} />
        </button>

        {/* BOTÃO EDITAR - MARROM/BEGE */}
        <button 
          onClick={() => prepararEdicao(item)}
          className="p-3 bg-[#F9F1ED] text-[#A67C52] rounded-xl hover:bg-[#A67C52] hover:text-white transition-all shadow-sm"
          title="Editar Horário"
        >
          <Scissors size={20} />
        </button>

        {/* BOTÃO EXCLUIR - VERMELHO VIVO */}
        <button 
          onClick={() => solicitarCancelamento(item)}
          className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
          title="Cancelar"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  ))}
</div>
      </main>

      {/* MODAL NOVO AGENDAMENTO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative">
            <button onClick={() => setModalAberto(false)} className="absolute top-8 right-8 text-gray-400 hover:text-gray-600">
              <X size={24}/>
            </button>
            <h3 className="text-3xl font-serif mb-8">Novo Agendamento</h3>
            <form onSubmit={handleSalvar} className="space-y-5">
              <input type="text" placeholder="Nome da Cliente" required value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-xl p-4 outline-none focus:ring-1 focus:ring-[#A67C52]" />
              <input type="tel" placeholder="WhatsApp" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-xl p-4 outline-none focus:ring-1 focus:ring-[#A67C52]" />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" required min={new Date().toISOString().split("T")[0]} value={data} onChange={(e) => setData(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-xl p-4 outline-none" />
                <input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-xl p-4 outline-none" />
              </div>
              <select value={servico} onChange={(e) => setServico(e.target.value)} className="w-full bg-[#FDF6F3] border border-[#EAD7CC] rounded-xl p-4 outline-none appearance-none cursor-pointer">
                <option>Volume Russo</option>
                <option>Volume Híbrido</option>
                <option>Design de Sobrancelha</option>
                <option>Limpeza de Pele</option>
              </select>
              <button type="submit" className="w-full bg-[#5D4037] text-white py-5 rounded-2xl font-bold text-lg hover:bg-[#3E2B25] transition-all shadow-lg active:scale-95">
                {idEditando ? 'SALVAR ALTERAÇÕES' : 'SALVAR NA AGENDA'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ALERTA */}
      {aviso.aberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl border border-[#EAD7CC] text-center">
            <h3 className="text-2xl font-serif mb-2 text-[#5D4037]">{aviso.titulo}</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">{aviso.mensagem}</p>
            <button 
              onClick={() => setAviso({ ...aviso, aberto: false })} 
              className="w-full bg-[#A67C52] text-white py-4 rounded-xl font-bold hover:bg-[#8B6543] transition-all active:scale-95"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO */}
      {confirmacao.aberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl border border-[#EAD7CC] text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="text-red-500" size={32} />
            </div>
            <h3 className="text-2xl font-serif mb-2 text-[#5D4037]">Cancelar Horário?</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Deseja mesmo cancelar o agendamento de <span className="font-bold">{confirmacao.item?.cliente_nome}</span>?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmacao({ aberto: false, item: null })} 
                className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Voltar
              </button>
              <button 
                onClick={executarCancelamento} 
                className="flex-1 bg-red-500 text-white py-4 rounded-xl font-bold hover:bg-red-600 transition-all shadow-md"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  ); // Fecha o return
} // Fecha a function App

export default App;