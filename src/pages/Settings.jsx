import React from "react";
import ScreenShell from "./_ScreenShell";
import ThemePicker from "../components/ThemePicker";
import { Button, Card } from "../components/UI";
import { clearState } from "../utils/storage";
import { initialData } from "../logic/state";
import { uid } from "../utils/helpers";

export default function Settings({ data, setData }) {
  function addCategory() {
    const name = prompt("Nom :", "Nouvelle");
    if (!name) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    const color = prompt("Couleur HEX :", "#FFFFFF") || "#FFFFFF";
    const cleanColor = color.trim();
    const id = uid();

    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const nextCategories = [...prevCategories, { id, name: cleanName, color: cleanColor, wallpaper: "" }];
      const prevUi = prev.ui || {};
      const nextSelected = prevCategories.length === 0 ? id : prevUi.selectedCategoryId || id;
      return { ...prev, categories: nextCategories, ui: { ...prevUi, selectedCategoryId: nextSelected } };
    });
  }

  if (!data.categories || data.categories.length === 0) {
    return (
      <ScreenShell
        data={data}
        pageId="settings"
        headerTitle="Réglages"
        headerSubtitle="Aucune catégorie"
        backgroundImage={data?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
            <div className="mt12">
              <Button onClick={addCategory}>+ Ajouter une catégorie</Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const selected = data.categories.find((c) => c.id === data.ui.selectedCategoryId) || data.categories[0];

  return (
    <ScreenShell
      data={data}
      pageId="settings"
      headerTitle="Réglages"
      headerSubtitle="Thème Accueil + reset"
      backgroundImage={selected.wallpaper || data.profile.whyImage || ""}
    >
      <div className="col">
        <ThemePicker data={data} setData={setData} />

        <Card accentBorder style={{ marginTop: 14 }}>
          <div className="p18 row">
            <div>
              <div style={{ fontWeight: 900 }}>Réinitialiser</div>
              <div className="small2">Efface tout (localStorage).</div>
            </div>
            <Button
              variant="danger"
              onClick={() => {
                clearState();
                setData(initialData());
              }}
            >
              Reset
            </Button>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
