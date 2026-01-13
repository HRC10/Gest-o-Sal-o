export default function FinanceiroTable({ historicoFinanceiro, filtroMes }) {
  return (
    <table className="w-full">
      <thead className="text-xs uppercase text-[#A67C52]">
        <tr>
          <th>Data</th>
          <th>Cliente</th>
          <th className="text-right">Total</th>
          <th className="text-right">Pago</th>
        </tr>
      </thead>
      <tbody>
        {historicoFinanceiro
          .filter(f => !filtroMes || f.mes_referencia === filtroMes)
          .map(reg => (
            <tr key={reg.id}>
              <td>{new Date(reg.data_finalizacao).toLocaleDateString('pt-BR')}</td>
              <td>{reg.cliente_nome}</td>
              <td className="text-right">R$ {reg.valor_servico?.toFixed(2)}</td>
              <td className="text-right font-bold text-green-600">R$ {reg.valor_pago?.toFixed(2)}</td>
            </tr>
        ))}
      </tbody>
    </table>
  );
}
