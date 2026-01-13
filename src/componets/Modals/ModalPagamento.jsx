export default function ModalPagamento({ vTotal, vPago, setVTotal, setVPago, onCancelar, onSalvar }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]">
      <div className="bg-white p-8 rounded-2xl w-full max-w-sm">
        <h3 className="text-2xl font-serif mb-6">Finalizar Atendimento</h3>

        <input value={vTotal} onChange={e => setVTotal(e.target.value)} placeholder="Valor total" className="w-full mb-3 p-4 border rounded-xl"/>
        <input value={vPago} onChange={e => setVPago(e.target.value)} placeholder="Valor pago" className="w-full mb-6 p-4 border rounded-xl"/>

        <div className="flex gap-3">
          <button onClick={onCancelar} className="flex-1">Voltar</button>
          <button onClick={onSalvar} className="flex-1 bg-green-600 text-white rounded-xl">Finalizar</button>
        </div>
      </div>
    </div>
  );
}
