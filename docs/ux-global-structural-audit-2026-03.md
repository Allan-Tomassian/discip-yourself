# Audit UX structurel global

Date: 2026-03-29
Base observée: état actuel du produit dans le repo

## 1. Diagnostic global du modèle mental réel

### Diagnostic central

Le produit ne se présente pas aujourd'hui comme un système évident de structuration personnelle. Il se présente plutôt comme un hybride entre planner orienté catégories, assistant de structuration, tableau de bord de progression et couche d'analyse IA.

La promesse implicite la plus proche du produit réel est:

> un système personnel de structuration par catégories, assisté par IA, qui essaie de transformer des intentions en actions, puis de piloter leur continuité.

Le problème n'est pas la richesse de cette promesse. Le problème est qu'elle n'est pas exposée dans un ordre mental simple. L'utilisateur doit comprendre trop tôt:

- la structure par catégories
- la différence objectif / action
- le rôle de Today
- le rôle de Planning
- le rôle de Pilotage
- le rôle du Coach
- le rôle séparé des analyses locales

Le produit est donc potentiellement puissant, mais il n'est pas immédiatement lisible.

### Ce que l'app semble être au premier contact

Pour un nouvel utilisateur, l'app peut être perçue successivement comme:

1. un onboarding de profilage structuré par préférences
2. un planner quotidien avec recommandation IA
3. une bibliothèque de catégories et d'actions
4. un outil de coaching conversationnel
5. un dashboard de progression

Ces lectures sont toutes partiellement vraies. C'est précisément le problème: aucune ne domine assez clairement.

### Hypothèses concurrentes testées

| Hypothèse | Crédibilité actuelle | Pourquoi |
| --- | --- | --- |
| Todo list | Faible | La structure est trop riche, le vocabulaire trop systémique, les catégories trop centrales. |
| Habit tracker | Moyenne | La logique de répétition, rythme, discipline et continuité est forte. |
| Planner | Forte | `Today`, `Planning`, calendrier, créneaux, sessions et charge rendent cette lecture naturelle. |
| Outil IA | Moyenne | Le Coach, les analyses et la création assistée sont visibles, mais ne suffisent pas à définir l'app seuls. |
| Système de structuration personnelle | Forte en profondeur, faible en première lecture | C'est probablement la vérité produit la plus juste, mais elle n'est pas explicitée assez simplement. |

### Conclusion

Le modèle mental réel est:

> un planner de structuration personnelle centré sur des catégories, enrichi par du coaching et de l'analyse.

Le modèle mental perçu au premier usage est:

> une app complexe qui mélange planification, organisation, diagnostic et IA sans dire clairement quelle couche doit être comprise en premier.

Le produit fatigue moins par excès de fonctionnalités que par excès de rôles simultanés.

## 2. Cartographie des frictions principales

### Friction 1

Constat
: L'utilisateur n'apprend pas explicitement dans quel ordre comprendre le produit.

Impact utilisateur
: Il peut entrer par l'onboarding, puis arriver sur Today, puis voir le Coach, puis découvrir Planning, Library et Pilotage sans hiérarchie claire de priorité mentale.

Pourquoi c'est structurel
: La navigation est canonique, mais la pédagogie produit ne l'est pas. Le produit expose des surfaces cohérentes localement sans orchestrer leur apprentissage global.

Direction recommandée
: Définir un ordre d'apprentissage strict: structure de base -> premier succès exécutable -> rythme -> lecture de progression.

### Friction 2

Constat
: Les catégories sont structurellement centrales, mais pas présentées comme la clé maîtresse du système.

Impact utilisateur
: L'utilisateur peut créer, planifier ou discuter avec le Coach sans comprendre assez tôt que les catégories sont les conteneurs stables du système.

Pourquoi c'est structurel
: Les catégories sont partout dans les données, les sélections de vue et les surfaces, mais leur statut mental n'est pas énoncé clairement.

Direction recommandée
: Assumer explicitement que la catégorie est l'unité de structuration principale, et faire découler objectif, action, planning et pilotage de cette base.

### Friction 3

Constat
: La différence entre objectif et action reste rationnelle dans le code, mais encore coûteuse à comprendre dans l'expérience.

Impact utilisateur
: Le débutant peut hésiter sur ce qu'il doit créer en premier et sur le niveau de granularité attendu.

Pourquoi c'est structurel
: Le produit essaye d'offrir un create flow unifié et guidé, mais expose tôt la logique de rattachement, d'horizon, de cadence et de lien entre entités.

Direction recommandée
: Réduire la charge décisionnelle initiale et rendre la hiérarchie objectif -> action plus évidente dans le langage et l'ordre des décisions.

### Friction 4

Constat
: Today mélange exécution immédiate, recommandation, calendrier, micro-actions, état du jour, notes et raccourcis de lecture.

Impact utilisateur
: La surface censée répondre à "que faire maintenant ?" contient aussi plusieurs couches d'interprétation et de navigation.

Pourquoi c'est structurel
: Today porte à la fois le rôle d'écran d'exécution, d'écran d'orientation, de surface IA et de point d'entrée global.

Direction recommandée
: Rendre Today beaucoup plus radical dans son rôle principal et déclassement des éléments secondaires.

### Friction 5

Constat
: Planning est lisible fonctionnellement, mais sa valeur stratégique n'est pas immédiatement différenciée de Today.

Impact utilisateur
: L'utilisateur peut voir Planning comme un autre écran de consultation plutôt que comme le lieu du rythme.

Pourquoi c'est structurel
: Today contient déjà du calendrier et du pilotage micro-local. Planning contient du coaching et du diagnostic. La frontière devient poreuse.

Direction recommandée
: Renforcer la lecture "quand et à quel rythme agir", sans transformer Planning en deuxième surface de coaching.

### Friction 6

Constat
: Library est la vraie surface de structure, mais elle n'est pas perçue immédiatement comme la base mère du système.

Impact utilisateur
: L'utilisateur peut considérer Library comme une page de rangement ou d'administration, alors qu'elle définit en réalité la stabilité long terme du produit.

Pourquoi c'est structurel
: Le mot "Bibliothèque" adoucit la structure, mais peut aussi la minimiser. La page mélange catégories actives, suggestions, reclassification et édition inline.

Direction recommandée
: Faire de Library la surface où le système devient intelligible, pas seulement gérable.

### Friction 7

Constat
: Pilotage arrive encore comme une surface dense et ambitieuse avant que sa nécessité soit acquise.

Impact utilisateur
: Il peut être perçu comme un dashboard technique ou analytique plutôt que comme une lecture utile de progression.

Pourquoi c'est structurel
: La surface empile résumé global, catégories structurées, catégories à structurer, lecture locale, mini-métriques, tendance et analyse IA.

Direction recommandée
: Le repositionner clairement comme surface secondaire de lecture et non comme couche de compréhension initiale.

### Friction 8

Constat
: L'IA n'a pas un contrat mental assez net.

Impact utilisateur
: Il est difficile de savoir ce qui relève du Coach, ce qui relève d'une analyse locale, et lequel fait autorité.

Pourquoi c'est structurel
: Today, Planning et Pilotage ont des analyses persistées ou locales, tandis que le Coach existe comme panel, chat et mode structuration.

Direction recommandée
: Assumer explicitement deux couches d'IA distinctes, avec un périmètre et un niveau d'autorité non ambigus.

## 3. Incohérences conceptuelles

### 3.1 Planner vs système de structuration

Le produit est conçu comme un système de structuration personnelle, mais plusieurs surfaces le font d'abord lire comme un planner. Ce n'est pas un défaut en soi. Le défaut est de ne pas trancher l'ordre mental entre les deux.

### 3.2 Catégorie vs objectif comme point d'entrée

Le produit semble vouloir que la catégorie soit le conteneur principal. Pourtant l'onboarding parle surtout priorités, temps, intensité, blocs, structure. L'utilisateur ne sort pas de l'entrée avec une lecture nette de la catégorie comme unité mère.

### 3.3 Coach vs analyses locales

Le produit assume déjà deux couches d'IA dans sa structure, mais pas encore dans sa pédagogie:

- le Coach conversationnel aide à discuter, structurer, proposer des brouillons
- les analyses locales lisent un contexte précis et restituent un diagnostic ou une recommandation

Aujourd'hui cette séparation existe dans le produit, mais n'existe pas encore assez dans l'esprit utilisateur.

### 3.4 Today vs Planning

Today contient déjà une lecture de contexte, un focus actionnable, un calendrier et une analyse. Planning contient du calendrier, du rythme et du coaching. Les deux surfaces se distinguent, mais pas encore avec une netteté maximale.

### 3.5 Library vs Pilotage

Library dit "voici la structure". Pilotage dit "voici la lecture de la progression". Mais Pilotage contient encore beaucoup d'information structurelle sur l'état des catégories, ce qui crée un recouvrement avec Library.

### 3.6 Créer vs structurer avec le Coach

La création unifiée et la structuration via Coach sont proches. Le produit possède déjà plusieurs passerelles entre les deux. Cela augmente la puissance, mais aussi le doute: dois-je créer directement, ou demander au Coach de structurer avant ?

## 4. Éléments introduits trop tôt

- La logique complète de profilage IA dès l'onboarding.
- La notion de niveau de structure avant que le système ne soit visible.
- La densité de Today au premier retour post-onboarding.
- La possibilité d'ouvrir rapidement Coach alors que la logique de base n'est pas encore stabilisée.
- L'existence de Pilotage parmi les surfaces de premier rang avant que l'utilisateur n'ait accumulé assez de signal.
- La distinction fine entre objectif, action, action liée, catégorie suggérée, rappel, quantification, horizon, cadence dans les premiers flux de création.
- Les analyses IA dans plusieurs surfaces avant que l'utilisateur ne sache déjà lire ces surfaces sans IA.

Le point commun est simple: l'app introduit parfois l'optimisation avant la compréhension de base.

## 5. Éléments manquants pour comprendre le système

- Une phrase simple qui définit l'app sans ambiguïté.
- Une hiérarchie explicite entre catégorie, objectif et action.
- Une explication courte du rôle exact de chaque surface principale.
- Une explication nette de la différence entre Coach et analyses locales.
- Un "par où commencer" explicite après onboarding.
- Un principe directeur long terme du type:
  "les catégories portent tes chantiers, les objectifs donnent la direction, les actions donnent l'exécution, Today te dit quoi faire maintenant, Planning règle le rythme, Pilotage lit la cohérence."

Le produit n'a pas besoin de plus de fonctionnalités pour clarifier cela. Il a besoin d'une grammaire produit plus stricte.

## 6. Audit détaillé de Pilotage

### Rôle promis

Pilotage doit être perçu comme:

> lecture de progression et cohérence globale

### Rôle réellement perçu aujourd'hui

Pilotage est perçu comme un mélange de:

- dashboard de progression
- console par catégorie
- surface d'analyse
- zone de diagnostic système

### Diagnostic

#### Lisibilité immédiate

Moyenne à faible pour un nouvel utilisateur.

La surface a une bonne logique interne, mais suppose déjà plusieurs acquis:

- comprendre ce qu'est une catégorie structurée
- comprendre pourquoi certaines catégories sont différées
- comprendre les métriques de rythme
- comprendre la valeur d'une lecture locale
- comprendre pourquoi une analyse IA existe ici

#### Utilité perçue

Faible au début, bonne plus tard.

Pilotage devient pertinent quand l'utilisateur a déjà:

- plusieurs catégories
- plusieurs actions
- plusieurs jours d'historique
- une question de cohérence ou de continuité

Avant cela, la surface paraît plus savante qu'utile.

#### Complexité visuelle

Modérée à forte.

La densité n'est pas purement décorative. Elle vient d'une multiplicité de rôles:

- résumé global
- focus catégorie
- lecture locale
- statistiques globales
- catégories à structurer
- catégories structurées

#### Complexité mentale

Forte.

L'utilisateur doit simultanément comprendre:

- l'état global
- la logique par catégorie
- la différence entre structure et activité
- la notion de rythme
- la notion de lecture locale
- l'intérêt de l'analyse IA

#### Charge cognitive

Trop élevée pour un premier cycle de vie.

#### Compréhension de la progression

Bonne pour un utilisateur déjà investi.
Moyenne pour un utilisateur régulier.
Faible pour un nouvel utilisateur.

#### Compréhension de ce qu'il faut améliorer

Partiellement bonne.

Pilotage sait dire où ça baisse, où c'est irrégulier, où c'est vide. Mais l'utilisateur doit déjà comprendre pourquoi cela mérite son attention et comment relier cette lecture aux surfaces d'action.

#### Cohérence avec Today et Planning

Partiellement cohérente, mais encore trop proche d'une surcouche analytique branchée à côté du système principal.

Today répond à l'action du moment.
Planning répond au rythme.
Pilotage devrait répondre à la cohérence du système.

Aujourd'hui, Pilotage parle encore trop en termes de structure locale et de métriques, pas assez comme une lecture synthétique utile à la décision.

### Moment de vérité produit

Pilotage arrive trop tôt comme surface de premier rang.

Cela ne veut pas dire qu'il faut le supprimer. Cela veut dire qu'il faut clarifier qu'il ne constitue pas le premier apprentissage du produit.

### Verdict

Pilotage doit rester une surface secondaire assumée, tournée vers:

- lecture de cohérence
- lecture de continuité
- lecture de déséquilibre entre catégories

et non vers:

- compréhension initiale du produit
- pilotage détaillé trop tôt
- diagnostic dense avant usage suffisant

## 7. Audit détaillé du rôle actuel de l'IA

### État actuel observé

L'IA apparaît via:

- CoachPanel
- coach-chat
- mode structuration du Coach
- analyses Today
- analyses Planning
- analyses Pilotage
- suggestions et création assistée

### Lecture utilisateur probable

L'utilisateur peut percevoir trois choses différentes:

1. un Coach avec lequel on parle
2. des analyses qui "regardent la page"
3. des propositions de création ou de brouillons

La bonne nouvelle est que ces trois choses sont liées.
La mauvaise est que leur hiérarchie n'est pas assez claire.

### Ce qui est cohérent

- Le Coach conversationnel comme assistant de structuration.
- Les analyses locales comme diagnostics contextualisés.
- Les brouillons/propositions comme passerelle entre parole et action.

### Ce qui est confus

#### 7.1 Qui fait autorité

Le produit ne dit pas assez si l'autorité principale est:

- le Coach
- l'analyse locale
- la logique locale non IA

#### 7.2 Frontière entre aide et complexification

L'IA aide souvent, mais elle ajoute aussi une couche de lecture.

Sur Today, l'analyse concurrence parfois la simplicité du "quoi faire maintenant".
Sur Planning, elle transforme une surface de rythme en surface de commentaire.
Sur Pilotage, elle ajoute une deuxième lecture à une surface déjà dense.

#### 7.3 Risque gadget

Le risque ne vient pas d'une mauvaise intégration technique. Il vient du fait que certaines analyses peuvent arriver avant que l'utilisateur ait acquis la lecture humaine de base de la surface.

Une IA utile clarifie une surface déjà compréhensible.
Une IA perçue comme gadget commente une surface encore floue.

### Verdict

L'IA à deux couches peut être un bon choix produit, à condition de formaliser:

- le Coach = assistant de structuration, de discussion et de transformation d'intention
- les analyses locales = lecture contextualisée d'une surface précise, à la demande ou en second niveau

L'erreur à éviter est de faire croire que ces deux couches sont interchangeables.

## 8. Opportunités majeures de simplification

### Opportunité 1

Simplifier la phrase-mère du produit.

Le produit a besoin d'une définition centrale stable. Pas marketing, pas conceptuelle, mais opératoire.

### Opportunité 2

Hiérarchiser plus strictement les surfaces.

- Today = agir maintenant
- Planning = régler le rythme
- Library = comprendre et structurer le système
- Pilotage = relire la cohérence après accumulation de signal

### Opportunité 3

Faire des catégories la première colonne vertébrale explicite.

Le produit devient plus évident si tout est relu à travers la catégorie comme chantier stable.

### Opportunité 4

Réduire la portée cognitive de Today.

Today doit redevenir la surface la plus simple à lire, même si le système derrière reste puissant.

### Opportunité 5

Clarifier le contrat mental de l'IA.

Deux IA assumées peuvent être plus claires qu'une IA floue:

- une IA qui discute et structure
- une IA qui lit localement une situation

### Opportunité 6

Déclasser Pilotage dans l'apprentissage sans le dévaluer dans la valeur long terme.

Il peut devenir plus crédible s'il n'essaie pas d'être immédiatement utile à tous les profils.

### Opportunité 7

Réduire les décisions précoces dans la création.

Le produit doit garder sa puissance structurelle, mais l'exposer plus tard et plus progressivement.

## 9. Priorisation des améliorations

### Matrice P0 / P1 / P2 / P3

| Priorité | Sujet | Pourquoi |
| --- | --- | --- |
| P0 | Définition explicite du produit et ordre de démarrage | Sans cela, la compréhension immédiate reste fragile. |
| P0 | Clarification catégorie / objectif / action | C'est la grammaire de base du système. |
| P0 | Réduction de la densité cognitive de Today | Today doit être immédiatement lisible. |
| P1 | Repositionnement de Pilotage comme surface secondaire | Sans cela, le produit continue de sur-exposer l'analyse trop tôt. |
| P1 | Contrat explicite entre Coach et analyses locales | Sans cela, l'IA reste puissante mais ambiguë. |
| P1 | Clarification du rôle de Library comme structure mère | Important pour la tenue sur plusieurs mois. |
| P2 | Réduction des décisions précoces dans create-item | Important pour le premier succès mais moins structurant que la grammaire globale. |
| P2 | Alignement plus net Today / Planning | Réduit la confusion récurrente. |
| P2 | Déclassement visible de certains accès IA au bon moment | Améliore la lisibilité sans toucher au coeur du système. |
| P3 | Harmonisation plus fine des wording de progression | Important mais secondaire face au modèle mental. |
| P3 | Réduction de certains doublons d'analyse ou d'insight | Netteté supplémentaire, pas levier principal. |

### Cartographie synthétique des frictions

| Sujet | Priorité | Risque principal |
| --- | --- | --- |
| Compréhension du produit | P0 | L'utilisateur ne sait pas ce qu'est vraiment l'app |
| Compréhension du point de départ | P0 | L'utilisateur ne sait pas par où commencer |
| Grammaire catégorie / objectif / action | P0 | Le système semble plus compliqué qu'il ne l'est |
| Densité de Today | P0 | L'exécution immédiate perd en évidence |
| Place de Pilotage | P1 | Le produit semble plus analytique qu'actionnable |
| Rôle de Library | P1 | La structure long terme reste sous-comprise |
| Contrat IA | P1 | L'aide paraît diffuse ou redondante |
| Charge du create flow | P2 | Le premier passage paraît plus lourd que nécessaire |

## 10. Direction cible

### 10.1 Onboarding

Direction cible
: garder un onboarding structuré, mais le faire servir un premier décollage clair.

Principe
: l'onboarding ne doit pas d'abord profiler l'utilisateur pour optimiser le système; il doit d'abord lui permettre de comprendre quel système il entre en train de construire.

Cap à tenir

- expliciter ce qu'est l'app
- expliciter ce qu'est une catégorie
- expliciter la relation objectif / action
- préparer le premier succès sur Today
- ne pas introduire trop tôt les couches d'optimisation

### 10.2 Modèle mental

Direction cible
: faire du produit un système personnel de structuration par catégories, dont le planner et l'IA sont des moyens, pas des identités concurrentes.

Modèle cible recommandé

> Tu organises ta vie en catégories stables.
> Chaque catégorie porte une direction.
> Les objectifs donnent le cap.
> Les actions rendent ce cap exécutable.
> Today te dit quoi faire maintenant.
> Planning règle le rythme.
> Pilotage relit la cohérence quand assez de signal existe.

### 10.3 Pilotage

Direction cible
: surface secondaire de lecture et de cohérence, utile surtout après quelques jours ou semaines d'usage.

Ce qu'elle doit devenir mentalement

- moins dashboard
- moins initiation
- plus lecture de continuité
- plus lecture de déséquilibre entre catégories
- plus utile quand le système existe déjà

### 10.4 IA produit

Direction cible
: assumer clairement deux couches d'IA.

Couche 1
: `Coach`

- conversation
- structuration
- transformation d'intention
- proposition de brouillons

Couche 2
: `analyses locales`

- lecture contextualisée d'une surface
- diagnostic ponctuel
- recommandation locale
- second niveau, pas premier langage du produit

Le produit ne doit pas chercher à faire croire qu'il s'agit d'une seule couche si l'expérience réelle en expose deux.
Il doit au contraire rendre leur complémentarité évidente.

## Matrice “surface promise vs surface perçue vs drift”

| Surface | Rôle promis | Rôle perçu aujourd'hui | Drift principal |
| --- | --- | --- | --- |
| Today | Ce qu'il faut faire maintenant | Surface d'exécution + lecture du jour + IA + calendrier + micro-navigation | Trop de couches concurrentes pour une surface censée être la plus simple |
| Planning | Quand et à quel rythme agir | Calendrier planifié + revue locale + coaching d'ajustement | La frontière avec Today et l'IA n'est pas assez nette |
| Library | Structure complète du système | Bibliothèque de catégories + gestion + édition + clarification | Semble parfois administrative alors qu'elle porte la structure mère |
| Pilotage | Lecture de progression et cohérence globale | Dashboard + console catégorie + diagnostic + analyse IA | Arrive trop tôt et paraît plus technique qu'évident |
| Coach | Assistant de structuration | Chat, panel, structuration, aide contextuelle, passerelle de création | Périmètre riche mais insuffisamment séparé des analyses locales |

## Interfaces de support du modèle mental

| Interface | Rôle utile cible | Lecture actuelle | Risque |
| --- | --- | --- | --- |
| create-item | Transformer une intention en structure minimale crédible | Flow riche, guidé, mais encore chargé en décisions précoces | Le débutant comprend la mécanique avant de comprendre le système |
| edit-item | Ajuster une structure déjà comprise | Surface de maintenance dense mais logique | Demande une grammaire déjà acquise |
| CoachPanel | Assistance rapide contextuelle | Porte d'entrée tentante, latérale, permanente | Peut détourner trop tôt de la compréhension de base |
| coach-chat | Espace de structuration conversationnelle | Surface riche et crédible pour explorer | Peut concurrencer create-item si le contrat n'est pas mieux clarifié |

## Lecture par scénarios obligatoires

### Première ouverture à vide

Le risque principal est de comprendre un parcours, mais pas encore le système. L'onboarding structure, mais ne fixe pas assez la grammaire catégorie -> objectif -> action -> surfaces.

### Première création d'action

Le produit est puissant, mais la création peut sembler plus lourde que nécessaire car elle expose tôt cadence, moment, rappels, quantification et rattachements.

### Première création d'objectif

L'objectif existe bien comme direction, mais sa place dans l'architecture mentale reste moins intuitive que celle de l'action.

### Première navigation Today / Planning / Library / Pilotage

La navigation est nette visuellement. La hiérarchie mentale, elle, ne l'est pas encore assez:

- Today semble central
- Planning semble utile mais voisin
- Library semble importante sans être explicitement fondatrice
- Pilotage semble trop ambitieux trop tôt

### Première compréhension des catégories

Sujet critique. Les catégories existent partout, mais le produit ne dit pas encore assez qu'elles sont le conteneur principal et durable du système.

### Première compréhension du Coach

Le Coach est visible et riche, mais il peut apparaître avant que le besoin de structuration assistée soit ressenti.

### Première compréhension des analyses IA locales

Leur valeur existe, mais elles sont plus pertinentes une fois la lecture humaine de la surface acquise.

### Utilisation après plusieurs semaines

Le produit devient plus convaincant. Sa logique structurelle prend de la valeur. C'est un signal positif: le problème principal n'est pas la profondeur, mais le premier étage de compréhension.

### Utilisation avec beaucoup d'actions

Le besoin de grammaire stable devient fort. Sans clarification suffisante, la densité du système peut devenir coûteuse à maintenir.

### Utilisation avec plusieurs catégories

C'est là que la qualité du modèle mental se joue réellement. Si la catégorie n'est pas clairement perçue comme chantier stable, la complexité s'accumule vite.

### Cas utilisateur pressé

Le produit n'est pas encore assez radicalement lisible pour quelqu'un qui veut:

- créer en quelques secondes
- comprendre quoi faire aujourd'hui immédiatement

### Cas utilisateur confus

Les zones d'hésitation principales sont:

- par où commencer
- quoi créer d'abord
- quand utiliser Library
- quand utiliser Pilotage
- quand parler au Coach
- quand lancer une analyse

## Point de départ recommandé

L'utilisateur devrait commencer ainsi:

1. comprendre qu'il organise sa vie en catégories stables
2. créer une première structure simple dans une catégorie
3. créer une première action exécutable
4. revenir sur Today pour obtenir un premier succès immédiat
5. utiliser Planning pour rendre le rythme crédible
6. n'ouvrir Pilotage qu'après accumulation d'un minimum de signal

Le Coach doit intervenir comme assistant de structuration ou de clarification, pas comme point d'entrée principal par défaut.

## Conclusion opérationnelle

Le produit est plus proche d'un bon système durable que d'une app confuse sans cap. La fondation est donc saine.

La difficulté n'est pas de tout refaire.
La difficulté est de faire apparaître dans le bon ordre ce qui existe déjà.

Le prochain cap UX ne doit pas être:

- plus d'IA
- plus d'insights
- plus de couches

Le prochain cap UX doit être:

- une définition produit plus nette
- une grammaire plus stricte
- un ordre d'apprentissage plus clair
- un Today plus simple
- un Pilotage plus mature et plus tardif
- une IA mieux séparée entre structuration et lecture locale

Si cette clarification est réussie, le produit peut devenir lisible immédiatement sans perdre sa profondeur, et rester maintenable mentalement sur plusieurs années.
