import {
  ArrowLeft,
  Camera,
  ImagePlus,
  MapPin,
  Trash2,
  Upload,
  X,
  FileText,
  Leaf,
  Recycle,
  Anvil,
  GlassWater,
} from "lucide-react";

export const getCategoryIcon = (categoryName: string) => {
  const name = categoryName.toLowerCase();

  if (name.includes("organic")) return Leaf;
  if (name.includes("plastic")) return Recycle;
  if (name.includes("paper")) return FileText;
  if (name.includes("metal")) return Anvil;
  if (name.includes("glass")) return GlassWater;

  return Trash2;
};
