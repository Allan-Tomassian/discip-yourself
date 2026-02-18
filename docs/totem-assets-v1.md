# Totem Assets V1

## Dossier cible
- `src/assets/totem/v1/`

## Fichiers obligatoires (noms figés)
- `branch.png`
- `eagle_perch.png`
- `eagle_land.png`
- `eagle_thumb.png`
- `eagle_fly_01.png`
- `eagle_fly_02.png`
- `eagle_fly_03.png`
- `eagle_fly_04.png`

## Contraintes de format (Canva / export)
- Taille exacte: `512x512`
- Fond: transparent (RGBA)
- Format: PNG
- Ne pas renommer les fichiers

## Pipeline actuel
- Le Dock (perchoir) lit:
  - `branch.png`
  - `eagle_perch.png`
- Le ghost d’animation lit:
  - `eagle_fly_01.png` (vol)
  - `eagle_land.png` (arrivée)
  - `eagle_thumb.png` (pose pouce)

## Remplacement des placeholders
1. Exporter tes PNG Canva en `512x512` transparent.
2. Remplacer les fichiers dans `src/assets/totem/v1/` en gardant exactement les mêmes noms.
3. Vérifier visuellement:
   - Dock visible en haut-droite.
   - Animation micro-action: vol -> arrivée -> pouce -> retour.
4. Lancer:
   - `npm test`
   - `npm run build`
   - `npm run test:e2e`

