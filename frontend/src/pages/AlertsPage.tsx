import { Bell, CircleCheck } from "lucide-react";
import { AlertRow } from "../components/AlertRow";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, PageSkeleton, Panel, PanelTitle } from "../components/ui";
import { useSnapshot } from "../lib/snapshot";

export function AlertsPage() {
  const { onboard } = useSnapshot();
  if (!onboard) return <PageSkeleton />;
  const open = onboard.alerts.filter((a) => a.status !== "resolved");
  const closed = onboard.alerts.filter((a) => a.status === "resolved");
  return (
    <>
      <PageHeader eyebrow="Борт" title="Тревоги">Каждая тревога открывает пошаговый протокол действий.</PageHeader>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel labelledBy="open-alerts">
          <PanelTitle id="open-alerts" icon={Bell} aside={<span className="num text-sm text-muted">{open.length}</span>}>Активные</PanelTitle>
          {open.length === 0 ? <EmptyState icon={CircleCheck} title="Активных тревог нет">Все показатели экипажа и корабля в норме.</EmptyState> :
            <div className="space-y-2">{open.map((a) => <AlertRow key={a.id} alert={a} nowT={onboard.t} />)}</div>}
        </Panel>
        <Panel labelledBy="closed-alerts">
          <PanelTitle id="closed-alerts" icon={CircleCheck}>Закрытые за последний час</PanelTitle>
          {closed.length === 0 ? <EmptyState title="Пока нет закрытых тревог" /> :
            <div className="space-y-2">{closed.map((a) => <AlertRow key={a.id} alert={a} nowT={onboard.t} />)}</div>}
        </Panel>
      </div>
    </>
  );
}
