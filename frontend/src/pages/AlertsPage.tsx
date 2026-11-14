import { AlertRow } from "../components/AlertRow";
import { Card, Empty, Loading, SectionTitle } from "../components/ui";
import { useSnapshot } from "../lib/snapshot";

export function AlertsPage() {
  const { onboard } = useSnapshot();
  if (!onboard) return <Loading />;
  const open = onboard.alerts.filter((a) => a.status !== "resolved");
  const closed = onboard.alerts.filter((a) => a.status === "resolved");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle>Активные тревоги ({open.length})</SectionTitle>
        {open.length === 0 ? <Empty>Активных тревог нет</Empty> :
          <div className="space-y-2">{open.map((a) => <AlertRow key={a.id} alert={a} nowT={onboard.t} />)}</div>}
      </Card>
      <Card>
        <SectionTitle>Закрытые за последний час</SectionTitle>
        {closed.length === 0 ? <Empty>Нет</Empty> :
          <div className="space-y-2">{closed.map((a) => <AlertRow key={a.id} alert={a} nowT={onboard.t} />)}</div>}
      </Card>
    </div>
  );
}
