import type { Question } from '../types/game';

export const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 'q01',
    type: 'which-bin',
    category: 'bio',
    prompt: 'A greasy pizza box from the cookout. Which bin?',
    promptFi: 'Rasvainen pizzalaatikko grillijuhlista. Minne kuuluu?',
    image: '',
    options: ['cardboard', 'bio', 'mixed', 'paper'],
    answer: 1,
    explanation:
      'Close or spot on! Grease ruins cardboard recycling — tear off clean parts for cardboard and toss greasy parts into biowaste.',
    explanationFi:
      'Rasva pilaa kartongin kierrätyksen — puhtaat osat kartonkiin, rasvaiset biojätteeseen.',
    notes: 'Ask the crowd first — almost everyone guesses cardboard!',
  },
  {
    id: 'q02',
    type: 'which-bin',
    category: 'mixed',
    prompt: 'A broken drinking glass from the patio. Which bin?',
    promptFi: 'Rikkoutunut juomalasi terassilta. Minne se kuuluu?',
    image: '',
    options: ['glass', 'mixed', 'hazard', 'metal'],
    answer: 1,
    explanation:
      'Drinking glasses have a different melting point than bottles and jars — wrap safely and place in mixed waste, never glass packaging.',
    explanationFi:
      'Juomalasit sulavat eri lämpötilassa kuin pullot ja purkit — kääri turvallisesti ja laita sekajätteeseen, älä lasinkeräykseen.',
    notes: 'Bonus tip: only glass packaging (jars and non-deposit bottles) goes to glass.',
  },
  {
    id: 'q03',
    type: 'which-bin',
    category: 'cardboard',
    prompt: 'An empty chip tube (like Pringles) with a metal bottom. Which bin?',
    promptFi: 'Tyhjä sipsiputkilo metallipohjalla. Minne menee?',
    image: '',
    options: ['metal', 'cardboard', 'mixed', 'plastic'],
    answer: 1,
    explanation:
      'Cardboard wins by weight! Pop off the plastic lid into plastic packaging, and toss the tube straight into cardboard.',
    explanationFi:
      'Kartonki ratkaisee painollaan! Irrota muovikansi muovipakkauksiin ja laita putkilo kartonkiin.',
    notes: 'Great icebreaker because people love arguing about Pringles tubes.',
  },
  {
    id: 'q04',
    type: 'which-bin',
    category: 'metal',
    prompt: 'Used aluminum foil from wrapping grill veggies. Which bin?',
    promptFi: 'Käytetty alumiinifolio grillikasvisten kääreenä. Minne kuuluu?',
    image: '',
    options: ['mixed', 'plastic', 'metal', 'hazard'],
    answer: 2,
    explanation:
      'Give it a quick wipe, crumple it into a fist-sized ball so sorting machines spot it, and drop it in metal.',
    explanationFi:
      'Pyyhkäise ruoantähteet pois, rutista nyrkin kokoiseksi palloksi ja laita metalliin.',
    notes: 'Mention that tiny flat foil scraps can get lost in optical sorters.',
  },
  {
    id: 'q05',
    type: 'true-false',
    category: 'plastic',
    prompt: 'You must wash yogurt tubs with hot soap before putting them in plastic.',
    promptFi: 'Jogurttipurkit täytyy pestä kuumalla saippuavedellä ennen muovinkeräystä.',
    image: '',
    options: ['True', 'False'],
    optionsFi: ['Totta', 'Tarua'],
    answer: 1,
    explanation:
      'False! Hot water wastes more energy than recycling saves. Just scrape clean or give a quick cold rinse if it would smell.',
    explanationFi:
      'Tarua! Kuuma pesuvesi kuluttaa liikaa energiaa. Kaapiminen tai nopea kylmä huuhtelu riittää.',
    notes: 'A relief for lazy recyclers everywhere.',
  },
  {
    id: 'q06',
    type: 'which-bin',
    category: 'bio',
    prompt: 'Used paper napkins and coffee grounds with the filter. Which bin?',
    promptFi: 'Käytetyt lautasliinat sekä kahvinporot suodatinpusseineen. Minne?',
    image: '',
    options: ['paper', 'cardboard', 'bio', 'mixed'],
    answer: 2,
    explanation:
      'Tissue paper and coffee filters are too short-fibered for paper recycling, so they compost beautifully in biowaste.',
    explanationFi:
      'Pehmopaperi ja suodatinpussit eivät sovellu paperinkeräykseen — ne maatuvat täydellisesti biojätteessä.',
    notes: 'Remind guests: never put paper towels in paper recycling.',
  },
  {
    id: 'q07',
    type: 'multiple-choice',
    category: 'reuse',
    prompt: 'Which action cuts the most cookout waste before it even starts?',
    promptFi: 'Mikä teko vähentää grillijuhlien jätettä eniten jo etukäteen?',
    image: '',
    options: [
      'Compostable single-use plates',
      'Washable plates & sharing leftovers',
      'Extra recycling bins everywhere',
      'Buying smaller individual packs',
    ],
    optionsFi: [
      'Biohajoavat kertakäyttölautaset',
      'Pestävät astiat ja tähteiden jakaminen',
      'Enemmän kierrätysastioita',
      'Pienemmät annospakkaukset',
    ],
    answer: 1,
    explanation:
      'Prevention beats recycling every time — reusable dishes plus sending guests home with leftovers slashes food and packaging waste.',
    explanationFi:
      'Ehkäisy voittaa kierrätyksen — kestävät astiat ja ruoantähteiden jakaminen vähentävät hävikkiä eniten.',
    notes: 'Point to the reusable cups at the table!',
  },
  {
    id: 'q08',
    type: 'which-bin',
    category: 'hazard',
    prompt: 'A dead AA battery from the Bluetooth speaker. Which bin?',
    promptFi: 'Tyhjä AA-paristo kaiuttimesta. Minne se kuuluu?',
    image: '',
    options: ['metal', 'mixed', 'hazard', 'plastic'],
    answer: 2,
    explanation:
      'Tape the terminals and drop batteries at any grocery store battery box or hazardous waste point — loose batteries spark bin fires!',
    explanationFi:
      'Teippaa navat ja vie paristot kaupan keräyslaatikkoon tai vaarallisen jätteen pisteeseen — irtonaiset paristot voivat sytyttää tulipalon.',
    notes: 'Emphasize taping the terminals on lithium and 9V batteries.',
  },
  {
    id: 'q09',
    type: 'multiple-choice',
    category: 'paper',
    prompt: 'Which of these actually belongs in the Paper bin?',
    promptFi: 'Mikä näistä todella kuuluu paperinkeräykseen?',
    image: '',
    options: [
      'A glossy magazine & windowed envelope',
      'A brown paper grocery bag',
      'A gift-wrap roll with metallic print',
      'A receipt from the supermarket',
    ],
    optionsFi: [
      'Kiiltävä aikakauslehti ja ikkunakirjekuori',
      'Ruskea paperinen ruokakassi',
      'Kiiltävä metallipintainen lahjapaperi',
      'Kaupan kuitti',
    ],
    answer: 0,
    explanation:
      'Magazines and windowed envelopes go straight to paper! Brown paper bags go to cardboard, while thermal receipts and foil gift wrap go to mixed waste.',
    explanationFi:
      'Aikakauslehdet ja ikkunakirjekuoret kuuluvat paperiin! Ruskeat paperikassit menevät kartonkiin, kuitit ja lahjapaperit sekajätteeseen.',
    notes: 'Almost nobody knows brown paper bags go to cardboard in Finland.',
  },
  {
    id: 'q10',
    type: 'true-false',
    category: 'glass',
    prompt: 'A dented deposit soda can still earns you money if the barcode scans.',
    promptFi: 'Lommoinen panttitölkki antaa silti pantin, jos viivakoodi luetaan.',
    image: '',
    options: ['True', 'False'],
    optionsFi: ['Totta', 'Tarua'],
    answer: 1,
    explanation:
      'Tricky one — False! Finnish Palpa reverse vending machines check both shape and barcode, so crushed cans get rejected (and go to metal instead).',
    explanationFi:
      'Tarua! Palpa-automaatit tunnistavat sekä muodon että viivakoodin — litistetty tölkki hylätään ja päätyy metallinkeräykseen.',
    notes: 'Keep your cookout cans uncrushed!',
  },
  {
    id: 'q11',
    type: 'discussion',
    category: 'reuse',
    prompt: "What's one thing you repaired or gave a second life to recently?",
    promptFi: 'Minkä esineen korjasit tai pelastit uuteen käyttöön viimeksi?',
    image: '',
    options: [],
    explanation:
      'Extending a product’s life by just 1–2 years often cuts its carbon footprint far more than recycling it ever could. Pass the mic if someone else wants to chime in!',
    explanationFi:
      'Tuotteen käyttöiän pidentäminen parilla vuodella pienentää sen hiilijalanjälkeä usein paljon enemmän kuin kierrätys.',
    notes: 'Open discussion — encourage a quick story and celebrate creative fixes.',
  },
  {
    id: 'q12',
    type: 'discussion',
    category: 'mixed',
    prompt: "What's the most confusing item you've stood holding in front of the bins?",
    promptFi: 'Mikä on hämmentävin roska, jonka kanssa olet seissyt jäteastioiden edessä?',
    image: '',
    options: [],
    explanation:
      'Rule of thumb when stuck: sort by the heaviest material, separate loose lids/caps, and when truly unsure about contamination, mixed waste keeps recycling batches clean.',
    explanationFi:
      'Nyrkkisääntö epävarmassa tilanteessa: lajittele painavimman materiaalin mukaan, irrota korkit ja jos olet täysin epävarma, sekajäte suojaa muun kierrätyksen laatua.',
    notes: 'Fun crowd closer — ask if anyone else has wondered about the exact same item.',
  },
];

