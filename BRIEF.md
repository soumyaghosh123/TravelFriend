Smart Travel Planner Website – Detailed Build Prompt
Nov 8, 2026 · @Soumya
Paste everything below the line into Claude Code as the opening brief for the project. Section 13 tells Claude Code how to work through it. Names in square brackets are placeholders you can change.
1. Role and goal
You are a senior full-stack engineer and travel-tech product designer. Build a responsive website called [TripSaver] that turns a few simple inputs into a complete, budget-optimised trip: the cheapest suitable hotels, transport to and from the destination (train, bus, flight), local transport, sightseeing, local food, shopping, and do's and don'ts — all organised into a day-by-day plan with clear "where to book this cheapest" links.
Primary market: Indian travellers (prices in INR, Indian Railways, Indian bus operators, domestic flights), designed so international destinations can be added later.
2. User inputs (search form)
The home page has ONE short search form. Only six inputs are required; everything else is optional and hidden under "More preferences". From these six inputs the site must produce the complete plan and the cheapest place to book every part of it, on one results page (everything under one roof).
1. From – origin city (autocomplete of cities, railway stations, airports and bus points).
2. To – destination city or region (e.g., Goa, Manali, Kerala).
3. Number of days – e.g., 10.
4. Month of travel – e.g., December 2026. The user does NOT pick exact dates; the site finds the cheapest dates inside that month.
5. Hotel type – Budget, 3-star, 4-star, 5-star, Homestay / Villa, Resort, Hostel (multi-select). By default always show both a 3-star-and-above plan and a 5-star plan.
6. Head count – adults, children (with ages) and rooms (auto-suggested, e.g., 2 adults per room, editable). Every price is shown per person AND for the whole group.
7. Optional (More preferences) – nearest landmark to stay near, total budget, preferred travel mode (train / bus / flight / any), AC / non-AC, sleeper vs seater, food preference (veg / non-veg / Jain), travelling with kids or seniors, interests (beaches, temples, adventure, nightlife, shopping, nature).
2.1 When is it cheapest to travel? (must-have)
Because the user gives a month and a number of days instead of exact dates, the site must work out the cheapest dates itself:
• Try every possible start date in the chosen month (for 10 days in December: start on 1 Dec, 2 Dec … up to the last start date that still fits a 10-day trip).
• For each start date, calculate the total trip cost for the whole group: onward + return transport (cheapest of train / bus / flight) + hotel for all nights + estimated local transport, sightseeing and food.
• Show a price calendar of the month, colour-coded green (cheapest) to red (most expensive), with the 3 cheapest date windows listed on top, e.g., "5–14 Dec: ₹38,400 for 2 people – save ₹9,200 compared with 20–29 Dec".
• Explain why some dates cost more: weekends, festivals and public holidays (Diwali, Christmas, New Year, long weekends), school holidays, peak / off-season, and local events.
• Also show a month-by-month comparison for the destination (cheap / normal / peak, plus weather), so the user can see if another month would be much cheaper, e.g., "Going in mid-January saves about 25% and the weather is still good".
• Show booking-time advice: how far ahead train tickets open (IRCTC advance reservation period), when Tatkal opens, and how far ahead flights and hotels are usually cheapest.
• Offer a price alert: "Tell me when this trip drops below ₹X".
2.2 One results page – everything under one roof
After search, show a single results page. At the top: a sticky summary bar with the cheapest dates, head count, and three plan cards side by side – Offbeat, Budget and Comfort (see 2.3), each with its total cost for the group. Selecting a card fills every tab below with that plan. All tabs use the cheapest dates by default and update live when the user picks other dates or another plan:
1. Best dates & price calendar
2. Day-by-day plan
3. Getting there and back (train, bus, flight)
4. Hotels (3-star+ list and 5-star list)
5. Local transport & cabs
6. Sightseeing & activities
7. Local food
8. Shopping
9. Do's & don'ts
10. Total cost & cheapest place to book each item
The Book everything checklist lists every item to book for the selected plan (onward ticket, each hotel, activities, return ticket) with the cheapest site, price for the whole group, and a booking link, plus a tick box so the user can track what they have already booked.
2.3 Three travel styles for every trip (must-have)
Every search generates three complete plans for the same From, To, days, month and head count. The user can compare them side by side and switch between them. Each plan has its own itinerary, hotels, transport and total cost.
A. Offbeat travel
• Find lesser-known places within a reasonable distance of the destination (e.g., for Goa: Divar Island, Netravali, Cabo de Rama; for Manali: Jibhi, Tirthan Valley, Sethan). Use low tourist footfall, good ratings and distance from the main hub to choose them.
• Hotels: homestays, eco-stays, boutique properties, camps and small local guesthouses near those offbeat places, with best rates and per-site price comparison.
• Travel plan: a route that mixes 1–2 main highlights with the offbeat spots, local experiences (village walks, treks, local festivals, farm stays) and how to reach each place (shared jeep, local bus, hired cab where no public transport exists).
• Show road condition, network coverage and permit warnings for remote places.
• If no good offbeat places exist nearby, say so and suggest the nearest alternative instead of forcing a plan.
B. Budget travel
• Hotels: normal, well-rated budget hotels, guesthouses and hostels at the best available rate (minimum guest rating threshold, e.g., 3.5/5, to avoid bad properties).
• Getting there: the cheapest of train (sleeper / 3A), bus (non-AC / AC seater or sleeper) or flight.
• Between places: public transport first – local buses, state transport buses, metro, local trains, shared autos, shared jeeps, ferries – with timings, fare and where to board. Cabs only where no public option exists.
• Food: street food and budget local eateries with cost for two.
• Sightseeing: free and low-cost attractions first; group sights to save on transport.
C. Comfort travel
• Hotels: two lists for every stop – 3-star and above and 5-star – with best rates and per-site price comparison.
• Getting there: flight or AC train (2A / 1A / 3A) or premium AC bus, whichever is most comfortable for the budget and time.
• Between places: cab services for every leg (airport/station pickup, hotel to sights, city to city) – app cabs, outstation cab services, or private driver for the day – with fare estimate and booking link.
• Food: good, well-reviewed restaurants (including the hotel's own restaurant) with average cost for two, ratings and reservation links where available.
• Sightseeing: fewer stops per day, guided tours and skip-the-line tickets where available.
For each plan show: total cost for the group, cost per person, and the cost split (transport, hotels, local transport, food, sightseeing, buffer). The hotel-type input acts as a filter inside each plan.
2.4 Head-count and child pricing rules
Approx travel cost must be calculated from the head count using these default age rules for train, bus and hotel:
• Below 4 years: free (no seat / berth, sharing the bed with parents).
• 4 to 7 years: half price.
• Above 7 years: full price (counted as an adult).
Implementation notes:
• Ask for each child's age in the search form, then show a cost breakdown per traveller type (adults, children at half price, infants free).
• Store these age bands in one admin-editable config, per mode (train, bus, flight, hotel) and per provider. Real rules differ by provider and change over time – for example, Indian Railways, airlines (infant fares) and each hotel's child policy all use their own age bands – so when a provider returns its own child fare or child policy, use the provider's real price and label the default rule as an estimate.
• Flights: apply the airline's infant / child fares from the API rather than the default rule.
• Rooms: suggest the number of rooms from the head count (e.g., 2 adults + up to 2 children under 7 per room), and add the extra-bed charge when a hotel requires one.
• Show the final figure as "Approx. total for 2 adults + 2 children" with a note that the exact price is confirmed on the booking site.
3. Core features
3.1 Cheapest hotel finder
• For the date range (and flexible window), fetch prices from multiple hotel sources and show the cheapest total price for the stay, including taxes and fees.
• Filters: star rating, price, distance from landmark, guest rating, free cancellation, breakfast included, couple-friendly, pool, parking.
• Sort: Cheapest, Nearest to landmark, Best value (price ÷ rating score), Highest rated.
• Always show two comparison lists side by side: minimum 3-star properties and 5-star properties, so the user sees the budget option and the luxury option for every leg of the trip.
• Each hotel card shows: photo, name, star rating, guest rating and review count, distance from the chosen landmark, per-night and total price, price from each booking site (e.g., Booking.com, Agoda, MakeMyTrip, Goibibo, Expedia/Hotels.com, the hotel's own website), the cheapest one highlighted, and a "Book on [site]" button that deep-links with dates and guests pre-filled.
• Show the hotel's restaurant / food price range where available (e.g., average cost for two, breakfast price).
• Price-history hint: "Prices for these dates are lower / higher than usual" and an optional price-drop alert by email.
3.2 Getting there and back (train, bus, flight)
For origin → destination and the return journey, show all three modes in tabs with fares and durations, and a summary card: "Cheapest", "Fastest", "Best overnight option".
• Train (IRCTC): train list between stations, departure/arrival, duration, classes (SL, 3A, 2A, 1A, CC, EC), fare per class, seat availability / waitlist status, and a confirmation-chance indicator. Booking: redirect to IRCTC or to an IRCTC-authorised partner. Also show Tatkal opening time and the advance reservation window.
• Bus (redBus): operator, bus type (AC sleeper, Volvo, seater), boarding and dropping points, duration, fare, rating, and seats left. Include state transport buses (KSRTC, MSRTC, APSRTC, etc.) where available. Booking: through redBus partner integration or affiliate deep link.
• Flight: airline, stops, duration, baggage, fare; cheapest-day calendar for flexible dates; nearest alternative airports. Booking: deep link to airline or OTA.
• Multi-modal suggestions: e.g., "Flight to Bagdogra + cab to Darjeeling" or "Train to Kalka + toy train to Shimla", with total time and total cost.
• Show total transport cost for all travellers, both ways.
3.3 Local transport and cabs
For every travel leg inside the trip (station/airport → hotel, hotel → sightseeing, city → city), show:
• Options: app cabs (Uber, Ola, Rapido), prepaid airport/railway taxis, local taxi unions, auto-rickshaws, self-drive car rental (e.g., Zoomcar), scooter/bike rental, metro, local buses, ferries, shared jeeps, toy trains, ropeways.
• Estimated fare range and travel time for each option, with the cheapest and most convenient marked.
• Where to book: app deep link, official counter location, or phone number of the government / tourism-department service.
• Tips such as "Fix the fare before boarding an auto" or "App cabs are not allowed at this airport; use the prepaid counter".
3.4 Sightseeing and activities
• List nearby sights grouped by distance from the hotel/landmark: must-see, nature, religious, adventure, museums, nightlife, kid-friendly.
• For each: description, photos, timings, closed days, entry fee, time needed, best time of day, distance and travel time, rating and reviews, and an official ticket booking link where one exists.
• Bookable activities (tours, water sports, treks) with price comparison across activity providers.
3.5 Day-by-day itinerary generator (e.g., 10-day plan)
Given the trip length, split the holiday into a realistic plan:
• Day 1 = arrival + check-in + nearby light sightseeing; last day = checkout + return travel.
• If the destination is a region (e.g., "Himachal", "Kerala"), split nights across bases (e.g., 3 nights Manali, 2 nights Kasol, 3 nights Shimla) based on distances, and plan inter-city transfers between them.
• Group sights by geography to minimise travel time; respect opening hours and closed days; keep a maximum of 8–9 active hours per day; add rest/buffer time and a flexible "free day" for trips longer than 7 days.
• For each day show: morning / afternoon / evening plan, transport between stops with cost, meal suggestions nearby, hotel for the night (3-star option and 5-star option), and the day's estimated spend.
• Let the user drag-and-drop to reorder, swap or remove activities, and re-optimise.
• Export the plan to PDF, share by link / WhatsApp, and add to Google Calendar.
3.6 Local food
• Famous local dishes to try, with a short description, veg/non-veg tag and typical price.
• Recommended restaurants and street-food spots for each dish: average cost for two, rating, review count, distance from hotel, opening hours.
• Food at the user's hotel: in-house restaurant, menu price range, whether breakfast is included.
3.7 Shopping
• Best markets and shops for the destination, with what to buy there (e.g., handicrafts, spices, textiles), typical price ranges, and whether bargaining is expected.
• For each shop/market: rating, reviews, timings, closed days, distance, and tags such as "Government emporium – fixed fair price" or "Bargain hard – start at 40–50%".
• Highlight shops known for genuine products and fair prices (government emporiums, cooperative stores, GI-tagged product outlets) and warn about common tourist traps.
3.8 Do's and don'ts
For each destination, show a concise checklist covering: local customs and dress code (especially at religious places), safety, scams to avoid, permits needed (e.g., Inner Line Permit, Rohtang permit), photography restrictions, weather and what to pack, plastic bans, alcohol rules, emergency numbers, nearest hospitals and police stations, and network/ATM availability.
3.9 Total trip cost summary
One summary panel showing, for each of the three plans (Offbeat, Budget, Comfort – and for Comfort, both the 3-star+ and 5-star versions):
• Transport to/from destination, hotels (all nights), local transport, sightseeing tickets and activities, estimated food, shopping buffer, and grand total per person and for the group.
• "Cheapest way to book" table: each item → the site with the lowest price → direct booking link.
4. Data sources and integrations
Implement every integration behind a provider interface (adapter pattern), so a provider can be swapped without changing the UI. Start with deep links / affiliate links where API access is not yet approved, and upgrade to full APIs later.
• IRCTC (trains): IRCTC does not offer an open public booking API. Train ticket booking by third parties requires becoming an IRCTC-authorised partner (licence + integration fee), or partnering with an existing authorised agent/aggregator. Phase 1: show train schedules, fares and availability from a licensed rail-data provider, and deep-link to IRCTC or an authorised partner for booking. Phase 2: apply for IRCTC authorisation.
• redBus (buses): redBus offers API access (SeatSeller) to approved partners through an application process. Phase 1: affiliate deep links. Phase 2: full API (search, seat layout, block, book, cancel). Add state transport (RTC) APIs where available.
• Flights: use a flight-search API or B2B consolidator (evaluate options such as Amadeus Enterprise, TBO, TripJack, or a metasearch affiliate programme). Note: Amadeus's free Self-Service API portal was shut down on 17 July 2026, so do not build on it.
• Hotels: affiliate / partner APIs from Booking.com, Agoda, Expedia (Rapid API), MakeMyTrip/Goibibo and similar, plus a hotel price-comparison feed. Cache prices and refresh frequently.
• Places, sightseeing, restaurants, shops, reviews: Google Maps Platform (Places, Routes, Distance Matrix) or OpenStreetMap + Foursquare. Display ratings with proper attribution.
• Cabs: Uber / Ola / Rapido deep links with pickup and drop pre-filled; fare estimates from their APIs where access is granted, otherwise distance-based estimates clearly labelled "approx.".
• Weather: a weather API for forecast on the travel dates.
• Destination content (food, shopping, do's & don'ts): curated database maintained by an admin, with AI-assisted drafting and human review, plus a "last verified on" date.
All API keys live server-side in environment variables. Respect each provider's terms, rate limits and branding rules. Never scrape sites whose terms forbid it.
5. Pages / screens
1. Home – search form, popular destinations, seasonal deals.
2. Results / trip overview – tabs: Plan, Hotels, Getting there, Local transport, Sightseeing, Food, Shopping, Do's & Don'ts, Cost summary.
3. Hotel detail – photos, amenities, map, price comparison across sites, reviews, food prices.
4. Transport detail – train/bus/flight lists with filters and fare calendar.
5. Day-by-day itinerary – timeline + map view, editable.
6. Destination guide – food, shopping, do's & don'ts.
7. User account – saved trips, price alerts, past searches.
8. Admin panel – manage destination content, providers, commissions, and featured listings.
6. Logic and algorithms
• Cheapest hotel: for each property, compute total stay price (all nights + taxes + fees) per provider; pick the lowest; for flexible dates, evaluate each valid check-in date in the window and return the cheapest combination.
• Best value score: combine price, rating, review count and distance to landmark with adjustable weights.
• Itinerary split: cluster sights by location (e.g., k-means or grid by distance), allocate clusters to days by available hours, then order stops within a day using a nearest-neighbour route that respects opening hours.
• Multi-city split for long trips: choose bases so total inter-city travel time is small and each base has at least 2 nights.
• Price freshness: show "price checked X minutes ago"; re-check live price before redirecting to booking.
7. Technical requirements
• Suggested stack: Next.js (React) + TypeScript + Tailwind CSS frontend; Node.js (NestJS) or Python (FastAPI) backend; PostgreSQL; Redis for caching prices; a job queue for background price refresh; Google Maps or Mapbox for maps. Deployed on Vercel / AWS.
• Mobile-first, fast (target under 3 seconds for first results; stream results as providers respond).
• Multi-language ready (English, Hindi, Bengali first); INR by default with currency switch.
• Authentication: email / Google / mobile OTP.
• SEO-friendly destination pages.
• Analytics on searches and booking clicks; affiliate click tracking for revenue.
• Security: HTTPS, input validation, rate limiting, no storage of card data (payments happen on partner sites unless a payment gateway such as Razorpay is integrated in a later phase).
8. Data model (minimum)
User, Trip (inputs + generated plan), TripDay, ItineraryItem, Destination, Landmark, Hotel, HotelPrice (provider, dates, price, fetched_at), TransportOption (mode, provider, route, fare, times), LocalTransportOption, Attraction, Restaurant, Dish, Shop, DosAndDonts, PriceAlert, Provider.
9. Legal and trust
• Clearly state that the site is a comparison and planning service and that bookings are completed with the partner, unless and until direct booking licences are obtained.
• Show affiliate disclosure, privacy policy (compliant with India's DPDP Act), and terms of use.
• Prices and availability can change; always confirm on the partner site.
10. Build phases
1. MVP: search form, hotel price comparison with deep links, train/bus/flight search with deep links, sightseeing list, auto-generated day-by-day plan, food/shopping/do's & don'ts for 10 popular destinations, cost summary, PDF export.
2. Phase 2: user accounts, price alerts, editable itinerary, cab fare estimates, more destinations.
3. Phase 3: direct booking via redBus partner API and IRCTC-authorised integration, flight booking via consolidator, in-site payments, mobile app.
11. Acceptance criteria
• Entering From, To, number of days, month, hotel type and head count returns, within a few seconds: the 3 cheapest date windows in that month with a price calendar; three complete plans (Offbeat, Budget, Comfort), each with a day-by-day plan matching the trip length, hotels, train / bus / flight options both ways with fares, local transport, sightseeing, food, shopping, do's and don'ts, and a total cost for the group.
• Group cost follows the head-count rules in 2.4 (under 4 free, 4–7 half price, above 7 full price) unless the provider returns its own child price.
• Every price shows its source site and a working booking link with dates and travellers pre-filled.
• A 10-day trip produces 10 distinct days with no day exceeding 9 active hours and no attraction scheduled on its closed day.
12. Example request to test with
Input: From Kolkata, To Goa, 10 days, December 2026, hotel type any, head count 2 adults + 2 children (ages 3 and 6). Expected: price calendar for December with the 3 cheapest 10-day windows and a warning that Christmas–New Year is peak; three plan cards – Offbeat (e.g., Divar Island, Netravali, Cabo de Rama with homestays), Budget (budget hotels, sleeper/3A train or bus, local buses and shared transport between places) and Comfort (3-star+ and 5-star hotels, flight or AC train, cabs between places, good restaurants); cost worked out as 2 adults full price + the 6-year-old at half price + the 3-year-old free (provider prices used where available); Goan food, Mapusa and Anjuna market tips, Goa do's and don'ts; and the cheapest site to book each item in each plan.
13. How to work on this in Claude Code
1. Plan first, code second. Read this whole brief, then write docs/PLAN.md with the architecture, folder structure, data model, the provider list and the build order. Wait for my approval before writing code.
2. Create CLAUDE.md at the project root with a short summary of this brief, the tech stack, coding conventions, how to run, test and lint, and the rule that every price must show its source and a booking link.
3. Mock providers first. Real API access (IRCTC partner, redBus SeatSeller, flight and hotel APIs) takes time to get approved. Build every provider as an interface with a mock implementation that returns realistic sample data for 5 destinations (Goa, Manali, Jaipur, Kerala, Darjeeling). The whole site must work end-to-end on mock data, so real providers can be plugged in later without UI changes.
4. Build in small steps, one feature per step, in this order: search form → cheapest-dates engine + price calendar → transport results → hotel comparison → itinerary generator → local transport → sightseeing / food / shopping / do's & don'ts → total cost + Book everything checklist → PDF export and sharing → accounts and price alerts.
5. Test as you go. Write unit tests for the cheapest-dates engine, cost totals (per person and group) and itinerary rules (no day over 9 active hours, no attraction on its closed day, first and last days kept light). Run the tests and the dev server after each step and fix errors before moving on.
6. Keep secrets safe. Put all API keys in .env (with a committed .env.example), never in code.
7. Commit after each working step with a clear message, and keep a short CHANGELOG.md.
8. Ask me whenever a provider, licence or cost decision is needed instead of guessing.
Start now with step 1: read the brief and propose docs/PLAN.md.