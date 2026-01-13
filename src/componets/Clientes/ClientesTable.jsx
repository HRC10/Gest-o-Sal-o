import { Edit, Trash2 } from 'lucide-react';

export default function ClientesTable({ listaClientes, onEditar, onExcluir }) {
  return (
    <table className="w-full min-w-[600px]">
      <thead className="bg-[#F9F1ED] text-xs uppercase text-[#A67C52]">
        <tr>
          <th className="p-6">Nome</th>
          <th className="p-6 text-center">Desmarques</th>
          <th className="p-6 text-center">Situação</th>
          <th className="p-6 text-right">Ações</th>
        </tr>
      </thead>
      <tbody>
        {listaClientes.map(c => (
          <tr key={c.id}>
            <td className="p-6 font-bold">{c.nome}</td>
            <td className="p-6 text-center">{c.desmarques_total || 0}</td>
            <td className="p-6 text-center">
              {c.saldo_devedor > 0 ? `R$ ${c.saldo_devedor.toFixed(2)}` : 'Em dia'}
            </td>
            <td className="p-6 text-right flex gap-2 justify-end">
              <button onClick={() => onEditar(c)}><Edit size={18}/></button>
              <button onClick={() => onExcluir(c.id)}><Trash2 size={18}/></button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
