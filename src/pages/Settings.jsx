import React, { useState } from "react";
import ScreenShell from "./_ScreenShell";
import ThemePicker from "../components/ThemePicker";
import { Button, Card, Input, Select } from "../components/UI";
import { clearState } from "../utils/storage";
import { initialData } from "../logic/state";
import { uid } from "../utils/helpers";
import { requestReminderPermission } from "../logic/reminders";
import { safePrompt } from "../utils/dialogs";

export default function Settings({ data, setData }) {
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  function addCategory() {
    const name = safePrompt("Nom :", "Nouvelle");
    if (!name) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    const color = safePrompt("Couleur HEX :", "#FFFFFF") || "#FFFFFF";
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
  const reminders = Array.isArray(data.reminders) ? data.reminders : [];
  const goals = Array.isArray(data.goals) ? data.goals : [];
  const habits = Array.isArray(data.habits) ? data.habits : [];

  const DAYS = [
    { id: 1, label: "L" },
    { id: 2, label: "M" },
    { id: 3, label: "M" },
    { id: 4, label: "J" },
    { id: 5, label: "V" },
    { id: 6, label: "S" },
    { id: 7, label: "D" },
  ];

  function addReminder() {
    const id = uid();
    const next = {
      id,
      label: "Rappel",
      time: "09:00",
      enabled: true,
      goalId: "",
      days: [1, 2, 3, 4, 5, 6, 7],
      channel: "IN_APP",
    };
    setData((prev) => ({ ...prev, reminders: [...(prev.reminders || []), next] }));
  }

  function updateReminder(id, updates) {
    setData((prev) => ({
      ...prev,
      reminders: (prev.reminders || []).map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  }

  function removeReminder(id) {
    setData((prev) => ({ ...prev, reminders: (prev.reminders || []).filter((r) => r.id !== id) }));
  }

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
          <div className="p18">
            <div className="row">
              <div>
                <div style={{ fontWeight: 900 }}>Rappels</div>
                <div className="small2">In-app + notification navigateur (si autorisée).</div>
              </div>
              <Button variant="ghost" onClick={addReminder}>
                + Ajouter
              </Button>
            </div>

            <div className="mt12 col">
              {reminders.length ? (
                reminders.map((r) => {
                  const goal = goals.find((g) => g.id === r.goalId);
                  const habit = !goal ? habits.find((h) => h.id === r.goalId) : null;
                  const target = goal || habit;
                  const cat = data.categories.find((c) => c.id === target?.categoryId);
                  const days = Array.isArray(r.days) ? r.days : [];
                  return (
                    <div key={r.id} className="listItem focusHalo" style={{ "--catColor": cat?.color || "#7C3AED" }}>
                      <Input
                        value={r.label || ""}
                        onChange={(e) => updateReminder(r.id, { label: e.target.value })}
                        placeholder="Label"
                      />
                      <div className="grid2">
                        <Input
                          type="time"
                          value={r.time || "09:00"}
                          onChange={(e) => updateReminder(r.id, { time: e.target.value })}
                        />
                        <Select
                          value={r.goalId || ""}
                          onChange={(e) => updateReminder(r.id, { goalId: e.target.value })}
                        >
                          <option value="">Aucune cible</option>
                          {goals.length ? (
                            <optgroup label="Objectifs">
                              {goals.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.title || "Objectif"}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                          {habits.length ? (
                            <optgroup label="Habitudes">
                              {habits.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.title || "Habitude"}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                        </Select>
                      </div>
                      <div className="mt10">
                        <div className="small2">Jours</div>
                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                          {DAYS.map((d) => {
                            const active = days.includes(d.id);
                            return (
                              <button
                                key={d.id}
                                className={active ? "btn" : "btn btnGhost"}
                                style={{ padding: "4px 8px", fontSize: 12 }}
                                onClick={() => {
                                  const nextDays = active
                                    ? days.filter((x) => x !== d.id)
                                    : [...days, d.id].sort((a, b) => a - b);
                                  updateReminder(r.id, { days: nextDays });
                                }}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt10">
                        <div className="small2">Canal</div>
                        <Select
                          value={r.channel || "IN_APP"}
                          onChange={(e) => updateReminder(r.id, { channel: e.target.value })}
                        >
                          <option value="IN_APP">In-app</option>
                          <option value="NOTIFICATION">Notification navigateur</option>
                        </Select>
                      </div>
                      <div className="row" style={{ marginTop: 10 }}>
                        <Button
                          variant={r.enabled ? "primary" : "ghost"}
                          onClick={() => updateReminder(r.id, { enabled: !r.enabled })}
                        >
                          {r.enabled ? "ON" : "OFF"}
                        </Button>
                        <Button variant="ghost" onClick={() => removeReminder(r.id)}>
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="small2">Aucun rappel pour l’instant.</div>
              )}
            </div>

            <div className="mt12 row">
              <div className="small2">Notifications : {notifStatus}</div>
              <Button
                variant="ghost"
                onClick={async () => {
                  const res = await requestReminderPermission();
                  setNotifStatus(res);
                }}
              >
                Autoriser
              </Button>
            </div>
          </div>
        </Card>

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
