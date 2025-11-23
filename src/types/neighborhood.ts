export interface School {
  name: string;
  type: string;
  rating: number;
  distance: number;
  grades: string;
}

export interface Amenity {
  name: string;
  type: string;
  distance: number;
  rating?: number;
}

export interface NeighborhoodInsights {
  schools: School[];
  walkScore: {
    score: number;
    description: string;
    transitScore?: number;
    bikeScore?: number;
  };
  crimeData: {
    overallRating: string;
    crimeRate: number;
    comparison: string;
    categories: {
      violent: number;
      property: number;
      other: number;
    };
  };
  amenities: {
    restaurants: Amenity[];
    parks: Amenity[];
    shopping: Amenity[];
    transit: Amenity[];
  };
  demographics: {
    population: number;
    medianIncome: number;
    medianAge: number;
    homeownershipRate: number;
  };
}
