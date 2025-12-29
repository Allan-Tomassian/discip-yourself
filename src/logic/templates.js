export const CATEGORY_TEMPLATES = [
  { id: "sport", label: "Sport" },
  { id: "travail", label: "Travail" },
  { id: "sante", label: "Santé" },
  { id: "finance", label: "Finance" },
  { id: "etudes", label: "Études" },
  { id: "famille", label: "Famille" },
  { id: "relations", label: "Relations" },
  { id: "creativite", label: "Créativité" },
  { id: "spiritualite", label: "Spiritualité" },
  { id: "maison", label: "Maison" },
  { id: "carriere", label: "Carrière" },
  { id: "apprentissage", label: "Apprentissage" },
  { id: "langues", label: "Langues" },
  { id: "lecture", label: "Lecture" },
  { id: "nutrition", label: "Nutrition" },
  { id: "sommeil", label: "Sommeil" },
  { id: "bien_etre", label: "Bien-être" },
  { id: "productivite", label: "Productivité" },
  { id: "entrepreneuriat", label: "Entrepreneuriat" },
  { id: "voyage", label: "Voyage" },
  { id: "organisation", label: "Organisation" },
  { id: "technologie", label: "Technologie" },
  { id: "loisirs", label: "Loisirs" },
  { id: "environnement", label: "Environnement" },
  { id: "mental", label: "Mental" },
  { id: "social", label: "Social" },
];

export const GOAL_TEMPLATES = [
  // Sport (8+)
  {
    id: "sport_courir_10k",
    label: "Courir 10 km",
    categoryKey: "sport",
    metric: { unit: "km" },
    defaultTarget: 10,
  },
  {
    id: "sport_perdre_5kg",
    label: "Perdre 5 kg",
    categoryKey: "sport",
    metric: { unit: "kg" },
    defaultTarget: 5,
  },
  {
    id: "sport_prendre_muscle",
    label: "Prendre du muscle",
    categoryKey: "sport",
  },
  {
    id: "sport_semi_marathon",
    label: "Finir un semi-marathon",
    categoryKey: "sport",
    metric: { unit: "km" },
    defaultTarget: 21,
  },
  {
    id: "sport_50_pompes",
    label: "Faire 50 pompes",
    categoryKey: "sport",
    metric: { unit: "rep" },
    defaultTarget: 50,
  },
  {
    id: "sport_souplesse",
    label: "Gagner en souplesse",
    categoryKey: "sport",
  },
  {
    id: "sport_nager_1k",
    label: "Nager 1 km",
    categoryKey: "sport",
    metric: { unit: "km" },
    defaultTarget: 1,
  },
  {
    id: "sport_10000_pas",
    label: "Marcher 10 000 pas/jour",
    categoryKey: "sport",
    metric: { unit: "pas" },
    defaultTarget: 10000,
  },

  // Travail (8+)
  {
    id: "travail_projet_cle",
    label: "Livrer un projet clé",
    categoryKey: "travail",
  },
  {
    id: "travail_productivite",
    label: "Améliorer la productivité",
    categoryKey: "travail",
  },
  {
    id: "travail_portfolio",
    label: "Construire un portfolio",
    categoryKey: "travail",
  },
  {
    id: "travail_promotion",
    label: "Obtenir une promotion",
    categoryKey: "travail",
  },
  {
    id: "travail_rapport",
    label: "Écrire un rapport complet",
    categoryKey: "travail",
  },
  {
    id: "travail_deep_work",
    label: "Structurer une routine de deep work",
    categoryKey: "travail",
  },
  {
    id: "travail_communication",
    label: "Améliorer la communication pro",
    categoryKey: "travail",
  },
  {
    id: "travail_automatisation",
    label: "Automatiser une tâche récurrente",
    categoryKey: "travail",
  },

  // Santé (8+)
  {
    id: "sante_sommeil",
    label: "Améliorer le sommeil",
    categoryKey: "sante",
  },
  {
    id: "sante_stress",
    label: "Réduire le stress",
    categoryKey: "sante",
  },
  {
    id: "sante_equilibre",
    label: "Manger équilibré",
    categoryKey: "sante",
  },
  {
    id: "sante_sucre",
    label: "Réduire le sucre",
    categoryKey: "sante",
  },
  {
    id: "sante_immunite",
    label: "Renforcer l’immunité",
    categoryKey: "sante",
  },
  {
    id: "sante_bilan",
    label: "Faire un bilan médical annuel",
    categoryKey: "sante",
  },
  {
    id: "sante_fumer",
    label: "Arrêter de fumer",
    categoryKey: "sante",
  },
  {
    id: "sante_endurance",
    label: "Améliorer l’endurance",
    categoryKey: "sante",
  },

  // Finance (8+)
  {
    id: "finance_fonds_urgence",
    label: "Constituer un fonds d’urgence",
    categoryKey: "finance",
    metric: { unit: "€" },
    defaultTarget: 3000,
  },
  {
    id: "finance_epargne_1000",
    label: "Épargner 1 000 €",
    categoryKey: "finance",
    metric: { unit: "€" },
    defaultTarget: 1000,
  },
  {
    id: "finance_dette",
    label: "Rembourser une dette",
    categoryKey: "finance",
    metric: { unit: "€" },
    defaultTarget: 2000,
  },
  {
    id: "finance_budget",
    label: "Créer un budget mensuel",
    categoryKey: "finance",
  },
  {
    id: "finance_investir",
    label: "Investir régulièrement",
    categoryKey: "finance",
  },
  {
    id: "finance_depenses",
    label: "Réduire les dépenses fixes",
    categoryKey: "finance",
  },
  {
    id: "finance_revenus",
    label: "Augmenter les revenus mensuels",
    categoryKey: "finance",
    metric: { unit: "€" },
    defaultTarget: 500,
  },
  {
    id: "finance_10pourcent",
    label: "Mettre 10% de côté",
    categoryKey: "finance",
    metric: { unit: "%" },
    defaultTarget: 10,
  },

  // Légers (général)
  {
    id: "general_lire",
    label: "Lire 12 livres",
    categoryKey: "lecture",
  },
  {
    id: "general_langue",
    label: "Apprendre une langue",
    categoryKey: "langues",
  },
  {
    id: "general_organisation",
    label: "Désencombrer la maison",
    categoryKey: "organisation",
  },
];

export const HABIT_TEMPLATES = [
  {
    id: "habit_course_30",
    label: "Sortie course 30 min",
    goalTemplateId: "sport_courir_10k",
    defaultFreq: { count: 3, unit: "WEEK", minutes: 30 },
  },
  {
    id: "habit_marche_rapide",
    label: "Marche rapide",
    goalTemplateId: "sport_perdre_5kg",
    defaultFreq: { count: 5, unit: "WEEK", minutes: 30 },
  },
  {
    id: "habit_muscu",
    label: "Séance musculation",
    goalTemplateId: "sport_prendre_muscle",
    defaultFreq: { count: 3, unit: "WEEK", minutes: 45 },
  },
  {
    id: "habit_sortie_longue",
    label: "Sortie longue",
    goalTemplateId: "sport_semi_marathon",
    defaultFreq: { count: 1, unit: "WEEK", minutes: 60 },
  },
  {
    id: "habit_pompes",
    label: "Pompes",
    goalTemplateId: "sport_50_pompes",
    defaultFreq: { count: 4, unit: "WEEK", minutes: 15 },
  },
  {
    id: "habit_etirements",
    label: "Étirements",
    goalTemplateId: "sport_souplesse",
    defaultFreq: { count: 3, unit: "WEEK", minutes: 20 },
  },
  {
    id: "habit_natation",
    label: "Natation",
    goalTemplateId: "sport_nager_1k",
    defaultFreq: { count: 2, unit: "WEEK", minutes: 45 },
  },
  {
    id: "habit_10000_pas",
    label: "Marcher 10 000 pas",
    goalTemplateId: "sport_10000_pas",
    defaultFreq: { count: 7, unit: "WEEK", minutes: 30 },
  },
  {
    id: "habit_deep_work",
    label: "Deep work 60 min",
    goalTemplateId: "travail_deep_work",
    defaultFreq: { count: 4, unit: "WEEK", minutes: 60 },
  },
  {
    id: "habit_planif",
    label: "Planifier la journée",
    goalTemplateId: "travail_productivite",
    defaultFreq: { count: 5, unit: "WEEK", minutes: 10 },
  },
  {
    id: "habit_ecriture",
    label: "Écrire 30 min",
    goalTemplateId: "travail_rapport",
    defaultFreq: { count: 3, unit: "WEEK", minutes: 30 },
  },
  {
    id: "habit_communication",
    label: "Point d’équipe",
    goalTemplateId: "travail_communication",
    defaultFreq: { count: 1, unit: "WEEK", minutes: 30 },
  },
  {
    id: "habit_sommeil",
    label: "Se coucher à heure fixe",
    goalTemplateId: "sante_sommeil",
    defaultFreq: { count: 7, unit: "WEEK", minutes: 10 },
  },
  {
    id: "habit_respiration",
    label: "Respiration 10 min",
    goalTemplateId: "sante_stress",
    defaultFreq: { count: 5, unit: "WEEK", minutes: 10 },
  },
  {
    id: "habit_equilibre",
    label: "Assiette équilibrée",
    goalTemplateId: "sante_equilibre",
    defaultFreq: { count: 7, unit: "WEEK", minutes: 20 },
  },
  {
    id: "habit_sucre",
    label: "Sans sucre ajouté",
    goalTemplateId: "sante_sucre",
    defaultFreq: { count: 5, unit: "WEEK", minutes: 5 },
  },
  {
    id: "habit_budget",
    label: "Suivre les dépenses",
    goalTemplateId: "finance_budget",
    defaultFreq: { count: 1, unit: "WEEK", minutes: 15 },
  },
  {
    id: "habit_epargne",
    label: "Virement épargne",
    goalTemplateId: "finance_epargne_1000",
    defaultFreq: { count: 1, unit: "WEEK", minutes: 5 },
  },
  {
    id: "habit_invest",
    label: "Revue investissements",
    goalTemplateId: "finance_investir",
    defaultFreq: { count: 1, unit: "MONTH", minutes: 30 },
  },
  {
    id: "habit_general_focus",
    label: "Focus 25 min",
    goalTemplateId: null,
    defaultFreq: { count: 5, unit: "WEEK", minutes: 25 },
  },
  {
    id: "habit_general_journal",
    label: "Journal 10 min",
    goalTemplateId: null,
    defaultFreq: { count: 5, unit: "WEEK", minutes: 10 },
  },
];

export function findCategoryTemplateByLabel(label) {
  const clean = (label || "").trim().toLowerCase();
  if (!clean) return null;
  return CATEGORY_TEMPLATES.find((t) => t.label.toLowerCase() === clean) || null;
}
