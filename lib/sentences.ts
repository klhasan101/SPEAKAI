export interface Sentence {
  id: string;
  text: string;
  category: 'daily-conversation' | 'business' | 'travel' | 'news' | 'movies';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export const AMERICAN_PHRASES: Sentence[] = [
  // DAILY CONVERSATION
  // Beginner
  { id: "dc_b1", text: "How is it going?", category: "daily-conversation", difficulty: "beginner" },
  { id: "dc_b2", text: "Have a nice day.", category: "daily-conversation", difficulty: "beginner" },
  { id: "dc_b3", text: "See you later.", category: "daily-conversation", difficulty: "beginner" },
  { id: "dc_b4", text: "Thanks a lot.", category: "daily-conversation", difficulty: "beginner" },
  { id: "dc_b5", text: "What's up?", category: "daily-conversation", difficulty: "beginner" },
  { id: "dc_b6", text: "Take care.", category: "daily-conversation", difficulty: "beginner" },
  { id: "dc_b7", text: "Nice to meet you.", category: "daily-conversation", difficulty: "beginner" },
  { id: "dc_b8", text: "Excuse me.", category: "daily-conversation", difficulty: "beginner" },
  // Intermediate
  { id: "dc_i1", text: "Water under the bridge.", category: "daily-conversation", difficulty: "intermediate" },
  { id: "dc_i2", text: "Let's call it a day.", category: "daily-conversation", difficulty: "intermediate" },
  { id: "dc_i3", text: "Could you pass me the water bottle?", category: "daily-conversation", difficulty: "intermediate" },
  { id: "dc_i4", text: "I'll be there in a couple of minutes.", category: "daily-conversation", difficulty: "intermediate" },
  { id: "dc_i5", text: "Keep me posted on your progress.", category: "daily-conversation", difficulty: "intermediate" },
  { id: "dc_i6", text: "Break a leg tonight!", category: "daily-conversation", difficulty: "intermediate" },
  { id: "dc_i7", text: "Better late than never.", category: "daily-conversation", difficulty: "intermediate" },
  { id: "dc_i8", text: "Take it with a grain of salt.", category: "daily-conversation", difficulty: "intermediate" },
  // Advanced
  { id: "dc_a1", text: "It's not worth crying over spilled milk.", category: "daily-conversation", difficulty: "advanced" },
  { id: "dc_a2", text: "He speaks highly of you behind your back.", category: "daily-conversation", difficulty: "advanced" },
  { id: "dc_a3", text: "Don't beat around the bush; get straight to the point.", category: "daily-conversation", difficulty: "advanced" },
  { id: "dc_a4", text: "She decided to bite the bullet and face the consequences.", category: "daily-conversation", difficulty: "advanced" },
  { id: "dc_a5", text: "We need to play it by ear and adjust our strategy accordingly.", category: "daily-conversation", difficulty: "advanced" },
  { id: "dc_a6", text: "Your guess is as good as mine in this situation.", category: "daily-conversation", difficulty: "advanced" },

  // BUSINESS
  // Beginner
  { id: "biz_b1", text: "Let's start the meeting.", category: "business", difficulty: "beginner" },
  { id: "biz_b2", text: "Send me the report.", category: "business", difficulty: "beginner" },
  { id: "biz_b3", text: "What is the deadline?", category: "business", difficulty: "beginner" },
  { id: "biz_b4", text: "We need to approve this.", category: "business", difficulty: "beginner" },
  { id: "biz_b5", text: "Reply to his email.", category: "business", difficulty: "beginner" },
  { id: "biz_b6", text: "Who is in charge here?", category: "business", difficulty: "beginner" },
  // Intermediate
  { id: "biz_i1", text: "Let's touch base next week.", category: "business", difficulty: "intermediate" },
  { id: "biz_i2", text: "We need to align on the project goals.", category: "business", difficulty: "intermediate" },
  { id: "biz_i3", text: "I'll follow up with the client tomorrow.", category: "business", difficulty: "intermediate" },
  { id: "biz_i4", text: "Could you schedule a calendar invite for the demo?", category: "business", difficulty: "intermediate" },
  { id: "biz_i5", text: "Let's brainstorm some creative marketing ideas.", category: "business", difficulty: "intermediate" },
  { id: "biz_i6", text: "The feedback was positive overall.", category: "business", difficulty: "intermediate" },
  // Advanced
  { id: "biz_a1", text: "We need to leverage our core competencies to gain market share.", category: "business", difficulty: "advanced" },
  { id: "biz_a2", text: "This merger represents a significant synergistic opportunity.", category: "business", difficulty: "advanced" },
  { id: "biz_a3", text: "Please prepare a comprehensive cost-benefit analysis by Friday.", category: "business", difficulty: "advanced" },
  { id: "biz_a4", text: "We must mitigate potential risks before entering negotiations.", category: "business", difficulty: "advanced" },
  { id: "biz_a5", text: "Let's optimize our operational efficiency to maximize ROI.", category: "business", difficulty: "advanced" },
  { id: "biz_a6", text: "He has a proven track record of driving business growth.", category: "business", difficulty: "advanced" },

  // TRAVEL
  // Beginner
  { id: "trv_b1", text: "Where is the airport?", category: "travel", difficulty: "beginner" },
  { id: "trv_b2", text: "I need a taxi.", category: "travel", difficulty: "beginner" },
  { id: "trv_b3", text: "Here is my passport.", category: "travel", difficulty: "beginner" },
  { id: "trv_b4", text: "Can I get a receipt?", category: "travel", difficulty: "beginner" },
  { id: "trv_b5", text: "Where is the hotel?", category: "travel", difficulty: "beginner" },
  { id: "trv_b6", text: "Is this the bus stop?", category: "travel", difficulty: "beginner" },
  // Intermediate
  { id: "trv_i1", text: "Could you tell me how to get to the train station?", category: "travel", difficulty: "intermediate" },
  { id: "trv_i2", text: "I would like to check in for my flight.", category: "travel", difficulty: "intermediate" },
  { id: "trv_i3", text: "Is there a local restaurant you would recommend?", category: "travel", difficulty: "intermediate" },
  { id: "trv_i4", text: "How long does it take to get to the downtown area?", category: "travel", difficulty: "intermediate" },
  { id: "trv_i5", text: "I'd like to book a double room for three nights.", category: "travel", difficulty: "intermediate" },
  { id: "trv_i6", text: "Does the hotel room have a stable internet connection?", category: "travel", difficulty: "intermediate" },
  // Advanced
  { id: "trv_a1", text: "Could you advise me on the customs regulations for imported goods?", category: "travel", difficulty: "advanced" },
  { id: "trv_a2", text: "I've experienced a flight delay and need to reschedule my connection.", category: "travel", difficulty: "advanced" },
  { id: "trv_a3", text: "Our itinerary includes a guided excursion through the historic district.", category: "travel", difficulty: "advanced" },
  { id: "trv_a4", text: "I need to exchange currency at the local financial institution.", category: "travel", difficulty: "advanced" },
  { id: "trv_a5", text: "Is travel insurance mandatory for entering the country?", category: "travel", difficulty: "advanced" },
  { id: "trv_a6", text: "The scenic route offers breathtaking panoramic views of the coastline.", category: "travel", difficulty: "advanced" },

  // NEWS
  // Beginner
  { id: "nws_b1", text: "The weather is hot today.", category: "news", difficulty: "beginner" },
  { id: "nws_b2", text: "Stock prices went up.", category: "news", difficulty: "beginner" },
  { id: "nws_b3", text: "A new law was passed.", category: "news", difficulty: "beginner" },
  { id: "nws_b4", text: "The game starts at eight.", category: "news", difficulty: "beginner" },
  { id: "nws_b5", text: "He won the gold medal.", category: "news", difficulty: "beginner" },
  // Intermediate
  { id: "nws_i1", text: "The government announced new economic policies today.", category: "news", difficulty: "intermediate" },
  { id: "nws_i2", text: "Scientists discovered a potential new clean energy source.", category: "news", difficulty: "intermediate" },
  { id: "nws_i3", text: "The tech company released its highly anticipated device.", category: "news", difficulty: "intermediate" },
  { id: "nws_i4", text: "Voters turned out in large numbers for the local election.", category: "news", difficulty: "intermediate" },
  { id: "nws_i5", text: "The central bank decided to lower interest rates.", category: "news", difficulty: "intermediate" },
  // Advanced
  { id: "nws_a1", text: "Geopolitical tensions have significantly impacted international trade routes.", category: "news", difficulty: "advanced" },
  { id: "nws_a2", text: "The legislative body is debating the fiscal policy adjustments.", category: "news", difficulty: "advanced" },
  { id: "nws_a3", text: "Environmental advocates are urging immediate policy reforms for conservation.", category: "news", difficulty: "advanced" },
  { id: "nws_a4", text: "Fluctuations in the commodity markets triggered economic concerns.", category: "news", difficulty: "advanced" },
  { id: "nws_a5", text: "The archaeological excavation revealed historical artifacts from antiquity.", category: "news", difficulty: "advanced" },

  // MOVIES
  // Beginner
  { id: "mov_b1", text: "May the Force be with you.", category: "movies", difficulty: "beginner" },
  { id: "mov_b2", text: "There's no place like home.", category: "movies", difficulty: "beginner" },
  { id: "mov_b3", text: "I'll be back.", category: "movies", difficulty: "beginner" },
  { id: "mov_b4", text: "Houston, we have a problem.", category: "movies", difficulty: "beginner" },
  { id: "mov_b5", text: "You're gonna need a bigger boat.", category: "movies", difficulty: "beginner" },
  // Intermediate
  { id: "mov_i1", text: "Frankly, my dear, I don't give a damn.", category: "movies", difficulty: "intermediate" },
  { id: "mov_i2", text: "Keep your friends close, but your enemies closer.", category: "movies", difficulty: "intermediate" },
  { id: "mov_i3", text: "You talking to me?", category: "movies", difficulty: "intermediate" },
  { id: "mov_i4", text: "Show me the money!", category: "movies", difficulty: "intermediate" },
  { id: "mov_i5", text: "You can't handle the truth!", category: "movies", difficulty: "intermediate" },
  // Advanced
  { id: "mov_a1", text: "Of all the gin joints in all the towns in all the world, she walks into mine.", category: "movies", difficulty: "advanced" },
  { id: "mov_a2", text: "Fasten your seatbelts. It's going to be a bumpy night.", category: "movies", difficulty: "advanced" },
  { id: "mov_a3", text: "Gentlemen, you can't fight in here! This is the War Room!", category: "movies", difficulty: "advanced" },
  { id: "mov_a4", text: "I love the smell of napalm in the morning.", category: "movies", difficulty: "advanced" },
  { id: "mov_a5", text: "The stuff that dreams are made of.", category: "movies", difficulty: "advanced" }
];
