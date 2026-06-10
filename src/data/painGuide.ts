// Données issues des fiches "Solutions Rapides & Diagramme de Dépannage" — AR.E de Pédaler
// Chaque section regroupe des zones de douleur, chaque zone liste des couples (problème → solutions).

export interface PainCause {
  problem: string;
  solutions: string[];
}

export interface PainZone {
  id: string;
  name: string;
  causes: PainCause[];
}

export interface PainSection {
  id: string;
  title: string;
  emoji: string;
  zones: PainZone[];
}

export const PAIN_GUIDE: PainSection[] = [
  // ── Pied ──────────────────────────────────────────────────────────────────
  {
    id: 'pied',
    title: 'Membre inférieur — Pied',
    emoji: '🦶',
    zones: [
      {
        id: 'engoudissement-pied',
        name: 'Engourdissement des pieds',
        causes: [
          {
            problem: 'Pieds trop serrés',
            solutions: [
              'Augmenter la taille des chaussures ou les desserrer',
              'Utiliser des chaussures plus larges sur l\'avant du pied (modèles "wide" : Shimano, Lake, Specialized)',
              'Semelles plus fines ou individualisées avec un podologue du sport',
            ],
          },
        ],
      },
      {
        id: 'douleur-cou-pied',
        name: 'Douleur au cou du pied',
        causes: [
          {
            problem: 'Chaussure trop serrée avec la languette qui appuie sur la zone (pédale en haut ou flexion dorsale trop importante)',
            solutions: [
              'Remplacer les chaussures pour un modèle plus ouvert à ce niveau (ex. marque Lake)',
              'Couper une partie de la languette avec des ciseaux (très présent sur les chaussures Sidi)',
              'Semelles plus fines ou individualisées avec un podologue du sport',
              'Revoir l\'engagement des cales (trop avancées) et la hauteur de la selle (trop basse) : la cheville peut travailler sur une mauvaise amplitude',
            ],
          },
        ],
      },
      {
        id: 'douleurs-pieds',
        name: 'Douleurs aux pieds',
        causes: [
          {
            problem: 'Pression trop importante sur le bord externe du pied ou autre point de pression maximale',
            solutions: [
              'Chaussures trop serrées ou trop étroites sur l\'avant — utiliser des chaussures "wide"',
              'Semelles individualisées avec un podologue du sport',
              'Rapprocher les cales de l\'intérieur de la chaussure pour éloigner les chaussures des manivelles',
            ],
          },
        ],
      },
      {
        id: 'crampes-pieds',
        name: 'Crampes aux pieds',
        causes: [
          {
            problem: 'Pieds trop serrés',
            solutions: [
              'Augmenter la taille des chaussures ou les desserrer',
              'Semelles plus fines ou individualisées',
            ],
          },
          {
            problem: 'Pieds pas assez maintenus (les orteils travaillent plus pour garder la stabilité)',
            solutions: [
              'Diminuer la taille des chaussures, semelles plus épaisses ou individualisées',
              'Chaussures moins larges et plus courtes',
              'Engager davantage le pied (rapprocher la cale du talon)',
            ],
          },
          {
            problem: 'Cales mal réglées ou selle trop basse',
            solutions: [
              'Revoir l\'engagement des cales (souvent trop avancées)',
              'Revoir les réglages de la selle (souvent trop basse)',
            ],
          },
          {
            problem: 'Chaussures non adaptées',
            solutions: [
              'Remplacer les chaussures pour un modèle plus en lien avec la morphologie',
            ],
          },
        ],
      },
      {
        id: 'tendon-achille',
        name: 'Tendon d\'Achille',
        causes: [
          {
            problem: 'Flexion plantaire maximale trop importante',
            solutions: [
              'Revoir l\'engagement des cales (souvent trop avancées)',
              'Revoir la hauteur de la selle (souvent trop basse)',
              'Engager davantage le pied (rapprocher la cale du talon)',
            ],
          },
          {
            problem: 'Chaussures non adaptées',
            solutions: [
              'Remplacer les chaussures pour un modèle qui n\'appuie pas sur le tendon',
            ],
          },
          {
            problem: 'Beaucoup de dénivelé positif (faible cadence, mobilisation de la cheville plus importante) ou travail en force trop important',
            solutions: [
              'Réduire le volume d\'entraînement, notamment le travail en force et les parcours vallonnés',
              'Augmenter la cadence de pédalage',
              'Monter la selle à l\'angle optimal selon la pratique',
            ],
          },
        ],
      },
    ],
  },

  // ── Genou ─────────────────────────────────────────────────────────────────
  {
    id: 'genou',
    title: 'Membre inférieur — Genou',
    emoji: '🦵',
    zones: [
      {
        id: 'genou-anterieur',
        name: 'Devant du genou (antérieur)',
        causes: [
          {
            problem: 'Sollicitation trop importante des quadriceps, flexion trop importante des genoux',
            solutions: [
              'Monter la selle et/ou la reculer',
              'Revoir l\'engagement des cales',
              'Engager davantage le pied (rapprocher la cale du talon)',
              'Réduire le volume d\'entraînement, notamment le travail en force et les parcours vallonnés',
              'Augmenter la cadence de pédalage',
            ],
          },
          {
            problem: 'Travail en force trop important',
            solutions: [
              'Augmenter la cadence moyenne de pédalage',
              'Réduire le volume d\'entraînement',
            ],
          },
          {
            problem: 'Amplitude de travail du genou trop importante',
            solutions: [
              'Passer sur des manivelles plus petites',
            ],
          },
        ],
      },
      {
        id: 'genou-posterieur',
        name: 'Derrière le genou (postérieur)',
        causes: [
          {
            problem: 'Sollicitation trop importante des ischios-jambiers (extension trop importante du genou)',
            solutions: [
              'Baisser la selle',
              'Avancer la selle',
              'Distance selle-cintre trop importante : réduire la longueur de la potence',
              'Revoir l\'engagement des cales',
              'Pivoter la cale pour rapprocher le talon du cadre',
              'Remplacer les cales et/ou les pédales si elles sont usées — diminuer la liberté angulaire si réglable',
            ],
          },
        ],
      },
      {
        id: 'patte-oie',
        name: 'Patte d\'oie (intérieur du genou, zone basse)',
        causes: [
          {
            problem: 'Extension maximale de la jambe trop importante',
            solutions: [
              'Baisser la selle',
            ],
          },
          {
            problem: 'Rotation externe du pied trop importante (talon trop proche du cadre)',
            solutions: [
              'Pivoter la cale pour éloigner le talon du cadre',
              'Remplacer les cales et/ou les pédales si elles sont usées — diminuer la liberté angulaire si réglable',
            ],
          },
          {
            problem: 'Pieds trop éloignés du cadre',
            solutions: [
              'Diminuer le déport : rapprocher les cales de l\'extérieur des chaussures pour rapprocher les chaussures des manivelles',
            ],
          },
        ],
      },
      {
        id: 'rotule-interne',
        name: 'Bord interne de la rotule',
        causes: [
          {
            problem: 'Contraintes trop importantes sur le bord interne de la rotule',
            solutions: [
              'Réduire le volume d\'entraînement, notamment le travail en force et les parcours vallonnés',
              'Augmenter la cadence de pédalage',
              'Selle trop basse ou trop avancée : corriger la hauteur',
              'Pivoter la cale pour rapprocher le talon du cadre',
            ],
          },
          {
            problem: 'Dysplasie fémoro-patellaire ou autre cause structurelle',
            solutions: [
              'Consultez un spécialiste',
            ],
          },
        ],
      },
      {
        id: 'rotule-externe',
        name: 'Bord externe de la rotule',
        causes: [
          {
            problem: 'Contraintes trop importantes sur le bord externe de la rotule (même logique que le côté interne)',
            solutions: [
              'Réduire le volume d\'entraînement, notamment le travail en force et les parcours vallonnés',
              'Augmenter la cadence de pédalage',
              'Selle trop basse ou trop avancée : corriger la hauteur',
              'Pivoter la cale pour éloigner le talon du cadre (sens opposé au bord interne)',
            ],
          },
        ],
      },
      {
        id: 'bandelette',
        name: 'Extérieur du genou (latéral) — Bandelette ilio-tibiale',
        causes: [
          {
            problem: 'Rotation interne du pied trop importante (talon trop éloigné du cadre)',
            solutions: [
              'Pivoter la cale pour rapprocher le talon du cadre',
              'Remplacer les cales et/ou les pédales si elles sont usées — diminuer la liberté angulaire si réglable',
            ],
          },
          {
            problem: 'Cheville trop libre / pieds trop proches du cadre',
            solutions: [
              'Augmenter le déport : rapprocher les cales de l\'intérieur des chaussures pour éloigner les chaussures des manivelles',
              'Si insuffisant, utiliser des "spacers" ou des pédales avec un axe plus long',
            ],
          },
          {
            problem: 'Frottement de la bandelette lié à une mauvaise hauteur de selle',
            solutions: [
              'Contrôler la hauteur de la selle',
            ],
          },
        ],
      },
    ],
  },

  // ── Hanche / Dos ──────────────────────────────────────────────────────────
  {
    id: 'hanche-dos',
    title: 'Hanche & Dos',
    emoji: '🦴',
    zones: [
      {
        id: 'hanches',
        name: 'Douleurs aux hanches',
        causes: [
          {
            problem: 'Flexion trop importante de la hanche',
            solutions: [
              'Baisser la selle à l\'angle optimal selon la pratique',
              'Avancer la selle',
              'Réduire la potence',
              'Relever le poste de pilotage (lever le guidon)',
              'Diminuer la longueur des manivelles',
            ],
          },
          {
            problem: 'Amplitude articulaire trop importante ou mauvais alignement hanche/genou/cheville',
            solutions: [
              'Contrôler la hauteur de la selle',
              'Ajuster la rotation et le déport des cales',
              'Selle mal réglée : recalibrer',
              'Passer sur des manivelles plus petites',
              'Consulter un podologue du sport',
            ],
          },
          {
            problem: 'Compensation du bassin suite à une dissymétrie des membres inférieurs',
            solutions: [
              'Trouver la cause de cette dissymétrie avec un podologue',
              'Orienter la cale du genou qui rentre vers l\'extérieur pour retrouver un alignement (rapprocher le talon de la manivelle)',
              'Différence de longueur de jambes : consulter un podologue pour diagnostic précis',
            ],
          },
          {
            problem: 'Dysplasie de hanche ou autre cause structurelle',
            solutions: [
              'Consultez un spécialiste',
            ],
          },
        ],
      },
      {
        id: 'lombaires',
        name: 'Douleurs lombaires',
        causes: [
          {
            problem: 'Chaîne musculaire postérieure trop mise en tension / buste trop incliné vers l\'avant',
            solutions: [
              'Réduire la potence',
              'Lever le poste de pilotage (remonter le guidon)',
              'Baisser la selle (et éventuellement l\'avancer)',
            ],
          },
          {
            problem: 'Buste trop incliné vers l\'arrière (rétroversion du bassin)',
            solutions: [
              'Incliner la selle vers l\'avant',
              'Utiliser une selle plus adaptée (formats larges et courts pour gagner en stabilité)',
            ],
          },
          {
            problem: 'Déhanchement / instabilité du bassin',
            solutions: [
              'Selle trop haute ou trop reculée : corriger la hauteur et le recul',
              'Remonter le guidon',
              'Modèle de selle non adapté',
              'Différence de longueur de jambes : consulter un podologue pour diagnostic précis',
              'Consulter un podologue du sport',
            ],
          },
        ],
      },
    ],
  },

  // ── Assise ────────────────────────────────────────────────────────────────
  {
    id: 'assise',
    title: 'Assise',
    emoji: '🚲',
    zones: [
      {
        id: 'perinee',
        name: 'Compression du périnée (avant de la selle)',
        causes: [
          {
            problem: 'Trop de pression sur l\'avant et le bec de la selle / bassin trop orienté vers l\'avant',
            solutions: [
              'Incliner la selle vers l\'avant',
              'Baisser la selle',
              'Remonter le guidon',
              'Changer de selle pour un modèle plus adapté',
            ],
          },
          {
            problem: 'Cuissard de mauvaise qualité ou frottements',
            solutions: [
              'Utiliser un cuissard de meilleure qualité',
              'Utiliser de la crème NOK de chez Akileine',
            ],
          },
        ],
      },
      {
        id: 'appuis-selle',
        name: 'Douleurs à l\'arrière de la selle (points d\'appui)',
        causes: [
          {
            problem: 'Trop de pression sur l\'arrière — selle trop inclinée vers l\'arrière',
            solutions: [
              'Changer de selle pour un modèle plus adapté',
              'Incliner la selle vers l\'avant',
              'Utiliser un cuissard de meilleure qualité',
              'Utiliser de la crème NOK de chez Akileine',
            ],
          },
          {
            problem: 'Selle trop large',
            solutions: [
              'Utiliser une selle plus étroite, notamment au niveau du bec',
            ],
          },
        ],
      },
      {
        id: 'irritation-cuisses',
        name: 'Irritation à l\'intérieur des cuisses',
        causes: [
          {
            problem: 'Cuissard de mauvaise qualité et frottements',
            solutions: [
              'Utiliser un cuissard de meilleure qualité',
              'Utiliser de la crème NOK de chez Akileine',
              'Incliner la selle vers l\'arrière',
              'Réduire la longueur de la potence et reculer la selle',
            ],
          },
        ],
      },
    ],
  },

  // ── Membre supérieur ──────────────────────────────────────────────────────
  {
    id: 'superieur',
    title: 'Membre supérieur — Épaules, Cervicales & Mains',
    emoji: '💪',
    zones: [
      {
        id: 'epaules-cervicales',
        name: 'Épaules & Cervicales',
        causes: [
          {
            problem: 'Trop de poids sur les bras (antépulsion trop importante)',
            solutions: [
              'Incliner la selle vers l\'arrière',
              'Réduire la longueur de la potence et reculer la selle',
              'Relever le poste de pilotage',
            ],
          },
          {
            problem: 'Ouverture des bras trop importante',
            solutions: [
              'Réduire la longueur de la potence',
              'Relever le poste de pilotage',
              'Réduire le recul de la selle',
            ],
          },
          {
            problem: 'Épaules trop fermées',
            solutions: [
              'Augmenter la largeur du guidon (= largeur entre les deux acromions)',
            ],
          },
          {
            problem: 'Tensions trop importantes aux cervicales comprimant certaines racines nerveuses',
            solutions: [
              'Réduire la longueur de la potence',
              'Remonter le guidon',
              'Une multitude d\'autres choses — consultez un spécialiste si persistance',
            ],
          },
        ],
      },
      {
        id: 'mains-poignets',
        name: 'Engourdissement / Douleurs aux poignets et aux mains',
        causes: [
          {
            problem: 'Trop de poids sur les poignets',
            solutions: [
              'Incliner la selle vers l\'arrière',
              'Réduire la longueur de la potence',
              'Contrôler la hauteur des poignées',
            ],
          },
          {
            problem: 'Mauvaise prise des poignées',
            solutions: [
              'Réduire la longueur de la potence si les poignées sont difficiles d\'accès',
              'Contrôler la hauteur des poignées',
            ],
          },
          {
            problem: 'Guidoline de mauvaise qualité ou vibrations',
            solutions: [
              'Revoir le modèle de guidoline',
              'Utiliser deux guidolines superposées pour absorber les vibrations',
            ],
          },
          {
            problem: 'Tensions face antérieure de l\'avant-bras',
            solutions: [
              'Réduire la largeur du guidon (= largeur entre les deux acromions)',
            ],
          },
        ],
      },
    ],
  },
];
