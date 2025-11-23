import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FavoriteButtonProps {
  propertyId: string;
  userId: string | undefined;
  variant?: "default" | "icon";
  position?: "absolute" | "relative";
}

export function FavoriteButton({ propertyId, userId, variant = "default", position = "absolute" }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      checkFavorite();
    }
  }, [userId, propertyId]);

  const checkFavorite = async () => {
    if (!userId) return;
    
    const { data } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .single();

    setIsFavorite(!!data);
  };

  const toggleFavorite = async () => {
    if (!userId) {
      toast({
        title: "Login necessário",
        description: "Você precisa estar logado para favoritar imóveis",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("property_id", propertyId);

        if (error) throw error;

        setIsFavorite(false);
        toast({
          title: "Removido dos favoritos",
        });
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: userId, property_id: propertyId });

        if (error) throw error;

        setIsFavorite(true);
        toast({
          title: "Adicionado aos favoritos",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (variant === "icon") {
    const positionClass = position === "absolute" ? "absolute top-4 right-4" : "";
    
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleFavorite}
        disabled={loading || !userId}
        className={`${positionClass} ${position === "absolute" ? "bg-background/80 backdrop-blur-sm hover:bg-background" : ""} h-8 w-8 p-0`}
      >
        <Heart
          className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
        />
      </Button>
    );
  }

  return (
    <Button
      variant={isFavorite ? "default" : "outline"}
      onClick={toggleFavorite}
      disabled={loading || !userId}
      className="flex items-center gap-2"
    >
      <Heart
        className={`h-5 w-5 ${isFavorite ? "fill-white" : ""}`}
      />
      {isFavorite ? "Favoritado" : "Favoritar"}
    </Button>
  );
}
