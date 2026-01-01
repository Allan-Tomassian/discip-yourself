import React, { useState } from "react";
import { Button, Select } from "./UI";

export default function FocusCategoryPicker({
  categories,
  value,
  onChange,
  label = "Catégorie focus",
  emptyLabel = "Aucune catégorie",
  selectWrapperClassName = "",
  selectWrapperStyle,
}) {
  const list = Array.isArray(categories) ? categories : [];
  const active = list.find((c) => c.id === value) || null;
  const [open, setOpen] = useState(false);

  return (
    <div className="listItem">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="small2">{label}</div>
          <div style={{ fontWeight: 800 }}>{active?.name || emptyLabel}</div>
        </div>
        <Button variant="ghost" onClick={() => setOpen((v) => !v)} disabled={!list.length}>
          {open ? "Fermer" : "Changer"}
        </Button>
      </div>
      {open ? (
        <div className={`mt10 ${selectWrapperClassName}`} style={selectWrapperStyle}>
          <Select
            value={active?.id || ""}
            onChange={(e) => {
              const nextId = e.target.value;
              if (typeof onChange === "function") onChange(nextId);
              setOpen(false);
            }}
            style={{ fontSize: 16 }}
          >
            <option value="" disabled>
              Choisir une catégorie
            </option>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </div>
  );
}
