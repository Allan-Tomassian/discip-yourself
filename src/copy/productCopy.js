export const SURFACE_LABELS = Object.freeze({
  today: "Today",
  planning: "Planification",
  library: "Bibliothèque",
  pilotage: "Pilotage",
  coach: "Coach",
  session: "Session",
  journal: "Journal",
  history: "Historique",
  settings: "Réglages",
  account: "Compte",
  subscription: "Abonnement",
  privacy: "Confidentialité",
  legal: "Conditions",
});

export const MAIN_PAGE_COPY = Object.freeze({
  today: Object.freeze({
    orientation: "Commence par le prochain pas utile aujourd’hui.",
    nextActionsSubtitle: "Le reste du jour, pour garder un rythme lisible.",
    dailyStateTitle: "Repères du jour",
    dailyStateSubtitle: "Prévu, fait, restant.",
  }),
  planning: Object.freeze({
    orientation: "Règle le rythme avant de charger la journée.",
    weekDescription: "Répartis les créneaux sur la semaine pour garder une cadence tenable.",
    dayDescription: "Ajuste le jour sans perdre le rythme.",
  }),
  library: Object.freeze({
    orientation: "Lis ton système par catégories stables.",
    primaryTitle: "Carte active",
    reclassifyTitle: "À reclasser",
    suggestionsTitle: "Catégories suggérées",
  }),
  pilotage: Object.freeze({
    orientation: "Relis la cohérence quand assez de signal existe.",
    summaryTitle: "Lecture d’ensemble",
    focusTitle: "Catégories suivies",
    statsTitle: "Signaux récents",
  }),
});

export const LABELS = Object.freeze({
  goal: "Objectif",
  goals: "Objectifs",
  goalLower: "objectif",
  goalsLower: "objectifs",
  action: "Action",
  actions: "Actions",
  actionLower: "action",
  actionsLower: "actions",
});

export const UI_COPY = Object.freeze({
  save: "Enregistrer",
  close: "Fermer",
  cancel: "Annuler",
  continue: "Continuer",
  done: "Fait",
  watchAd: "Regarder une vidéo",
  openPlanning: "Régler le rythme",
  refreshAnalysis: "Relire la situation",
  analyzePriority: "Observer ma situation",
  backToLocalDiagnostic: "Revenir à la lecture locale",
  openSupport: "Contacter le support",
  restorePurchases: "Restaurer mes achats",
  discoverPremium: "Découvrir Premium",
  openMailbox: "Ouvrir ma messagerie",
  resendLink: "Renvoyer le lien",
});

export const ANALYSIS_COPY = Object.freeze({
  localDiagnostic: "Lecture locale",
  coachAnalysis: "Lecture du Coach",
  coachAnalysisUpdated: "Lecture du Coach mise à jour",
  coachBadge: "Coach",
  coachLoadingHint: "Lecture en cours",
  guardedRecommendation: "Repère prioritaire",
  savedOnDevice: "Enregistrée sur cet appareil",
  syncedAcrossDevices: "Synchronisée sur tes appareils",
});

export const PLACEHOLDER_COPY = Object.freeze({
  whyText: "Décris la raison que tu veux garder en vue quand la discipline baisse.",
  accountHandle: "Choisis un identifiant public, si tu veux en afficher un.",
  fullName: "Nom complet, si tu veux le renseigner.",
  avatarUrl: "Lien direct vers une image de profil.",
  outcomeTitle: "Nom de l’objectif",
  notes: "Ajoute le contexte utile, sans te noyer dans les détails.",
});

export const STATUS_COPY = Object.freeze({
  checking: "Vérification en cours…",
  saving: "Enregistrement…",
  loading: "Chargement…",
  refreshing: "Actualisation…",
  importDone: "Import terminé.",
  importInvalid: "Import impossible : le fichier JSON est invalide.",
  importReadError: "Import impossible : le fichier n’a pas pu être lu.",
});

export const MARKETING_COPY = Object.freeze({
  essentialPlan: "Accès essentiel",
  premiumPlan: "Premium actif",
  premiumSubtitle: "Débloque toute la structure de l’app, le Coach et l’historique complet.",
  premiumLimitsPrefix: "Limites actuelles",
});
