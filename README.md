# Rourn – Duo Catch (HTML5 Canvas)

Petit jeu 2D sans framework: deux joueurs attrapent des aliments qui tombent, avec bonus, pièges, et transformations amusantes.

## Lancer le jeu

- Ouvrir `index.html` dans un navigateur moderne (double‑clic suffit).
- Aucun serveur requis; tout est en JavaScript vanilla.

## Commandes

- Joueur 1: Z / Q / S / D
- Joueur 2: Flèches directionnelles
- Espace: démarrer (depuis le menu)
- P: pause
- R: rejouer (écran fin)
- Échap: retour menu
- M: basculer le mode son (SFX → Musique → Muet)
- 1/2/3 (menu): choisir le mode son (SFX / Musique / Muet)

## Modes audio

- SFX: petits sons d’interaction (pbtb, bombe, poulet) + tir tacos/burger (fartprout).
- Musique: `assets/sound3banana/chickenbanana.mp3` en boucle, sans SFX.
- Muet: aucun son.

## Dossier des assets

- Images et sons: `assets/`
  - Images joueurs: rourn1, rourn2, rourntacos, rournpizza, rournbrocolis, rournburger, rournpoule
  - Aliments: pizza, burger, tacos, brocolis, poulet, bombe
  - Tirs tacos/burger: tacostomato, tacossalad
  - Audio SFX: `assets/sound2/*.wav`
  - Musique: `assets/sound3banana/chickenbanana.mp3`

Assurez‑vous que les noms de fichiers correspondent à ceux référencés dans `game.js`.

## Règles principales

- Aire de jeu virtuelle: 1280×720 (mise à l’échelle responsive).
- Objets qui tombent: attrapez les bons, évitez la bombe.
- Timer: 2 min 10 s, puis écran de fin avec scores et détails.
- Difficulté progressive: spawn et vitesse augmentent par paliers.

## Transformations & pouvoirs

- 10× même aliment (tacos/pizza/brocolis/burger) → transformation visuelle unique pour la partie (on y reste).
- Poule (easter egg): 3 poulets consécutifs (sans autre aliment entre) → transformation poule; la poule grossit à chaque capture (sauf poulet/bombe), avec une taille max configurée.
- Poulet (pendant 5 s): mouvement libre, téléportation au centre à la prise; la poule ne change pas de taille sur poulet.
- Bombe (pendant 5 s): personnage fortement rapetissé pendant la durée.
- Avantages:
  - Brocolis: +25% vitesse
  - Tacos: tirs automatiques (salade/tomate) vers le haut, alternés toutes les ~3 s
  - Pizza: roule et circule sur tout le périmètre avec ←/→
  - Burger: tirs automatiques comme tacos, mais salade ← et tomate →

## Développement

- Code principal: `game.js` (aucune dépendance externe).
- Style léger: `styles.css`.
- Lint/tests non inclus; jeu conçu pour tourner directement dans le navigateur.

## Licence

Voir le fichier `LICENSE`. Si vous souhaitez une autre licence, modifiez‑la avant publication.

