import React from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";

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
    answer: "Today sert uniquement à exécuter. Le calendrier détaillé reste dans Planning.",
  },
  {
    question: "Comment réorganiser une session ?",
    answer: "Ouvre la session puis utilise Reporter pour la déplacer ou l’envoyer dans Planning.",
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
    <ScreenShell data={safeData} pageId="faq" backgroundImage={safeData?.profile?.whyImage || ""}>
      <GatePage
        title={<span className="GatePageTitle">FAQ</span>}
        subtitle={<span className="GatePageSubtitle">Réponses rapides aux questions fréquentes.</span>}
      >
        {QUESTIONS.map((item) => (
          <GateSection
            key={item.question}
            title={item.question}
            collapsible={false}
            className="GateSurfacePremium GateCardPremium"
          >
            <div className="small">{item.answer}</div>
          </GateSection>
        ))}
        <GateSection
          title="Besoin d’aide supplémentaire ?"
          collapsible={false}
          className="GateSurfacePremium GateCardPremium"
        >
          <div className="GatePrimaryCtaRow">
            <GateButton
              type="button"
              variant="ghost"
              className="GatePressable"
              withSound
              onClick={() => setTab?.("support")}
            >
              Contacter le support
            </GateButton>
          </div>
        </GateSection>
      </GatePage>
    </ScreenShell>
  );
}
