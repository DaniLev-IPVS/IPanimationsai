/**
 * The studio's interface text in the four languages the team reads. Client
 * text (briefs, ideas, scripts) is not here: that comes from Notion in English
 * and is translated on request by lib/studio/translate.ts.
 */

export const LANGS = { en: "English", fr: "Français", es: "Español", ru: "Русский" } as const;
export type Lang = keyof typeof LANGS;
export const LANG_COOKIE = "st_lang";

export const langOf = (value: string | undefined | null): Lang =>
  value && value in LANGS ? (value as Lang) : "en";

/** How the language is called inside a sentence written in English. */
export const LANG_NAME: Record<Lang, string> = { en: "English", fr: "French", es: "Spanish", ru: "Russian" };
export const LOCALE: Record<Lang, string> = { en: "en-US", fr: "fr-FR", es: "es-ES", ru: "ru-RU" };

const en = {
  navSpend: "Spend",
  navProjects: "Projects",
  navClients: "Potential clients",
  navSettings: "Settings",
  signOut: "Sign out",
  admin: "Admin",
  producer: "Producer",

  translate: "Translate",
  translating: "Translating…",
  translationFailed: "Some of this page couldn't be translated just now, so it is shown in English. Try again in a minute.",

  title: "Potential clients",
  introAdmin: "Every project set to Team check / Estimate in Notion, whoever it's assigned to.",
  introTeam: "Client requests Daniel sent you. Open one to see who the client is, what they want and the ideas, then estimate each idea.",
  saved: "Estimate saved for {name}.",
  sent: "Every idea for {name} has an estimate. It's back with Daniel.",
  problem: "Couldn't read the proposal board from Notion.",
  tellDaniel: "Tell Daniel.",
  empty: "No client requests are waiting for an estimate.",

  forPeople: "For {names}",
  notAssigned: "Not assigned to anyone",
  estimatedOf: "{done} of {total} estimated",
  noIdeasYet: "No ideas yet",
  openInNotion: "Open in Notion",

  who: "Who the client is",
  wants: "What the client wants",
  notWritten: "Not written yet.",
  needs: "What they need",
  why: "Why they need it",
  usedFor: "What it's for",
  budget: "Their budget",
  quoted: "Quoted so far",
  notes: "Notes from Daniel",

  ideas: "Ideas to pitch",
  ideasHint: "Open each idea, give a cost range and the working days, and submit. When every idea has an estimate it goes back to Daniel by itself.",
  noIdeas: "No ideas on this project yet. Add yours below.",
  seconds: "{n} sec",
  needsEstimate: "Needs your estimate",
  noSummary: "No summary has been written for this idea yet.",
  fullScript: "Full script",
  costFrom: "Cost to make it, from (USD)",
  costTo: "To (USD)",
  days: "Working days to make it",
  eg: "e.g. {n}",
  rangeTo: "{low} to {high}",
  submit: "Submit estimate",
  update: "Update estimate",
  saving: "Saving…",

  addOwn: "Add an idea of your own",
  shortName: "Short name",
  shortNameHint: "Mascot opens the shop",
  whatHappens: "What happens in the video",
  whatHappensHint: "What we see, the style, and how we would make it.",
  lengthSeconds: "Length in seconds",
  addIdea: "Add idea",
  adding: "Adding…",

  estimated: "Estimated",
  colRequest: "Client request",
  colSent: "Sent",
  colBy: "By",
  colEstimates: "Estimates",
};

export type Dict = typeof en;

const fr: Dict = {
  navSpend: "Dépenses",
  navProjects: "Projets",
  navClients: "Clients potentiels",
  navSettings: "Réglages",
  signOut: "Se déconnecter",
  admin: "Admin",
  producer: "Producteur",

  translate: "Traduire",
  translating: "Traduction…",
  translationFailed: "Une partie de cette page n'a pas pu être traduite pour l'instant ; elle est affichée en anglais. Réessayez dans une minute.",

  title: "Clients potentiels",
  introAdmin: "Tous les projets passés en « Team check / Estimate » dans Notion, quelle que soit la personne assignée.",
  introTeam: "Les demandes de clients que Daniel vous a envoyées. Ouvrez-en une pour voir qui est le client, ce qu'il veut et les idées, puis estimez chaque idée.",
  saved: "Estimation enregistrée pour {name}.",
  sent: "Toutes les idées de {name} ont une estimation. Le projet est reparti chez Daniel.",
  problem: "Impossible de lire le tableau des propositions dans Notion.",
  tellDaniel: "Prévenez Daniel.",
  empty: "Aucune demande de client n'attend d'estimation.",

  forPeople: "Pour {names}",
  notAssigned: "Assigné à personne",
  estimatedOf: "{done} sur {total} estimées",
  noIdeasYet: "Pas encore d'idées",
  openInNotion: "Ouvrir dans Notion",

  who: "Qui est le client",
  wants: "Ce que veut le client",
  notWritten: "Pas encore rédigé.",
  needs: "Ce dont il a besoin",
  why: "Pourquoi il en a besoin",
  usedFor: "À quoi ça sert",
  budget: "Son budget",
  quoted: "Prix annoncé jusqu'ici",
  notes: "Notes de Daniel",

  ideas: "Idées à proposer",
  ideasHint: "Ouvrez chaque idée, donnez une fourchette de coût et le nombre de jours de travail, puis envoyez. Quand chaque idée a son estimation, le projet repart tout seul chez Daniel.",
  noIdeas: "Pas encore d'idées sur ce projet. Ajoutez la vôtre ci-dessous.",
  seconds: "{n} s",
  needsEstimate: "À estimer",
  noSummary: "Aucun résumé n'a encore été écrit pour cette idée.",
  fullScript: "Script complet",
  costFrom: "Coût de fabrication, de (USD)",
  costTo: "À (USD)",
  days: "Jours de travail nécessaires",
  eg: "p. ex. {n}",
  rangeTo: "{low} à {high}",
  submit: "Envoyer l'estimation",
  update: "Mettre à jour l'estimation",
  saving: "Enregistrement…",

  addOwn: "Ajouter votre propre idée",
  shortName: "Nom court",
  shortNameHint: "La mascotte ouvre la boutique",
  whatHappens: "Ce qui se passe dans la vidéo",
  whatHappensHint: "Ce qu'on voit, le style, et comment on la fabriquerait.",
  lengthSeconds: "Durée en secondes",
  addIdea: "Ajouter l'idée",
  adding: "Ajout…",

  estimated: "Estimés",
  colRequest: "Demande du client",
  colSent: "Envoyé",
  colBy: "Par",
  colEstimates: "Estimations",
};

const es: Dict = {
  navSpend: "Gasto",
  navProjects: "Proyectos",
  navClients: "Clientes potenciales",
  navSettings: "Ajustes",
  signOut: "Cerrar sesión",
  admin: "Admin",
  producer: "Productor",

  translate: "Traducir",
  translating: "Traduciendo…",
  translationFailed: "Parte de esta página no se pudo traducir ahora mismo y se muestra en inglés. Inténtalo de nuevo en un minuto.",

  title: "Clientes potenciales",
  introAdmin: "Todos los proyectos puestos en «Team check / Estimate» en Notion, sea quien sea la persona asignada.",
  introTeam: "Las solicitudes de clientes que Daniel te envió. Abre una para ver quién es el cliente, qué quiere y las ideas, y luego estima cada idea.",
  saved: "Estimación guardada para {name}.",
  sent: "Todas las ideas de {name} tienen estimación. El proyecto volvió a Daniel.",
  problem: "No se pudo leer el tablero de propuestas en Notion.",
  tellDaniel: "Avisa a Daniel.",
  empty: "No hay solicitudes de clientes esperando una estimación.",

  forPeople: "Para {names}",
  notAssigned: "Sin asignar",
  estimatedOf: "{done} de {total} estimadas",
  noIdeasYet: "Aún sin ideas",
  openInNotion: "Abrir en Notion",

  who: "Quién es el cliente",
  wants: "Qué quiere el cliente",
  notWritten: "Aún no está escrito.",
  needs: "Qué necesita",
  why: "Por qué lo necesita",
  usedFor: "Para qué es",
  budget: "Su presupuesto",
  quoted: "Precio dado hasta ahora",
  notes: "Notas de Daniel",

  ideas: "Ideas para proponer",
  ideasHint: "Abre cada idea, da un rango de costo y los días de trabajo, y envía. Cuando todas las ideas tengan estimación, el proyecto vuelve solo a Daniel.",
  noIdeas: "Este proyecto aún no tiene ideas. Añade la tuya abajo.",
  seconds: "{n} s",
  needsEstimate: "Falta tu estimación",
  noSummary: "Todavía no se ha escrito un resumen para esta idea.",
  fullScript: "Guion completo",
  costFrom: "Costo de producción, desde (USD)",
  costTo: "Hasta (USD)",
  days: "Días de trabajo para hacerlo",
  eg: "p. ej. {n}",
  rangeTo: "{low} a {high}",
  submit: "Enviar estimación",
  update: "Actualizar estimación",
  saving: "Guardando…",

  addOwn: "Añadir una idea propia",
  shortName: "Nombre corto",
  shortNameHint: "La mascota abre la tienda",
  whatHappens: "Qué pasa en el video",
  whatHappensHint: "Qué se ve, el estilo y cómo lo haríamos.",
  lengthSeconds: "Duración en segundos",
  addIdea: "Añadir idea",
  adding: "Añadiendo…",

  estimated: "Estimados",
  colRequest: "Solicitud del cliente",
  colSent: "Enviado",
  colBy: "Por",
  colEstimates: "Estimaciones",
};

const ru: Dict = {
  navSpend: "Расходы",
  navProjects: "Проекты",
  navClients: "Потенциальные клиенты",
  navSettings: "Настройки",
  signOut: "Выйти",
  admin: "Админ",
  producer: "Продюсер",

  translate: "Перевести",
  translating: "Переводим…",
  translationFailed: "Часть страницы сейчас не удалось перевести, поэтому она показана на английском. Попробуйте ещё раз через минуту.",

  title: "Потенциальные клиенты",
  introAdmin: "Все проекты со статусом «Team check / Estimate» в Notion, кому бы они ни были назначены.",
  introTeam: "Запросы клиентов, которые прислал вам Даниэль. Откройте запрос, чтобы увидеть, кто клиент, чего он хочет и какие есть идеи, а затем оцените каждую идею.",
  saved: "Оценка сохранена: {name}.",
  sent: "У всех идей проекта «{name}» есть оценка. Проект вернулся к Даниэлю.",
  problem: "Не удалось прочитать доску предложений в Notion.",
  tellDaniel: "Сообщите Даниэлю.",
  empty: "Нет запросов клиентов, ожидающих оценки.",

  forPeople: "Для: {names}",
  notAssigned: "Никому не назначено",
  estimatedOf: "Оценено {done} из {total}",
  noIdeasYet: "Идей пока нет",
  openInNotion: "Открыть в Notion",

  who: "Кто клиент",
  wants: "Чего хочет клиент",
  notWritten: "Пока не написано.",
  needs: "Что ему нужно",
  why: "Зачем ему это нужно",
  usedFor: "Для чего это",
  budget: "Его бюджет",
  quoted: "Названная цена",
  notes: "Заметки Даниэля",

  ideas: "Идеи для предложения",
  ideasHint: "Откройте каждую идею, укажите диапазон стоимости и количество рабочих дней и отправьте. Когда у всех идей будет оценка, проект сам вернётся к Даниэлю.",
  noIdeas: "В этом проекте пока нет идей. Добавьте свою ниже.",
  seconds: "{n} сек",
  needsEstimate: "Нужна ваша оценка",
  noSummary: "Для этой идеи пока нет краткого описания.",
  fullScript: "Полный сценарий",
  costFrom: "Стоимость производства, от (USD)",
  costTo: "До (USD)",
  days: "Рабочих дней на производство",
  eg: "напр. {n}",
  rangeTo: "{low} – {high}",
  submit: "Отправить оценку",
  update: "Обновить оценку",
  saving: "Сохраняем…",

  addOwn: "Добавить свою идею",
  shortName: "Короткое название",
  shortNameHint: "Маскот открывает магазин",
  whatHappens: "Что происходит в видео",
  whatHappensHint: "Что мы видим, стиль и как бы мы это сделали.",
  lengthSeconds: "Длина в секундах",
  addIdea: "Добавить идею",
  adding: "Добавляем…",

  estimated: "Оценённые",
  colRequest: "Запрос клиента",
  colSent: "Отправлено",
  colBy: "Кем",
  colEstimates: "Оценки",
};

export const DICT: Record<Lang, Dict> = { en, fr, es, ru };

/** Fills {placeholders} in a dictionary line. */
export const fill = (line: string, values: Record<string, string | number>) =>
  line.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

/** "3 days", "3 jours", "3 días", "3 дня". */
export function daysLabel(lang: Lang, n: number): string {
  const whole = Number.isInteger(n);
  if (lang === "ru") {
    const d10 = n % 10;
    const d100 = n % 100;
    const word = !whole ? "дня" : d10 === 1 && d100 !== 11 ? "день" : d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14) ? "дня" : "дней";
    return `${n} ${word}`;
  }
  if (lang === "fr") return `${n} ${n < 2 ? "jour" : "jours"}`;
  if (lang === "es") return `${n} ${n === 1 ? "día" : "días"}`;
  return `${n} ${n === 1 ? "day" : "days"}`;
}
