import AgendaNavigator from './AgendaNavigator';
import AgendaList from './AgendaList';

export default function AgendaView(props) {
  return (
    <>
      <AgendaNavigator
        offsetDias={props.offsetDias}
        setOffsetDias={props.setOffsetDias}
        dataSelecionada={props.dataSelecionada}
        setDataSelecionada={props.setDataSelecionada}
      />

      <AgendaList
        listaAgendamentos={props.listaAgendamentos}
        dataSelecionada={props.dataSelecionada}
        prepararEdicao={props.prepararEdicao}
        enviarWhatsApp={props.enviarWhatsApp}
        setConfirmacao={props.setConfirmacao}
        setPagamentoId={props.setPagamentoId}
        setVTotal={props.setVTotal}
        setVPago={props.setVPago}
      />
    </>
  );
}
