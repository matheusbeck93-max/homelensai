// Canadian provinces with major cities for the Open House Finder.

export interface CaProvince {
  code: string;
  name: string;
  cities: string[];
}

export const CA_PROVINCES: CaProvince[] = [
  { code: 'AB', name: 'Alberta', cities: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'Medicine Hat'] },
  { code: 'BC', name: 'British Columbia', cities: ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond', 'Kelowna', 'Abbotsford'] },
  { code: 'MB', name: 'Manitoba', cities: ['Winnipeg', 'Brandon'] },
  { code: 'NB', name: 'New Brunswick', cities: ['Moncton', 'Saint John', 'Fredericton'] },
  { code: 'NL', name: 'Newfoundland and Labrador', cities: ["St. John's", 'Mount Pearl'] },
  { code: 'NS', name: 'Nova Scotia', cities: ['Halifax', 'Sydney', 'Dartmouth'] },
  { code: 'ON', name: 'Ontario', cities: ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor', 'Burlington', 'Oakville'] },
  { code: 'PE', name: 'Prince Edward Island', cities: ['Charlottetown'] },
  { code: 'QC', name: 'Quebec', cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke'] },
  { code: 'SK', name: 'Saskatchewan', cities: ['Saskatoon', 'Regina'] },
];
