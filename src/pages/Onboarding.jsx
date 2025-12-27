import React, { useState } from "react";
import { Button, Card, Input, Textarea, Badge } from "../components/UI";
import { readFileAsDataUrl } from "../utils/helpers";
import ScreenShell from "./_ScreenShell";

export default function Onboarding({ data, setData, onDone }) {
  const [name, setName] = useState(data.profile.name || "Allan");
  const [why, setWhy] = useState(
    data.profile.whyText ||
      "Je deviens discipliné pour atteindre mes objectifs et construire une sécurité financière solide."
  );
  const [img, setImg] = useState(data.profile.whyImage || "");
  const [error, setError] = useState("");
  const minChars = 24;

  return (
    <ScreenShell
      data={data}
      pageId="onboarding"
      headerTitle="Ton Pourquoi"
      headerSubtitle="Inscription (obligatoire)"
      backgroundImage={img || ""}
    >
      <Card accentBorder>
        <div className="p18">
          <div className="row">
            <div>
              <div className="titleSm">Phrase d’engagement</div>
              <div className="small">Pas de discipline sans sens. Tu dois l’écrire.</div>
            </div>
            <Badge>V2</Badge>
          </div>

          <div className="mt14 col">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" />
            <Textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Écris ton pourquoi" />

            <div className="listItem">
              <div className="row">
                <div>
                  <div className="titleSm">Image du pourquoi (optionnelle)</div>
                  <div className="small">Une image qui te rappelle ce que tu veux vraiment.</div>
                </div>
                <Badge>{img ? "Ajoutée" : "—"}</Badge>
              </div>

              <div className="mt12" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label className="btn btnGhost" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  Importer
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setImg(await readFileAsDataUrl(f));
                    }}
                  />
                </label>
                <Button variant="ghost" onClick={() => setImg("")}>Retirer</Button>
              </div>
            </div>

            {error ? <div style={{ color: "rgba(255,120,120,.95)", fontSize: 13 }}>{error}</div> : null}

            <Button
              onClick={() => {
                const cleanWhy = (why || "").trim();
                if (cleanWhy.length < minChars) {
                  setError(`Ton pourquoi doit faire au moins ${minChars} caractères.`);
                  return;
                }
                setError("");

                setData((prev) => ({
                  ...prev,
                  profile: {
                    ...prev.profile,
                    name: (name || "").trim() || prev.profile.name || "",
                    whyText: cleanWhy,
                    whyImage: img || prev.profile.whyImage || "",
                  },
                }));
                onDone();
              }}
            >
              Continuer
            </Button>

            <div className="small2">Stocké localement (localStorage).</div>
          </div>
        </div>
      </Card>
    </ScreenShell>
  );
}