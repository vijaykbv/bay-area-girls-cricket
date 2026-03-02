import { createServerClient } from "@/lib/supabase";
import type { Metadata } from "next";
import { Image as ImageIcon } from "lucide-react";

export const metadata: Metadata = { title: "Gallery" };
export const revalidate = 3600;

interface GalleryItem {
  id: string;
  title?: string;
  image_url: string;
}

async function getGallery(): Promise<GalleryItem[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("gallery")
      .select("id, title, image_url")
      .order("created_at", { ascending: false });
    return (data as GalleryItem[]) ?? [];
  } catch {
    return [];
  }
}

export default async function GalleryPage() {
  const items = await getGallery();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="section-title text-3xl">Gallery</h1>
      <p className="text-gray-500 mb-8">Photos from matches, training, and events.</p>

      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ImageIcon size={48} className="mx-auto mb-3 opacity-30" />
          <p>No photos yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="relative group overflow-hidden rounded-xl aspect-square">
              <img
                src={item.image_url}
                alt={item.title ?? "Gallery photo"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {item.title && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-white text-xs font-medium">{item.title}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
