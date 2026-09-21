/** DEMO CONTENT — clearly marked, per the Phase 30a locked rule that
 *  visual/demo copy must never be confused with real business facts.
 *  These are editorial strings only. They assert NOTHING factual about
 *  amenities, facilities, availability or pricing — all of which come
 *  exclusively from the backend. Replace with real brand copy at launch. */
export const DEMO_COPY = {
  landingEyebrow: 'International Hospitality Group',
  landingHeadline: 'Stay somewhere exceptional',
  landingSubline:
    'Thoughtfully designed stays, beautifully connected to the cities and landscapes around them.',
  introEyebrow: 'The IHG Experience',
  introHeadline: 'Designed for meaningful stays.',
  introBody: [
    'Every property in our collection is shaped around the same idea: that a stay should feel considered from the moment you arrive.',
    'Rooms are planned for rest as much as for work. Public spaces invite you to linger. Service is attentive without being intrusive.',
  ],
  roomsEyebrow: 'Rooms & Suites',
  roomsHeadline: 'Choose the stay that feels right.',
  storyEyebrow: 'The Experience',
  storyHeadline: 'A closer look.',
  propertiesEyebrow: 'Our Properties',
  propertiesHeadline: 'Where would you like to stay?',
}

/** Maps a media caption keyword to an editorial section label. Only
 *  sections whose media actually exists are ever rendered. */
export const STORY_SECTIONS = [
  { key: 'Lobby', label: 'The Arrival', blurb: 'Where every stay begins.' },
  { key: 'Pool', label: 'The Outdoors', blurb: 'Space to slow down.' },
  { key: 'Exterior', label: 'The Destination', blurb: 'Rooted in its surroundings.' },
]