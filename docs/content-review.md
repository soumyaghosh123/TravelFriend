# Data review list

What in TripSaver is real, what is sourced but needs confirming, and what is still sample data.
Last updated 2026-11-09. Tick items off as they are checked; change `fareSource` / `lastVerifiedOn`
in the data when you do.

## Real data

| What | Source | Notes |
|---|---|---|
| Monthly weather (max/min, rain, rainy days) | [Open-Meteo](https://open-meteo.com/) historical archive, 2021–2025 average | Free tier is non-commercial only: buy the paid plan before a commercial launch. One point per destination, so regions use one spot (Kerala = Kochi, not Munnar). Mountain grid cells can overstate rain: Manali shows ~170 mm in December, which looks high; compare with IMD normals. |

## Sourced, but confirm against the official notice

| Fare | What we use | Source | Check with |
|---|---|---|---|
| HRTC ordinary bus, hills | ₹2.50/km, minimum ₹10 | [News report of the May 2025 notification](https://www.theweek.in/wire-updates/national/2025/05/08/des52-hp-bus-fare-hike.html) | HP Transport Department notification |
| Kochi Water Metro | ₹20–40 (High Court ↔ Fort Kochi ₹40) | [Launch report, Apr 2024](https://www.onmanorama.com/travel/travel-news/2024/04/21/water-metro-starts-service-fort-kochi.html) | kochimetro.org fare page |
| Jaipur Metro | ₹10–30 by stations | [Third-party fare chart](https://yometro.com/jaipur-metro-fare) | Jaipur Metro Rail Corporation |
| Goa Kadamba bus | ₹10 for 4 km, then ₹5 per 5 km | [2019 notification, as reported](https://www.thegoan.net/goa-news/bus-fare-hike-notified-by-govt/48198.html) | Likely outdated; KTCL citizen charter / Goa Gazette |

## Still sample data (shown as "Sample fare" / "Sample content")

- **Local fares:**
  - Goa: GoaMiles, prepaid taxi, tourist taxi, taxi for the day, scooter rental, Divar ferry, Dudhsagar jeep. Goa taxi reports conflict (₹24–49/km): use the current Goa Gazette notification.
  - Manali: prepaid taxi, Taxi Union cab (rate card at the stand), taxi for the day, motorbike rental.
  - Jaipur: Uber/Ola, prepaid taxi, auto, JCTSL bus, taxi for the day.
  - Kerala: Uber/Ola, prepaid taxi, auto, KSRTC bus, taxi for the day.
  - Darjeeling: shared jeep, reserved jeep, prepaid taxi, taxi for the day.
- **Trains, buses, flights, hotels:** all prices are mock until partner access is approved (Agoda Partners first).
- **Monthly price index** (which months are cheap or peak): sample until we have real price history.
- **Destination guides** (`packages/providers/src/mock/data/content.ts`, `lastVerifiedOn` 2026-11-02, not yet checked by a person):
  - Restaurants are generic "(sample)" places: replace with real listings from a licensed places source.
  - Markets, emporiums, cooperatives, GI outlets: check names, opening days and hours, and price ranges.
  - Hospitals and police stations: check names and coordinates.
  - Do's & don'ts, permits, plastic bans, network and ATM notes: check each line.
- **Sights** (`attractions.ts`): hours, closed days and entry fees are approximate. Official ticket links exist only for Amer Fort (Rajasthan OBMS) and the Darjeeling toy train (IRCTC).

## Added 2026-11-09: 20 more destinations (sample data)

Delhi, Mumbai, Kolkata, Bengaluru, Chennai, Hyderabad, Agra, Varanasi, Udaipur, Rishikesh, Shimla, Ooty, Mysuru, Hampi, Leh–Ladakh, Andaman Islands, Amritsar, Puducherry, Gangtok, Coorg (`packages/providers/src/mock/data/destinations-more.ts`).

- **Real, check the details:** stations, airports, arrival points, base areas and sights. Opening hours, closed days and fees are approximate; check each sight (ASI / state tourism sites).
- **Generic samples, to replace per destination:** local transport (a city, hills or island set), price seasons (by profile), holidays (national plus a generic peak season).
- **Not written yet:** food, shopping and do's & don'ts guides. Those tabs say so for these destinations.
- **Hotels, trains, buses, flights:** generated sample data, like the first five.
