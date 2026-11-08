import type { BestTime, Footfall } from '@tripsaver/domain';
import type { Attraction } from '../../interfaces.js';

/**
 * Sample sights for the 5 mock destinations. Real places; coordinates, hours, closed days and fees are
 * approximate and must be verified before launch (they come from a licensed content source later).
 * closedDays: 0 = Sunday … 6 = Saturday.
 */
type Row = [
  id: string,
  name: string,
  category: string,
  lat: number,
  lng: number,
  hours: [open: string, close: string],
  closedDays: number[],
  durationMin: number,
  bestTime: BestTime,
  entryFee: number,
  rating: number,
  footfall: Footfall,
  flags: { offbeat?: boolean; highlight?: boolean; kids?: boolean; road?: string; network?: string; permit?: string },
  description: string,
];

const ALL_DAY: [string, string] = ['00:00', '23:59'];

const ROWS: Record<string, Row[]> = {
  GOA: [
    ['goa-baga', 'Baga & Calangute beaches', 'beach', 15.556, 73.752, ALL_DAY, [], 150, 'any', 0, 4.2, 'high', { highlight: true, kids: true }, 'Busy beaches with shacks and water sports; avoid red-flag zones.'],
    ['goa-aguada', 'Fort Aguada', 'fort', 15.492, 73.773, ['09:30', '18:00'], [], 90, 'afternoon', 0, 4.4, 'high', { highlight: true, kids: true }, '17th-century Portuguese fort and lighthouse above the Mandovi estuary.'],
    ['goa-chapora', 'Chapora Fort', 'fort', 15.606, 73.736, ALL_DAY, [], 60, 'evening', 0, 4.3, 'high', {}, 'Hilltop ruins with sunset views over Vagator beach.'],
    ['goa-anjuna', 'Anjuna beach & flea market', 'market', 15.575, 73.741, ['09:00', '18:00'], [0, 1, 2, 4, 5, 6], 120, 'any', 0, 4.0, 'high', {}, 'Wednesday flea market: clothes, spices and souvenirs. Bargain.'],
    ['goa-mapusa', 'Mapusa Friday Market', 'market', 15.591, 73.81, ['08:00', '14:00'], [0, 1, 2, 3, 4, 6], 120, 'morning', 0, 4.2, 'medium', {}, 'Local market on Fridays: spices, cashews, Goan sausages, pottery.'],
    ['goa-bomjesus', 'Basilica of Bom Jesus & Se Cathedral, Old Goa', 'religious', 15.501, 73.912, ['09:00', '18:30'], [], 120, 'morning', 0, 4.6, 'high', { highlight: true }, 'UNESCO-listed churches. Cover shoulders and knees.'],
    ['goa-fontainhas', 'Fontainhas Latin Quarter, Panjim', 'heritage', 15.497, 73.833, ALL_DAY, [], 90, 'afternoon', 0, 4.4, 'medium', {}, 'Colourful Portuguese-era lanes, cafés and bakeries.'],
    ['goa-museum', 'Goa State Museum', 'museum', 15.497, 73.828, ['09:30', '17:30'], [1], 90, 'any', 0, 3.9, 'low', { kids: true }, 'Sculpture, coins and Christian art. Closed Mondays.'],
    ['goa-spice', 'Spice plantation tour, Ponda', 'nature', 15.42, 74.02, ['09:00', '16:30'], [], 150, 'morning', 600, 4.3, 'medium', { kids: true }, 'Guided walk through spice gardens with a Goan buffet lunch.'],
    ['goa-dudhsagar', 'Dudhsagar Falls jeep safari', 'nature', 15.318, 74.314, ['08:00', '15:00'], [], 300, 'morning', 600, 4.5, 'high', { highlight: true, road: 'Rough forest track; shared jeeps only from Collem' }, 'Four-tier waterfall on the Goa–Karnataka border.'],
    ['goa-divar', 'Divar Island village walk', 'village', 15.52, 73.89, ['08:00', '18:00'], [], 150, 'morning', 0, 4.5, 'low', { offbeat: true, kids: true }, 'Free government ferry from Ribandar; old Goan houses and paddy fields.'],
    ['goa-netravali', 'Netravali Wildlife Sanctuary & bubbling lake', 'nature', 15.08, 74.21, ['08:00', '17:00'], [], 180, 'morning', 50, 4.4, 'low', { offbeat: true, road: 'Narrow ghat road after Sanguem', network: 'Weak mobile signal inside the sanctuary' }, 'Forest trails, a lake that bubbles when you clap, and the Mainapi waterfall trek.'],
    ['goa-cabo', 'Cabo de Rama fort & Pinho beach', 'fort', 15.088, 73.919, ['09:00', '18:00'], [], 150, 'afternoon', 0, 4.5, 'low', { offbeat: true, road: 'Last 3 km is a narrow village road', network: 'Patchy signal' }, 'Cliff-top fort with a steep path down to a quiet cove.'],
    ['goa-palolem', 'Palolem beach', 'beach', 15.01, 74.023, ALL_DAY, [], 180, 'afternoon', 0, 4.5, 'medium', { kids: true }, 'Calm crescent beach in the south; kayaking and dolphin trips.'],
  ],
  MANALI: [
    ['man-hadimba', 'Hadimba Devi Temple', 'religious', 32.248, 77.181, ['08:00', '18:00'], [], 60, 'morning', 0, 4.5, 'high', { highlight: true, kids: true }, 'Wooden pagoda temple in a cedar forest.'],
    ['man-oldmanali', 'Old Manali & Manu Temple', 'village', 32.256, 77.182, ALL_DAY, [], 120, 'afternoon', 0, 4.4, 'medium', {}, 'Cafés, apple orchards and the Manu temple.'],
    ['man-solang', 'Solang Valley', 'adventure', 32.316, 77.158, ['09:00', '17:00'], [], 240, 'morning', 600, 4.4, 'high', { highlight: true, kids: true }, 'Ropeway, paragliding and snow activities in season.'],
    ['man-vashisht', 'Vashisht hot springs & temple', 'religious', 32.262, 77.188, ['07:00', '20:00'], [], 75, 'evening', 0, 4.3, 'medium', {}, 'Natural hot-water baths beside an old stone temple.'],
    ['man-mallroad', 'Mall Road & Tibetan market', 'market', 32.243, 77.189, ['10:00', '21:00'], [], 90, 'evening', 0, 4.1, 'high', { kids: true }, 'Shawls, woollens and Tibetan handicrafts.'],
    ['man-jogini', 'Jogini Falls trek', 'nature', 32.27, 77.192, ['08:00', '17:00'], [], 180, 'morning', 0, 4.6, 'medium', { road: 'Steep 3 km walk from Vashisht' }, 'Forest trek to a high waterfall.'],
    ['man-naggar', 'Naggar Castle & Roerich Art Gallery', 'heritage', 32.115, 77.17, ['10:00', '17:00'], [1], 120, 'afternoon', 100, 4.4, 'medium', {}, 'Wood-and-stone castle and the Roerich estate. Gallery closed Mondays.'],
    ['man-jibhi', 'Jibhi village & Jalori Pass', 'village', 31.587, 77.37, ['08:00', '17:00'], [], 300, 'morning', 0, 4.7, 'low', { offbeat: true, road: 'Jalori Pass road can close after snow', network: 'Weak signal beyond Banjar' }, 'Wooden villages, a forest waterfall and the Serolsar lake trail.'],
    ['man-tirthan', 'Tirthan Valley & Great Himalayan National Park gate', 'nature', 31.637, 77.441, ['08:00', '17:00'], [], 300, 'morning', 150, 4.7, 'low', { offbeat: true, permit: 'GHNP entry permit from the Sai Ropa office', network: 'No signal in the park' }, 'Trout streams, homestays and trails into a UNESCO national park.'],
    ['man-sethan', 'Sethan village', 'village', 32.207, 77.229, ['08:00', '17:00'], [], 180, 'morning', 0, 4.5, 'low', { offbeat: true, road: 'Steep single-lane road; 4x4 after snow' }, 'High Buddhist hamlet with snow walks in winter.'],
  ],
  JAIPUR: [
    ['jai-amer', 'Amer Fort', 'fort', 26.985, 75.851, ['08:00', '17:30'], [], 180, 'morning', 200, 4.6, 'high', { highlight: true, kids: true }, 'Hilltop palace-fort; go early to beat the heat and crowds.'],
    ['jai-hawamahal', 'Hawa Mahal', 'heritage', 26.924, 75.827, ['09:00', '17:00'], [], 60, 'morning', 50, 4.4, 'high', { highlight: true }, 'The pink "palace of winds" facade.'],
    ['jai-citypalace', 'City Palace', 'heritage', 26.926, 75.824, ['09:30', '17:00'], [], 120, 'any', 300, 4.4, 'high', { highlight: true }, 'Royal residence with museums and courtyards.'],
    ['jai-jantar', 'Jantar Mantar', 'heritage', 26.925, 75.825, ['09:00', '16:30'], [], 75, 'any', 50, 4.4, 'high', { kids: true }, 'UNESCO-listed astronomical instruments.'],
    ['jai-nahargarh', 'Nahargarh Fort', 'fort', 26.937, 75.815, ['10:00', '22:00'], [], 120, 'evening', 50, 4.4, 'medium', {}, 'Sunset over the city from the ridge.'],
    ['jai-albert', 'Albert Hall Museum', 'museum', 26.912, 75.819, ['09:00', '17:00'], [], 90, 'any', 40, 4.4, 'medium', { kids: true }, 'Indo-Saracenic museum of art and artefacts.'],
    ['jai-johari', 'Johari & Bapu Bazaar', 'market', 26.92, 75.826, ['11:00', '21:00'], [0], 120, 'evening', 0, 4.2, 'high', {}, 'Gems, block prints and mojris. Many shops close Sundays.'],
    ['jai-panna', 'Panna Meena ka Kund', 'heritage', 26.988, 75.857, ['07:00', '18:00'], [], 45, 'morning', 0, 4.4, 'medium', {}, 'Criss-cross stepwell near Amer.'],
    ['jai-abhaneri', 'Chand Baori stepwell, Abhaneri', 'heritage', 27.007, 76.607, ['08:00', '18:00'], [], 120, 'morning', 0, 4.6, 'low', { offbeat: true, road: 'Village road for the last 5 km' }, 'One of India\'s deepest stepwells, 3,500 steps.'],
    ['jai-sambhar', 'Sambhar Salt Lake', 'nature', 26.92, 75.19, ['08:00', '18:30'], [], 180, 'evening', 0, 4.3, 'low', { offbeat: true, network: 'Patchy signal around the lake' }, 'India\'s largest inland salt lake; flamingos in winter.'],
  ],
  KERALA: [
    ['ker-chinesenets', 'Chinese fishing nets & Fort Kochi walk', 'heritage', 9.968, 76.242, ALL_DAY, [], 120, 'evening', 0, 4.3, 'high', { highlight: true, kids: true }, 'Giant cantilevered nets at sunset; colonial streets.'],
    ['ker-mattancherry', 'Mattancherry Palace & Jew Town', 'heritage', 9.958, 76.259, ['10:00', '17:00'], [5], 120, 'any', 5, 4.3, 'high', { highlight: true }, 'Dutch Palace murals and the Paradesi Synagogue. Palace closed Fridays.'],
    ['ker-kathakali', 'Kathakali performance', 'culture', 9.965, 76.245, ['17:00', '20:00'], [], 120, 'evening', 400, 4.6, 'medium', { kids: true }, 'Classical dance-drama; come early to watch the make-up.'],
    ['ker-marari', 'Marari beach', 'beach', 9.6, 76.298, ALL_DAY, [], 150, 'afternoon', 0, 4.5, 'low', { offbeat: true }, 'Quiet fishing-village beach between Kochi and Alleppey.'],
    ['ker-kumbalangi', 'Kumbalangi village', 'village', 9.86, 76.29, ['08:00', '17:00'], [], 180, 'morning', 300, 4.5, 'low', { offbeat: true }, 'Model tourism village: crab farms, canoeing, coir making.'],
    ['ker-backwaters', 'Alleppey backwater cruise', 'nature', 9.498, 76.339, ['09:00', '17:00'], [], 240, 'morning', 800, 4.6, 'high', { highlight: true, kids: true }, 'Shikara or houseboat day cruise through the canals.'],
    ['ker-teamuseum', 'Munnar Tea Museum & estates', 'heritage', 10.096, 77.06, ['09:00', '17:00'], [1], 120, 'morning', 150, 4.3, 'high', { kids: true }, 'Tea-making demonstration and estate walks. Closed Mondays.'],
    ['ker-eravikulam', 'Eravikulam National Park', 'nature', 10.18, 77.06, ['07:30', '16:00'], [], 180, 'morning', 200, 4.5, 'high', { highlight: true, kids: true }, 'Nilgiri tahr and rolling grasslands.'],
    ['ker-mattupetty', 'Mattupetty Dam & Echo Point', 'nature', 10.106, 77.123, ['09:30', '17:30'], [], 120, 'afternoon', 50, 4.1, 'high', { kids: true }, 'Lake boating and viewpoints.'],
    ['ker-vattavada', 'Vattavada village', 'village', 10.17, 77.25, ['08:00', '17:00'], [], 240, 'morning', 0, 4.6, 'low', { offbeat: true, road: 'Narrow mountain road', network: 'Weak signal' }, 'Terraced vegetable farms near the Tamil Nadu border.'],
  ],
  DARJEELING: [
    ['dar-tigerhill', 'Tiger Hill sunrise', 'nature', 26.995, 88.287, ['04:00', '07:30'], [], 120, 'morning', 40, 4.4, 'high', { highlight: true }, 'Sunrise over Kanchenjunga. Book a shared jeep the evening before.'],
    ['dar-toytrain', 'Toy train joy ride to Ghum', 'heritage', 27.039, 88.263, ['08:00', '16:00'], [], 120, 'morning', 1500, 4.5, 'high', { highlight: true, kids: true }, 'UNESCO-listed Darjeeling Himalayan Railway loop via Batasia.'],
    ['dar-hmi', 'Himalayan Mountaineering Institute & Zoo', 'museum', 27.058, 88.252, ['08:30', '16:00'], [4], 150, 'any', 100, 4.5, 'high', { kids: true }, 'Everest museum and red pandas. Closed Thursdays.'],
    ['dar-chowrasta', 'Chowrasta & The Mall', 'market', 27.042, 88.266, ['09:00', '20:00'], [], 90, 'evening', 0, 4.3, 'high', { kids: true }, 'Promenade, tea shops and Tibetan stalls.'],
    ['dar-happyvalley', 'Happy Valley Tea Estate', 'nature', 27.054, 88.262, ['08:00', '16:00'], [0, 1], 90, 'morning', 100, 4.2, 'medium', {}, 'Tea factory tour. Closed Sundays and Mondays.'],
    ['dar-peace', 'Japanese Peace Pagoda', 'religious', 27.031, 88.257, ['04:30', '19:00'], [], 60, 'any', 0, 4.5, 'medium', { kids: true }, 'White stupa with valley views.'],
    ['dar-ropeway', 'Darjeeling Ropeway', 'adventure', 27.06, 88.25, ['10:00', '15:30'], [], 75, 'afternoon', 250, 4.0, 'high', { kids: true }, 'Cable car over tea gardens.'],
    ['dar-sittong', 'Sittong orange village', 'village', 26.92, 88.38, ['08:00', '16:00'], [], 240, 'morning', 0, 4.5, 'low', { offbeat: true, road: 'Steep, broken stretches after Mungpoo', network: 'Weak signal' }, 'Orange orchards and Lepcha homestays (oranges Nov–Jan).'],
    ['dar-lamahatta', 'Lamahatta eco park', 'nature', 27.05, 88.43, ['08:00', '17:00'], [], 150, 'morning', 20, 4.4, 'low', { offbeat: true }, 'Pine forest walk with prayer flags and a small lake.'],
    ['dar-tinchuley', 'Tinchuley viewpoint', 'village', 27.08, 88.44, ['05:00', '17:00'], [], 180, 'morning', 0, 4.4, 'low', { offbeat: true, road: 'Last 6 km single lane', network: 'Patchy' }, 'Quiet ridge-top village with Kanchenjunga views.'],
  ],
};

export const MOCK_ATTRACTIONS: Record<string, Attraction[]> = Object.fromEntries(
  Object.entries(ROWS).map(([dest, rows]) => [
    dest,
    rows.map(([id, name, category, lat, lng, [open, close], closedDays, durationMin, bestTime, entryFee, rating, footfall, f, description]): Attraction => ({
      id,
      destination: dest,
      name,
      category,
      lat,
      lng,
      open,
      close,
      closedDays,
      durationMin,
      bestTime,
      entryFee,
      rating,
      footfall,
      isOffbeat: !!f.offbeat,
      isHighlight: !!f.highlight,
      kidFriendly: !!f.kids,
      description,
      ...(f.road || f.network || f.permit
        ? { warnings: { ...(f.road ? { road: f.road } : {}), ...(f.network ? { network: f.network } : {}), ...(f.permit ? { permit: f.permit } : {}) } }
        : {}),
    })),
  ]),
);
