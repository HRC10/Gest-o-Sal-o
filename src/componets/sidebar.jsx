import { Calendar, Users, DollarSign } from 'lucide-react';

export default function Sidebar({ abaAtiva, setAbaAtiva, menuAberto, setMenuAberto }) {
  return (
    <aside className={`w-72 bg-white shadow-2xl border-r fixed h-full z-50 transition-transform
      ${menuAberto ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

      <div className="p-8">
        <h1 className="text-2xl font-serif font-bold text-[#A67C52]">Joanes<br/>Netto</h1>
        <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-2">Painel de Gestão</p>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {[
          { id: 'agenda', label: 'Agenda', icon: <Calendar size={20}/> },
          { id: 'clientes', label: 'Clientes', icon: <Users size={20}/> },
          { id: 'financeiro', label: 'Financeiro', icon: <DollarSign size={20}/> }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => { setAbaAtiva(item.id); setMenuAberto(false); }}
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition
              ${abaAtiva === item.id ? 'bg-[#F9F1ED] text-[#A67C52] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
