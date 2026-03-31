import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection, GateSectionIntro } from "../shared/ui/gate/Gate";
import { UI_COPY } from "../ui/labels";

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
    <ScreenShell
      data={safeData}
      pageId="faq"
      backgroundImage={safeData?.profile?.whyImage || ""}
      headerTitle="FAQ"
      headerSubtitle="Réponses rapides aux questions fréquentes."
    >
      <section className="mainPageSection">
        <GateSectionIntro title="Questions fréquentes" subtitle="Les réponses utiles les plus courantes." />
        <GateSection collapsible={false} className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            {QUESTIONS.map((item) => (
              <div key={item.question} className="GateInlineMetaCard col gap8">
                <div className="GateRoleCardTitle">{item.question}</div>
                <div className="GateRoleHelperText">{item.answer}</div>
              </div>
            ))}
          </div>
        </GateSection>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro title="Besoin d’aide supplémentaire ?" subtitle="Ouvre le support si la réponse n’est pas ici." />
        <GateSection collapsible={false} className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="GatePrimaryCtaRow">
            <GateButton
              type="button"
              variant="ghost"
              size="sm"
              className="GatePressable"
              withSound
              onClick={() => setTab?.("support")}
            >
              {UI_COPY.openSupport}
            </GateButton>
          </div>
        </GateSection>
      </section>
    </ScreenShell>
  );
}
