import React from "react";
import { UI_COPY } from "../ui/labels";
import { AppCard, AppScreen, GhostButton, SectionHeader } from "../shared/ui/app";

const QUESTIONS = [
  {
    question: "Comment démarrer rapidement ?",
    answer: "Passe par l’onboarding IA, puis ouvre Today pour lancer ta priorité du moment.",
  },
  {
    question: "Où retrouver mes actions ?",
    answer: "Bibliothèque reste la source de vérité de tes actions et catégories.",
  },
  {
    question: "Pourquoi Today est plus simple ?",
    answer: "Today sert uniquement à exécuter. Le calendrier détaillé reste dans Planification.",
  },
  {
    question: "Comment réorganiser une session ?",
    answer: "Ouvre la session puis utilise Reporter pour la déplacer ou l’envoyer dans Planification.",
  },
  {
    question: "Comment réinitialiser mon mot de passe ?",
    answer: "Depuis l’écran de connexion, utilise “Mot de passe oublié”.",
  },
  {
    question: "Où voir mon historique ?",
    answer: "Le menu latéral ouvre une page Historique dédiée aux sessions déjà terminées.",
  },
];

export default function Faq({ data, setTab }) {
  const safeData = data && typeof data === "object" ? data : {};

  return (
    <AppScreen
      data={safeData}
      pageId="faq"
      backgroundImage={safeData?.profile?.whyImage || ""}
      headerTitle="FAQ"
      headerSubtitle="Réponses rapides aux questions fréquentes."
    >
      <section className="mainPageSection">
        <SectionHeader title="Questions fréquentes" subtitle="Les réponses utiles les plus courantes." />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            {QUESTIONS.map((item) => (
              <div key={item.question} className="GateInlineMetaCard col gap8">
                <div className="GateRoleCardTitle">{item.question}</div>
                <div className="GateRoleHelperText">{item.answer}</div>
              </div>
            ))}
          </div>
        </AppCard>
      </section>

      <section className="mainPageSection">
        <SectionHeader title="Besoin d’aide supplémentaire ?" subtitle="Ouvre le support si la réponse n’est pas ici." />
        <AppCard className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="GatePrimaryCtaRow">
            <GhostButton
              type="button"
              size="sm"
              withSound
              onClick={() => setTab?.("support")}
            >
              {UI_COPY.openSupport}
            </GhostButton>
          </div>
        </AppCard>
      </section>
    </AppScreen>
  );
}
