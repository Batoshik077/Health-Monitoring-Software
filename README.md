# AstroHealth — мониторинг здоровья астронавтов

Хакатонный проект: бортовая система, которая собирает показатели здоровья экипажа, помогает **самому астронавту** оценить своё состояние и подсказывает, **что делать прямо сейчас** — не дожидаясь Земли.

## Задача

> Long-duration missions expose astronauts to space radiation, isolation and confinement, altered gravity, and a hostile closed environment, which can bring immune changes, bone loss, cardiovascular events, and behavioral health problems. On long missions, astronauts carry much of the responsibility for spotting these changes in themselves. Your challenge is to build a health monitoring software that gathers health indicators and enables astronauts to evaluate and act on the status of their health.

| Что просят | Что делаем |
|---|---|
| **Gather** — собирать показатели | Датчики (симуляция), среда корабля, ежедневный опросник, дневник симптомов, журнал тренировок |
| **Evaluate** — оценить состояние | Статус по системам организма, NEWS2, личная норма, тренды, индекс готовности, объяснение каждой тревоги |
| **Act** — действовать | Пошаговый протокол к каждой тревоге, ежедневные советы, перепроверка показателя после действия |

## Почему это важно

- До Марса сигнал идёт **3–22 минуты** в одну сторону; раз в ~26 месяцев связи нет почти две недели.
- В 2020 году астронавта МКС с тромбом лечили по указаниям с Земли — на Марсе так не получится.
- Поэтому оценка и первые действия должны происходить **на борту**.

## Как устроен прототип

```
Simulator → Analytics → Alerts → Guidance → Onboard State ──WS──▶ экраны борта (/me, /alerts, /crew)
                                                 │
                                                 ▼
                                   Outbox + Link Simulator (задержка, обрывы, приоритеты)
                                                 │
                                                 ▼
                                           Ground State ──WS──▶ Mission Control (/ground)

SimClock — общие часы миссии (ускорение ×1…×600)        Пульт /director — сценарии ЧП
```

Реальных датчиков нет: **симулятор генерирует правдоподобные (мок) данные** для 4 астронавтов, а пульт сценариев запускает ЧП — гипоксию, рост CO₂, обрыв связи и т. д.

Подробнее — в [`docs/architecture.md`](docs/architecture.md).

## Стек

| Слой | Технология |
|---|---|
| Бэкенд | Python 3.12, FastAPI, Pydantic, numpy, PyYAML |
| Хранение | Память (кольцевые буферы) + SQLite |
| Фронтенд | React + TypeScript + Vite, Tailwind, Recharts, Zustand |
| Реалтайм | WebSocket |
| Тесты | pytest, Playwright |

## Структура репозитория

```
├── README.md
├── docs/
│   ├── architecture.md          архитектура, модули, данные, API
│   ├── hackathon-plan.md        объём, роли, таймлайн, демо, питч
│   ├── research-checklist.md    что нужно изучить команде
│   └── thresholds-and-facts.md  пороги и факты с источниками
├── config/
│   ├── thresholds.yaml          все пороги тревог
│   ├── crew.yaml                экипаж и личные нормы
│   ├── scenarios/               сценарии ЧП для пульта
│   └── protocols/               протоколы действий по тревогам
├── backend/                     (будет) FastAPI
└── frontend/                    (будет) React
```

## Статус

- [x] План, архитектура, пороги, сценарии, протоколы
- [ ] Бэкенд: симулятор → аналитика → тревоги → WebSocket
- [ ] Фронтенд: «Моё здоровье», тревоги и протоколы, экипаж, Mission Control, пульт
- [ ] Демо и питч

> ⚠️ Прототип для хакатона, не медицинское изделие. Пороги с пометкой «решение команды» — не медицинские нормы.
