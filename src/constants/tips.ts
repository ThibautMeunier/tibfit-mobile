export type Niveau = 'débutant' | 'intermédiaire' | 'avancé' | 'expert';

const VALID_NIVEAUX: Niveau[] = ['débutant', 'intermédiaire', 'avancé', 'expert'];

function resolveNiveau(niveau?: string | null): Niveau {
  if (niveau && (VALID_NIVEAUX as string[]).includes(niveau)) return niveau as Niveau;
  return 'débutant';
}

// Probabilité (%) de piocher dans chaque niveau selon le niveau de l'athlète.
const WEIGHTS: Record<Niveau, Record<Niveau, number>> = {
  débutant:      { débutant: 85, intermédiaire: 10, avancé: 4,  expert: 1  },
  intermédiaire: { débutant: 10, intermédiaire: 75, avancé: 12, expert: 3  },
  avancé:        { débutant: 3,  intermédiaire: 12, avancé: 75, expert: 10 },
  expert:        { débutant: 1,  intermédiaire: 4,  avancé: 15, expert: 80 },
};

// Pseudo-random déterministe (sin hash) pour getTipAt.
function seeded(s: number): number {
  const x = Math.sin(s + 1) * 10000;
  return x - Math.floor(x);
}

function pickLevel(niveau: Niveau, rand: number): Niveau {
  const w = WEIGHTS[niveau];
  let r = rand * 100;
  for (const lvl of VALID_NIVEAUX) {
    r -= w[lvl];
    if (r <= 0) return lvl;
  }
  return niveau;
}

export const TIPS: Record<'fr' | 'en', Record<Niveau, string[]>> = {
  fr: {
    débutant: [
      "Pas besoin de montre cardio pour doser ton effort. Le RPE, c'est juste : sur 10, tu en es où ? 6-7, c'est bien pour la plupart des séances.",
      "Si tu peux encore tenir une vraie conversation en courant, tu es en zone 2. La plupart des gens vont trop vite. Ralentis — c'est là que tu te construis.",
      "Ta VMA, c'est la vitesse où tu consommes le maximum d'oxygène. Toutes tes allures cibles en découlent.",
      "Ta FC max est propre à toi — les formules génériques (220 - âge) sont souvent fausses de 10-15 bpm. Si tu peux, fais un test max pour avoir ta vraie valeur.",
      "Échauffer avant une séance, c'est pas une option. 10-15 min de montée en température, et tu peux pousser beaucoup plus fort après — sans te blesser.",
      "Le retour au calme n'est pas du temps perdu. 5-10 min de footing léger après l'effort et ton corps récupère nettement mieux le lendemain.",
      "Si tu attends d'avoir soif pour boire, tu es déjà déshydraté à 1-2 %. À ce niveau, tu perds 10-20 % de tes capacités sans t'en rendre compte.",
      "Ton corps devient plus fort pendant le repos, pas pendant la séance. La séance, c'est le stimulus. Le repos, c'est là que la magie opère.",
      "La principale raison de blessure chez les débutants : aller trop vite, trop tôt. Si tu as envie d'en faire plus, attends la semaine d'après.",
      "Le 1RM, c'est la charge maxi sur une seule répétition. En pratique, tu n'as jamais besoin de le tester — 70 % de ton 1RM sur 10 reps, c'est déjà du travail sérieux.",
      "Les courbatures 24-48 h après une séance, c'est normal — signe que tu as bien travaillé. Une douleur articulaire franche, elle, ne se tolère pas.",
      "Mixer les sports, c'est futé : tu sollicites des muscles différents et tu évites de te blesser par répétition. Le vélo repose les jambes du coureur.",
      "Terminer une séance avec encore un peu d'énergie en réserve, c'est pas de la faiblesse. C'est ce qui permet de s'entraîner régulièrement pendant des mois.",
      "Les étirements statiques avant l'effort refroidissent les muscles et baissent tes perfs. Garde-les pour après la séance — c'est là qu'ils servent vraiment.",
      "Rater une séance n'est pas un échec. Un plan, ça s'adapte à ta vie réelle. Reprends juste la suivante, sans culpabiliser.",
    ],
    intermédiaire: [
      "La périodisation, c'est alterner des blocs durs et des semaines légères. Sans ça, tu stagneras ou tu te planterai. Ton corps a besoin des deux.",
      "Toutes les 3-4 semaines, baisse ton volume de 20 %. Ça paraît contre-productif — c'est en réalité là que tu progresses le plus, grâce à la surcompensation.",
      "Le seuil lactique, c'est l'intensité où les lactates s'accumulent plus vite qu'ils partent. Travailler juste autour de ce seuil est l'un des entraînements les plus efficaces qui soit.",
      "Les intervalles développent ta VMA bien mieux qu'un effort continu modéré. 5 × 3 min à fond, c'est plus utile qu'1 h à allure confort.",
      "Ton FTP vélo, c'est la puissance que tu peux tenir pendant 1 heure. Tout ce qui est au-dessus, tu n'as qu'un temps limité pour le tenir.",
      "Ta CSS natation, c'est ton allure de seuil dans l'eau. Si tu nages régulièrement plus vite que ça en entraînement, tu te grilles sans t'en apercevoir.",
      "Si tu fais du triathlon sans jamais enchaîner vélo + course à pied à l'entraînement, tu auras les jambes en plomb le jour J. Les bricks sont non négociables.",
      "Un footing facile le lendemain d'une séance dure aide ton corps à éliminer les déchets. Souvent plus efficace que de rester allongé sur le canapé.",
      "En muscu, descends lentement — 3 à 4 secondes. C'est la phase excentrique qui crée le plus de stimulus musculaire, et la plupart des gens la bâclent.",
      "Au-delà de 10 % d'augmentation de charge par semaine, ton risque de blessure explose. Si tu veux progresser vite, reste patient — c'est paradoxal mais vrai.",
      "Le gainage, c'est pas juste pour les abdos. Des muscles profonds du tronc solides améliorent ton économie de course et ta posture sur le vélo.",
      "Tes sorties longues en zone 2, t'as l'impression de ne rien faire. En réalité, tu entraînes ton corps à brûler des graisses et tu poses les fondations de tout le reste.",
      "4 séances de 45 min dans la semaine, c'est souvent plus bénéfique qu'une seule sortie de 3 h. La fréquence prime sur le volume.",
      "En running, vise 170-180 pas par minute. Une foulée trop lente et trop longue absorbe mal les chocs — et ça finit par faire mal aux genoux.",
      "En vélo, pédaler en gros braquet à faible cadence fatigue les jambes pour la course à pied. 85-95 rpm, c'est plus économique et ça préserve les muscles.",
    ],
    avancé: [
      "80 % de ton volume en zones 1-2, 20 % en zones 4-5 — c'est l'entraînement polarisé. Sur le long terme, il surclasse le travail exclusivement au seuil.",
      "Pendant l'affûtage, baisse le volume de 40-60 % mais garde l'intensité. Beaucoup ont peur de perdre leur forme — en réalité, c'est là qu'elle arrive à son pic.",
      "Les côtes, c'est le meilleur ratio efficacité/risque en running : tu développes la puissance spécifique sans le choc des intervalles sur plat.",
      "Ta VO₂max progresse surtout avec des intervalles longs (3-8 min) à 95-100 % de la VMA. La clé : récupération active courte, pas complète.",
      "En triathlon, comment tu gères le vélo détermine ta course. Si tu sors du T2 à 100 %, ta course sera médiocre. 82-85 % du FTP, c'est le range gagnant.",
      "La périodisation en blocs, ça concentre un type de qualité sur 3-4 semaines avant de passer à autre chose. Plus efficace que de tout travailler en même temps.",
      "En natation, travaille d'abord à allonger ta distance par cycle avant d'augmenter ta cadence. Un bon nageur glisse — il ne pagaie pas.",
      "Entre deux compétitions, prévois 1 jour de récup par tranche de 10 min de course. Un 10 km, c'est au minimum 1 jour. Un marathon, c'est 4 semaines.",
      "Les 4 dernières semaines avant une compétition, travaille à ton allure cible. C'est ce qui grave l'économie de mouvement à cette vitesse précise.",
      "En fin de saison, 2-4 semaines sans entraînement structuré améliorent les adaptations à long terme. Accepte la coupure, tu reviendras plus fort.",
      "Le nordic hamstring curl est l'exercice préventif le plus efficace contre les blessures aux ischio-jambiers en running. 2 fois par semaine suffit.",
      "Ta position aéro sur le vélo réduit la résistance de 20-30 %. Au-delà d'une certaine vitesse, ça fait plus de différence que n'importe quel upgrade matériel.",
      "Après un bloc dur, ta semaine de récup ne te fait pas régresser — elle te propulse au-dessus de ton point de départ. C'est la surcompensation.",
      "Ce que tu mangeras en course, entraîne-toi à le manger à l'entraînement. Tester une stratégie nutritionnelle le jour J, c'est prendre un risque inutile.",
      "Ton économie de course s'améliore avec le renforcement musculaire et le travail de technique. Deux fois par semaine de renfo, et tu cours plus vite pour le même effort.",
    ],
    expert: [
      "Ton HRV du matin est ton meilleur indicateur de récupération du système nerveux. Une baisse persistante, c'est le signal de lever le pied — avant que le corps t'y force.",
      "La double périodisation, c'est cibler deux pics de forme dans une saison. Ça se planifie au jour près, des mois à l'avance. Pas de place pour l'improvisation.",
      "L'altitude ou l'hypoxie simulée stimule la production naturelle d'EPO et augmente ta capacité de transport en oxygène. Efficace, mais ça ne remplace pas le volume.",
      "Ton ratio ATL/CTL, c'est ta fatigue aiguë divisée par ta forme de fond. Quand il dépasse 1,5, le risque de blessure monte en flèche — même si tu te sens bien.",
      "Capacité aérobie (volume d'O₂ disponible) et puissance aérobie (débit max) sont deux qualités distinctes. Les confondre, c'est mal cibler ses blocs de travail.",
      "Le travail neuromusculaire — striders, accélérations, pliométrie — préserve tes qualités de vitesse et ton économie même en phase de gros volume. Ne le sacrifie pas.",
      "Ton pic de forme dure 2-3 semaines max. Le timing du taper n'est pas universel — apprends à connaître ton propre profil de réponse, et planifie en conséquence.",
      "Nutrition périodisée : entraîne-toi parfois à jeun ou low-carb pour développer ta flexibilité métabolique. Le jour J, tu cartures au maximum.",
      "La modélisation en puissance critique te permet de prédire tes dégradations de performance sur toutes les distances. Un outil sous-utilisé par beaucoup d'athlètes expérimentés.",
      "30 min de déficit de sommeil répété sur une semaine, ça dégrade ta récupération neuromusculaire autant qu'une mauvaise semaine d'entraînement. Le sommeil, c'est de la performance.",
      "À haut niveau, la fréquence des stimuli prime sur le volume par séance. 6 séances légères valent souvent plus que 3 séances à bloc.",
      "La clearance lactique est entraînable. Travailler régulièrement au-dessus du seuil développe les enzymes qui éliminent le lactate plus vite.",
      "En longue distance triathlon, dépasser 80 % du FTP sur le vélo compromet systématiquement la course. 70-75 %, c'est le range qui protège tes jambes pour le run.",
      "Le biais de positivité en début de saison est la principale cause de surentraînement chez les athlètes expérimentés. Fais confiance aux données, pas aux sensations.",
      "Un off-season actif avec du sport croisé maintient ta base aérobie tout en laissant ton mental souffler. Revenir motivé, c'est aussi une variable de performance.",
    ],
  },
  en: {
    débutant: [
      "You don't need a heart rate monitor to gauge effort. RPE is just: out of 10, where are you? 6-7 is the sweet spot for most sessions.",
      "If you can hold a real conversation while running, you're in zone 2. Most people go too fast. Slow down — that's where you build your base.",
      "Your VO2max speed is the pace where your body uses the most oxygen. All your target paces come from it. Add it to your profile and the app calculates them for you.",
      "Your max heart rate is unique to you — the '220 minus age' formula can be off by 10-15 bpm. A proper max test gives you a much more useful number.",
      "Warming up isn't optional. 10-15 minutes of progressive effort and you can push much harder afterward — with way less injury risk.",
      "Cool-down is not wasted time. 5-10 minutes of easy jogging after a hard effort and you'll feel noticeably better the next day.",
      "If you wait until you're thirsty to drink, you're already 1-2% dehydrated. At that point, you've lost 10-20% of your capacity without realizing it.",
      "Your body gets stronger during rest, not during the session itself. The workout is the stimulus. Recovery is where the magic happens.",
      "The number one cause of injury for beginners: too much, too soon. If you feel like doing more, save it for next week.",
      "1RM is your max weight for one rep. In practice, you rarely need to test it — 70% of 1RM for 10 reps is already serious work.",
      "Muscle soreness 24-48 hours after a session is normal — it means you worked. Sharp joint pain is a different story. Don't push through it.",
      "Mixing sports is smart: you work different muscles and avoid overuse injuries. Cycling is a great rest day for runners.",
      "Finishing a session with a little energy left isn't weakness. It's what lets you train consistently for months.",
      "Static stretching before exercise cools muscles down and lowers performance. Save it for after — that's where it actually helps.",
      "Missing a session isn't failure. A plan adapts to real life. Just pick up the next one without guilt.",
    ],
    intermédiaire: [
      "Periodization is about alternating hard blocks and easy weeks. Without it, you'll plateau or break down. Your body needs both.",
      "Every 3-4 weeks, drop your volume by 20%. It feels counterintuitive — but that's exactly when you improve most, thanks to supercompensation.",
      "Lactate threshold is where lactate builds up faster than your body can clear it. Training right around that point is one of the most effective things you can do.",
      "Intervals build VO2max far better than steady moderate effort. 5 × 3 min at max is more useful than 1 hour at comfort pace.",
      "Your FTP is the power you can hold for 1 hour on the bike. Everything above it, you only have a limited time before you blow up.",
      "Your CSS is your threshold pace in the water. If you regularly swim faster than that in training, you're burning matches without knowing it.",
      "If you do triathlon without ever running off the bike in training, your legs will be jelly on race day. Brick sessions are non-negotiable.",
      "An easy jog the day after a hard session helps your body flush out waste. Often more effective than lying on the couch.",
      "In strength training, lower slowly — 3 to 4 seconds down. The eccentric phase creates the most muscle stimulus, and most people rush through it.",
      "Past 10% increase in training load per week, your injury risk spikes. Staying patient is the fastest way to progress. Counterintuitive but true.",
      "Core strength isn't just about abs. A solid deep core improves your running economy and your position on the bike.",
      "Your long easy runs feel like you're doing nothing. You're actually training your body to burn fat and laying the foundation for everything else.",
      "4 sessions of 45 min across the week is often more valuable than one 3-hour outing. Frequency beats volume.",
      "In running, aim for 170-180 steps per minute. An overstriding gait absorbs impact poorly — and eventually, your knees pay for it.",
      "Grinding a big gear at low cadence on the bike wrecks your legs for the run. 85-95 rpm is more economical and kinder to your muscles.",
    ],
    avancé: [
      "80% of your volume in zones 1-2, 20% in zones 4-5 — that's polarized training. Long-term, it beats pure threshold work hands down.",
      "During taper, cut volume by 40-60% but keep the intensity. Most athletes are scared of losing fitness — in reality, that's when form peaks.",
      "Hill reps give you the best effort-to-risk ratio in running: specific power gains without the impact of flat intervals.",
      "Your VO2max improves most with long intervals (3-8 min) at 95-100% VO2max speed. The key: short active recovery, not full rest.",
      "In triathlon, how you ride the bike dictates your run. If you exit T2 at 100%, your run will be a suffer-fest. 82-85% FTP is the winning range.",
      "Block periodization concentrates one quality over 3-4 weeks before switching. Far more effective than trying to develop everything at once.",
      "In swimming, work on lengthening your stroke before increasing your stroke rate. A good swimmer glides — they don't just churn.",
      "Between races, allow 1 day of recovery per 10 minutes of racing. A 10K is at least 1 day. A marathon is 4 weeks.",
      "In the final 4 weeks before a race, work at your target pace. That's what locks in movement economy at that exact speed.",
      "At the end of a long season, 2-4 weeks with no structured training improve long-term adaptation. Accept the break — you'll come back stronger.",
      "The Nordic hamstring curl is the single most effective preventive exercise for hamstring injuries in running. Twice a week is enough.",
      "Your aero position on the bike cuts air resistance by 20-30%. Past a certain speed, it makes more difference than any equipment upgrade.",
      "After a hard block, your recovery week doesn't set you back — it propels you above where you started. That's supercompensation working.",
      "Whatever you'll eat on race day, practice it in training. Testing a nutrition strategy on race day is an unnecessary gamble.",
      "Running economy improves with strength training and technique work. Two sessions of strength per week, and you run faster for the same effort.",
    ],
    expert: [
      "Your morning HRV is your best indicator of nervous system recovery. A persistent drop is the signal to back off — before your body forces you to.",
      "Double periodization means targeting two form peaks in a season. It requires planning months in advance, down to the day. No room for improvisation.",
      "Altitude or simulated hypoxia stimulates natural EPO production and raises oxygen-carrying capacity. Effective — but it doesn't replace volume.",
      "Your ATL/CTL ratio is acute fatigue divided by baseline fitness. When it exceeds 1.5, injury risk spikes — even if you feel fine.",
      "Aerobic capacity (total O₂ available) and aerobic power (max flow rate) are distinct qualities. Confusing them leads to misaligned training blocks.",
      "Neuromuscular work — strides, accelerations, plyometrics — preserves your speed qualities and economy even during heavy volume phases. Don't sacrifice it.",
      "Your form peak lasts 2-3 weeks max. Taper timing isn't universal — learn your own response profile and plan accordingly.",
      "Periodized nutrition: training sometimes fasted or low-carb builds metabolic flexibility. On race day, you fuel at full capacity.",
      "Critical Power modeling lets you predict performance degradation across all distances. An underused tool by many experienced athletes.",
      "30 minutes of sleep deficit repeated across a week degrades your neuromuscular recovery as much as a bad training week. Sleep is performance.",
      "At the high-performance level, stimulus frequency beats per-session volume. Six light sessions often outperform three all-out ones.",
      "Lactate clearance is trainable. Regular work above threshold develops the enzymes that clear lactate faster.",
      "In long-distance triathlon, exceeding 80% FTP on the bike systematically tanks the run. 70-75% is the range that protects your legs.",
      "The positivity bias at the start of a season is the main cause of overtraining in experienced athletes. Trust the data, not the feelings.",
      "An active off-season with cross-training keeps your aerobic base while giving your mind a break. Coming back motivated is a performance variable too.",
    ],
  },
};

export function getRandomTip(lang: string, niveau?: string | null): string {
  const l = lang === 'en' ? 'en' : 'fr';
  const n = resolveNiveau(niveau);
  const lvl = pickLevel(n, Math.random());
  const tips = TIPS[l][lvl];
  return tips[Math.floor(Math.random() * tips.length)];
}

export function getTipAt(lang: string, niveau: string | null | undefined, index: number): string {
  const l = lang === 'en' ? 'en' : 'fr';
  const n = resolveNiveau(niveau);
  const lvl = pickLevel(n, seeded(index * 2));
  const tips = TIPS[l][lvl];
  return tips[Math.floor(seeded(index * 2 + 1) * tips.length)];
}

// Grand espace de départ pour que tipIndex initial (random) soit bien distribué.
export function tipsCount(_lang: string, _niveau?: string | null): number {
  return 500;
}
