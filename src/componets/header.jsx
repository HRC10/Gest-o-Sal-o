export default function Header({ abaAtiva, onNovoAgendamento }) {
  return (
    <header className="flex flex-col md:flex-row justify-between mb-12 gap-6 pt-12 md:pt-0">
      <div>
        <h2 className="text-3xl md:text-4xl font-serif uppercase">Olá, Joanes!</h2>
        <p className="text-gray-500 mt-1">
          {abaAtiva === 'agenda' && 'Sua agenda atualizada em tempo real.'}
          {abaAtiva === 'clientes' && 'Gerencie sua base de clientes.'}
          {abaAtiva === 'financeiro' && 'Acompanhe seu histórico de ganhos.'}
        </p>
      </div>

      {abaAtiva === 'agenda' && (
        <button
          onClick={onNovoAgendamento}
          className="bg-[#A67C52] text-white px-8 py-4 rounded-full font-bold"
        >
          + Novo Agendamento
        </button>
      )}
    </header>
  );
}
