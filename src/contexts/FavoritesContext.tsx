import React, { createContext, useContext, useState, useEffect } from "react";
import { HomeLensListing } from "@/types/ui-blocks";

type FavoriteItem = {
  id: string;
  address: string;
  price: number | null;
  city: string | null;
  state: string | null;
  photoUrl: string | null;
  listingUrl: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  status: string | null;
  source: string;
};

type FavoritesContextValue = {
  favorites: FavoriteItem[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (listing: HomeLensListing) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  // Load favorites from localStorage on mount with validation
  useEffect(() => {
    try {
      const stored = localStorage.getItem("homelens_favorites");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate that parsed data is an array with valid objects
        if (Array.isArray(parsed)) {
          const validFavorites = parsed.filter((item: any) =>
            item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            item.id.length > 0
          );
          setFavorites(validFavorites);
        } else {
          console.warn('Invalid favorites data in localStorage, clearing');
          localStorage.removeItem("homelens_favorites");
        }
      }
    } catch (error) {
      console.error("Failed to load favorites:", error);
      localStorage.removeItem("homelens_favorites");
    }
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("homelens_favorites", JSON.stringify(favorites));
    } catch (error) {
      console.error("Failed to save favorites:", error);
    }
  }, [favorites]);

  const isFavorite = (id: string) => {
    return favorites.some((fav) => fav.id === id);
  };

  const toggleFavorite = (listing: HomeLensListing) => {
    setFavorites((prev) => {
      const exists = prev.some((fav) => fav.id === listing.id);
      
      if (exists) {
        return prev.filter((fav) => fav.id !== listing.id);
      } else {
        const newFavorite: FavoriteItem = {
          id: listing.id,
          address: listing.address,
          price: listing.price,
          city: listing.city || null,
          state: listing.state || null,
          photoUrl: listing.photoUrl || null,
          listingUrl: listing.listingUrl || null,
          beds: listing.beds || null,
          baths: listing.baths || null,
          sqft: listing.sqft || null,
          status: listing.status || null,
          source: listing.source || "unknown",
        };
        return [...prev, newFavorite];
      }
    });
  };

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return context;
}
