# Пороги и факты для системы мониторинга здоровья астронавтов

Справочник для хакатона. Каждое значение помечено:

- **[источник]** — взято из норматива или исследования (ссылка внизу);
- **[решение команды]** — разумный выбор для прототипа, не медицинский норматив. На питче так и говорите.

> ⚠️ NEWS2 — шкала для пациентов больниц на Земле, для астронавтов она не валидирована. Мы используем её как научно обоснованную отправную точку и дополняем персональной нормой каждого астронавта.

---

## 1. Пороги показателей организма (на основе NEWS2)

Баллы NEWS2 по каждому параметру [источник: Royal College of Physicians, NEWS2]:

| Параметр | 3 балла | 2 балла | 1 балл | **0 (норма)** | 1 балл | 2 балла | 3 балла |
|---|---|---|---|---|---|---|---|
| Частота дыхания, /мин | ≤ 8 | — | 9–11 | **12–20** | — | 21–24 | ≥ 25 |
| SpO₂, % (шкала 1) | ≤ 91 | 92–93 | 94–95 | **≥ 96** | — | — | — |
| Систолическое давление, мм рт. ст. | ≤ 90 | 91–100 | 101–110 | **111–219** | — | — | ≥ 220 |
| Пульс, уд/мин | ≤ 40 | — | 41–50 * | **51–90** | 91–110 | 111–130 | ≥ 131 |
| Температура, °C | ≤ 35.0 | — | 35.1–36.0 | **36.1–38.0** | 38.1–39.0 | ≥ 39.1 | — |
| Сознание (AVPU) | не «Alert» | — | — | **Alert** | — | — | — |

\* По официальной карте RCP диапазон 41–50 даёт 1 балл, но в части вторичных источников указано 2. Перед питчем сверьте с оригинальной картой RCP.

### Как переводим в тревоги

| Условие | Уровень | Основание |
|---|---|---|
| Сумма NEWS2 = 0 | 🟢 Норма | [источник] |
| Сумма 1–4 | 🔵 INFO | [источник] низкий риск |
| Один параметр на 3 балла **или** сумма 5–6 | 🟡 WARNING | [источник] срочная оценка |
| Сумма ≥ 7 | 🔴 CRITICAL | [источник] экстренная реакция |
| SpO₂ ≤ 88 % дольше 30 с | 🔴 CRITICAL | [решение команды] отдельное правило для гипоксии |
| Значение держится ≥ 30 с (SpO₂, пульс) или ≥ 2 мин (остальное) | — | [решение команды] против ложных тревог |
| Гистерезис: тревога снимается, когда значение вернулось в норму + запас 2 % | — | [решение команды] |

### Персональная норма

| Правило | Уровень | Основание |
|---|---|---|
| Базовая линия = среднее и стандартное отклонение за первые 3–7 дней | — | [решение команды] |
| \|z\| > 2 дольше 10 мин | 🔵 INFO | [решение команды] |
| \|z\| > 3 дольше 5 мин | 🟡 WARNING | [решение команды] |
| Пульс в покое вырос на ≥ 10 уд/мин относительно базовой линии за 3+ дня | 🟡 WARNING (тренд) | [решение команды] |

---

## 2. Пороги среды на борту

| Параметр | Норма | WARNING | CRITICAL | Основание |
|---|---|---|---|---|
| **CO₂ (ppCO₂)** | среднее за 7 дней < 2.5 мм рт. ст. | среднее за 1 час > 3 мм рт. ст. (≈ 0.39 %) | ≥ 6 мм рт. ст. или быстрый рост | Норма и WARNING [источник: NASA-STD-3001 V2 6004, NASA OCHMO]; CRITICAL [решение команды] |
| **O₂** | ≈ 21 % при давлении на уровне моря | < 19.5 % | < 17 % | 21 % [источник]; 19.5 % — земной промышленный порог дефицита O₂ (OSHA); 17 % [решение команды]. Точные пределы ppO₂ — таблица 6.2-1 в NASA-STD-3001 Vol. 2 |
| **Давление в кабине** | ≈ 101.3 кПа (14.7 psi) | падение > 2 кПа от номинала | падение > 0.5 кПа/мин (утечка) | Номинал [источник]; пороги [решение команды] |
| **Температура кабины** | 18–27 °C | вне диапазона | вне 15–30 °C | [решение команды], сверьте с NASA-STD-3001 Vol. 2 |

---

## 3. Радиация

| Параметр | Значение | Основание |
|---|---|---|
| Карьерный лимит NASA | **< 600 мЗв** (одинаковый для всех возрастов и полов, с 2022 г.) | [источник] |
| Фон на Земле | ~2–3 мЗв в год | [источник] |
| МКС | ~100 мЗв за 6 месяцев (≈ 0.5 мЗв/сутки) | [источник, вторичный] |
| Перелёт к Марсу (Curiosity RAD) | ~1.8 мЗв/сутки | [источник] |
| Поверхность Марса | ~0.67 мЗв/сутки | [источник] |
| Полная миссия на Марс (180 + 500 + 180 сут.) | ≈ 1 Зв | [источник] |
| WARNING: израсходовано 50 % карьерного лимита | | [решение команды] |
| CRITICAL: 80 % лимита, или суточная доза > 5× средней (солнечная вспышка) | | [решение команды] |

---

## 4. Сон и психология

| Параметр | Порог | Основание |
|---|---|---|
| Плановый сон NASA | 8.5 ч | [источник] |
| Фактический сон на МКС | ~6.1 ч в среднем | [источник] |
| WARNING: < 6 ч три ночи подряд | | [решение команды] |
| WARNING: опросник — стресс или усталость ≥ 7/10 два дня подряд | | [решение команды] |

---

## 5. Задержка связи (для link-simulator)

| Направление | Задержка в одну сторону | Основание |
|---|---|---|
| МКС | практически 0 | [источник] |
| Луна | ~1.3 с | [общеизвестное] |
| Марс | ~3–22 мин в зависимости от взаимного положения | [источник] |
| Соединение Марса с Солнцем | раз в ~26 месяцев, около 2 недель без нормальной связи | [источник] |

---

## 6. Факты для питча

| Факт | Источник |
|---|---|
| Земля узнает о проблеме у астронавта на Марсе через **до 22 минут**, а ответ придёт ещё через 22. | NASA, NTRS |
| Миссия на Марс даёт **≈ 1 Зв** радиации — больше карьерного лимита NASA в 600 мЗв. | Curiosity RAD, NASA |
| Астронавт теряет **~1–1.5 % костной массы в месяц** (по разным исследованиям 0.4–2 %), и восстанавливается она не полностью. | NASA NTRS, CSA, исследование 2022 г. |
| Объём икроножных мышц за ~6 месяцев на МКС уменьшается в среднем на **~13 %**. | Trappe et al., 2009 |
| Около **70 %** астронавтов в длительных полётах имеют признаки SANS (изменения зрения). | NASA, Macias et al. 2020 |
| Астронавты спят **~6 часов** при плановых 8.5; **75 %** принимали снотворное на МКС. | Lancet Neurology, 2014 |
| Допустимый CO₂ на МКС (3 мм рт. ст.) примерно **в 10 раз выше**, чем на Земле (~0.3 мм рт. ст. при ~420 ppm). | NASA-STD-3001 + расчёт |
| В 2020 году у астронавта МКС нашли **тромб в яремной вене**; лечили по указаниям врачей с Земли, препараты пришлось экономить до прибытия грузового корабля. | NEJM, 2020 |
| NASA Twins Study: за 340 суток у Скотта Келли изменилась экспрессия >1000 генов, утолщилась сонная артерия, снизились когнитивные показатели; >90 % изменений вернулись к норме. | Science, 2019 |
| NASA выделяет **5 главных угроз (RIDGE)**: радиация, изоляция, удалённость от Земли, гравитация, замкнутая среда. Наша система закрывает все пять. | NASA HRP |
| На МКС уже испытана «умная футболка» **Astroskin / Bio-Monitor**: ЭКГ, дыхание, SpO₂, давление, температура кожи, активность, сон. Наш проект — следующий шаг: автономная аналитика на борту. | CSA / Hexoskin |

---

## 7. Конфиг для бэкенда (thresholds.yaml)

```yaml
# Пороги для прототипа. Значения NEWS2 — по RCP; остальное помечено как решение команды.
vitals:
  spo2:        { normal_min: 96, info_min: 94, warning_min: 92, critical_max: 88, sustain_s: 30 }
               # ≤91 → 3 балла NEWS2 (warning); ≤88 дольше 30 с → critical [решение команды]
  heart_rate:  { normal: [51, 90], info: [[41, 50], [91, 110]], warning: [111, 130],
                 critical_low: 40, critical_high: 131, sustain_s: 30 }
  resp_rate:   { normal: [12, 20], info: [9, 11], warning: [21, 24],
                 critical_low: 8, critical_high: 25, sustain_s: 120 }
  systolic_bp: { normal: [111, 219], info: [101, 110], warning: [91, 100],
                 critical_low: 90, critical_high: 220, sustain_s: 120 }
  temperature: { normal: [36.1, 38.0], info: [[35.1, 36.0], [38.1, 39.0]],
                 warning_high: 39.1, critical_low: 35.0, sustain_s: 120 }

news2_levels: { info: 1, warning: 5, critical: 7, single_param_3_is: warning }

baseline:
  learning_days: 3
  z_info: 2.0
  z_warning: 3.0
  resting_hr_trend_bpm: 10

environment:
  co2_mmhg:       { avg_1h_warning: 3.0, avg_7d_target: 2.5, critical: 6.0 }   # critical — решение команды
  o2_percent:     { warning_below: 19.5, critical_below: 17.0 }
  cabin_kpa:      { nominal: 101.3, warning_drop: 2.0, critical_rate_per_min: 0.5 }

radiation:
  career_limit_msv: 600
  warning_fraction: 0.5
  critical_fraction: 0.8
  spike_multiplier: 5
  daily_rate_msv: { iss: 0.5, mars_transit: 1.8, mars_surface: 0.67 }

sleep:
  warning_hours: 6
  warning_nights_in_row: 3

link_delay_s: { iss: 0, moon: 1.3, mars_min: 180, mars_max: 1320 }
```

---

## Источники

- NASA OCHMO, CO₂ technical brief — https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf
- NASA OCHMO, ECLSS technical brief — https://www.nasa.gov/wp-content/uploads/2023/07/eclss-technical-brief-ochmo.pdf
- Aerospace Medicine and Human Performance, комментарий о CO₂ (2025) — https://asma.kglmeridian.com/view/journals/amhp/96/11/article-p1024.xml
- NASA OCHMO, Radiation protection technical brief — https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf
- National Academies о радиационном лимите — https://www.nationalacademies.org/news/nasa-should-update-astronaut-radiation-exposure-limits-improve-communication-of-cancer-risks
- Universe Today, 600 мЗв и земной фон — https://universetoday.com/151822/report-suggests-that-astronauts-shouldnt-get-more-than-600-millisieverts-of-radiation-exposure-during-their-career-we-get-2-3-a-year-down-here-on-earth/amp
- SwRI, Curiosity RAD и доза миссии на Марс — https://www.swri.org/press-release/swri-led-team-calculates-radiation-exposure-associated-trip-mars
- Universe Today, доза на МКС — https://universetoday.com/107093/how-much-radiation-would-you-get-during-a-mars-mission/amp
- NASA NTRS, потеря костной массы — https://ntrs.nasa.gov/citations/20170004598
- Canadian Space Agency, кости в космосе — https://www.asc-csa.gc.ca/eng/astronauts/space-medicine/bones.asp
- UCSF, потеря костей на МКС — https://www.ucsf.edu/news/2004/03/97565/ucsfbaylor-team-uses-new-method-measure-bone-loss-astronauts-flying-long
- Live Science, неполное восстановление костей (2022) — https://livescience.com/astronauts-bone-loss-space
- Scientific American, мышцы (Trappe 2009) — https://www.scientificamerican.com/blog/news-blog/spaceflight-wreaks-havoc-on-astrona-2009-04-08/
- NASA, SANS — https://ntrs.nasa.gov/api/citations/20230006218/downloads/Brunstetter%20-%20Crewmember%20SANS%20Overview%20-%20Export%20Control%20-FINAL%20-%2001May23.pdf
- NASA NTRS, SANS (2022) — https://ntrs.nasa.gov/citations/20220014606
- Сон астронавтов (Lancet Neurology 2014) — https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436 и https://www.livescience.com/47249-astronauts-sleep-deprivation.html
- NASA NTRS, задержки связи для Марса — https://ntrs.nasa.gov/api/citations/20220013418/downloads/ASCEND-Communication%20Delays%2C%20Disruptions%2C%20and%20Blackouts%20for%20Crewed%20Mars%20Missions.pdf
- New Atlas, соединение Марса с Солнцем — https://newatlas.com/space/nasa-mars-missions-pause-solar-conjunction
- Тромб на МКС (NEJM 2020) — https://www.beckershospitalreview.com/quality/first-case-of-blood-clot-in-space-treated-from-earth.html и https://phys.org/news/2020-01-occurrence-treatment-spaceflight-medical-miles.pdf
- NASA Twins Study — https://www.statnews.com/2019/04/11/nasa-twins-study-scott-kelly-space-travel/
- NASA HRP, 5 угроз — https://www.nasa.gov/hrp/hazards
- NEWS2 — https://www.nwas.nhs.uk/publications/news2-national-early-warning-score и https://pmc.ncbi.nlm.nih.gov/articles/PMC4890514/table/Tab1
- Astroskin / Bio-Monitor — https://ntrs.nasa.gov/api/citations/20190000238/downloads/20190000238.pdf и https://www.pressreader.com/canada/toronto-star/20190201/281887299542745
- Атмосфера МКС — https://newspaceeconomy.ca/2025/01/22/the-atmospheric-environment-of-the-international-space-station-iss/
